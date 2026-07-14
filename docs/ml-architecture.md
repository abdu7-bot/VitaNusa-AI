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

## Percakapan umum (`general_chat`) dan memori multi-giliran
Sejak revisi "hybrid_open", `intent_router.py` tidak lagi memperlakukan
pertanyaan yang tidak cocok dengan kata kunci kesehatan/produk/agama/aplikasi
sebagai fallback defensif. Kasus itu sekarang diberi intent `general_chat`
(risiko `low`) dan dijawab dengan nada mengobrol yang jujur soal keterbatasan
saat ini (lihat `GENERAL_CHAT_ANSWER` di `responses.py`), bukan "saya belum
punya informasi". Ini **tidak melonggarkan keselamatan**: setiap pesan tetap
melewati `detect_intent` → `classify_risk` → `PolicyEngine.evaluate_question`
apa adanya, jadi pertanyaan yang memuat kata kunci darurat/obat/produk/agama
tetap dialihkan ke intent spesifiknya masing-masing, tidak pernah "tertelan"
oleh `general_chat`.

`backend/app/conversation_memory.py` menambahkan memori percakapan singkat,
in-process, per `sessionId` (dikirim klien lewat body `/ask`; server membuat
satu baru bila kosong dan selalu mengembalikannya di `AskResponse.sessionId`).
Beberapa catatan penting:
- **Bukan penyimpanan permanen.** Riwayat hanya hidup di memori proses
  (hilang saat proses restart), dibatasi jumlah giliran per sesi
  (`VITANUSA_MEMORY_MAX_TURNS`, default 6), TTL tanpa aktivitas
  (`VITANUSA_MEMORY_TTL_SECONDS`, default 1800 detik), dan jumlah sesi yang
  dilacak (`VITANUSA_MEMORY_MAX_SESSIONS`, default 1000) — jadi tidak
  menambah beban privasi/audit baru di luar yang sudah ada untuk feedback
  dan audit log. Teks yang disimpan tetap melewati `redact_pii` yang sama
  dengan feedback queue.
- **Hanya konteks untuk LLM, tidak pernah mengubah keputusan keselamatan.**
  `build_history_context()` merender giliran-giliran sebelumnya sebagai teks
  yang disisipkan ke system prompt lewat `build_system_prompt(...,
  history_context=...)` — ini murni membantu LLM (saat `LOCAL_LLM_ASK_ENABLED`
  aktif) menjawab lebih nyambung secara nada bahasa. Jalur rule-based (intent,
  safety level, Policy Engine) tetap dievaluasi ulang dari nol pada setiap
  pesan; riwayat tidak pernah dibaca oleh `detect_intent` atau
  `PolicyEngine.evaluate_question`.
- Frontend (`assets/js/modules/nusa-chat.js`) menyimpan `sessionId` per tab di
  `sessionStorage` dan mengirimkannya di setiap request; tombol "Chat Baru"
  menghapusnya sehingga percakapan berikutnya dimulai tanpa riwayat.

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
