# VitaNusa AI Brain Backend

Backend ini adalah tahap awal VitaNusa AI Brain. Saat ini Brain masih berupa rule-based safety layer dan intent router sederhana. OpenAI API belum disambungkan, tidak ada API key asli, dan belum ada RAG, embedding, atau vector database.

## Menjalankan Lokal

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Server lokal default berjalan di:

```text
http://127.0.0.1:8000
```

## Test Endpoint Status

```bash
curl http://127.0.0.1:8000/
```

Response aktif berisi status `ok` dan pesan bahwa VitaNusa AI Brain aktif.

## Test Endpoint Ask

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"Bagaimana mulai hidup sehat pelan-pelan?\"}"
```

Endpoint `/ask` menerima field:

```json
{
  "question": "pertanyaan pengguna"
}
```

Response berisi:

```json
{
  "question": "pertanyaan pengguna",
  "intent": "general_health",
  "answer": "jawaban aman",
  "disclaimer": "disclaimer VitaNusa AI",
  "safetyLevel": "low",
  "recommendedAction": "aksi yang disarankan atau null"
}
```

Pertanyaan kosong akan mengembalikan HTTP 400.

## Catatan Safety

Layer saat ini mendeteksi intent dasar seperti:

- `serious_complaint`
- `diagnosis_request`
- `product_healing_claim`
- `product_personal_recommendation`
- `fatwa_request`
- `general_health`
- `general`

Keluhan berat diprioritaskan lebih tinggi daripada pertanyaan produk, sehingga Brain tidak mengarahkan kondisi berisiko ke rekomendasi produk.
