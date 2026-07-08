# VitaNusa AI Brain Backend

Backend ini adalah tahap awal VitaNusa AI Brain berbasis FastAPI. Saat ini sistem masih rule-based: intent detector, risk classifier, safety guard kesehatan, dan Qur'anic Reflection opsional. Belum ada OpenAI API, RAG, embedding, vector database, API key, token, password, atau secret di repository.

## Menjalankan Lokal

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Server lokal default:

```text
http://127.0.0.1:8000
```

## Cara Test

```bash
curl http://127.0.0.1:8000/
curl http://127.0.0.1:8000/health
```

Contoh `POST /ask`:

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"Aplikasi apa ini?\"}"
```

Endpoint `/ask` menerima:

```json
{
  "question": "Aplikasi apa ini?",
  "includeQuranicReflection": false
}
```

Response berisi:

```json
{
  "question": "Aplikasi apa ini?",
  "intent": "identity",
  "safetyLevel": "low",
  "answer": "jawaban aman",
  "disclaimer": "disclaimer VitaNusa AI",
  "recommendedAction": "aksi aman atau null",
  "actions": [],
  "sources": [],
  "quranicReflection": null
}
```

Pertanyaan kosong mengembalikan HTTP 400.

## Endpoint

- `GET /` mengembalikan status service.
- `GET /health` mengembalikan `{ "status": "healthy" }`.
- `POST /ask` mengembalikan jawaban edukatif berdasarkan intent dan risk classifier.

## Deploy ke Render

Pengaturan Render manual:

```text
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Repository juga menyediakan `render.yaml` di root:

```yaml
services:
  - type: web
    name: vitanusa-ai-backend
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    plan: free
```

## CORS

Default allowed origins:

- `http://localhost:5173`
- `http://localhost:3000`
- `http://127.0.0.1:5500`
- `https://abdu7-bot.github.io`

Untuk override:

```text
VITANUSA_ALLOWED_ORIGINS=https://abdu7-bot.github.io,http://localhost:5173
```

## Mengganti URL Backend Frontend

Frontend Nusa Chat membaca URL backend dengan prioritas:

1. `window.VITANUSA_BACKEND_ASK_URL`
2. meta tag `vitanusa-backend-ask-url`
3. fallback lokal `http://127.0.0.1:8000/ask`

Contoh:

```html
<script>
  window.VITANUSA_BACKEND_ASK_URL = "https://nama-backend.onrender.com/ask";
</script>
```

Atau:

```html
<meta name="vitanusa-backend-ask-url" content="https://nama-backend.onrender.com/ask">
```

Jika backend gagal, frontend tetap memakai jawaban lokal `getNusaReply`.

## Catatan Safety

Backend tidak membuat diagnosis, tidak memberi dosis obat resep, tidak menyarankan menghentikan obat dokter, tidak menjanjikan hasil produk, tidak memberi fatwa, dan tidak membuat tafsir baru. Refleksi Qur'ani hanya muncul bila diminta lewat `includeQuranicReflection: true` atau intent refleksi terdeteksi.
