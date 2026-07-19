# Fase 2 PR 5 — Offline Hardening dan Phase Exit

## Status

Fase 2 NusaBelajar selesai untuk review setelah PR ini. Fitur tetap internal-only dan
local-first. Fase 3 tidak dimulai oleh perubahan ini.

## Offline contract

Service worker mem-precache halaman katalog dan lesson, stylesheet, build asset, catalog,
manifest, serta content package NusaBelajar yang berada pada allowlist statis. Cache API
tidak menyimpan jawaban, attempt, progress, learner scope, data akun, atau payload privat.
Request non-GET, API, Firebase, Firestore, dan host data eksternal tetap bypass/network-only.

Byte dari Cache API melewati loader yang sama dengan byte dari jaringan. Mode offline tidak
melewati gate `published`/`approved`, pemeriksaan path same-origin, `contentBytes`, checksum
SHA-256, relasi manifest, scope learner, atau `contentVersion`. Cache bukan sumber otoritas
dan tidak menggantikan validasi package.

Worker baru menunggu konfirmasi update yang sudah ada sebelum `skipWaiting`. Saat worker
aktif, hanya cache lama dengan prefix VitaNusa yang dihapus; cache yang tidak dimiliki
VitaNusa tidak disentuh. Pergantian cache version memberi snapshot statis yang konsisten.

## Rekomendasi lesson

Rekomendasi dihitung deterministik dari urutan lesson, progress learner yang sedang aktif,
dan `contentVersion` package. Tanpa progress, lesson pertama direkomendasikan. Progress
`needs_practice` merekomendasikan lesson yang sama; progress mastery merekomendasikan
lesson berikutnya bila ada. Progress dari content version lain diabaikan. Rekomendasi
bukan AI, bukan ranking, dan tidak memakai label merendahkan.

## Quiz, attempt, progress, backup, dan recovery

- Retry penyimpanan quiz memakai attempt serta operation ID yang sama.
- Completed attempt tetap append-only dan progress tetap diperbarui atomik.
- Progress content version baru tidak mewarisi best score atau attempt count versi lama.
- Semua repository read/write tetap membutuhkan learner scope eksplisit.
- Backup v2 memvalidasi attempt completed, operation ID unik, relasi last attempt,
  attempt count, best score, timestamp, learner scope, dan content version.
- Backup v1 dan v2 tetap dapat dipreview.
- Recovery tetap preview-only; tidak ada restore commit.

## Accessibility dan responsive

Katalog menandai rekomendasi dengan teks dan relasi `aria-describedby`, bukan warna saja.
Navigasi keyboard, focus-visible, live status, touch target, mobile viewport, safe area,
reduced motion, forced colors, dan wrapping layar sempit diuji sebagai exit criteria.

## Rollback

Rollback kode tidak menurunkan IndexedDB v2 dan tidak menghapus data. Binary lama yang
hanya memahami v1 tidak boleh dipakai untuk membuka database v2. Cache offline dapat
diganti dengan cache version baru atau dibersihkan melalui lifecycle service worker yang
terkontrol; IndexedDB learning attempts/progress dan file backup tidak dihapus otomatis.

## Batas akhir Fase 2

- Tidak ada Firestore atau cloud sync.
- Tidak ada AI grading.
- Tidak ada leaderboard atau sertifikat.
- Tidak ada fitur NusaKasir atau VitaSheet.
- Tidak ada IndexedDB v3.
- Tidak ada restore commit atau deployment.
- Fase 3 tidak dimulai.
