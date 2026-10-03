# VitaNusa-AI Agent Workflow

Dokumen ini adalah prosedur operasional. Ikuti urutan; jangan improvisation
urutan dan lewati gate.

## 1. State machine

```text
BACKLOG → READY → ACTIVE → TESTING → REVIEW → DONE
```

Kegagalan:

```text
ACTIVE → BLOCKED
TESTING → FAILED
REVIEW → BLOCKED
```

Pemetaan ke alur dasar `.agents/AGENTS.md` §3:

| Alur dasar | State task | Keluaran yang dihasilkan |
|---|---|---|
| PLAN | `READY` | Objective, scope file, kelas task, acceptance criteria |
| IMPLEMENT | `ACTIVE` | Diff terbatas pada scope |
| VALIDATE | `TESTING` | Hasil test/lint/check yang dicatat |
| REVIEW | `REVIEW` | Checklist review dan keputusan PASS atau BLOCKED |
| COMMIT | `DONE` | Satu commit dengan task ID + status task diperbarui |

## 2. Kriteria masuk dan keluar setiap state

### BACKLOG → READY
- Task terdaftar di `tasks/BACKLOG.md` atau `tasks/TODO.md`.
- Dependency teridentifikasi dan sudah DONE.

### READY → ACTIVE
- File task ada di `tasks/active/` dengan ID, class, priority, dependency, owner.
- Scope file ditulis eksplisit.
- Claim dicatat (§4).
- `git status --short` dibaca; kondisi tree diketahui.
- Untuk class `CODE` pada area terlindungi: approval manusia tersedia.

### ACTIVE → TESTING
- Diff hanya menyentuh file dalam scope.
- Tidak ada perubahan production behavior di luar objective.

### TESTING → REVIEW
- Validasi relevan (§6) dijalankan dan hasilnya dicatat pada file task.
- Tidak ada kegagalan yang belum dipahami.

### TESTING → FAILED
- Test gagal dan penyebab belum dipahami, atau perubahan memerlukan
  production fix yang di luar scope.

### REVIEW → DONE
- Checklist review (§7) lengkap dan PASS.
- Commit tunggal dengan task ID sudah dibuat.
- Status dan bukti ditulis pada file task.

### Ke state BLOCKED
- Terjadi salah satu stop condition `.agents/AGENTS.md` §7.
- Alasan ditulis pada file task. Task tidak boleh dibiarkan menggantung di
  `ACTIVE` tanpa penjelasan.

## 3. Sebelum coding
1. Baca `ROADMAP.md`, `tasks/TODO.md`, dan file task.
2. Baca `.agents/AGENTS.md` dan `.agents/RULES.md`.
3. Pilih satu task yang dependency-nya terpenuhi.
4. Pastikan scope file dan kelas task jelas.
5. Cek `git status --short`.
6. Klaim task bila belum diklaim (§4).
7. Buat checkpoint bila perubahan berisiko.

## 4. Claim dan anti-tabrakan

Format claim pada file task:

```text
**Owner:** <nama agen atau "unassigned">
**Claimed at:** <YYYY-MM-DDTHH:MM:SSZ>
**Claimed files:** <daftar path eksplisit>
```

Aturan:

- Klaim dicatat sebelum file pertama disentuh.
- File yang diklaim tidak boleh diedit agen lain sampai claim dilepas atau
  task selesai.
- Jika dua agen mengklaim file yang sama, keduanya berhenti dan escalate ke manusia.
- Claim dicatat pada file task, bukan pada sistem eksternal.
- Otomasi claim terpusat (task locking) adalah pekerjaan T003; sebelum itu,
  disiplin claim manual di atas adalah satu-satunya pagar dan tidak boleh
  dilewati karena tidak ada tool.

## 5. Saat coding
1. Kerjakan hanya scope task.
2. Hindari perubahan tidak terkait.
3. Simpan perubahan kecil dan dapat ditinjau.
4. Jangan memperbaiki di luar scope walau test menyuruh.

