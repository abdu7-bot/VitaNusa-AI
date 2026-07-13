# Web Search Router

## Tujuan dan batas tahap ini

Web Search Router adalah fondasi backend untuk mencari dan menyatukan sumber dari beberapa provider dengan satu kontrak. Implementasi saat ini hanya menyediakan data simulasi yang deterministik. Tidak ada HTTP request, scraping, browser automation, SDK pencarian, API key, atau pencarian produksi.

Semua URL simulasi memakai domain `.example`, semua hasil diberi `is_mock=true`, dan snippet menyatakan bahwa data bukan sumber kesehatan nyata. Hasil tersebut hanya boleh diperiksa melalui endpoint development dan tidak boleh menjadi rujukan faktual pengguna.

Prinsip pembagian tanggung jawabnya:

> Web Search Router mencari sumber. Local LLM Router menyusun respons. Policy Engine menentukan batas.

Ketiganya merupakan modul terpisah. Router pencarian tidak menyusun jawaban, sedangkan Local LLM Router tidak memilih atau memverifikasi sumber.

## Arsitektur

```text
Pertanyaan
  -> Intent Router
  -> Policy Engine dan Search Guard
  -> Web Search Router
       -> BraveSearchProvider
       -> DuckDuckGoSearchProvider
       -> SearxngSearchProvider
  -> Normalizer
  -> Deduplicator
  -> Ranking deterministik
  -> SearchRouterResponse
```

Policy Engine selalu berada di atas pencarian. Search Guard membaca hasil intent dan `PolicyDecision`; ia tidak mengubah atau mengganti keputusan policy. Tanda bahaya diblokir sebelum provider dipanggil agar respons keselamatan tidak menunggu pencarian.

## Struktur modul

```text
backend/app/search/
├── base.py
├── config.py
├── models.py
├── fixtures.py
├── normalizer.py
├── deduplicator.py
├── ranking.py
├── guard.py
├── router.py
└── providers/
    ├── brave.py
    ├── duckduckgo.py
    └── searxng.py
```

`SearchProvider` adalah `Protocol` async dengan `name` dan `search(SearchQuery)`. Router hanya memahami kontrak seragam `ProviderSearchResponse`; format khusus API provider live kelak harus ditangani adapter masing-masing.

## Provider dummy

- `BraveSearchProvider` memakai identifier `brave`.
- `DuckDuckGoSearchProvider` memakai identifier `duckduckgo`. Pada tahap live nanti, hasilnya diperlakukan sebagai konteks tambahan dan bukan satu-satunya dasar penilaian kesehatan. Tidak ada scraping HTML DuckDuckGo.
- `SearxngSearchProvider` memakai identifier `searxng`. Tidak ada instance publik atau base URL bawaan.

Perilaku ketiganya sama:

| Mode | Status provider | Jaringan | Hasil mock |
| --- | --- | --- | --- |
| `disabled` | `disabled` | Tidak | Tidak |
| `mock` | `mock` atau status skenario terstruktur | Tidak | Ya |
| `live` | `not_implemented` | Tidak | Tidak |

Mode `live` sengaja gagal tertutup dan tidak pernah diam-diam kembali ke fixture mock.

## Mode dan strategi

Mode yang didukung adalah `disabled`, `mock`, dan `live`. Default repository adalah `mock`.

Strategi:

- `priority`: hanya provider pada `WEB_SEARCH_PROVIDER`; kegagalan tidak mencoba provider lain.
- `fallback`: mencoba `brave`, lalu `searxng`, lalu `duckduckgo`; berhenti pada respons pertama yang mempunyai hasil aman.
- `aggregate`: menjalankan seluruh provider terkonfigurasi, lalu menggabungkan, menormalisasi, mendeduplikasi, memberi skor, dan membatasi hasil.

Satu provider yang gagal ditandai dengan `partial_failure=true` bila provider lain selesai. Jika seluruh provider yang dicoba gagal, `all_providers_failed=true`. Exception provider diubah menjadi status `failed` tanpa stack trace atau detail internal.

## Kontrak model

`SearchQuery` membatasi query menjadi 2–500 karakter dan hasil menjadi 1–10. Kategori awal:

