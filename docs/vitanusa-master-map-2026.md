# Peta Induk VitaNusa AI 2026

**Status:** Dokumen navigasi arsitektur tertinggi  
**Tanggal:** 25 Juli 2026  
**Repositori:** `abdu7-bot/VitaNusa-AI`

## 1. Fungsi Dokumen Ini

Peta ini menyatukan arah VitaNusa AI agar fitur kesehatan, VitaCheck, produk, artikel, komik, novel, sumber eksternal, AI, dan admin tidak berkembang dengan aturan yang saling bertentangan.

Dokumen rinci yang menjadi bagian peta induk:

1. [Peta Besar VitaNusa AI](./vitanusa-map.md) — identitas, fitur publik, produk, dan arah platform.
2. [Firebase Admin Architecture Plan](./firebase-admin-plan.md) — autentikasi, Firestore, Storage, admin, dan migrasi.
3. [Peta Produksi Kreatif Gratis dan Ketat](./vitanusa-creative-production-zero-cost.md) — novel, komik, syariah, review, dan budget gate.
4. [Inventaris API Gratis dan Free Tier 2026](./api-inventory-free-tier-2026.md) — sumber data, API key, batas biaya, lisensi, dan keputusan integrasi.
5. [Peta Navigator Kesehatan Multi-Bidang Rp0](./vitanusa-health-navigator-zero-cost.md) — intended use, emergency gate, ruang edukasi, privasi, pemisahan produk, dan validasi.
6. [Katalog Novel](../documents/novel/README.md) — status karya novel yang benar-benar tersedia.
7. Direktori [`komik/`](../komik/) — implementasi komik statis yang sudah ada.

Apabila dua dokumen memberi arahan berbeda, urutan penyelesaian konflik adalah:

```text
Konstitusi syariah dan keselamatan
→ kebijakan privasi/hukum/hak cipta
→ peta induk ini
→ dokumen modul
→ roadmap
→ issue atau instruksi proyek
→ prompt AI
```

## 2. Identitas dan Amanah Platform

VitaNusa AI adalah platform edukasi yang membantu pengguna memahami kesehatan, kebiasaan hidup, produk, sumber pengetahuan, serta cerita yang membawa hikmah.

VitaNusa bukan:

- dokter atau alat diagnosis;
- pemberi resep;
- mufti atau pengganti ahli ilmu;
- mesin klaim produk;
- penerbit otomatis tanpa editor;
- pengumpul data pribadi tanpa kebutuhan;
- mesin penyalin konten berhak cipta.

Prinsip tetap:

- jujur;
- tidak membuat klaim palsu;
- tidak menakut-nakuti;
- tidak memanipulasi emosi untuk menjual;
- membedakan fakta, analisis, dugaan, dan fiksi;
- mengutamakan sumber primer dan otoritatif;
- menyimpan jejak sumber dan keputusan;
- berhenti ketika data atau kewenangan tidak cukup.

## 3. Hierarki Platform

```text
TINGKAT 0 — AL-QUR'AN DAN SUNNAH YANG SAHIH
TINGKAT 1 — IJMA' YANG BENAR-BENAR TERBUKTI
TINGKAT 2 — IJTIHAD/QIYAS ULAMA YANG KOMPETEN
TINGKAT 3 — KESELAMATAN, HUKUM, PRIVASI, DAN HAK CIPTA
TINGKAT 4 — PRINSIP AMANAH VITANUSA
TINGKAT 5 — SOURCE REGISTRY DAN MODEL REGISTRY
TINGKAT 6 — WORKFLOW DAN APPROVAL GATES
TINGKAT 7 — FITUR PUBLIK DAN ADMIN
TINGKAT 8 — INSTRUKSI PROYEK DAN PROMPT AI
```

AI selalu berada pada tingkat terendah. AI boleh membantu, tetapi tidak dapat membatalkan pagar di atasnya.

## 4. Struktur Produk

