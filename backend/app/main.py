from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

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


class AskRequest(BaseModel):
    question: str


DISCLAIMER = (
    "VitaNusa AI bukan dokter, bukan tenaga medis, dan bukan alat diagnosis. "
    "Informasi ini hanya edukasi umum. Untuk keluhan yang berat, memburuk, "
    "atau memiliki tanda bahaya, segera hubungi dokter, fasilitas kesehatan, "
    "atau layanan darurat setempat."
)


@app.get("/")
def home():
    return {
        "message": "VitaNusa AI Brain aktif",
        "status": "ok"
    }


@app.post("/ask")
def ask_ai(request: AskRequest):
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Pertanyaan tidak boleh kosong."
        )

    return {
        "question": question,
        "answer": (
            "Terima kasih sudah bertanya. Saya akan menjawab dengan prinsip "
            "edukasi amanah: memahami keluhan secara umum, menghindari klaim "
            "diagnosis, tidak menjanjikan kesembuhan, dan mendorong ikhtiar "
            "yang aman. Bila ada tanda bahaya seperti nyeri dada, sesak napas, "
            "penurunan kesadaran, perdarahan berat, kelemahan mendadak, demam "
            "tinggi yang menetap, dehidrasi, atau gejala yang cepat memburuk, "
            "segera cari pertolongan medis."
        ),
        "disclaimer": DISCLAIMER
    }
