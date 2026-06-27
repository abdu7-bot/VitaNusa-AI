# AGENTS.md

## Project
VitaNusa AI adalah website edukasi kesehatan, refleksi Islami, VitaCheck, artikel, dan katalog reseller produk secara amanah.

## Prinsip Utama
- Edukasi dulu, bukan klaim.
- Jaga amanah, tabayyun, ikhtiar, dan tawakal.
- Konten kesehatan bersifat edukasi umum, bukan pengganti tenaga profesional.
- Konten Islami bersifat refleksi, bukan fatwa dan bukan tafsir final.
- Konten produk hanya untuk informasi reseller, bukan klaim medis.
- Artikel sensitif harus tetap draft sampai direview pihak yang kompeten.

## Area yang Dilindungi
Jangan mengubah bagian berikut kecuali diminta eksplisit:
- homepage publik,
- chat UI Nusa AI,
- layout utama,
- VitaCheck logic,
- halaman produk,
- halaman kontak,
- Firebase config,
- Firestore rules,
- WhatsApp link,
- email contact,
- asset path penting.

## Aturan Kode
- Jangan menambah backend, API baru, RAG, embedding, vector database, payment, atau fitur besar tanpa instruksi eksplisit.
- Jangan redesign besar tanpa permintaan.
- Jangan menghapus kode lama tanpa alasan jelas.
- Jaga HTML valid, tag tertutup rapi, dan mobile responsive.
- Jelaskan setiap file yang diubah dan alasan perubahannya.

## Aturan Artikel Admin
- Artikel baru default ke status draft.
- Pertahankan metadata artikel: intentTarget, riskLevel, sensitive flags, relatedArticles, contentDepth, primaryAction, reviewerNote.
- Related Articles wajib memakai slug, bukan judul.
- Artikel draft dan archived tidak boleh tampil di publik.
- Jangan menghapus Catatan Amanah.
- Jika artikel memakai referensi, taruh link di section article-references.

## Struktur HTML Artikel
Gunakan struktur:
- article.vitanusa-article
- header dengan h1 dan article-summary
- section isi utama
- section.article-note untuk Catatan Amanah
- section.article-references untuk referensi bila diperlukan

Jangan memasukkan full document HTML seperti html, head, atau body ke contentHtml artikel.

## Workflow Codex
1. Kerjakan perubahan kecil dan spesifik.
2. Jangan mengubah area yang tidak terkait.
3. Jangan merge otomatis untuk perubahan sensitif.
4. Berikan laporan perubahan.
5. Berikan cara test.
6. Tandai risiko konten bila ada.

## Prioritas Terdekat
1. Pastikan blok Content Library Metadata V1 tampil di dashboard admin artikel, terutama mobile.
2. Pastikan form artikel menyimpan metadata ke Firestore.
3. Pastikan hanya artikel published yang tampil di publik.
4. Test satu artikel low-risk sebelum artikel sensitif.
5. Audit safety Nusa AI sebelum publish banyak artikel.
