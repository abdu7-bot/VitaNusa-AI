import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .intent_router import detect_intent
from .responses import DISCLAIMER, build_actions, build_answer, build_quranic_reflection
from .schemas import AskRequest, AskResponse

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
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
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
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
    include_reflection = (
        request.includeQuranicReflection
        or intent == "quranic_reflection"
    )

    return AskResponse(
        question=question,
        intent=intent,
        safetyLevel=intent_result["safetyLevel"],
        answer=build_answer(intent, intent_result["safetyLevel"]),
        disclaimer=DISCLAIMER,
        recommendedAction=intent_result["recommendedAction"],
        actions=build_actions(intent),
        sources=[],
        quranicReflection=build_quranic_reflection() if include_reflection else None,
    )
