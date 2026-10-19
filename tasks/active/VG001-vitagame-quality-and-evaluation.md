# VG001 — VitaGame Quality, Safety, and Evaluation

**Priority:** P0
**Class:** `CODE + TEST + DOC`
**State:** ACTIVE
**Owner:** Kilo (implementer)
**Reviewer:** independent reviewer (to be assigned)
**Claimed at:** 2026-10-19T18:10:00Z
**Claimed files:**
- `vitagame.html`
- `tests/vitagame.test.mjs` (new)
- `docs/visual/vitagame-quality-and-evaluation.md` (new)
- `tasks/active/VG001-vitagame-quality-and-evaluation.md`
- `tasks/TODO.md`
**Branch:** `kilo/vg001-vitagame-quality`
**Workspace:** canonical `/workspace/app`
**Approval:** Human approval granted by repository owner for VG001 scope (vitagame.html and related test/docs) per user instruction 2026-10-19. Production code changes to vitagame.html are authorized within this scope.

## Objective

Memperbaiki kualitas, keamanan, dan evaluasi VitaGame (Mitos vs Fakta) yang sudah ada di `vitagame.html`. Fokus pada:

1. **Randomisasi kartu** — ganti `sort(() => Math.random() - 0.5)` dengan Fisher–Yates yang benar
2. **Rendering aman** — audit dan perbaiki penggunaan `innerHTML` pada feedback dan elemen dinamis
3. **State machine permainan** — uji dan perbaiki lifecycle game
4. **Progress dan statistik** — pastikan konsistensi progress bar, skor, streak
5. **Aksesibilitas** — keyboard, focus, label, color-independent feedback, screen reader
6. **Ketahanan** — handle edge cases (deck kosong, klik berulang, reset di tengah)
7. **Konten kesehatan** — audit kartu untuk akurasi, provenance, safety
8. **Regression test** — buat `tests/vitagame.test.mjs` dengan coverage minimum
9. **Dokumentasi** — perbarui `docs/visual/vitagame-quality-and-evaluation.md`
10. **Evaluasi** — baseline untuk benchmark masa depan

## Batas yang ditegakkan

Task ini **tidak**:
- Mengubah backend, Firebase, authentication, dependency manifest, CI workflow, deployment
- Mengubah service worker, VitaCheck, chat UI, homepage, halaman produk/kontak
- Menambah dependency baru jika kemampuan tercapai dengan API bawaan
- Memperluas deck kartu secara massal sebelum kualitas konten diverifikasi
- Menjalankan deployment produksi

## Acceptance criteria

- [ ] Fisher–Yates shuffle diimplementasikan dengan random source yang dapat diinjeksi untuk test
- [ ] Semua `innerHTML` pada feedback diganti dengan `textContent` + DOM creation
- [ ] State machine lifecycle lengkap: start → answer → next → finish → reset → replay
- [ ] Progress bar: 100% setelah kartu ke-10 dijawab (sebelum tombol next)
- [ ] Skor, streak, correct count, round konsisten
- [ ] Aksesibilitas: keyboard navigable, focus visible, label bermakna, non-color feedback, ARIA live region untuk feedback
- [ ] Edge cases: deck < 10 kartu, klik berulang, reset di tengah, root element missing
- [ ] Test file `tests/vitagame.test.mjs` dibuat dengan 16+ test case (lihat fase C)
- [ ] Konten kartu diaudit: provenance dicatat, klaim berbahaya ditandai, emergency warning jelas
- [ ] Dokumentasi `docs/visual/vitagame-quality-and-evaluation.md` lengkap
- [ ] Validasi lulus: `node --test tests/vitagame.test.mjs`, `npm run check`, governance checks
- [ ] `git diff --check` bersih
- [ ] Review independen PASS

## Test commands

```bash
node --test tests/vitagame.test.mjs
npm run check
python scripts/check_suspicious_unicode.py
python scripts/check_agent_governance.py
git diff --check
```

## Rollback plan

Jika gagal (sebelum commit):
- `git checkout -- vitagame.html`
- Hapus file baru: `rm tests/vitagame.test.mjs docs/visual/vitagame-quality-and-evaluation.md`
- Hapus file task record: `rm tasks/active/VG001-vitagame-quality-and-evaluation.md`

Jika sudah di-commit tapi perlu rollback:
- `git revert <commit-SHA>` untuk commit VG001
- Verifikasi `git diff --check` dan test lulus setelah revert

**Dilarang:** `git checkout -- .`, `git reset --hard`, `git clean -fd`, force-push, rewrite history.

## Status log

- 2026-10-19T18:10:00Z: Task claimed, state → ACTIVE, record created. Human approval documented.
- 2026-10-19T18:11:00Z: Starting Phase A — Audit baseline