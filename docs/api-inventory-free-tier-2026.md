# Inventaris API Gratis dan Free Tier VitaNusa AI

**Status:** Registri keputusan teknis  
**Tanggal verifikasi:** 25 Juli 2026  
**Target biaya tahap awal:** Rp0  
**Cakupan:** API yang relevan dengan modul VitaNusa AI: pengetahuan, riset, kesehatan, pangan, Islam, data Indonesia, cuaca, peta, media, AI, dan infrastruktur.

## 1. Batas Kejujuran Dokumen

Tidak mungkin menjamin seluruh API gratis di internet tercantum selamanya. Layanan dapat muncul, ditutup, mengubah kuota, lisensi, atau syarat penggunaan kapan saja.

Dokumen ini dimaksudkan sebagai:

- inventaris seluas mungkin untuk kebutuhan VitaNusa yang telah didefinisikan;
- daftar keputusan, bukan daftar belanja;
- catatan tanggal verifikasi;
- pengaman agar istilah “gratis” tidak disalahartikan sebagai “gratis tanpa batas” atau “gratis untuk produksi komersial”.

Sebelum implementasi, pengembang wajib membuka dokumentasi resmi kembali dan memperbarui kolom `last_verified_at`.

## 2. Legenda

### Status akses

| Kode | Arti |
|---|---|
| `NOKEY` | Akses publik dasar tanpa API key |
| `FREE_KEY` | Memerlukan key gratis atau akun gratis |
| `APPROVAL` | Memerlukan pendaftaran, persetujuan, OAuth, lisensi, atau status organisasi tertentu |
| `LOCAL` | Berjalan lokal tanpa API eksternal |
| `NO_PUBLIC_API` | Tidak ditemukan API publik resmi yang layak dipakai |
| `PAID_NOT_ALLOWED` | Tidak masuk arsitektur nol biaya |

### Keputusan VitaNusa

| Keputusan | Arti |
|---|---|
| `CORE` | Fondasi yang layak dipasang lebih dahulu |
| `NEXT` | Dipasang setelah fondasi dan gate keamanan selesai |
| `OPTIONAL` | Berguna tetapi bukan kebutuhan inti |
| `MANUAL` | Gunakan tautan/verifikasi manusia, bukan integrasi otomatis |
| `BLOCKED` | Jangan diintegrasikan sebelum syarat atau izin jelas |
| `EXCLUDED` | Tidak digunakan pada tahap nol biaya |

## 3. Aturan Nol Biaya yang Tidak Boleh Dilanggar

```yaml
zero_cost_policy:
  monthly_budget_idr: 0
  payment_method_allowed: false
  cloud_billing_link_allowed: false
  automatic_paid_upgrade_allowed: false
  paid_fallback_allowed: false
  stop_when_free_quota_exhausted: true
  hard_quota_required: true
  secrets_in_frontend_allowed: false
  secrets_in_repository_allowed: false
```

Aturan operasional:

1. Jangan memasukkan kartu pembayaran.
2. Jangan menautkan Google Cloud Billing, AWS billing, atau akun penagihan lain.
3. Jangan mengaktifkan free trial yang otomatis berubah menjadi berbayar.
4. Semua API key disimpan di secret backend atau environment variable.
5. Terapkan hard limit internal di bawah batas provider.
6. Saat kuota tersisa 20%, hentikan batch nonprioritas.
7. Saat kuota habis, gunakan cache atau fallback lokal; jika tidak tersedia, proses berhenti.
8. Tidak ada provider berbayar sebagai fallback diam-diam.
9. Setiap respons menyimpan provider, URL sumber, lisensi/atribusi, dan waktu pengambilan.
10. Review syarat layanan minimal setiap 90 hari dan sebelum rilis besar.

## 4. Pengetahuan dan Ensiklopedia

