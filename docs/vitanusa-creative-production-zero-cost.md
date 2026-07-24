# Peta Produksi Kreatif VitaNusa AI — Gratis, Ketat, dan Berlapis

**Status:** Dokumen tata kelola wajib  
**Tanggal verifikasi:** 25 Juli 2026  
**Ruang lingkup:** VitaStory, novel, komik, cerita pendek, storyboard, audio story, dan aset turunannya.

> Dokumen ini bukan fatwa. Ia adalah pagar produk agar AI tidak menerbitkan klaim agama, fakta sensitif, atau visual berisiko tanpa pemeriksaan manusia yang kompeten.

## 1. Keputusan Dasar

VitaNusa AI boleh:

- mencari ide;
- menyusun riset;
- membuat sinopsis, karakter, outline, bab, dialog, dan storyboard;
- membuat prompt gambar;
- menghasilkan draf teks dan gambar;
- menyunting konsistensi dan tata bahasa;
- menyiapkan PDF atau format publikasi.

VitaNusa AI **tidak boleh menerbitkan hasil AI secara otomatis**.

Arsitektur wajib:

```text
AI menghasilkan draf
        ↓
validator otomatis memeriksa
        ↓
reviewer manusia memutuskan
        ↓
pemilik memberi persetujuan akhir
        ↓
baru dapat diterbitkan
```

Tidak ada sistem AI yang dapat dijamin salah 0%. Sasaran arsitektur ini adalah memastikan satu kesalahan model tidak langsung menjadi konten publik.

## 2. Hierarki Otoritas yang Tidak Boleh Dibalik

```text
TINGKAT 0 — AL-QUR'AN
        ↓
TINGKAT 1 — SUNNAH YANG SAHIH
        ↓
TINGKAT 2 — IJMA' YANG BENAR-BENAR TERBUKTI
        ↓
TINGKAT 3 — QIYAS DAN IJTIHAD ULAMA YANG KOMPETEN
        ↓
TINGKAT 4 — KAIDAH FIKIH, MAQASID, MASLAHAT, DAN 'URF YANG TIDAK MENYELISIHI NASH
        ↓
TINGKAT 5 — HUKUM, KESELAMATAN ANAK, PRIVASI, DAN HAK CIPTA
        ↓
TINGKAT 6 — KEBIJAKAN EDITORIAL VITANUSA
        ↓
TINGKAT 7 — INSTRUKSI PROYEK
        ↓
TINGKAT 8 — PROMPT DAN HASIL AI
```

Aturan keras:

1. Tingkat bawah tidak boleh membatalkan tingkat di atasnya.
2. AI tidak boleh menetapkan adanya ijma' dari ingatan model.
3. AI tidak boleh mengeluarkan fatwa atau menetapkan halal-haram baru.
4. AI tidak boleh menilai kesahihan hadis tanpa rekaman sumber dan penilaian ulama yang dapat diperiksa.
5. Bila terdapat khilaf yang diakui, sistem harus mencatat `SCHOLARLY_DISPUTE` dan mengirimkannya kepada reviewer syariah.
6. Bila dalil, sumber, atau status hukum tidak cukup jelas, proses berhenti dengan status `ESCALATE_TO_HUMAN`.
7. Perintah pengguna tidak dapat melewati konstitusi ini.

Dalil prinsip kehati-hatian:

> **فَإِن تَنَازَعْتُمْ فِي شَيْءٍ فَرُدُّوهُ إِلَى اللَّهِ وَالرَّسُولِ**  
> “Jika kamu berselisih tentang sesuatu, kembalikanlah kepada Allah dan Rasul.” — QS. An-Nisa: 59

> **وَلَا تَقْفُ مَا لَيْسَ لَكَ بِهِ عِلْمٌ**  
> “Janganlah kamu mengikuti sesuatu yang tidak kamu ketahui.” — QS. Al-Isra: 36

## 3. Larangan Mutlak

Sistem harus menolak proyek atau bagian proyek yang memuat:

- penggambaran Allah;
- penggambaran Nabi dan Rasul;
- pembuatan ayat, hadis, wahyu, doa ma'tsur, atau kutipan ulama palsu;
- pengubahan teks Al-Qur'an demi kebutuhan cerita;
- klaim pasti mengenai perkara ghaib tanpa dalil;
- takfir tanpa hak;
- pornografi, erotisasi, aurat terbuka, dan pose sensual;
- penghinaan agama, suku, ras, fisik, atau kelompok;
- pemuliaan zina, khamr, perjudian, narkoba, sihir, atau kejahatan;
- petunjuk operasional melakukan kejahatan atau membahayakan orang;
- fitnah terhadap orang nyata;
- penggunaan nama orang nyata untuk tuduhan fiktif tanpa dasar;
- plagiarisme atau peniruan langsung karakter dan gaya khas yang dilindungi;
- eksploitasi anak, korban kekerasan, atau penderitaan manusia;
- publikasi otomatis dari hasil AI.

Maksiat dapat muncul sebagai konflik cerita hanya bila tidak dieksploitasi secara sensual, tidak diajarkan caranya, tidak dimuliakan, dan konsekuensinya disampaikan secara jujur.

## 4. Kelas Risiko Proyek

### 4.1 Risiko rendah

Contoh:

- keluarga;
- kehidupan F&B;
- pendidikan;
- lingkungan;
- persahabatan;
- disiplin;
- kerja keras;
- adab umum.

Boleh diproduksi otomatis sebagai **draf**, tetap memerlukan persetujuan manusia sebelum terbit.

### 4.2 Risiko sedang

Contoh:

- romansa;
- kesehatan mental;
- kriminalitas;
- perang;
- politik fiktif;
- konflik keluarga berat;
- kekerasan;
- sejarah umum.

Wajib pemeriksaan fakta, keselamatan, dan etika.

### 4.3 Risiko tinggi

Contoh:

- Al-Qur'an dan hadis;
- sejarah Islam;
- sahabat dan ulama nyata;
- akidah dan fikih;
- halal-haram;
- jin, sihir, ruqyah, mimpi, dan perkara ghaib;
- konflik mazhab;
- tokoh atau organisasi nyata;
- kesehatan, hukum, keuangan, dan politik aktual.

Wajib reviewer manusia yang sesuai bidang. Tanpa reviewer yang kompeten, status tetap `BLOCKED_REVIEWER_UNAVAILABLE`.

### 4.4 Terlarang

Konten pada bagian “Larangan Mutlak” langsung berstatus `REJECTED` dan tidak dapat diteruskan hanya dengan mengganti prompt.

## 5. Registri dan Hierarki Sumber

Setiap sumber harus masuk registri sebelum dipakai:

```yaml
source_id: quran-primary-001
name: Al-Quran Arabic Text
source_class: A1
usage: exact_retrieval_only
ai_rewrite_allowed: false
license_reviewed: true
checksum: sha256:...
reviewed_by: human-reviewer-id
status: approved
```

Kelas sumber:

```text
A1 — Al-Qur'an terverifikasi
A2 — Hadis sahih dengan rujukan dan penilaian yang dapat diperiksa
A3 — Ijma' yang dibuktikan melalui rujukan ulama, bukan klaim model
B1 — Tafsir, syarah, dan karya ulama Ahlus Sunnah
B2 — Fatwa dan keputusan lembaga tepercaya
C1 — Sumber primer sejarah, hukum, dan institusi
C2 — Jurnal dan buku akademik
D1 — Ensiklopedia akademik
D2 — Wikipedia, Wikidata, dan sumber umum
E  — Berita, blog, media sosial, dan sumber belum terverifikasi
```

Aturan konflik:

- Sumber kelas rendah tidak dapat membatalkan sumber kelas lebih tinggi.
- Dua sumber setingkat yang berselisih harus ditandai `DISPUTED`.
- Wikipedia dan AI tidak boleh menjadi dalil agama.
- Sumber berita tidak boleh sendirian menjadi dasar tuduhan kepada orang nyata.
- Sumber yang lisensinya tidak jelas hanya boleh ditautkan, bukan disalin ke basis data.

## 6. Basis Dalil yang Dikunci

### 6.1 Al-Qur'an

- teks Arab tidak dibuat oleh model bahasa atau model gambar;
- ayat diambil dari korpus yang telah diperiksa;
- setiap ayat menyimpan nomor surah, nomor ayat, sumber terjemahan, checksum, dan reviewer;
- AI tidak boleh menerjemahkan ulang lalu menamainya “terjemahan Al-Qur'an”;
- perbedaan terjemahan harus dinisbatkan kepada sumbernya;
- teks ayat pada gambar harus ditempel dari data terverifikasi setelah gambar selesai, bukan digambar AI.

