# Roadmap VitaNusa AI

**Tanggal sinkronisasi:** 25 Juli 2026  
**Arah biaya:** layanan digital Rp0, no-billing, no-paid-fallback  
**Arah kesehatan:** Navigator Kesehatan Multi-Bidang non-diagnostik

Roadmap ini menjaga agar VitaNusa AI berkembang sebagai platform edukasi yang berguna, amanah, dapat diuji, dan tidak menulis rencana seolah-olah sudah menjadi implementasi.

## 1. Aturan Status

Setiap pekerjaan wajib memakai salah satu status:

- `completed` — kode, test, dan dokumentasi berada di `main`;
- `partial` — sebagian implementasi berada di `main`, tetapi kriteria selesai belum terpenuhi;
- `planned` — telah dirancang, belum diimplementasikan;
- `blocked` — tidak boleh dilanjutkan sebelum blocker diselesaikan;
- `future` — arah jangka panjang, belum menjadi komitmen implementasi.

Dokumen sasaran bukan bukti bahwa fitur sudah tersedia.

## 2. Tahap 1 — Fondasi Website

**Status:** `partial`

Fokus:

- website statis yang rapi;
- beranda chat-only;
- navigasi publik;
- artikel edukasi dasar;
- VitaCheck sederhana;
- katalog produk reseller;
- tombol WhatsApp;
- disclaimer kesehatan dan Prinsip Amanah.

Target:

Pengguna langsung memahami bahwa VitaNusa AI adalah platform edukasi, bukan alat diagnosis medis.

Yang sudah ada harus tetap dipertahankan melalui regression test. Perubahan Navigator Kesehatan tidak boleh merusak halaman publik, VitaCheck, produk, kontak, atau jalur artikel yang berjalan.

## 3. Tahap 2 — Konten, Akun, dan Keamanan

**Status:** `partial`

Sudah tersedia sebagian:

- admin artikel Firestore dan import satu blok;
- artikel `published` pada jalur publik;
- search/filter artikel;
- metadata artikel untuk routing Nusa AI;
- FAQ, produk amanah, dan global sidebar;
- login pengguna dan riwayat VitaCheck;
- backend Policy Engine;
- security hardening dan pengujian terkait.

Belum selesai:

- content rendering security prioritas nol;
- validasi browser/Android utama;
- consent, retensi, ekspor, dan penghapusan data kesehatan yang terpadu;
- review queue dan approval records;
- source/model registry machine-readable;
- media manager dan FAQ dinamis penuh.

### Kebijakan artikel aktual

Kondisi implementasi berjalan:

- artikel baru/import disimpan sebagai `published`;
- warning bukan draft;
- konten sensitif memakai warning, sensitive flags, disclaimer, reviewer note, dan arahan amanah;
- draft/archived tidak tampil publik.

Kondisi ini tidak boleh diwariskan otomatis kepada konten AI baru. Evaluasi alur artikel menuju `DRAFT → REVIEWED → APPROVED → PUBLISHED` harus menjadi PR terpisah yang mengubah policy, test, admin flow, dan dokumentasi secara konsisten.

## 4. Tahap 3 — Tata Kelola Navigator Kesehatan

**Status:** `planned`

Fokus:

- intended use dan prohibited use;
- label `Ruang Edukasi`, bukan dokter spesialis;
- structured health response contract;
- pemisahan kesehatan dan produk;
- privacy/data-minimization policy;
- budget lock Rp0;
- health source hierarchy;
- medical reviewer role dan correction channel.

Target:

Seluruh tim memahami apa yang boleh dan tidak boleh dilakukan sebelum menambah model atau API.

Dokumen sasaran: [`vitanusa-health-navigator-zero-cost.md`](./vitanusa-health-navigator-zero-cost.md).

## 5. Tahap 4 — Emergency Gate, Intake, dan Privasi

**Status:** `planned`

Fokus:

- matriks red flag terstruktur;
- poisoning, pregnancy, pediatric, injury, dan mental crisis gates;
- negation, typo, time, subject, context, dan prompt-injection tests;
- intake minimum tanpa nama/NIK/alamat;
- penyimpanan lokal sebagai default;
- consent terpisah untuk cloud;
- retention dan delete controls;
- audit log tanpa pertanyaan kesehatan mentah;
- safe fallback saat classifier/policy gagal.

Target:

Keadaan berisiko ditangani sebelum artikel, AI, VitaCheck, atau produk. Satu emergency signal harus menutup jalur promosi dan konten non-darurat.

## 6. Tahap 5 — Source Registry dan Ruang Edukasi

**Status:** `planned`

Fokus sumber:

- Kementerian Kesehatan dan regulasi Indonesia;
- WHO;
- PubMed/NCBI dan Europe PMC;
- MedlinePlus, RxNorm, dan DailyMed dengan konteks negara;
- source class, tanggal verifikasi, tanggal review ulang, lisensi, dan atribusi;
- cache, timeout, retry terbatas, circuit breaker, dan hard quota;
- citation validator dan stale-source warning.

Ruang edukasi prioritas:

1. kesehatan dewasa umum;
2. pencernaan dan nutrisi;
3. tidur, lelah, dan kebiasaan;
4. obat dan suplemen sebagai literasi;
5. kulit dan otot-sendi tanpa diagnosis gambar.

Ruang high-risk:

- anak;
- kehamilan dan menyusui;
- penyakit kronis dan kardiometabolik;
- mental dan emosi;
- interpretasi hasil pemeriksaan.

Ruang high-risk tetap `EDUCATION_ONLY` atau `BLOCKED_REVIEWER_UNAVAILABLE` sampai mempunyai reviewer dan skenario uji yang memadai.

## 7. Tahap 6 — AI Lokal Terbatas

**Status:** `planned`

Fokus:

- Ollama/llama.cpp dengan model lokal yang lisensinya disetujui;
- model registry dan prompt version;
- retrieval hanya dari sumber yang disetujui;
- structured output;
- claim, citation, authority, privacy, product-separation, dan budget gates;
- model bahasa tidak menjadi satu-satunya classifier risiko;
- fallback rule-based dan konten statis;
- tidak ada fallback otomatis ke provider berbayar.

Target:

AI membantu merangkai edukasi yang bersumber, tetapi policy tetap memegang keputusan batas tindakan.

Ketersediaan AI 24/7 tidak dijanjikan pada arsitektur Rp0. Saat laptop/worker/kuota tidak tersedia, situs tetap memberikan konten lokal dan arahan aman.

## 8. Tahap 7 — Validasi dan Pilot Edukasi

**Status:** `future`

Fokus:

- golden test set bahasa Indonesia;
- adversarial safety test;
- review tenaga kesehatan untuk skenario prioritas;
- pengukuran false negative, false positive, dan harmful omission;
- uji aksesibilitas dan pemahaman pengguna;
- pilot terbatas;
- kanal koreksi, audit, penarikan, dan rollback;
- public source notes dan disclaimer.

Target:

Membuktikan sistem cukup aman untuk pilot edukasi terbatas. Pengujian software bukan pengganti validasi klinis.

Tanpa reviewer kompeten, sistem tidak boleh dipasarkan sebagai dokter, diagnosis, atau spesialis.

## 9. Budget Gate Rp0

```yaml
zero_cost_policy:
  monthly_service_budget_idr: 0
  payment_method_allowed: false
  cloud_billing_link_allowed: false
  automatic_paid_upgrade_allowed: false
  paid_fallback_allowed: false
  stop_when_free_quota_exhausted: true
  local_fallback_only: true
```

Pilihan tahap Rp0:

- GitHub Pages untuk situs statis;
- GitHub Actions standard runner pada repository publik;
- IndexedDB/local-first untuk data pengguna;
- Firebase Spark tanpa billing untuk cloud opsional;
- Ollama/llama.cpp untuk AI lokal;
- SQLite FTS5 atau indeks JSON untuk pencarian lokal;
- API gratis yang disetujui dengan cache dan hard stop;
- browser print/export atau tool lokal untuk PDF.

`Rp0` berarti tidak ada tagihan platform, API, atau langganan. Listrik, internet, perangkat yang sudah ada, waktu kerja, dan review manusia tetap mempunyai biaya nyata.

## 10. Prioritas Pengerjaan

Urutan kerja:

1. tutup content rendering security;
2. sinkronkan status dokumentasi dengan `main`;
3. buat budget lock dan source registry;
4. perkuat emergency gate;
5. buat intake minimum dan privacy controls;
6. bangun ruang edukasi prioritas;
7. pasang AI lokal terbatas;
8. validasi dengan skenario dan reviewer;
9. lakukan pilot terbatas;
10. perluas hanya berdasarkan bukti.

Jangan mengaktifkan generator kesehatan baru sebelum pagar keselamatan, sumber, dan kontrak jawaban tersedia.

## 11. Kondisi yang Memblokir Rilis

Rilis diblokir bila:

- content rendering security prioritas nol belum selesai;
- emergency gate dapat dilewati oleh artikel, model, VitaCheck, atau produk;
- AI dapat memberi diagnosis, dosis, penghentian obat, atau produk dari keluhan personal;
- data kesehatan mentah masuk log publik;
- data sensitif dikirim ke provider yang tidak disetujui;
- sumber tidak mempunyai URL dan tanggal verifikasi;
- high-risk flow tidak mempunyai rujukan manusia;
- billing atau paid fallback aktif;
- UI memakai identitas dokter atau spesialis;
- dokumentasi menyatakan planned feature sebagai completed.

## 12. Prioritas Prinsip

Setiap tahap harus menjaga:

1. keselamatan medis lebih dahulu;
2. edukasi sebelum promosi;
3. tidak membuat klaim medis berlebihan;
4. tidak memberi diagnosis, resep, atau dosis personal;
5. tidak menyuruh menghentikan obat;
6. tidak menjanjikan kesembuhan;
7. tidak menipu dengan bahasa marketing;
8. menjaga privasi dan persetujuan pengguna;
9. mengarahkan pengguna kepada tenaga medis saat dibutuhkan;
10. memakai sumber sesedikit mungkin, seotoritatif mungkin;
11. berhenti ketika bukti, kewenangan, reviewer, atau kuota tidak cukup;
12. menjaga biaya layanan digital tetap Rp0.

## 13. Keputusan Penutup

VitaNusa AI tidak mengejar label “dokter digital”. Arah resminya adalah navigator kesehatan multi-bidang yang membantu pengguna memahami informasi, mengenali bahaya, menyiapkan pertanyaan, dan menemui ahli yang tepat.

> **Sistem yang aman tidak hanya tahu kapan menjawab. Ia juga tahu kapan harus berhenti dan merujuk.**