| Layanan | Akses | Batas gratis/aturan penting | Fungsi VitaNusa | Keputusan |
|---|---|---|---|---|
| Wikimedia MediaWiki API | `NOKEY` | Wajib User-Agent yang jelas, batasi concurrency, hormati `Retry-After`; akses teridentifikasi mendapat batas lebih baik daripada trafik anonim | Pencarian dan ringkasan Wikipedia | `CORE` |
| Wikidata API/SPARQL | `NOKEY` | Data terstruktur CC0; query berat harus di-cache dan dibatasi | Fakta tokoh, tempat, tanggal, relasi | `CORE` |
| Wikimedia Commons | `NOKEY` | Periksa lisensi setiap berkas dan pertahankan atribusi | Gambar, audio, peta, manuskrip terbuka | `NEXT` |
| Open Library API | `NOKEY` | API publik ber-volume rendah; bukan backend massal. Gunakan data dump untuk kebutuhan bulk | Metadata buku dan penulis | `NEXT` |
| Library of Congress API | `NOKEY` | Tanpa key, tetapi rate limiting dan deep-paging limit berlaku | Arsip, foto, peta, koleksi sejarah | `NEXT` |
| Google Books API | `FREE_KEY` | Kuota dan metode dapat berubah; key harus dibatasi domain/IP | Metadata buku, ISBN, sampul | `OPTIONAL` |
| Europeana APIs | `FREE_KEY` | Memerlukan key dan atribusi; lisensi tiap objek perlu diperiksa | Warisan budaya dan manuskrip | `OPTIONAL` |
| Encyclopaedia Iranica | `NO_PUBLIC_API` | Open-access untuk dibaca, tetapi “All Rights Reserved”; API publik resmi tidak ditemukan | Referensi akademik Persia/Iran | `MANUAL` |

### Kebijakan Iranica

- Simpan metadata, penulis, judul, dan URL.
- Ringkas terbatas berdasarkan permintaan pengguna.
- Jangan crawl seluruh situs.
- Jangan membuat embeddings massal atau menerbitkan ulang artikel tanpa izin tertulis.

## 5. Riset, DOI, dan Literatur Ilmiah

| Layanan | Akses | Batas gratis/aturan penting | Fungsi | Keputusan |
|---|---|---|---|---|
| Crossref REST API | `NOKEY` | Tidak wajib mendaftar; kirim `mailto`/User-Agent dan gunakan cache | DOI dan metadata publikasi | `CORE` |
| OpenAlex API | `FREE_KEY` | Model freemium: key gratis memberi kredit harian gratis. Penggunaan setelah kredit gratis dapat berbayar | Paper, penulis, institusi, sitasi | `CORE` dengan hard stop |
| DataCite REST API | `NOKEY` | Retrieval publik tanpa autentikasi; metadata terbuka, banyak berstatus CC0 | DOI dataset dan laporan | `NEXT` |
| PubMed/NCBI E-utilities | `NOKEY` / `FREE_KEY` | Sekitar 3 req/detik tanpa key dan 10 req/detik dengan key gratis; gunakan email/tool identity | Literatur biomedis | `CORE` |
| Europe PMC REST API | `NOKEY` | API publik; periksa hak full text per artikel | Literatur medis dan life sciences | `CORE` |
| Unpaywall API | `NOKEY` | Parameter email wajib; batas publik sangat besar tetapi tetap harus di-cache | Menemukan salinan open-access legal | `NEXT` |
| OpenCitations | `NOKEY` | Token dianjurkan; rate limit publik berlaku | Hubungan sitasi | `NEXT` |
| DOAJ | `NOKEY` | Metadata terbuka; jalur OAI publik dapat lebih lambat daripada layanan premium | Jurnal open-access terkurasi | `NEXT` |
| Semantic Scholar Academic Graph | `APPROVAL` | Key/rate limit perlu dikonfirmasi saat pendaftaran | Paper, sitasi, rekomendasi | `OPTIONAL` |
| ORCID Public API | `APPROVAL` | Kesesuaian penggunaan komersial dan lisensi harus diperiksa | Identitas peneliti | `OPTIONAL` |

### Koreksi penting OpenAlex

OpenAlex tidak boleh ditulis sebagai “gratis tanpa batas”. Arsitektur VitaNusa harus:

```text
kredit gratis tersedia
→ gunakan cache dan hard quota
→ kredit gratis habis
→ hentikan request OpenAlex
→ fallback ke Crossref/DataCite/PubMed atau pencarian lokal
```