## 6. Validasi per kelas task

Jalankan yang relevan dengan kelas task, bukan semuanya.

| Konteks perubahan | Validasi minimum |
|---|---|
| Governance atau dokumentasi (`.agents/`, `tasks/`, `docs/`) | `git status --short`, `git diff --check`, `python scripts/check_agent_governance.py`, `python scripts/check_suspicious_unicode.py` |
| Backend (`backend/app`, `backend/tests`) | dari `backend/`: `python -m unittest discover -s tests -p 'test_*.py'`, `python -m compileall -q app tests`, `python tests/ci_smoke_test.py`, `python tests/policy_http_smoke_test.py` |
| Frontend (`tests/*.mjs`, asset, halaman) | `npm run check` dan suite `npm run test:*` yang relevan |
| Firestore rules | `npm run test:firestore-rules` |
| Dependency manifest | `python scripts/check_python_dependency_sync.py` |

Aturan validasi:

- Jangan menjalankan test yang tidak relevan hanya agar output terlihat banyak.
- Test yang gagal karena penyebab belum dipahami adalah stop condition, bukan alasan untuk diabaikan.
- Status test lokal bukan bukti status CI; jangan mengklaim CI hijau tanpa bukti.

## 7. Setelah validasi: checklist reviewer

Reviewer wajib memeriksa dan mencatat hasil untuk keenam hal berikut:

1. **Scope** — semua file yang berubah ada dalam scope task; tidak ada file
   asing yang ikut ter-commit.
2. **Correctness** — perubahan memenuhi objective dan acceptance criteria task.
3. **Regression** — test lama yang relevan masih lulus; tidak ada fitur yang
   dihapus untuk membuat test hijau.
4. **Architecture consistency** — perubahan tidak melanggar
   `docs/vitanusa-master-architecture-2026.md`, `.agents/ARCHITECTURE.md`, dan
   `docs/hierarchy-system.md`; policy owner tetap satu.
5. **Documentation consistency** — dokumentasi yang menyebut perilaku atau
   status lama sudah diperbarui; tidak ada klaim tanpa bukti.
6. **Git diff** — `git diff` dan `git diff --check` dibaca penuh; tidak ada
   whitespace error, merge marker, secret, atau artefak yang tidak disengaja.

Tambahan pemeriksaan reviewer:
- Class `CODE` pada area terlindungi: pastikan approval manusia tercatat.
- Perubahan pada `.agents/` atau `tasks/`: pastikan konsistensi antar dokumen.

Hasil review dicatat pada file task sebagai `PASS` atau `BLOCKED` beserta alasan.

## 8. Commit
- Commit hanya setelah reviewer PASS.
- Satu commit untuk satu task; jangan menggabungkan task lain.
- Pesan commit menyebut task ID, misalnya `docs: establish agent governance (T002)`.
- Jangan amend commit yang sudah gagal gate; buat commit baru.
- Jangan melakukan destructive operation tanpa approval manusia.

## 9. Autonomous loop

Agent boleh mengambil task berikutnya hanya jika:
- task tersedia;
- dependency terpenuhi;
- tidak ada lock/conflict;
- test gate lolos;
- policy keamanan lolos;
- task bukan zona human approval.

Jika syarat gagal, hentikan loop dan catat alasan.

Batas loop yang berlaku saat ini: satu task per sesi agent. Loop multi-task
autonomous, task locking terotomasi, checkpoint/rollback otomatis, dan audit
log adalah pekerjaan T003, T004, dan T005. Jangan menambahkannya
di luar scope task tersebut.

## 10. Definition of Done per task

Task DONE bila `.agents/AGENTS.md` §9 terpenuhi seluruhnya. Task yang hanya
sebagian selesai ditulis sebagai `BLOCKED` dengan keterangan yang jelas, bukan
sebagai DONE.
