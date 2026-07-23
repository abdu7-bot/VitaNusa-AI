import os
import uuid
from hmac import compare_digest

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .audit_log import log_ask_event
from .client_identity import resolve_feedback_client
from .conversation_memory import CONVERSATION_MEMORY, build_history_context
from .feedback import (
    FEEDBACK_RATE_LIMITER,
    FeedbackReceipt,
    FeedbackRequest,
    feedback_rate_limit_window_seconds,
    list_pending_feedback,
    record_feedback,
)
from .intent_router import detect_intent, normalize_text
from .knowledge_base import build_knowledge_context
from .llm.config import LocalLlmConfig
from .llm.guard import (
    build_blocked_router_response,
    build_guard_context,
    evaluate_llm_guard,
)
from .llm.models import LlmRequest, LlmRouterResponse
from .llm.prompts import build_system_prompt
from .llm.router import LocalLlmRouter
from .policy_engine import POLICY_ENGINE, serialize_policy_decision
from .privacy import install_sensitive_access_log_filter
from .responses import DISCLAIMER, build_actions, build_answer, build_quranic_reflection
from .schemas import AskRequest, AskResponse, LlmPreviewRequest, SearchPreviewRequest
from .search.config import WebSearchConfig
from .search.guard import (
    build_blocked_search_response,
    build_search_guard_context,
    evaluate_search_guard,
)
from .search.models import SearchQuery, SearchRouterResponse
from .search.normalizer import clean_whitespace
from .search.router import SearchRouter

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://abdu7-bot.github.io",
]

install_sensitive_access_log_filter()


def get_allowed_origins() -> list[str]:
    raw_origins = os.getenv("VITANUSA_ALLOWED_ORIGINS", "")
    if not raw_origins.strip():
        return DEFAULT_ALLOWED_ORIGINS

    return [
        origin.strip()
        for origin in raw_origins.split(",")
        if origin.strip()
    ]