Tidak boleh melanjutkan ke penggunaan berbayar.

## 6. Kesehatan, Obat, dan Penelitian Klinis

| Layanan | Akses | Batas/aturan penting | Fungsi | Keputusan |
|---|---|---|---|---|
| ClinicalTrials.gov API v2 | `NOKEY` | Data studi klinis; status studi tidak sama dengan bukti efektivitas | Uji klinis | `CORE` |
| openFDA | `FREE_KEY` | Gunakan key gratis dan hard quota; data tidak boleh menjadi satu-satunya dasar keputusan medis | Label, recall, adverse events | `NEXT` |
| RxNorm/RxNav APIs | `NOKEY` | Normalisasi istilah obat; bukan pemberi resep | Nama dan relasi obat | `CORE` |
| DailyMed REST API | `NOKEY` | Label obat resmi AS; konteks negara tetap perlu dijelaskan | Label dan peringatan obat | `CORE` |
| MedlinePlus Connect | `NOKEY` | Gratis; tampilkan data/tautan dengan atribusi. Jangan menyalin halaman penuh | Edukasi pasien | `CORE` |
| MyHealthfinder API | `NOKEY` | Konten pencegahan untuk masyarakat; ikuti terms dan atribusi | Pencegahan kesehatan | `NEXT` |
| WHO ICD API | `APPROVAL` | OAuth client credentials; lisensi dan penggunaan kode harus dipatuhi | Klasifikasi penyakit | `NEXT` |
| UMLS API | `APPROVAL` | Akun UTS dan lisensi sumber terminologi; tidak semua terminologi bebas | Terminologi medis | `OPTIONAL` |
| SATUSEHAT Sandbox | `APPROVAL` | Akun developer dan kredensial sandbox; jangan menaruh secret di klien | Pengembangan interoperabilitas FHIR | `OPTIONAL` |
| SATUSEHAT Production | `APPROVAL` | Terbatas pada pihak ekosistem kesehatan yang terverifikasi | Integrasi fasilitas resmi | `BLOCKED` sampai memenuhi syarat |

### Aturan kesehatan

- Tidak mendiagnosis.
- Tidak membuat resep.
- Tidak menyuruh menghentikan obat dokter.
- Tidak menjanjikan kesembuhan.
- Selalu tampilkan tanda bahaya dan arahan mencari tenaga kesehatan.
- Data AS harus diberi konteks; jangan otomatis dianggap sebagai aturan Indonesia.

## 7. Nutrisi, Makanan, Produk, dan Halal

| Layanan | Akses | Batas/aturan penting | Fungsi | Keputusan |
|---|---|---|---|---|
| USDA FoodData Central | `FREE_KEY` | Key Data.gov gratis; sekitar 1.000 req/jam/IP; data CC0; key tidak boleh dibuka | Nutrisi bahan dan produk | `CORE` |
| Open Food Facts | `NOKEY` | Saat verifikasi: 15 pembacaan produk/menit/IP dan 10 pencarian/menit/IP; jangan search-as-you-type; data crowdsourced | Barcode, komposisi, alergen, nutrisi | `NEXT` |
| BPOM Cek Produk | `NO_PUBLIC_API` | API developer publik resmi belum dikonfirmasi | Verifikasi izin edar Indonesia | `MANUAL` |
| BPJPH Cek Produk Halal | `NO_PUBLIC_API` | API developer publik resmi belum dikonfirmasi | Verifikasi sertifikat halal | `MANUAL` |

Aturan halal:

- Tidak menyatakan halal hanya karena komposisi tampak aman.
- Tidak menyatakan haram hanya karena data tidak lengkap.
- Status resmi harus diverifikasi ke BPJPH atau sertifikat yang sah.
- Open Food Facts bukan pengganti BPOM atau BPJPH.
- Jangan scraping massal portal pemerintah tanpa izin.

## 8. Al-Qur'an, Hadis, Waktu Salat, dan Konten Islam