### 6.2 Hadis

- hadis hanya boleh diambil dari whitelist lokal yang telah ditinjau;
- wajib menyimpan kitab, nomor hadis, teks, terjemahan, derajat, sumber penilaian, dan reviewer;
- model tidak boleh melengkapi potongan hadis berdasarkan ingatan;
- hadis lemah atau diperselisihkan harus diberi status dan tidak boleh disajikan sebagai sahih;
- hadis tanpa sumber berstatus `BLOCKED_UNVERIFIED_HADITH`.

## 7. State Machine Produksi

```text
IDEA
  ↓
RISK_CLASSIFIED
  ↓
SOURCES_LOCKED
  ↓
RESEARCH_APPROVED
  ↓
OUTLINE_APPROVED
  ↓
DRAFT_GENERATED
  ↓
AUTOMATED_REVIEW_PASSED
  ↓
HUMAN_REVIEWED
  ↓
SHARIA_APPROVED        ← wajib untuk risiko agama tinggi
  ↓
FACT_APPROVED          ← wajib untuk sejarah/tokoh/fakta berisiko
  ↓
VISUAL_APPROVED        ← wajib untuk komik
  ↓
FINAL_APPROVED
  ↓
PUBLISHED
```

Status penghentian:

```text
REJECTED
NEEDS_REVISION
BLOCKED_BY_SHARIA
BLOCKED_BY_FACT_CHECK
BLOCKED_BY_COPYRIGHT
BLOCKED_BY_VISUAL_POLICY
BLOCKED_REVIEWER_UNAVAILABLE
BLOCKED_BUDGET
WITHDRAWN
ARCHIVED
```

Aturan publikasi minimum:

```javascript
function canPublish(project) {
  if (project.status !== "FINAL_APPROVED") return false;
  if (!project.humanApproval) return false;
  if (project.religiousRisk === "high" && !project.shariaApproval) return false;
  if (project.factRisk !== "low" && !project.factApproval) return false;
  if (project.type === "comic" && !project.visualApproval) return false;
  if (!project.copyrightApproval) return false;
  if (!project.budgetGatePassed) return false;
  return true;
}
```

Tidak boleh ada admin action yang mengubah `DRAFT_GENERATED` langsung menjadi `PUBLISHED`.

## 8. Agen dan Pemisahan Tugas

```text
Creative Orchestrator
│
├── Research Agent
├── Source Registrar
├── Story Architect
├── Novel Writer
├── Comic Planner
├── Continuity Checker
├── Fact Gate
├── Sharia Gate
├── Visual Safety Gate
├── Copyright Gate
├── Budget Gate
└── Human Approval Gate
```

Satu model tidak boleh menulis lalu menjadi satu-satunya pengesah hasilnya sendiri. Setiap gate hanya menghasilkan:

```text
PASS
FAIL
ESCALATE_TO_HUMAN
```

Tidak ada status “mungkin aman, lanjutkan”.

## 9. Alur Novel

```text
Tema
→ klasifikasi risiko
→ registri sumber
→ research pack
→ story bible
→ outline bagian
→ outline bab
→ pemeriksaan outline
→ penulisan draf
→ pemeriksaan kontinuitas
→ pemeriksaan fakta
→ pemeriksaan syariah
→ penyuntingan
→ review manusia
→ penyusunan PDF/EPUB
→ persetujuan akhir
→ publikasi
```

Label klaim internal:

```text
[FACT]
[HISTORICAL_RECONSTRUCTION]
[FICTION]
[RELIGIOUS_CLAIM]
[SCHOLARLY_DISPUTE]
[UNVERIFIED]
```

Satu label `[UNVERIFIED]` yang belum diselesaikan memblokir publikasi.

## 10. Alur Komik

```text
Naskah yang telah lolos
→ pembagian panel
→ storyboard
→ character bible
→ pemeriksaan visual awal
→ prompt panel
→ pembuatan gambar
→ pemeriksaan aurat dan pose
→ pemeriksaan simbol
→ pemeriksaan teks Arab
→ pemeriksaan kontinuitas karakter
→ layout
→ review manusia
→ persetujuan akhir
→ publikasi
```