- `general`
- `health`
- `news`
- `education`
- `product_claim`
- `technology`

Tidak ada kategori diagnosis.

`SearchResult` mempunyai `title`, `url`, `snippet`, `domain`, `provider`, `published_at`, `score`, dan `is_mock`. `ProviderSearchResponse` menambahkan status, daftar hasil, kode/pesan error aman, waktu proses, dan label mock. `SearchRouterResponse` mencatat mode, strategi, provider yang diminta/selesai/gagal, respons per provider, hasil akhir, serta indikator kegagalan.

Status provider yang didukung:

```text
success mock empty disabled blocked timeout rate_limited
unavailable not_implemented failed
```

Model publik tidak memuat stack trace, path filesystem, environment variable, base URL internal, atau API key.

## Fixture simulasi

Skenario `WEB_SEARCH_MOCK_SCENARIO`:

- `success`
- `empty`
- `partial_failure`
- `all_failed`
- `timeout`
- `rate_limited`
- `duplicate_results`
- `provider_unavailable`

`partial_failure` menyimulasikan Brave berhasil, DuckDuckGo kosong, dan SearXNG timeout. Timeout hanya berupa status; tidak ada `sleep()` panjang. `duplicate_results` memberi beberapa varian URL pelacakan agar pipeline deduplikasi dapat diuji.

## Normalisasi URL

Normalizer menggunakan `urllib.parse` dari standard library. Ia:

- merapikan whitespace title dan snippet;
- mengambil domain dari URL;
- menormalkan alias identifier provider;
- hanya menerima skema `http` dan `https`;
- menolak `javascript:`, `data:`, `file:`, `ftp:`, URL berkredensial, dan URL rusak;
- membuang fragment;
- mengurutkan query parameter secara deterministik;
- menghapus hanya parameter pelacakan `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, dan `gclid`.

Parameter lain dipertahankan karena mungkin diperlukan halaman. URL yang tidak aman dibuang dari daftar akhir tanpa menghasilkan exception.

## Deduplikasi

Hasil dibandingkan memakai URL yang telah dinormalisasi. Identitas sekunder mempertimbangkan domain, path, query yang masih diperlukan, dan judul yang dinormalisasi sambil mengabaikan perbedaan skema. Judul yang sama pada path berbeda tetap dipertahankan agar sumber sah tidak terhapus terlalu agresif.

Jika halaman sama muncul dari beberapa provider, hanya satu kartu dipertahankan. Versi dengan snippet lebih lengkap dipilih dan skor mendapat bonus kecil berdasarkan dukungan provider berbeda. Bonus tersebut hanya sinyal ranking; sistem tidak menyatakan bahwa konten telah diverifikasi.

## Ranking

Ranking bersifat deterministik dan tanpa machine learning. Faktor yang dipakai:

- kecocokan kata query pada title dan snippet;
- kelengkapan title dan snippet;
- bonus hasil duplikat lintas provider;
- tipe sumber berdasarkan domain fixture;
- keberadaan dan tanggal `published_at` yang valid.

Untuk `health` dan `product_claim`, bobot tipe sumber berurutan: pemerintah, otoritas kesehatan, akademik, jurnal, produk resmi untuk datanya sendiri, media umum, komunitas, lalu tidak dikenal. HTTPS saja tidak dianggap bukti kredibilitas. Skor ini bukan penilaian medis dan bukan jaminan kebenaran.

## Search Guard

Search Guard dibangun dari `PolicyDecision`, intent, dan safety level yang sudah ada:

- `danger_sign` atau safety `emergency`: pencarian diblokir, `safety_first=true`, provider tidak dipanggil;
- `medication_request`: preview pencarian diblokir dan larangan Policy Engine seperti `give_personal_dose` tetap utuh agar search tidak menjadi jalan memutar untuk dosis personal;
- `product_claim`: pencarian sumber secara konseptual diperbolehkan, kategori dipaksa menjadi `product_claim`, dengan Brave dan SearXNG di depan serta DuckDuckGo tetap tersedia pada agregasi;
- salam dan intent yang knowledge lokalnya memadai: pencarian tidak diperlukan;
- kategori berita dapat memakai pencarian pada preview development.

Product claim yang diblokir Policy Engine tetap boleh menguji pencarian sumber di preview, tetapi keputusan block policy tidak dihapus dan hasil dummy tidak dipublikasikan melalui `/ask`.

## Endpoint preview development

`POST /search/preview` hanya tersedia bila:

```dotenv
WEB_SEARCH_PREVIEW_ENABLED=true
```

Defaultnya `false`. Jika `APP_ENV=production`, endpoint tetap mengembalikan 404 walaupun flag preview salah diaktifkan.

Contoh request:

```json
{
  "query": "cara menilai klaim produk kesehatan",
  "category": "product_claim",
  "strategy": "aggregate",
  "maxResults": 5
}
```

Endpoint membersihkan query, menjalankan Intent Router dan Policy Engine, mengevaluasi Search Guard, lalu memanggil Search Router hanya bila diizinkan. Respons mock menampilkan provider, status, URL `.example`, dan `is_mock=true`.

`/ask` tidak bergantung pada Web Search Router pada tahap ini. `sources=[]` tetap dipertahankan dan tidak ada fixture `.example` yang masuk ke `answer`, `sources`, `actions`, `recommendedAction`, atau knowledge frontend.

## Konfigurasi environment

```dotenv
WEB_SEARCH_MODE=mock
WEB_SEARCH_STRATEGY=aggregate
WEB_SEARCH_PROVIDERS=brave,duckduckgo,searxng
WEB_SEARCH_PROVIDER=brave
WEB_SEARCH_MAX_RESULTS=5
WEB_SEARCH_TIMEOUT_SECONDS=8
WEB_SEARCH_LANGUAGE=id
WEB_SEARCH_COUNTRY=ID
WEB_SEARCH_SAFE_SEARCH=true
WEB_SEARCH_PREVIEW_ENABLED=false
WEB_SEARCH_MOCK_SCENARIO=success