```text
VitaNusa AI
│
├── Nusa Chat
│   ├── edukasi umum
│   ├── pencarian sumber
│   └── arahan aman
│
├── VitaCheck
│   ├── refleksi kebiasaan
│   ├── skor non-diagnostik
│   └── tanda kapan mencari bantuan
│
├── Navigator Kesehatan Multi-Bidang
│   ├── emergency gate sebelum routing lain
│   ├── ruang edukasi, bukan dokter spesialis
│   ├── sumber terkurasi dan sitasi
│   ├── langkah aman serta pertanyaan untuk tenaga kesehatan
│   └── tanpa diagnosis, resep, atau rekomendasi produk personal
│
├── Edukasi
│   ├── artikel kesehatan
│   ├── literasi produk
│   ├── mitos vs fakta
│   └── refleksi Islami terkurasi
│
├── VitaStory
│   ├── novel
│   ├── komik
│   ├── cerita pendek
│   ├── audio story
│   └── storyboard
│
├── Produk
│   ├── katalog terverifikasi
│   ├── BPOM/halal manual atau resmi
│   └── larangan klaim kesembuhan
│
├── Media
│   ├── video edukasi
│   ├── gambar
│   └── PDF/dokumen
│
└── Admin dan Governance
    ├── autentikasi
    ├── content management
    ├── source registry
    ├── model registry
    ├── review queue
    ├── approval gates
    ├── audit log
    └── incident/correction system
```

## 5. Aturan Status Konten

### 5.1 Konten kreatif

Semua novel, komik, storyboard, audio story, prompt gambar, dan hasil AI baru harus dimulai dengan:

```text
status = DRAFT
```

Konten kreatif hanya dapat menjadi `PUBLISHED` melalui state machine pada [Peta Produksi Kreatif](./vitanusa-creative-production-zero-cost.md).

### 5.2 Pemisahan dari aturan artikel lama

Dokumen admin sebelumnya mencatat alur artikel yang memaksa penyimpanan menjadi `published`. Apa pun alasan historisnya, **aturan tersebut tidak boleh diwariskan kepada novel, komik, media AI, atau konten agama sensitif**.

Implementasi baru wajib mempunyai koleksi, schema, dan fungsi publikasi tersendiri. Tidak boleh memakai satu fungsi `saveAndPublish()` untuk seluruh jenis konten.

### 5.3 Sasaran pembenahan artikel

Untuk keselamatan jangka panjang, alur artikel sensitif juga sebaiknya dievaluasi menuju:

```text
DRAFT → REVIEWED → APPROVED → PUBLISHED
```

Namun perubahan terhadap artikel yang sudah berjalan harus dilakukan pada tugas terpisah setelah audit dampak, agar tidak merusak konten publik saat ini.

## 6. Arsitektur Data yang Disarankan

```text
Firestore / database
│
├── admins
├── users
├── articles
├── creativeProjects
│   ├── project metadata
│   ├── source set
│   ├── research pack
│   ├── drafts
│   ├── reviews
│   ├── approvals
│   └── audit log
├── comics
│   └── panels
├── novels
│   └── chapters
├── sourceRegistry
├── modelRegistry
├── apiRegistry
├── mediaIndex
├── incidentReports
└── siteSettings
```

Secret, API key, token, password, private key, dan service-account credential tidak boleh disimpan di Firestore, repository, HTML, atau JavaScript publik.

## 7. Source Router

Pertanyaan tidak dikirim ke semua API sekaligus.

```text
Pertanyaan pengguna
        ↓
klasifikasi domain dan risiko
        ↓
pilih sumber paling otoritatif yang diperlukan
        ↓
cek cache dan kuota
        ↓
ambil data minimum
        ↓
validasi, sanitasi, dan bandingkan bila perlu
        ↓
jawaban + sumber + tanggal pengambilan + batasan
```

Contoh rute:

- pengetahuan umum: Wikimedia/Wikidata;
- jurnal: Crossref, PubMed, Europe PMC, OpenAlex dengan hard stop;
- obat: RxNorm, DailyMed, MedlinePlus;
- nutrisi: USDA, lalu Open Food Facts sebagai data crowdsourced;
- Indonesia: BMKG dan BPS;
- halal/BPOM: verifikasi manual sampai API resmi tersedia;
- agama: korpus Al-Qur'an dan whitelist hadis lokal yang terverifikasi;
- berita: GDELT untuk penemuan, lalu sumber penerbit asli untuk verifikasi.

Daftar keputusan lengkap berada di [Inventaris API](./api-inventory-free-tier-2026.md).

## 8. Navigator Kesehatan Multi-Bidang

Arah kesehatan resmi adalah **navigator edukasi**, bukan dokter, alat diagnosis, atau persona spesialis. Istilah multi-bidang hanya berarti sistem memilih sumber, policy, dan format jawaban yang relevan.

```text
intake minimum dan consent
→ emergency gate
→ specialized policies
→ router ruang edukasi
→ approved health sources
→ constrained AI draft
→ claim/citation/privacy validation
→ edukasi + langkah aman + rujukan
```