### Mode visual ihtiyath tahap awal

- tidak menggambarkan Allah, Nabi, dan Rasul;
- tidak memastikan bentuk malaikat, jin, surga, neraka, atau perkara ghaib;
- tidak menampilkan sahabat utama sebagai karakter visual pada tahap awal;
- tidak membuat teks Al-Qur'an melalui generator gambar;
- tokoh manusia berpakaian menutup aurat;
- tanpa pose, framing, atau sudut kamera sensual;
- hindari hiperrealisme untuk tokoh agama dan sejarah sensitif;
- tidak meniru karakter, merek, atau gaya khas seniman hidup;
- setiap panel wajib mempunyai catatan prompt, model, seed bila tersedia, dan hasil review.

Hukum gambar digital memiliki rincian dan khilaf di kalangan ulama kontemporer. VitaNusa tidak boleh mengklaim adanya ijma' yang tidak terbukti. Kebijakan final harus mengikuti arahan reviewer syariah yang kompeten.

## 11. Stack Nol Biaya

Prioritasnya **local-first**:

| Kebutuhan | Pilihan tahap gratis | Catatan |
|---|---|---|
| Situs publik | HTML/CSS/JS yang sudah ada | Pertahankan fallback statis |
| Database/admin | Firebase Spark | Jangan hubungkan billing |
| Versi dan audit | Git + GitHub | Simpan perubahan dan reviewer |
| AI teks utama | Ollama atau llama.cpp lokal | Model harus lolos pemeriksaan lisensi |
| Pencarian lokal | SQLite FTS5 | Tidak mengirim naskah keluar |
| AI gambar | ComfyUI lokal | Model dan checkpoint wajib diregistrasi |
| AI cloud cadangan | Free tier yang disetujui | Tidak boleh menerima naskah sensitif |
| CI validasi | GitHub Actions pada repo publik | Hanya pemeriksaan, bukan pemberi fatwa |
| PDF | Browser print/export atau tool lokal | Tidak perlu API berbayar |

Urutan fallback AI:

```text
1. Model lokal yang disetujui
2. Provider free tier yang disetujui dan masih memiliki kuota
3. Proses berhenti dengan BLOCKED_BUDGET
```

Tidak ada fallback otomatis ke layanan berbayar.

## 12. Budget Gate Nol Rupiah

```yaml
billing:
  paid_services_allowed: false
  payment_method_allowed: false
  cloud_billing_link_allowed: false
  auto_upgrade_allowed: false
  paid_fallback_allowed: false
  stop_when_free_quota_exhausted: true
  local_fallback_only: true
  monthly_budget_idr: 0
```

Aturan:

1. Jangan memasukkan kartu pembayaran.
2. Jangan menautkan akun Cloud Billing.
3. Jangan memakai free trial yang berubah otomatis menjadi berbayar.
4. Jangan menggunakan endpoint di luar paket gratis.
5. Terapkan hard quota sebelum batas provider.
6. Ketika kuota tersisa 20%, hentikan pekerjaan batch dan tampilkan peringatan.
7. Ketika kuota habis, status menjadi `BLOCKED_BUDGET`.
8. API key hanya disimpan sebagai secret backend, bukan di frontend, Firestore, dokumen, atau GitHub.

## 13. Peran Manusia

| Peran | Kewenangan |
|---|---|
| Owner | Persetujuan akhir dan penarikan publikasi |
| Editor | Bahasa, struktur, dan mutu cerita |
| Fact reviewer | Sejarah, sains, kesehatan, hukum, dan tokoh nyata |
| Sharia reviewer | Ayat, hadis, akidah, fikih, dan khilaf |
| Visual reviewer | Aurat, pose, simbol, dan keamanan anak |
| Copyright reviewer | Lisensi sumber, model, gambar, dan kemiripan karya |
| AI worker | Hanya menghasilkan dan merevisi draf |

Satu orang boleh merangkap pada proyek risiko rendah. Materi agama berisiko tinggi tidak boleh diterbitkan tanpa reviewer yang benar-benar kompeten.

## 14. Audit dan Koreksi

Setiap versi harus menyimpan:

```json
{
  "projectId": "novel-001",
  "contentHash": "sha256:...",
  "previousStatus": "DRAFT_GENERATED",
  "newStatus": "NEEDS_REVISION",
  "actor": "reviewer-id",
  "reason": "Hadis belum diverifikasi",
  "model": "registered-model-id",
  "promptVersion": "v1.0",
  "sourceSetVersion": "v1.0",
  "timestamp": "ISO-8601"
}
```

Wajib tersedia:

- version history;
- audit log yang tidak dapat diubah oleh penulis AI;
- tombol tarik publikasi;
- kanal koreksi pembaca;
- kemampuan mengembalikan versi sebelumnya;
- daftar sumber yang digunakan;
- tanggal pemeriksaan ulang untuk materi yang dapat berubah.

## 15. Struktur Folder

```text
creative/
├── governance/
│   ├── constitution.md
│   ├── source-hierarchy.md
│   ├── islamic-policy.md
│   ├── visual-policy.md
│   ├── copyright-policy.md
│   ├── child-safety-policy.md
│   └── zero-cost-policy.md
├── config/
│   ├── source-registry.yaml
│   ├── model-registry.yaml
│   ├── forbidden-content.yaml
│   ├── workflow-transitions.yaml
│   └── budget-lock.yaml
├── schemas/
│   ├── creative-project.schema.json
│   ├── source-record.schema.json
│   ├── approval.schema.json
│   └── audit-record.schema.json
├── engine/
├── gates/
├── novel/
└── comic/
```

## 16. Urutan Implementasi

### Fase 0 — Pagar dahulu

- [ ] Konstitusi kreatif
- [ ] Hierarki sumber
- [ ] Registri model dan lisensi
- [ ] State machine
- [ ] Budget gate
- [ ] Audit log
- [ ] Role dan approval

**Belum mengaktifkan generator.**

### Fase 1 — Studio novel lokal

- [ ] Formulir proyek
- [ ] Klasifikasi risiko
- [ ] Research pack
- [ ] Story bible
- [ ] Outline
- [ ] Generator draf lokal
- [ ] Review dan approval

### Fase 2 — Studio komik teks

- [ ] Pembagian panel
- [ ] Storyboard
- [ ] Character bible
- [ ] Prompt dan negative prompt
- [ ] Visual policy gate

### Fase 3 — Worker gambar lokal

- [ ] ComfyUI lokal
- [ ] Registri checkpoint/model
- [ ] Pemeriksaan panel
- [ ] Penyimpanan metadata generasi

### Fase 4 — Publikasi terkunci

- [ ] Hubungkan hanya konten `FINAL_APPROVED` ke VitaStory
- [ ] Katalog novel
- [ ] Katalog komik
- [ ] PDF/EPUB
- [ ] Penarikan dan koreksi

## 17. Kriteria Selesai

Fitur belum dianggap selesai sebelum:

- tidak ada jalur AI langsung ke `published`;
- seluruh proyek baru selalu dimulai sebagai `draft`;
- semua klaim agama mempunyai sumber terverifikasi;
- semua karya sejarah membedakan fakta, rekonstruksi, dan fiksi;
- seluruh panel lolos visual review;
- seluruh aset memiliki status lisensi;
- budget gate telah diuji dengan kuota habis;
- tidak ada API key di repository atau frontend;
- audit log merekam seluruh approval;
- tersedia tombol penarikan publikasi;
- pengujian membuktikan satu gate gagal akan memblokir publikasi.

## 18. Referensi Teknis Resmi

- Firebase pricing plans: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Ollama: https://github.com/ollama/ollama
- llama.cpp: https://github.com/ggml-org/llama.cpp
- ComfyUI: https://github.com/comfyanonymous/ComfyUI
- SQLite FTS5: https://www.sqlite.org/fts5.html
- GitHub Actions billing: https://docs.github.com/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions
- Quran Foundation API: https://api-docs.quran.com/
- Al Quran Cloud API: https://alquran.cloud/api

## 19. Keputusan Penutup

Arsitektur resmi tahap gratis:

> **Local-first, draft-only, source-locked, human-gated, no-billing, no-auto-publish.**

Mesin produksi harus kreatif dan cepat. Mesin penjaga harus ketat, lambat, dan berhak menghentikan seluruh proses. Bila pagar belum tersedia, generator tidak boleh diaktifkan.