| Layanan | Akses | Batas/aturan penting | Fungsi | Keputusan |
|---|---|---|---|---|
| Korpus Al-Qur'an lokal terverifikasi | `LOCAL` | Teks dikunci dengan checksum dan reviewer; sumber terjemahan dicatat | Sumber utama teks ayat | `CORE` |
| Al Quran Cloud API | `NOKEY` | API terbuka; tetap harus dibandingkan dan dikunci secara lokal sebelum produksi | Bootstrap ayat/surah/audio | `NEXT` sebagai sumber sekunder |
| Quran Foundation/Quran.com API | `APPROVAL` | OAuth2/client credentials; secret wajib di backend; jangan auto-translate teks Al-Qur'an | Ayat, tafsir, audio, pencarian | `NEXT` |
| AlAdhan API | `NOKEY` | API waktu salat dan kalender; metode hitung/lokasi harus ditampilkan | Jadwal salat dan Hijriah | `NEXT` |
| Whitelist hadis lokal | `LOCAL` | Kitab, nomor, teks, derajat, sumber penilaian, reviewer wajib | Hadis untuk konten produksi | `CORE` |
| Sunnah.com API/repository | `APPROVAL` | Jangan menganggap key produksi otomatis tersedia; konfirmasi akses dan terms atau self-host sesuai lisensi | Pencarian hadis pendukung | `BLOCKED` sampai akses/legal jelas |
| Dorar Hadith | `APPROVAL` | API publik dan hak penggunaan belum dikonfirmasi secara memadai | Takhrij Arab | `BLOCKED` |
| HadithAPI.com dan API pihak ketiga sejenis | `FREE_KEY` | Bukan otoritas primer; data wajib diverifikasi ke kitab dan ulama | Pencarian awal saja | `OPTIONAL`, tidak untuk dalil final |

Aturan agama:

- API hanya kurir data, bukan mufti.
- AI tidak boleh membuat ayat atau hadis dari ingatan.
- AI tidak boleh menetapkan ijma'.
- AI tidak boleh menentukan derajat hadis tanpa sumber penilaian.
- Untuk khilaf, tampilkan adanya perbedaan dan rujuk reviewer syariah.
- Wikipedia, Iranica, dan jurnal akademik bukan dalil syariat.

## 9. Data Indonesia dan Data Global

| Layanan | Akses | Batas/aturan penting | Fungsi | Keputusan |
|---|---|---|---|---|
| BMKG Data Terbuka | `NOKEY` | Sekitar 60 req/menit/IP pada endpoint yang dipublikasikan; atribusi BMKG wajib | Cuaca, gempa, peringatan | `CORE` |
| BPS WebAPI | `APPROVAL` | Gunakan portal developer/token resmi; cek kuota aktual saat registrasi | Statistik Indonesia | `CORE` setelah token |
| Data.go.id | Bervariasi | Katalog nasional; metode akses berbeda per dataset/instansi | Penemuan data pemerintah | `OPTIONAL` |
| World Bank Indicators API | `NOKEY` | Tidak memerlukan key; data harus diberi nama indikator/tahun | Ekonomi dan pembangunan | `NEXT` |

## 10. Cuaca, Iklim, Udara, Peta, dan Rute

| Layanan | Akses | Batas/aturan penting | Fungsi | Keputusan |
|---|---|---|---|---|
| BMKG | `NOKEY` | Sumber utama Indonesia; atribusi wajib | Cuaca/gempa | `CORE` |
| NASA POWER | `NOKEY` | Gunakan untuk iklim/energi/pertanian, bukan cuaca darurat lokal | Data iklim historis | `NEXT` |
| NASA APIs | `FREE_KEY` | `DEMO_KEY` sangat terbatas; key terdaftar memiliki kuota gratis | Data sains/astronomi | `OPTIONAL` |
| OpenAQ | `FREE_KEY` | Key gratis dan rate limit berlaku | Kualitas udara | `NEXT` |
| Geoapify | `FREE_KEY` | Kredit gratis harian; atribusi dan pembatasan paket berlaku | Geocoding/tempat | `OPTIONAL` |
| openrouteservice | `FREE_KEY` | Batas per endpoint; hindari batch besar | Rute dan isochrone | `OPTIONAL` |
| Nominatim publik | `NOKEY` | Sekitar 1 req/detik; tidak untuk autocomplete berat atau bulk geocoding | Geocoding ringan | `OPTIONAL` |
| Open-Meteo | `NOKEY` | Paket publik gratis memiliki batas dan ketentuan nonkomersial; review sebelum penggunaan bisnis | Cuaca alternatif | `BLOCKED` untuk produksi komersial sampai legal jelas |
| WeatherAPI | `FREE_KEY` | Free plan terbatas dan atribusi/fitur berubah menurut paket | Cuaca cadangan | `OPTIONAL` |
| OpenWeather | `FREE_KEY` | Kuota gratis terbatas; periksa endpoint yang termasuk paket | Cuaca cadangan | `OPTIONAL` |