BRAVE_SEARCH_ENABLED=false
BRAVE_SEARCH_API_KEY=
DUCKDUCKGO_SEARCH_ENABLED=false
DUCKDUCKGO_BASE_URL=
SEARXNG_SEARCH_ENABLED=false
SEARXNG_BASE_URL=
SEARXNG_API_KEY=
```

`WEB_SEARCH_MAX_RESULTS` valid pada 1–10 dan timeout valid pada 1–30 detik. Language dan country harus berisi 2–10 karakter. Alias provider umum dinormalkan ke identifier resmi; provider tidak dikenal menghasilkan kegagalan terstruktur. API key tidak mempunyai nilai default dan tidak pernah dicetak ke log atau respons.

## Menjalankan test

Dari root repository:

```bash
npm ci
npm run check
python scripts/check_suspicious_unicode.py
```

Dari folder `backend`:

```bash
python -m compileall app tests
python -m unittest discover -s tests -p "test_*.py" -v
python tests/ci_smoke_test.py
python tests/policy_http_smoke_test.py
```

Smoke test HTTP memerlukan Uvicorn aktif seperti pada workflow CI. Unit test provider memblokir akses socket agar mode mock dan live-contract terbukti tidak melakukan jaringan.

## Privasi dan aktivasi live berikutnya

Query pengguna belum dikirim ke pihak ketiga. Sebelum provider live diaktifkan, pekerjaan berikutnya wajib menentukan:

- redaksi atau penghapusan data pribadi dari query;
- persetujuan dan batas data yang dikirim ke provider;
- pengelolaan secret hanya di server;
- rate limit, timeout, retry, cache, logging, dan retensi;
- kebijakan allowlist/blocklist domain dan penilaian sumber kesehatan;
- adapter respons khusus provider dan test kontraknya;
- observabilitas tanpa merekam isi sensitif;
- review keamanan serta deployment terkontrol.

Mengisi API key atau base URL saat ini tidak mengaktifkan jaringan. Mode `live` tetap `not_implemented` sampai adapter live dan seluruh pengamanan tersebut dibuat dalam pekerjaan terpisah.
