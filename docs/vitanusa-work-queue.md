# Daftar Kerja VitaNusa AI

Terakhir diperbarui: 24 Juli 2026

Dokumen ini menjadi antrean kerja utama saat pengembangan dilakukan dari laptop. Setiap pekerjaan harus memakai branch terpisah, satu fokus per Pull Request, dan tidak boleh di-merge sebelum test serta GitHub Actions lulus.

## Prioritas 0

- Selesaikan Content Rendering Security di branch `fix/vitanusa-content-rendering-security`.
- Fokus: sanitizer knowledge/chat/artikel, payload on*, action, formaction, javascript:, data:, xlink:href, SVG, HTML malformed, dan innerHTML tidak aman.
- Jalankan `npm ci`, `npm run check`, `npm run test:mandiri`, frontend/security test, Unicode scan, dan `git diff --check`.
- Buat Draft PR, lalu Copilot review read-only.

## Prioritas 1

- Buat dan merge PR `fix/static-link-accessibility` setelah `npm run check` dan `git diff --check` lulus.
- Pastikan hanya `vitacheck.html`, `komik.html`, dan `404.html` yang berubah.
- Buat dan merge PR `docs/vitanusa-status-sync` setelah pastikan hanya roadmap dan current-status diversi.

## Prioritas 2

- Smoke test backend hardening: query token ditolak, Bearer valid/invalid, data sensitif tidak masuk log/queue/respons admin, rate limit 429, dan trusted proxy fail-closed.
- Smoke test NusaKasir pada browser Android: Produk, Inventory, CartDraft, Sale Preview, Payment tunai, Receipt, idempotency, dan backup v6.

## Prioritas 3

- Mulai Fase 3 PR 8 setelah audit keamanan, PRs dokumentasi/aksesibilitas, dan smoke test selesai.
- Scope PR 8: Expense dan Cash Session Foundation.
- Belum mencakup void, reversal, refund, laporan, printer/PDF, cloud sync, atau deployment.

## Prioritas 4

- Unggah PDF novel bertahap: satu episode satu file PDF.
- Setelah PDF tersedia, perbarui README dan manifest berdasarkan file aktual.
- Jangan mengarang judul episode, jumlah file, atau metadata.

## Aturan Kerja

1. Jangan berkerja langsung di `main`.
2. Satu branch dan satu fokus per PR.
3. Codex mengerjakan implementasi utama.
4. Copilot meriview read-only setelah Draft PR tersedia.
5. Konektor GitHub dipakai untuk dokumentasi, konten, audit, dan perubahan kecil yang terisolasi.
6. Jangan merge bila test atau GitHub Actions belum hijau.
7. Jangan deploy dari branch fitur.
8. Jangan downgrade IndexedDB atau menghapus data pengguna.
9. Jangan menyimpan token, API key, password, UID, atau secret di repository maupun log.
