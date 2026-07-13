# Local LLM Router VitaNusa AI

## Tujuan dan batas kewenangan

Local LLM Router menyediakan kontrak seragam untuk menguji Ollama, LM Studio, dan LocalAI tanpa memasang atau menghubungi aplikasi provider tersebut. Fondasi ini mencakup konfigurasi, pemilihan provider, fallback, timeout logis, guard policy, validasi hasil, fixture mock, dan endpoint preview khusus development.

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

Router hanya mengenal kontrak `LlmProvider.generate(LlmRequest) -> LlmResponse`. Format API asli masing-masing provider kelak menjadi tanggung jawab adapter, bukan router.

| Provider | Fokus umum | Kondisi pada fondasi ini |
| --- | --- | --- |
| Ollama | Pengelolaan dan eksekusi model lokal yang ringkas | Dummy; tanpa HTTP |
| LM Studio | Aplikasi desktop dengan server lokal bergaya OpenAI-compatible | Dummy; tanpa HTTP |
| LocalAI | Server inference lokal yang umum dipakai secara service/container | Dummy; tanpa HTTP dan tanpa Docker |

Perbedaan di atas hanya orientasi teknis. Fondasi ini tidak memilih provider sebagai sumber kebenaran kesehatan atau agama.

## Mode

| Mode | Perilaku |
| --- | --- |
| `disabled` | Router tidak menjalankan provider dan mengembalikan status `disabled`. |
| `mock` | Provider memakai fixture aman dan tidak melakukan jaringan. Ini default repository. |
| `live` | Adapter mengembalikan `not_implemented`; tidak melakukan HTTP dan tidak jatuh diam-diam ke mock. |

Flag `*_ENABLED` dan base URL telah tersedia untuk tahap live berikutnya. Pada PR ini, mengubah flag tersebut tidak mengaktifkan koneksi.

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
| `LOCAL_LLM_MOCK_SCENARIO` | `success` | Fixture simulasi |
| `OLLAMA_ENABLED` | `false` | Disiapkan untuk aktivasi Ollama berikutnya |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Hanya konfigurasi pada tahap ini |
| `LM_STUDIO_ENABLED` | `false` | Disiapkan untuk aktivasi LM Studio berikutnya |
| `LM_STUDIO_BASE_URL` | `http://127.0.0.1:1234/v1` | Hanya konfigurasi pada tahap ini |
| `LOCALAI_ENABLED` | `false` | Disiapkan untuk aktivasi LocalAI berikutnya |
| `LOCALAI_BASE_URL` | `http://127.0.0.1:8080/v1` | Hanya konfigurasi pada tahap ini |

Konfigurasi tidak memuat API key atau secret. Hanya system prompt terkontrol, pesan preview yang dibatasi 4.000 karakter, intent, dan safety level yang masuk ke request provider; data akun atau profil tidak ditambahkan.

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

Endpoint `POST /llm/preview` default-nya tidak tersedia (`404`). Untuk pengujian lokal:

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

Endpoint `/ask` tetap menggunakan Policy Engine dan `build_answer()`. Mode `disabled`, `mock`, kegagalan provider, atau mode `live` fondasi ini tidak mengganti jawaban publik `/ask`; fixture dummy juga tidak masuk ke `answer` maupun `sources`.

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

## Tahap aktivasi Ollama berikutnya

Aktivasi nyata harus dikerjakan pada PR terpisah: pilih klien HTTP secara eksplisit, implementasikan serialisasi request/response hanya di `OllamaProvider`, batasi URL ke loopback yang disetujui, tambahkan timeout jaringan dan sanitasi error, aktifkan melalui flag eksplisit, lalu tambah contract/integration test dengan server tiruan. Sesudah itu ulangi pemeriksaan guard, post-response validation, kegagalan total, dan pastikan `/ask` tetap mempunyai fallback deterministik.

LM Studio dan LocalAI mengikuti disiplin yang sama melalui adapter masing-masing. Tidak satu pun aktivasi provider boleh memindahkan kewenangan Policy Engine ke model lokal.