Aturan inti:

- emergency gate berjalan sebelum artikel, AI, VitaCheck, dan produk;
- diagnosis, diagnosis banding personal, dosis, resep, dan penghentian obat dilarang;
- anak, kehamilan, menyusui, penyakit kronis, dan krisis mental memakai mode lebih konservatif;
- UI memakai label `Ruang Edukasi`, bukan `Dokter Spesialis`; persona AI tidak memakai gelar atau identitas klinis;
- data kesehatan diminimalkan, penyimpanan lokal menjadi default, dan cloud bersifat opt-in;
- keluhan personal tidak boleh menghasilkan rekomendasi produk;
- model bahasa tidak menjadi satu-satunya classifier risiko;
- tanpa reviewer kompeten, ruang high-risk tetap `EDUCATION_ONLY` atau `BLOCKED_REVIEWER_UNAVAILABLE`.

Rancangan lengkap berada di [Peta Navigator Kesehatan Multi-Bidang Rp0](./vitanusa-health-navigator-zero-cost.md).

## 9. Arsitektur Nol Biaya

```text
Frontend statis VitaNusa
        ↓
Firebase Spark tanpa billing
        ↓
API gateway gratis atau worker lokal
        ↓
cache dan hard quota
        ↓
API gratis yang disetujui
        ↓
fallback lokal
        ↓
STOP bila kuota habis
```

Aturan:

- target biaya bulanan tahap awal Rp0;
- payment method dan cloud billing dilarang;
- tidak ada auto-upgrade;
- tidak ada fallback ke endpoint berbayar;
- provider yang menghabiskan kuota harus berhenti;
- model lokal adalah jalur utama untuk produksi naskah;
- free tier cloud hanya cadangan dan tidak menerima data sensitif;
- semua lisensi model dan dataset diregistrasi sebelum digunakan.

## 10. Arsitektur Produksi Kreatif

```text
Tema
→ klasifikasi risiko
→ sumber dikunci
→ riset disetujui
→ outline disetujui
→ AI membuat draf
→ pemeriksaan otomatis
→ review manusia
→ review syariah/fakta/visual sesuai risiko
→ final approval
→ publikasi
→ koreksi dan penarikan bila perlu
```

Prinsip pokok:

- AI tidak menetapkan fatwa;
- AI tidak mengarang ayat dan hadis;
- AI tidak menetapkan ijma';
- tidak menggambarkan Allah, Nabi, dan Rasul;
- tidak ada aurat, seksualisasi, fitnah, atau plagiarisme;
- fakta sejarah dibedakan dari rekonstruksi dan fiksi;
- tanpa reviewer kompeten, karya risiko tinggi tetap diblokir;
- satu validator gagal memblokir publikasi.

## 11. Peran dan Kewenangan

| Peran | Kewenangan |
|---|---|
| Owner | Persetujuan akhir, pengaturan biaya, dan penarikan publikasi |
| Platform admin | Sistem, registry, role, dan audit |
| Editor | Bahasa, struktur, dan kualitas |
| Fact reviewer | Fakta kesehatan, sejarah, hukum, dan tokoh nyata |
| Sharia reviewer | Ayat, hadis, akidah, fikih, dan khilaf |
| Visual reviewer | Aurat, pose, simbol, dan keamanan anak |
| Copyright reviewer | Lisensi dan kemiripan karya |
| AI worker | Hanya membuat atau merevisi draf |

Tidak ada AI role yang mempunyai izin `publish`.

## 12. Roadmap Terpadu

### Fase A — Kunci arah

- [x] Peta platform awal tersedia.
- [x] Peta produksi kreatif ketat tersedia.
- [x] Inventaris API gratis tersedia.
- [ ] Source registry machine-readable.
- [ ] Model registry machine-readable.
- [ ] Budget lock configuration.

### Fase B — Pembenahan fondasi admin

- [ ] Role terpisah owner/editor/reviewer.
- [ ] Review queue.
- [ ] Approval records.
- [ ] Audit log.
- [ ] Secret management.
- [ ] Tidak ada fungsi generik yang langsung publish konten AI.

### Fase C — Studio novel

- [ ] Form proyek.
- [ ] Risk classifier.
- [ ] Research pack.
- [ ] Story bible.
- [ ] Outline dan chapter drafts.
- [ ] Fact/sharia/editor review.
- [ ] PDF/EPUB hanya dari final-approved version.

