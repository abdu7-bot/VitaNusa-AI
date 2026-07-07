from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .intent_router import detect_intent
from .responses import DISCLAIMER, build_answer
from .schemas import AskRequest, AskResponse

app = FastAPI(
    title="VitaNusa AI Brain",
    description="Backend otak dasar VitaNusa AI",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "VitaNusa AI Brain aktif",
        "status": "ok"
    }


@app.post("/ask", response_model=AskResponse)
def ask_ai(request: AskRequest) -> AskResponse:
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Pertanyaan tidak boleh kosong."
        )

    intent_result = detect_intent(question)

    return AskResponse(
        question=question,
        intent=intent_result["intent"],
        answer=build_answer(intent_result["intent"]),
        disclaimer=DISCLAIMER,
        safetyLevel=intent_result["safetyLevel"],
        recommendedAction=intent_result["recommendedAction"],
    )
