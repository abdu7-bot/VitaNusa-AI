# VitaNusa AI Brain Backend

Backend FastAPI VitaNusa AI bersifat rule-based. Ia memakai intent detector, medical risk classifier, hierarchy policy engine, response router, dan Qur'anic Reflection opsional.

Tidak ada OpenAI API, RAG, embedding, vector database, secret, atau dependency berat baru di fondasi ini.

Dokumentasi fondasi Local LLM Router: [`../docs/local-llm-router.md`](../docs/local-llm-router.md).

Dokumentasi fondasi Web Search Router: [`../docs/web-search-router.md`](../docs/web-search-router.md).

## Arsitektur

```text
normalize input
  → detect intent
  → safety decision pipeline (v3)
    ├── normalization & context detection
    ├── emergency signal detection
    ├── ambiguous safety detection
    ├── high-risk keyword detection
    └── decision: emergency | high_risk | ambiguous | low
  → run policy registry
  → aggregate PolicyDecision
  → route content/actions
  → build AskResponse
```

### Safety Pipeline v3

Emergency Gate v3 (`app/safety_v3.py`) menyediakan pipeline keputusan keselamatan yang terstruktur:

- **Input teks tervalidasi**: endpoint publik saat ini mengevaluasi teks pertanyaan. Skema `HealthIntake` tersedia untuk integrasi intake terstruktur di masa depan, tetapi belum menjadi input endpoint publik.
- **Context Detection**: Subject (self/other/hypothetical), Temporal (now/today/recent/past), dan negation handling yang robust
- **Emergency Detection**: Keyword matching + negation handling + flexible patterns
- **Ambiguous Handling**: Deteksi input yang tidak jelas tapi berpotensi safety-relevant
- **SafetyDecision**: Hasil terstruktur dengan level, reason_codes, matched_signals, context, dan clarification fields
- **Backward Compatibility**: Wrapper `classify_risk()` dan `contains_emergency_signal()` untuk existing code

Safety levels (prioritas):
1. **EMERGENCY** - Sinyal gejala serius yang memerlukan tindakan medis segera
2. **HIGH_RISK** - Konteks yang memerlukan evaluasi profesional (hamil, medication, chronic)
3. **AMBIGUOUS** - Input tidak jelas tapi berpotensi safety-relevant (perlu klarifikasi)
4. **EDUCATION** - Aman untuk respons edukatif

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

## Dependency Python

`../pyproject.toml` adalah sumber utama dependency langsung Python.
`requirements.txt` merupakan mirror kompatibilitas untuk instalasi berbasis pip, Render, dan CI,
sedangkan `../uv.lock` mengunci dependency lengkap untuk environment berbasis uv.

Setiap perubahan dependency langsung harus diterapkan pada `pyproject.toml` dan `requirements.txt`.
Sebelum commit, jalankan pemeriksaan berikut dari root repository:

```bash
python scripts/check_python_dependency_sync.py
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
