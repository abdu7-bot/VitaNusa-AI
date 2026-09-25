---
id: T005
status: READY
priority: P0
title: Content Rendering Security
allowedPaths: assets|admin|articles|tests|scripts|docs
---
# T005 — Content Rendering Security

## Tujuan
Menutup audit renderer/sanitizer untuk knowledge, chat, artikel, dan HTML dinamis.

## Wajib
- tolak script, iframe, object, embed, form;
- tolak event handler `on*`;
- tolak action/formaction/javascript/data/xlink:href berisiko;
- tangani SVG berisiko, malformed HTML, dan payload encoded/obfuscated;
- gunakan `textContent` jika HTML tidak dibutuhkan;
- tambah regression test untuk payload berbahaya dan konten normal.

## Selesai jika
- `npm ci` lulus;
- `npm run check` lulus;
- `npm run test:content-security` lulus;
- `git diff --check` lulus;
- Unicode/security checks lulus;
- scope perubahan sesuai task;
- Draft PR siap direview;
- tidak ada Blocker/High/Medium terbuka.

## Stop
Jangan menyentuh database, IndexedDB, deployment, secrets, atau mengubah API/backend tanpa task terpisah.