## 11. AI Teks, Terjemahan, Pencarian, dan Berita

| Layanan | Akses | Batas/aturan penting | Fungsi | Keputusan |
|---|---|---|---|---|
| Ollama/llama.cpp + model disetujui | `LOCAL` | Periksa lisensi tiap model; membutuhkan perangkat dan listrik | Penulis lokal dan privasi | `CORE` |
| Google Gemini API free tier | `FREE_KEY` | Hanya model/kuota tertentu; jangan kirim data sensitif; hentikan saat kuota habis | Cadangan generasi/ringkasan | `NEXT` |
| Groq free tier | `FREE_KEY` | Rate limit berbeda per model; upgrade berbayar dilarang | Inferensi cepat cadangan | `NEXT` |
| Cloudflare Workers AI | `FREE_KEY` | Free allocation dapat berubah; cek dashboard; hard limit wajib | Tugas kecil/serverless AI | `OPTIONAL` |
| Hugging Face Inference Providers | `FREE_KEY` | Kredit gratis sangat kecil dan dapat berubah | Eksperimen saja | `OPTIONAL` |
| DeepL API Free | `FREE_KEY` | Batas karakter bulanan; hentikan saat kuota habis | Terjemahan umum, bukan terjemahan Al-Qur'an | `OPTIONAL` |
| GDELT | `NOKEY` | Data penemuan berita/peristiwa; selalu verifikasi ke penerbit asli | Monitoring isu global | `NEXT` |
| Brave Search API | `FREE_KEY` | Kredit gratis dan syarat dashboard dapat berubah; hard quota wajib | Pencarian web | `OPTIONAL` |
| Guardian Open Platform | `APPROVAL` | Paket gratis terutama nonkomersial dan terbatas | Berita | `OPTIONAL` |
| NewsAPI free developer plan | `PAID_NOT_ALLOWED` | Paket gratis bukan untuk produksi dan berita dapat tertunda | Berita | `EXCLUDED` |
| OpenAI API | `PAID_NOT_ALLOWED` | Tidak dimasukkan sebagai fondasi nol biaya | AI | `EXCLUDED` pada fase Rp0 |

## 12. Gambar, Video, Buku, dan Media

| Layanan | Akses | Batas/aturan penting | Fungsi | Keputusan |
|---|---|---|---|---|
| ComfyUI + model gambar disetujui | `LOCAL` | Periksa lisensi model/checkpoint; simpan metadata generasi | Produksi panel komik lokal | `CORE` setelah visual gate |
| Wikimedia Commons | `NOKEY` | Lisensi per berkas; atribusi wajib sesuai lisensi | Media sejarah/edukasi | `NEXT` |
| YouTube Data API | `FREE_KEY` | Kuota default berbasis unit; pencarian mahal dibanding read; tidak memberi hak mengunduh/menyalin video | Metadata video | `NEXT` |
| Pexels API | `FREE_KEY` | Kuota dan kewajiban link/atribusi; jangan menjual ulang koleksi | Stok gambar/video | `OPTIONAL` |
| Google Books API | `FREE_KEY` | Metadata/sampul bukan izin menyalin isi buku | Buku | `OPTIONAL` |
| Europeana | `FREE_KEY` | Periksa rights statement setiap objek | Seni/warisan budaya | `OPTIONAL` |

