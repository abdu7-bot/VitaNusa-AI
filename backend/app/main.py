import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .intent_router import detect_intent
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
from .responses import DISCLAIMER, build_actions, build_answer, build_quranic_reflection
from .schemas import AskRequest, AskResponse, LlmPreviewRequest

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://abdu7-bot.github.io",
]


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
    if not config.preview_enabled:
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


@app.post("/ask", response_model=AskResponse)
def ask_ai(request: AskRequest) -> AskResponse:
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Pertanyaan tidak boleh kosong."
        )

    intent_result = detect_intent(question)
    intent = intent_result["intent"]
    decision = POLICY_ENGINE.evaluate_question(
        question,
        intent=intent,
        safety_level=intent_result["safetyLevel"],
    )
    include_reflection = (
        request.includeQuranicReflection
        or intent == "quranic_reflection"
    )

    return AskResponse(
        question=question,
        intent=intent,
        safetyLevel=intent_result["safetyLevel"],
        answer=build_answer(intent, intent_result["safetyLevel"], decision),
        disclaimer=DISCLAIMER,
        recommendedAction=(
            decision.recommended_action or intent_result["recommendedAction"]
        ),
        actions=build_actions(intent, decision),
        sources=[],
        quranicReflection=build_quranic_reflection() if include_reflection else None,
        policyDecision=serialize_policy_decision(decision),
    )