app = FastAPI(
    title="VitaNusa AI Brain",
    description="Backend otak dasar VitaNusa AI",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "status": "ok",
        "message": "VitaNusa AI Brain aktif",
        "service": "vitanusa-ai-backend",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/llm/preview", response_model=LlmRouterResponse)
async def llm_preview(request: LlmPreviewRequest) -> LlmRouterResponse:
    config = LocalLlmConfig.from_env()
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    if app_env == "production" or not config.preview_enabled:
        raise HTTPException(status_code=404, detail="Endpoint tidak tersedia.")

    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong.")

    intent_result = detect_intent(message)
    intent = intent_result["intent"]
    safety_level = intent_result["safetyLevel"]
    decision = POLICY_ENGINE.evaluate_question(
        message,
        intent=intent,
        safety_level=safety_level,
    )
    guard_context = build_guard_context(
        decision,
        intent=intent,
        safety_level=safety_level,
    )
    llm_request = LlmRequest(
        system_prompt=build_system_prompt(guard_context),
        user_message=message,
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        intent=intent,
        safety_level=safety_level,
    )
    guard = evaluate_llm_guard(guard_context, llm_request)
    selected_strategy = request.strategy or config.strategy
    selected_provider = (
        request.provider.strip().lower() if request.provider else None
    )

    if not guard.allowed:
        return build_blocked_router_response(
            mode=config.mode,
            strategy=selected_strategy,
            provider=selected_provider or config.provider or "local-llm",
            reason=guard.reason or "llm_guard_blocked",
        )

    router = LocalLlmRouter(config)
    return await router.route(
        llm_request,
        provider=selected_provider,
        strategy=selected_strategy,
        guard_context=guard_context,
    )


@app.post("/search/preview", response_model=SearchRouterResponse)
async def search_preview(request: SearchPreviewRequest) -> SearchRouterResponse:
    config = WebSearchConfig.from_env()
    if not config.preview_available:
        raise HTTPException(status_code=404, detail="Endpoint tidak tersedia.")

    query_text = clean_whitespace(request.query)
    if len(query_text) < 2:
        raise HTTPException(
            status_code=400,
            detail="Query harus berisi minimal dua karakter.",
        )

    intent_result = detect_intent(query_text)
    intent = intent_result["intent"]
    safety_level = intent_result["safetyLevel"]
    decision = POLICY_ENGINE.evaluate_question(
        query_text,
        intent=intent,
        safety_level=safety_level,
    )
    guard_context = build_search_guard_context(
        decision,
        intent=intent,
        safety_level=safety_level,
        query=query_text,
    )
    selected_strategy = request.strategy or config.strategy
    guard = evaluate_search_guard(
        guard_context,
        requested_category=request.category,
        providers=config.providers,
        strategy=selected_strategy,
    )

    if not guard.allowed:
        return build_blocked_search_response(
            mode=config.mode,
            strategy=guard.strategy,
            query=query_text,
            reason=guard.reason,
        )

    search_query = SearchQuery(
        query=query_text,
        language=config.language,
        country=config.country,
        category=guard.category,
        max_results=request.maxResults,
        safe_search=config.safe_search,
    )
    router = SearchRouter(config)
    return await router.route(
        search_query,
        provider=request.provider,
        providers=guard.providers,
        strategy=guard.strategy,
    )


async def _generate_llm_answer(
    *,
    question: str,
    intent: str,
    safety_level: str,
    decision,
    rule_based_answer: str,
    history_context: str = "",
) -> tuple[str, str | None]:
    """Try to rephrase `rule_based_answer` more naturally using a local LLM.

    Returns (answer, provider_used). Falls back to `rule_based_answer`
    (provider_used=None) on any disabled/blocked/failed/unavailable outcome —
    this function must never raise and must never change the safety meaning
    of the answer, only how naturally it reads.
    """

    config = LocalLlmConfig.from_env()
    if not (
        config.ask_enabled
        and config.mode == "live"
        and config.provider == "ollama"
        and config.ollama.enabled
        and config.model
        and not config.configuration_errors
    ):
        return rule_based_answer, None

    guard_context = build_guard_context(decision, intent=intent, safety_level=safety_level)

    knowledge_context = build_knowledge_context(intent, normalize_text(question))
    system_prompt = build_system_prompt(guard_context, history_context=history_context)
    system_prompt += (
        "\n\nJawaban dasar yang sudah disetujui aplikasi (edukasi ulang boleh membuatnya "
        "lebih natural dan ramah, tetapi jangan mengubah maknanya, jangan menghapus "
        "peringatan atau anjuran di dalamnya, dan jangan menambah klaim baru):\n"
        + rule_based_answer
    )
    if knowledge_context:
        system_prompt += "\n\n" + knowledge_context

    llm_request = LlmRequest(
        system_prompt=system_prompt,
        user_message=question,
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        intent=intent,
        safety_level=safety_level,
    )

    guard = evaluate_llm_guard(guard_context, llm_request)
    if not guard.allowed:
        return rule_based_answer, None

    try:
        router = LocalLlmRouter(config)
        router_response = await router.route(
            llm_request,
            provider="ollama",
            strategy="priority",
            guard_context=guard_context,
        )
    except Exception:
        return rule_based_answer, None

    response = router_response.response
    if (
        response is not None
        and response.provider == "ollama"
        and router_response.selected_provider == "ollama"
        and response.status == "success"
        and response.content.strip()
    ):
        return response.content.strip(), router_response.selected_provider

    return rule_based_answer, None


@app.post("/ask", response_model=AskResponse)
async def ask_ai(request: AskRequest) -> AskResponse:
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Pertanyaan tidak boleh kosong."
        )

    # Session id is opaque and client-supplied (typically a per-tab id kept
    # in the browser). It only unlocks short-lived, in-process conversation
    # context (see conversation_memory.py) — it never affects intent
    # detection or the Policy Engine's decision for the *current* message.
    session_id = (request.sessionId or "").strip() or uuid.uuid4().hex
    history = CONVERSATION_MEMORY.get_history(session_id)

    intent_result = detect_intent(question)
    intent = intent_result["intent"]
    safety_level = intent_result["safetyLevel"]
    decision = POLICY_ENGINE.evaluate_question(
        question,
        intent=intent,
        safety_level=safety_level,
    )
    include_reflection = (
        request.includeQuranicReflection
        or intent == "quranic_reflection"
    )

    rule_based_answer = build_answer(
        intent,
        safety_level,
        decision,
        greeting_prefix=intent_result.get("greetingPrefix", False),
        is_islamic_greeting=intent_result.get("isIslamicGreeting", False),
    )

    answer, llm_provider = await _generate_llm_answer(
        question=question,
        intent=intent,
        safety_level=safety_level,
        decision=decision,
        rule_based_answer=rule_based_answer,
        history_context=build_history_context(history),
    )

    CONVERSATION_MEMORY.record_turn(
        session_id,
        question=question,
        intent=intent,
        safety_level=safety_level,
        answer=answer,
    )

    log_ask_event(
        intent=intent,
        safety_level=safety_level,
        response_blocked=decision.response_blocked,
        dominant_policy=decision.dominant_policy.policy_id if decision.dominant_policy else None,
        llm_used=llm_provider is not None,
        llm_provider=llm_provider,
        llm_mode=LocalLlmConfig.from_env().mode,
    )

    return AskResponse(
        question=question,
        intent=intent,
        safetyLevel=safety_level,
        answer=answer,
        disclaimer=DISCLAIMER,
        recommendedAction=(
            decision.recommended_action or intent_result["recommendedAction"]
        ),
        actions=build_actions(intent, decision),
        sources=[],
        quranicReflection=build_quranic_reflection() if include_reflection else None,
        policyDecision=serialize_policy_decision(decision),
        sessionId=session_id,
    )


@app.post("/feedback", response_model=FeedbackReceipt)
def submit_feedback(feedback: FeedbackRequest, request: Request) -> FeedbackReceipt:
    """Record a like/dislike (+ optional reason) into the review queue.

    This never changes app behavior by itself — an admin reviews the queue
    (see GET /admin/feedback) and applies any resulting change as a normal,
    tested code change.
    """
    client_key = resolve_feedback_client(
        request.client.host if request.client else None,
        request.headers.get("X-Forwarded-For"),
    )
    if not FEEDBACK_RATE_LIMITER.allow(client_key):
        raise HTTPException(
            status_code=429,
            detail="Terlalu banyak feedback. Coba lagi nanti.",
            headers={"Retry-After": str(feedback_rate_limit_window_seconds())},
        )
    return record_feedback(feedback)


@app.get("/admin/feedback")
def admin_feedback(request: Request) -> list[dict]:
    expected_token = os.getenv("VITANUSA_ADMIN_TOKEN", "").strip()
    if not expected_token:
        raise HTTPException(status_code=404, detail="Endpoint tidak tersedia.")
    if "token" in request.query_params:
        raise HTTPException(status_code=400, detail="Token query tidak diizinkan.")
    authorization = request.headers.get("Authorization", "")
    scheme, separator, credential = authorization.partition(" ")
    if (
        not separator
        or scheme.lower() != "bearer"
        or not credential
        or " " in credential
        or not compare_digest(credential, expected_token)
    ):
        raise HTTPException(
            status_code=401,
            detail="Bearer token admin tidak valid.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return list_pending_feedback()