## 13. Backend, Database, Keamanan, dan Notifikasi

| Layanan | Akses | Batas/aturan penting | Fungsi | Keputusan |
|---|---|---|---|---|
| Firebase Spark | `FREE_KEY` | Tidak memerlukan payment method; jika kuota produk terlampaui, layanan dapat berhenti. Menautkan billing dapat menaikkan ke Blaze | Auth, Firestore, Storage | `CORE` dengan billing lock |
| GitHub Pages/repository publik | `FREE_KEY` | Bukan tempat menyimpan secret atau data pribadi | Hosting statis, versi, audit | `CORE` |
| GitHub Actions repo publik | `FREE_KEY` | Runner standar untuk repo publik dapat digunakan tanpa biaya; hindari layanan eksternal berbayar | CI dan validator | `CORE` |
| Cloudflare Workers free | `FREE_KEY` | Batas request/CPU harian; hard quota dan cache | API gateway | `NEXT` |
| Cloudflare Turnstile | `FREE_KEY` | Paket gratis; validasi token wajib di server | Perlindungan bot | `NEXT` |
| Supabase free | `FREE_KEY` | Dua proyek gratis; proyek tidak aktif dapat dipause; jangan jadikan duplikasi tanpa kebutuhan | Backend alternatif | `OPTIONAL` |
| Resend free | `FREE_KEY` | Sekitar 3.000 email/bulan dan batas harian; domain perlu diverifikasi | Email transaksi | `OPTIONAL` |
| Telegram Bot API | `FREE_KEY` | Token rahasia; patuhi rate limit dan privasi | Notifikasi admin | `OPTIONAL` |
| Google OAuth | `FREE_KEY` | Client secret hanya di backend; consent screen dan redirect URI harus benar | Login | `OPTIONAL` |
| OneSignal free | `FREE_KEY` | Jangan mengirim data kesehatan sensitif melalui push; periksa terms paket | Push notification | `OPTIONAL` |

## 14. Urutan Implementasi yang Disetujui

### Prioritas 0 — Pagar dan fondasi

1. Budget gate Rp0.
2. Secret management.
3. Source registry.
4. Cache, timeout, retry terbatas, dan circuit breaker.
5. Audit log.
6. Firebase Spark tanpa billing.
7. GitHub Actions validator.
8. Model lokal untuk teks.

### Prioritas 1 — Pengetahuan dan kesehatan inti

1. Wikimedia API.
2. Wikidata.
3. Crossref.
4. PubMed/NCBI.
5. Europe PMC.
6. ClinicalTrials.gov.
7. RxNorm.
8. DailyMed.
9. MedlinePlus Connect.
10. USDA FoodData Central.
11. BMKG.
12. BPS setelah token resmi.
13. Korpus Al-Qur'an dan whitelist hadis lokal.

### Prioritas 2 — Penguatan

1. OpenAlex dengan hard stop kredit gratis.
2. DataCite.
3. Unpaywall.
4. OpenCitations.
5. DOAJ.
6. Open Food Facts.
7. Quran Foundation.
8. AlAdhan.
9. OpenAQ.
10. GDELT.
11. YouTube Data API.
12. Cloudflare Workers dan Turnstile.

### Prioritas 3 — Opsional

- Google Books;
- Europeana;
- Library of Congress;
- Geoapify;
- openrouteservice;
- NASA;
- Pexels;
- DeepL;
- Resend;
- Telegram;
- Supabase sebagai alternatif.

### Diblokir atau manual

- Iranica: metadata/link/ringkasan terbatas; izin sebelum RAG massal.
- BPOM dan BPJPH: verifikasi manual sampai API resmi dikonfirmasi.
- SATUSEHAT produksi: hanya setelah memenuhi syarat institusional.
- Sunnah.com/Dorar: jangan produksi sebelum akses dan hak penggunaan jelas.
- Open-Meteo untuk penggunaan komersial: review syarat dahulu.
- NewsAPI free developer plan: jangan dipakai produksi.
- Semua provider berbayar: dilarang pada fase Rp0.

