# Local LLM Router VitaNusa AI

## Tujuan dan batas kewenangan

Local LLM Router menyediakan kontrak seragam untuk Ollama, LM Studio, dan LocalAI. Mode default tetap `mock` tanpa jaringan, sedangkan adapter HTTP live tersedia sebagai fitur opt-in untuk provider lokal yang dinyalakan secara eksplisit. Integrasi ini mencakup konfigurasi, pemilihan provider, fallback, timeout, guard policy, validasi hasil, fixture mock, dan endpoint preview khusus development.

Local LLM bukan Policy Engine, bukan sumber diagnosis, dan bukan pemilik keputusan. Urutan kewenangannya tetap:

```text
Intent Router
  → Policy Engine dan medical safety
  → knowledge serta respons terkontrol VitaNusa
  → Local LLM Router bila diizinkan
  → pemeriksaan hasil model
  → respons akhir
```

Model lokal tidak boleh menjadi satu-satunya penentu kondisi darurat, diagnosis, dosis atau penggunaan obat, klaim produk, status halal, keputusan agama, maupun tindakan pengguna.

## Arsitektur provider

```text
LocalLlmRouter
├── OllamaProvider    (identifier: ollama)
├── LMStudioProvider  (identifier: lmstudio)
└── LocalAIProvider   (identifier: localai)
```

Router hanya mengenal kontrak `LlmProvider.generate(LlmRequest) -> LlmResponse`. Format API asli masing-masing provider menjadi tanggung jawab adapter HTTP, bukan router.

| Provider | Fokus umum | Kondisi pada fondasi ini |
| --- | --- | --- |
| Ollama | Pengelolaan dan eksekusi model lokal yang ringkas | Adapter live `POST /api/chat` tersedia; default nonaktif |
| LM Studio | Aplikasi desktop dengan server lokal bergaya OpenAI-compatible | Adapter live teknis tersedia; default nonaktif |
| LocalAI | Server inference lokal yang umum dipakai secara service/container | Adapter live teknis tersedia; default nonaktif |

Perbedaan di atas hanya orientasi teknis. Fondasi ini tidak memilih provider sebagai sumber kebenaran kesehatan atau agama.

## Mode

| Mode | Perilaku |
| --- | --- |
| `disabled` | Router tidak menjalankan provider dan mengembalikan status `disabled`. |
| `mock` | Provider memakai fixture aman dan tidak melakukan jaringan. Ini default repository. |
| `live` | Adapter HTTP lokal dapat dijalankan jika provider, model, dan flag terkait dikonfigurasi; kegagalan tidak jatuh diam-diam ke mock. |

Mode live tidak aktif hanya karena base URL tersedia. Operator tetap harus mengaktifkan provider, memilih model, dan—untuk jawaban publik `/ask`—mengaktifkan `LOCAL_LLM_ASK_ENABLED` secara terpisah.

## Strategi

- `priority`: hanya menjalankan `LOCAL_LLM_PROVIDER`. Kegagalan provider utama tidak mencoba provider lain.
- `fallback`: mencoba urutan `ollama → lmstudio → localai`. Respons kosong, timeout, unavailable, blocked, atau failed melanjutkan ke provider berikutnya.

Jika seluruh provider gagal, router mengembalikan respons terstruktur dengan `all_providers_failed=true`. Pemanggil harus tetap memakai knowledge atau `build_answer()` VitaNusa; pesan teknis provider tidak menjadi jawaban publik.

## Konfigurasi environment

