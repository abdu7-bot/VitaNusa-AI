# VitaNusa-AI

**VitaNusa AI** adalah platform edukasi kesehatan berbasis AI yang membantu pengguna memahami kebiasaan sehat, membaca artikel edukatif, melakukan VitaCheck, menilai klaim produk secara bijak, mengenal katalog reseller, dan berdialog dengan Nusa AI dalam batas amanah.

VitaNusa AI bukan dokter, alat diagnosis, pemberi resep, mufti, atau pengganti tenaga profesional.

## Peta Ringkas

| Area | Fungsi |
|---|---|
| **Beranda** | Nusa Chat sebagai pintu utama edukasi amanah |
| **VitaCheck** | Refleksi kebiasaan sehat, bukan diagnosis |
| **Edukasi** | Artikel kesehatan, kebiasaan, literasi produk, dan kapan mencari bantuan |
| **VitaStory** | Cerita, komik, audio story, dan refleksi |
| **Produk** | Katalog reseller dengan edukasi sebelum promosi |
| **FAQ & Prinsip** | Disclaimer, batas AI, halal-thayyib, dan kebijakan amanah |

## Hierarchy Policy System

Backend memakai alur:

```text
User Input
  → Intent Detection
  → Medical Risk Classification
  → Policy Engine
  → Content Routing
  → Backward-compatible Response
```

Policy dapat aktif bersamaan. Emergency tetap mendominasi, tetapi warning halal, klaim, atau batas kewenangan tidak dibuang.

Field lama endpoint `/ask` tetap tersedia. Field baru `policyDecision` menjelaskan policy dominan, warning, action yang diizinkan/dilarang, serta hasil policy terurut.

## Prinsip Utama

1. Keselamatan medis lebih dahulu.
2. Edukasi sebelum promosi.
3. Tidak memberi diagnosis, dosis personal, atau fatwa final.
4. Status halal tidak ditebak.
5. Thayyib bukan sertifikasi universal.
6. Produk bukan jalan pintas atau solusi utama.
7. Data, klaim, dan bukti dijelaskan secara transparan.

## Arsitektur Konten

Artikel admin menggunakan metadata seperti `userQuestions`, `answerSnippet`, `problemTags`, `audience`, `doNotUseFor`, `whenToSeekHelp`, `sources`, `intentTarget`, `riskLevel`, sensitive flags, `relatedArticles`, `contentDepth`, `primaryAction`, dan `reviewerNote`.

Metadata membantu routing, tetapi tidak mengalahkan policy engine. Hanya artikel `published` yang boleh tampil pada jalur publik.

## Menjalankan Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Test

```bash
cd backend
python -m unittest discover -s tests -v
python -m compileall -q app tests
```

Smoke test HTTP yang sudah ada tetap dapat dijalankan setelah server aktif:

```bash
python tests/ci_smoke_test.py
```

## Dokumentasi

- [`docs/vitanusa-constitution.md`](docs/vitanusa-constitution.md) — sumber nilai dan prioritas induk
- [`docs/hierarchy-system.md`](docs/hierarchy-system.md) — panduan menambah policy
- [`docs/amanah-guidelines.md`](docs/amanah-guidelines.md) — pedoman praktis
- [`docs/nusa-ai-assistant-prompt.md`](docs/nusa-ai-assistant-prompt.md) — batas dan gaya Nusa AI
- [`docs/nusa-ai-islamic-thinking-principles.md`](docs/nusa-ai-islamic-thinking-principles.md) — prinsip adab Islami
- [`docs/vitanusa-map.md`](docs/vitanusa-map.md) — peta besar platform
- [`docs/roadmap.md`](docs/roadmap.md) — roadmap pengembangan

## Disclaimer

Informasi VitaNusa AI bersifat edukasi umum dan tidak menggantikan pemeriksaan, diagnosis, resep, pengobatan, fatwa, atau keputusan profesional. Untuk tanda bahaya, segera cari bantuan medis.