### Fase D — Studio komik teks

- [ ] Pembagian panel.
- [ ] Character bible.
- [ ] Storyboard.
- [ ] Prompt registry.
- [ ] Visual safety rules.

### Fase E — Produksi gambar lokal

- [ ] ComfyUI worker.
- [ ] Approved model registry.
- [ ] Generation metadata.
- [ ] Visual review queue.
- [ ] Panel continuity check.

### Fase F — Integrasi API inti

- [ ] Wikimedia/Wikidata.
- [ ] Crossref/PubMed/Europe PMC.
- [ ] RxNorm/DailyMed/MedlinePlus.
- [ ] USDA/BMKG/BPS.
- [ ] Korpus Al-Qur'an dan whitelist hadis.
- [ ] Hard quota dan provider health check.

### Fase G — Publikasi aman

- [ ] Public reads hanya untuk `PUBLISHED`.
- [ ] PUBLISHED hanya berasal dari `FINAL_APPROVED`.
- [ ] Correction channel.
- [ ] Withdrawal mechanism.
- [ ] Public source notes dan disclaimer.

### Fase H — Navigator kesehatan Rp0

- [x] Intended use dan arsitektur sasaran tersedia.
- [ ] Audit content rendering security selesai.
- [ ] Emergency gate terstruktur dengan negation/context tests.
- [ ] Intake minimum dan consent terpisah.
- [ ] Health source/evidence registry machine-readable.
- [ ] Ruang edukasi prioritas dengan structured response contract.
- [ ] Pemisahan keras keluhan personal dari rekomendasi produk.
- [ ] AI lokal terbatas dengan claim, citation, authority, dan privacy gates.
- [ ] Golden test set bahasa Indonesia dan review tenaga kesehatan.
- [ ] Tidak ada klaim dokter, diagnosis, atau spesialis pada pemasaran.

## 13. Kondisi yang Memblokir Rilis

Rilis tidak boleh dilakukan bila:

- ada API key pada frontend atau repository;
- billing account tertaut pada fase Rp0;
- ada jalur AI langsung ke publikasi;
- konten agama belum mempunyai reviewer dan sumber;
- karya sejarah mencampur fakta dan fiksi tanpa penanda internal;
- lisensi model atau data tidak tercatat;
- portal BPOM/BPJPH di-scrape tanpa izin;
- free tier dapat otomatis menjadi berbayar;
- tidak tersedia audit log atau penarikan publikasi;
- validator gagal tetapi admin tetap dapat memaksa publish tanpa alasan dan jejak audit;
- emergency gate dapat dilewati oleh artikel, model, VitaCheck, atau produk;
- data kesehatan mentah masuk log publik atau dikirim ke provider yang tidak disetujui;
- AI memberi diagnosis, dosis, penghentian obat, atau rekomendasi produk dari keluhan personal;
- antarmuka kesehatan mengaku sebagai dokter atau spesialis.

## 14. Definition of Done Platform

VitaNusa dianggap mempunyai fondasi produksi mandiri yang aman apabila:

1. arsitektur berjalan local-first dan no-billing;
2. semua hasil AI dimulai sebagai draf;
3. source registry dan model registry aktif;
4. setiap API memiliki hard quota dan tanggal review;
5. role AI tidak mempunyai izin publish;
6. high-risk content membutuhkan approval khusus;
7. publikasi dapat ditarik dan dikoreksi;
8. novel dan komik memiliki version history;
9. sumber, model, prompt version, dan reviewer tercatat;
10. test membuktikan kegagalan satu gate memblokir publikasi;
11. health navigator berjalan non-diagnostik dan memprioritaskan emergency gate;
12. data kesehatan diminimalkan dan cloud storage bersifat opt-in;
13. keluhan personal tidak memicu rekomendasi produk;
14. seluruh biaya layanan digital terkunci Rp0 tanpa paid fallback.

## 15. Keputusan Penutup

VitaNusa tidak dibangun dengan prinsip “sebanyak mungkin fitur dan API”. Arah resminya adalah:

> **Sumber paling otoritatif yang diperlukan, proses paling hemat yang aman, AI sebagai pembuat draf, manusia sebagai pemegang amanah, dan tidak ada biaya tersembunyi.**

Peta ini harus diperbarui ketika arsitektur aktual berubah. Roadmap tidak boleh menulis fitur sebagai selesai bila kode, data, review gate, dan jalur publikasinya belum benar-benar tersedia di branch utama.