| Variable | Default | Keterangan |
| --- | --- | --- |
| `LOCAL_LLM_MODE` | `mock` | `disabled`, `mock`, atau `live` |
| `LOCAL_LLM_STRATEGY` | `fallback` | `priority` atau `fallback` |
| `LOCAL_LLM_PROVIDERS` | `ollama,lmstudio,localai` | Urutan provider fallback |
| `LOCAL_LLM_PROVIDER` | `ollama` | Provider utama |
| `LOCAL_LLM_MODEL` | kosong | Nama model dari operator; tidak di-hardcode |
| `LOCAL_LLM_TIMEOUT_SECONDS` | `45` | Timeout logis per provider |
| `LOCAL_LLM_MAX_TOKENS` | `500` | Batas token request, 50–2000 |
| `LOCAL_LLM_TEMPERATURE` | `0.2` | Temperatur request, 0.0–1.0 |
| `LOCAL_LLM_PREVIEW_ENABLED` | `false` | Mengaktifkan endpoint development |
| `LOCAL_LLM_ASK_ENABLED` | `false` | Mengizinkan Ollama live memperhalus jawaban `/ask` setelah seluruh guard lulus |
| `LOCAL_LLM_MOCK_SCENARIO` | `success` | Fixture simulasi |
| `OLLAMA_ENABLED` | `false` | Mengaktifkan adapter Ollama live bila mode `live` |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Target loopback HTTP untuk Ollama |
| `LM_STUDIO_ENABLED` | `false` | Mengaktifkan adapter LM Studio; tetap nonaktif pada konfigurasi aman |
| `LM_STUDIO_BASE_URL` | `http://127.0.0.1:1234/v1` | Target loopback HTTP untuk LM Studio |
| `LOCALAI_ENABLED` | `false` | Mengaktifkan adapter LocalAI; tetap nonaktif pada konfigurasi aman |
| `LOCALAI_BASE_URL` | `http://127.0.0.1:8080/v1` | Target loopback HTTP untuk LocalAI |

Konfigurasi tidak memuat API key atau secret. Base URL provider hanya menerima `http` dengan host eksplisit `127.0.0.1`, `localhost`, atau `::1`; alamat bind `0.0.0.0`, LAN/private IP, domain publik, URL berkredensial, dan skema selain HTTP ditolak tanpa DNS resolution. Klien HTTP lokal juga mengabaikan konfigurasi proxy dari environment agar request loopback tidak dialihkan. Hanya system prompt terkontrol, pesan preview yang dibatasi 4.000 karakter, intent, dan safety level yang masuk ke request provider; data akun atau profil tidak ditambahkan.

Untuk Ollama live, model harus ditulis eksplisit melalui `LOCAL_LLM_MODEL`. Aplikasi tidak memilih `llama3` atau model lain secara diam-diam. Respons Ollama wajib berbentuk `{"message":{"content":"..."}}`; JSON atau schema yang salah, konten kosong, dan konten di atas 20.000 karakter ditolak secara terstruktur.

## Safety dan validasi hasil

Preview lebih dahulu menjalankan `detect_intent()` dan `POLICY_ENGINE.evaluate_question()`. Guard hanya membaca keputusan tersebut:

- `response_blocked=true` menghentikan eksekusi Local LLM;
- intent atau safety level darurat menghentikan eksekusi Local LLM;
- larangan generative response dari policy menghentikan eksekusi;
- warning, recommended action, dan prohibited actions dipertahankan untuk prompt dan validasi berikutnya.

Guard tidak membuat medical policy baru dan tidak dapat mengubah hasil Policy Engine. System prompt hanyalah lapisan tambahan, bukan satu-satunya pengaman.

Validator hasil menolak konten kosong serta pola pelanggaran jelas: diagnosis pasti, perintah menghentikan obat dokter, dosis resep personal, janji pasti sembuh, klaim 100% aman, dan klaim halal/BPOM tanpa data. Hasil yang ditolak berstatus `blocked` dan kontennya dikosongkan.

## Fixture mock

Skenario yang tersedia:

| Skenario | Hasil simulasi |
| --- | --- |
| `success` | Provider pertama menghasilkan respons `mock` yang aman. |
| `empty` | Provider menghasilkan konten kosong. |
| `partial_failure` | Ollama gagal, lalu LM Studio berhasil. |
| `all_failed` | Semua provider gagal terkontrol. |
| `timeout` | Timeout dikembalikan langsung tanpa menunggu 45 detik. |
| `provider_unavailable` | Provider tidak tersedia secara simulasi. |

Fixture menyatakan dengan jelas bahwa ia bukan hasil model nyata dan bukan rujukan kesehatan.

## Endpoint preview development

Endpoint `POST /llm/preview` default-nya tidak tersedia (`404`) dan selalu `404` ketika `APP_ENV=production`, walaupun flag preview dinyalakan. Untuk pengujian mock lokal:

```bash
LOCAL_LLM_MODE=mock \
LOCAL_LLM_PREVIEW_ENABLED=true \
LOCAL_LLM_STRATEGY=fallback \
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Request:

```json
{
  "message": "Jelaskan fungsi VitaCheck secara singkat.",
  "provider": "ollama",
  "strategy": "fallback"
}
```

Respons memuat mode, strategi, attempted providers, selected provider, status fallback, dan objek respons dengan `is_mock`. Endpoint tidak mengembalikan environment, filesystem path, stack trace, atau secret.

Endpoint `/ask` tetap membangun jawaban rule-based lebih dahulu. Ollama hanya boleh memperhalus bahasa ketika `LOCAL_LLM_ASK_ENABLED=true`, mode `live`, provider utama `ollama`, Ollama aktif, model eksplisit tersedia, URL valid, dan seluruh guard mengizinkan. Pemanggilan `/ask` dipaksa memakai Ollama dengan strategi `priority`; LM Studio dan LocalAI tidak dicoba. Mode `disabled`/`mock`, konfigurasi tidak lengkap, timeout, koneksi gagal, HTTP error, respons kosong/invalid/terlalu besar, atau respons yang diblokir selalu kembali ke `build_answer()`. `sources` tetap kosong dan `policyDecision`, warning, serta recommended action tetap milik aplikasi.

## Menjalankan test

Dari root repository:

```bash
npm ci
npm run check
```

Backend:

```bash
cd backend
python -m compileall app tests
python -m unittest discover -s tests -p "test_*.py" -v
```

Dengan backend aktif, jalankan test HTTP yang dipakai CI:

```bash
python tests/ci_smoke_test.py
python tests/policy_http_smoke_test.py
```

## Runbook Ollama lokal

Ollama harus dipasang dan model harus diunduh secara sadar oleh operator; repository tidak memasang Ollama atau mengunduh model. Periksa terlebih dahulu:

```bash
ollama --version
curl http://127.0.0.1:11434/api/tags
```

Gunakan model kecil yang memang sudah tersedia, misalnya `gemma3:1b`. Jangan mengekspos port `11434` ke internet.

### Preview Ollama

```bash
cd backend
APP_ENV=development \
LOCAL_LLM_MODE=live \
LOCAL_LLM_STRATEGY=priority \
LOCAL_LLM_PROVIDERS=ollama \
LOCAL_LLM_PROVIDER=ollama \
LOCAL_LLM_MODEL=gemma3:1b \
LOCAL_LLM_TIMEOUT_SECONDS=45 \
LOCAL_LLM_MAX_TOKENS=500 \
LOCAL_LLM_TEMPERATURE=0.2 \
LOCAL_LLM_PREVIEW_ENABLED=true \
LOCAL_LLM_ASK_ENABLED=false \
OLLAMA_ENABLED=true \
OLLAMA_BASE_URL=http://127.0.0.1:11434 \
LM_STUDIO_ENABLED=false \
LOCALAI_ENABLED=false \
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Kirim `POST /llm/preview`:

```json
{
  "message": "Jelaskan fungsi VitaCheck secara singkat.",
  "provider": "ollama",
  "strategy": "priority"
}
```

Pastikan provider terpilih `ollama`, status `success`, `is_mock=false`, model sesuai konfigurasi, dan konten tidak kosong.

### Mengaktifkan Ollama untuk `/ask`

Setelah preview lulus, matikan preview dan aktifkan flag publik secara terpisah:

```bash
LOCAL_LLM_PREVIEW_ENABLED=false
LOCAL_LLM_ASK_ENABLED=true
```

Uji pertanyaan biasa, klaim produk, permintaan dosis, dan kondisi darurat. Policy Engine selalu dievaluasi lebih dahulu. Kondisi darurat dan respons terlarang tidak boleh mencapai jawaban model; ketika Ollama dimatikan, `/ask` harus tetap mengembalikan jawaban rule-based tanpa HTTP 500.

LM Studio dan LocalAI tetap nonaktif secara default. Ketersediaan adapter teknis tidak memindahkan kewenangan Policy Engine ke provider mana pun.