## 15. Bentuk Data Registri API

```json
{
  "providerId": "openalex",
  "name": "OpenAlex API",
  "category": "research",
  "access": "FREE_KEY",
  "decision": "CORE_HARD_STOP",
  "officialDocs": "https://developers.openalex.org/",
  "freeBoundary": "$1/day free API credit at verification date",
  "commercialUseReviewed": true,
  "licenseReviewed": true,
  "attributionRequired": false,
  "secretLocation": "backend-secret-store",
  "hardDailyLimit": true,
  "paidFallback": false,
  "lastVerifiedAt": "2026-07-25",
  "nextReviewAt": "2026-10-25",
  "owner": "platform-admin"
}
```

## 16. Checklist Sebelum Mengaktifkan API

- [ ] Dokumentasi resmi dibuka pada hari implementasi.
- [ ] Gratis untuk jenis penggunaan VitaNusa, bukan hanya demo pribadi.
- [ ] Penggunaan komersial telah diperiksa.
- [ ] Tidak membutuhkan kartu atau billing account.
- [ ] Kuota gratis tercatat.
- [ ] Hard quota internal telah dibuat.
- [ ] Paid fallback dinonaktifkan.
- [ ] Secret hanya berada di backend.
- [ ] Domain/IP/API restriction telah dipasang bila tersedia.
- [ ] User-Agent dan kontak pengembang telah diatur.
- [ ] Cache, timeout, retry terbatas, dan backoff telah diuji.
- [ ] Lisensi data dan kewajiban atribusi telah dicatat.
- [ ] Data sensitif tidak dikirim ke provider yang tidak sesuai.
- [ ] Jalur penghapusan dan koreksi data tersedia.
- [ ] Provider outage tidak membuat aplikasi berhenti total.
- [ ] Tanggal pemeriksaan ulang telah dijadwalkan.

## 17. Referensi Resmi Utama

### Wikimedia dan pengetahuan

- https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy
- https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits
- https://www.wikidata.org/wiki/Wikidata:Data_access
- https://openlibrary.org/developers/api
- https://www.loc.gov/apis/json-and-yaml/

### Riset

- https://www.crossref.org/documentation/retrieve-metadata/rest-api/
- https://developers.openalex.org/
- https://support.datacite.org/reference/introduction
- https://www.ncbi.nlm.nih.gov/books/NBK25501/
- https://europepmc.org/RestfulWebService
- https://unpaywall.org/products/api
- https://api.opencitations.net/
- https://doaj.org/api/guide

### Kesehatan dan pangan

- https://clinicaltrials.gov/data-api/api
- https://open.fda.gov/apis/
- https://lhncbc.nlm.nih.gov/RxNav/APIs/
- https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm
- https://medlineplus.gov/medlineplus-connect/
- https://health.gov/myhealthfinder-api
- https://fdc.nal.usda.gov/api-guide/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/

### Indonesia

- https://data.bmkg.go.id/
- https://webapi.bps.go.id/documentation
- https://satusehat.kemkes.go.id/platform/docs/
- https://cekbpom.pom.go.id/
- https://bpjph.halal.go.id/

### Islam

- https://alquran.cloud/api
- https://api-docs.quran.com/
- https://aladhan.com/prayer-times-api
- https://github.com/sunnah-com/api

### Infrastruktur dan AI

- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/turnstile/plans/
- https://supabase.com/pricing
- https://resend.com/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://console.groq.com/docs/rate-limits
- https://github.com/ollama/ollama
- https://github.com/ggml-org/llama.cpp
- https://github.com/comfyanonymous/ComfyUI

## 18. Keputusan Penutup

Inventaris ini tidak memerintahkan pemasangan semua API. Prinsip resmi VitaNusa:

> **Pakai sumber sesedikit mungkin, seotoritatif mungkin, dengan biaya nol, atribusi benar, hard quota, dan jalur berhenti yang jelas.**

Banyak API tidak otomatis menghasilkan ilmu yang baik. Tanpa hierarki sumber dan pemeriksaan, ia hanya menghasilkan kebingungan dengan koneksi internet yang sangat rajin.