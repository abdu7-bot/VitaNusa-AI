from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="VitaNusa AI Brain",
    description="Backend otak dasar VitaNusa AI",
    version="0.1.0"
)


class AskRequest(BaseModel):
    question: str


@app.get("/")
def home():
    return {
        "message": "VitaNusa AI Brain aktif",
        "status": "ok"
    }


@app.post("/ask")
def ask_ai(request: AskRequest):
    return {
        "question": request.question,
        "answer": "Ini jawaban awal dari otak VitaNusa AI. Tahap berikutnya kita sambungkan ke knowledge dan AI."
    }