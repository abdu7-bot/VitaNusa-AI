# Arsitektur hybrid rule-based + local LLM

Dokumen ini menjelaskan cara "mesin learning" VitaNusa AI dibangun: **hybrid**,
dengan rule-based safety engine yang sudah ada sebagai penjaga utama, dan LLM
lokal opsional sebagai lapisan yang membuat jawaban lebih natural.

## Prinsip
1. **Rule-based engine tetap otoritas keselamatan.** `intent_router.py` →
   `safety.py` → `policy_engine.py` menentukan intent, level risiko, dan
   batasan (larangan diagnosis, larangan dosis pribadi, larangan klaim produk,
   dsb) untuk *setiap* pertanyaan, dengan atau tanpa LLM.
2. **LLM tidak pernah menggantikan keputusan itu**, hanya boleh menyusun ulang
   kalimat jawaban yang sudah disetujui aplikasi (`rule_based_answer` di
   `main.py`) menjadi lebih natural. System prompt (`llm/prompts.py`) secara
   eksplisit melarang diagnosis pasti, dosis resep, klaim kesembuhan, klaim
   halal/haram, dan izin BPOM.
3. **Guard berlapis:**
   - `llm/guard.py::evaluate_llm_guard` menolak memanggil LLM sama sekali
     untuk kondisi darurat (`danger_sign`) atau saat `policyDecision` sudah
     memblokir respons.
   - `llm/guard.py::validate_llm_response` memindai *hasil* LLM dengan
     pola regex (diagnosis pasti, dosis resep, "pasti sembuh", dst.) dan
     memblokir kontennya jika ditemukan — jawaban lalu jatuh kembali ke
     template rule-based.
   - `knowledge_base.py` memberi LLM "catatan terverifikasi" sebagai
     pegangan (bukan RAG vektor, hanya lookup kata kunci → snippet yang
     sudah dicek manusia) dan instruksi eksplisit untuk jujur bilang "belum
     cukup yakin" bila tidak ada catatan yang relevan.

## Menyalakan LLM lokal (opsional, default OFF)
Secara default `/ask` berjalan 100% rule-based seperti sebelumnya — tidak ada
perubahan perilaku kecuali env var berikut diset:

| Env var | Default | Keterangan |
|---|---|---|
| `LOCAL_LLM_MODE` | `mock` | `disabled` / `mock` / `live` |
| `LOCAL_LLM_ASK_ENABLED` | `false` | Harus `true` agar `/ask` mencoba memakai LLM sama sekali |
| `LOCAL_LLM_PROVIDER` | `ollama` | provider utama untuk strategi `priority` |
| `LOCAL_LLM_STRATEGY` | `fallback` | `priority` (satu provider) atau `fallback` (coba berurutan) |
| `OLLAMA_ENABLED` / `OLLAMA_BASE_URL` | `false` / `http://127.0.0.1:11434` | provider lokal utama |
| `LM_STUDIO_ENABLED` / `LM_STUDIO_BASE_URL` | `false` / `http://127.0.0.1:1234/v1` | provider OpenAI-compatible |
| `LOCALAI_ENABLED` / `LOCALAI_BASE_URL` | `false` / `http://127.0.0.1:8080/v1` | provider OpenAI-compatible |

Untuk benar-benar memakai Ollama di lingkungan Replit ini, jalankan Ollama
sebagai proses terpisah (atau host eksternal) dan set base URL-nya, lalu set
`LOCAL_LLM_MODE=live`, `LOCAL_LLM_ASK_ENABLED=true`, `OLLAMA_ENABLED=true`.
Jika provider tidak aktif/terhubung, sistem otomatis kembali ke jawaban
template rule-based (tidak pernah error ke pengguna).

## Feedback (like/dislike) — bukan self-learning
`POST /feedback` menyimpan rating + alasan opsional ke antrean
`backend/data/feedback_queue.jsonl` dengan status `pending_review`. Teks
pertanyaan/jawaban/alasan di-redact dari PII umum (email, nomor telepon,
angka panjang) sebelum disimpan (`app/privacy.py`).

**Tidak ada jalur otomatis dari feedback ke perubahan aplikasi.** Admin
membaca antrean lewat `GET /admin/feedback?token=...` (butuh env var
`VITANUSA_ADMIN_TOKEN`; endpoint 404 jika token tidak diset), menilai
usulan, menerapkannya sebagai perubahan kode biasa (edit keyword, prompt,
atau knowledge base), lalu diuji ulang lewat test suite sebelum dirilis.
Sengaja tidak ada online learning atau retraining otomatis dari histori
percakapan pengguna.

## Audit log
`app/audit_log.py` mencatat setiap `/ask` (waktu, intent, safety level,
apakah policy memblokir, provider LLM yang dipakai bila ada) ke
`backend/data/audit_log.jsonl`. Isi pertanyaan disimpan sebagai cuplikan
pendek yang sudah di-redact PII — bukan riwayat kesehatan lengkap.
