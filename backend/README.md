# VitaNusa AI Brain Backend

Backend FastAPI VitaNusa AI bersifat rule-based. Ia memakai intent detector, medical risk classifier, hierarchy policy engine, response router, dan Qur'anic Reflection opsional.

Tidak ada OpenAI API, RAG, embedding, vector database, secret, atau dependency berat baru di fondasi ini.

Dokumentasi fondasi Local LLM Router: [`../docs/local-llm-router.md`](../docs/local-llm-router.md).

## Arsitektur

```text
normalize input
  → detect intent
  → classify medical risk
  → run policy registry
  → aggregate PolicyDecision
  → route content/actions
  → build AskResponse
```

Folder policy:

```text
app/policies/
├── base.py
├── registry.py
├── medical_safety.py
├── authority_boundary.py
├── islamic_boundary.py
├── halal_thayyib.py
├── product_claims.py
└── content_integrity.py
```

## Menjalankan Lokal

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Endpoint

- `GET /`
- `GET /health`
- `POST /ask`

Request:

```json
{
  "question": "Apakah produk ini halal?",
  "includeQuranicReflection": false
}
```

Response tetap mempertahankan field lama dan menambah `policyDecision`:

```json
{
  "question": "Apakah produk ini halal?",
  "intent": "product_claim",
  "safetyLevel": "medium",
  "answer": "jawaban aman",
  "disclaimer": "disclaimer",
  "recommendedAction": "aksi aman",
  "actions": [],
  "sources": [],
  "quranicReflection": null,
  "policyDecision": {
    "dominantPolicy": "halal_thayyib",
    "responseBlocked": false,
    "allowedActions": [],
    "prohibitedActions": [],
    "warnings": [],
    "recommendedAction": null,
    "results": []
  }
}
```

Frontend lama tetap memakai `answer`, `intent`, `safetyLevel`, dan `actions` tanpa perubahan.

## Test

```bash
cd backend
python -m unittest discover -s tests -v
python -m compileall -q app tests
```

Dengan server aktif:

```bash
python tests/ci_smoke_test.py
```

## CORS dan Deploy

Konfigurasi CORS, `render.yaml`, root directory, dan perintah deploy tidak diubah oleh policy engine.

## Safety

Backend tidak memberi diagnosis, dosis personal, fatwa final, atau klaim kesembuhan. Status halal tidak ditebak. Emergency mengalahkan intent produk dan menghapus action produk/artikel biasa.
