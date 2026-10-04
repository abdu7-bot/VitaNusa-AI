# Validation Contract

Dokumen ini adalah kontrak validation untuk task dan integrasi multi-agent. Isi
kontrak ini **bukan** validator: tidak ada tooling yang dijalankan oleh dokumen
ini. Automasi validasi adalah pekerjaan lanjutan; sampai ada, pemeriksa yang
benar-benar berjalan tetap perintah yang tercantum pada `.agents/WORKFLOW.md` §6.

## 1. Delapan pemeriksaan minimum

| # | Pemeriksaan | Definisi | Bukti yang harus ada | Aksi bila gagal |
|---|---|---|---|---|
| 1 | Scope check | Seluruh file yang berubah ada di `**Claimed files:**` dan kategori file cocok dengan `**Class:**` | `git diff --name-only` dibandingkan dengan claim | `BLOCKED` |
| 2 | Git cleanliness | Tree bersih di luar perubahan task; tidak ada perubahan user yang tertimpa | `git status --short` sebelum dan sesudah | `BLOCKED` |
| 3 | Diff check | Tidak ada whitespace error, merge marker, secret, atau artefak | `git diff --check` dan pembacaan `git diff` penuh | `BLOCKED` |
| 4 | Task dan branch identity | Commit dan branch terkait dengan satu task ID; nama branch mengikuti `task/<TASK-ID>` | `git log --oneline` dan `git branch --show-current` | `BLOCKED` |
| 5 | Reviewer separation | Reviewer bukan implementer untuk kelas yang mewajibkan; self-review hanya untuk `DOC` dan `TEST` dengan checklist lengkap | Nama reviewer dan hasil checklist pada file task | `BLOCKED` |
| 6 | Acceptance criteria | Seluruh acceptance criteria pada file task terpenuhi dan terverifikasi | Checklist pada file task | `BLOCKED` |
| 7 | Approval state | Approval yang diwajibkan tercatat pada file task dan mendahului perubahan | Field `**Approval:**` | `BLOCKED` |
| 8 | Commit traceability | Commit menyebut task ID dan tercatat pada file task | `**Commit:**` pada file task | `BLOCKED` |

Pemeriksaan 1 sampai 8 adalah syarat masuk Integrator
(`review-approval-integration.md` §4.1). Pemeriksaan tambahan per kelas task
tetap berlaku pada `.agents/WORKFLOW.md` §6.

## 2. Pemetaan ke kelas task

| Kelas task | Pemeriksaan 1 sampai 8 | Validasi tambahan dari `.agents/WORKFLOW.md` §6 |
|---|---|---|
| `DOC` | Wajib | `git status --short`, `git diff --check`, `python scripts/check_agent_governance.py`, `python scripts/check_suspicious_unicode.py` |
| `TEST` | Wajib | Suite lama dan suite baru lulus, nol perubahan production |
| `TOOL` | Wajib | Pemeriksaan sintaks, minimal satu smoke check atau kasus negatif, nol perubahan production behaviour |
| `CONFIG` | Wajib | `python scripts/check_python_dependency_sync.py` bila manifest Python berubah |
| `CI` | Wajib | `git diff --check`, diff review penuh; hasil run CI tidak diklaim tanpa bukti |
| `DEPLOY` | Wajib | `git diff --check`, review rollback path; agent tidak menjalankan deploy |
| `CODE` | Wajib | Regression suite backend atau frontend sesuai area yang disentuh |
| `ADR` | Wajib | Keputusan manusia tercatat |

## 3. Pemeriksa yang sudah ada dan batasnya

| Pemeriksa | Yang diperiksa | Yang tidak diperiksa |
|---|---|---|
| `scripts/check_agent_governance.py` | Keberadaan path governance, keberadaan string anchor, bentuk baris task | Makna dan konsistensi antardokumen, kepatuhan agent, cakupan tabel peran dan kelas task baru |
| `scripts/check_suspicious_unicode.py` | Kontrol Unicode mencurigakan pada file teks terlacak | Makna dokumen, kebenaran klaim |
| `scripts/check_python_dependency_sync.py` | Sinkronisasi manifest dan lockfile Python | Dampak perubahan terhadap runtime aplikasi |
| Pemeriksa CI pada `.github/workflows/ci.yml` | Build, unit test, smoke test, rules test, repository safety | Validasi governance |

Anchor guard bukan sumber otoritatif. PASS dari anchor guard berarti anchor ada,
bukan berarti kontrak benar. `.agents/ARCHITECTURE.md` §3.1 menyatakan hal yang
sama; pemeriksa tidak boleh dipromosikan menjadi validator semantik di dokumen
mana pun.

## 4. Automation: batas dan syarat

Belum ada automation untuk pemeriksaan 1 sampai 8. Jika otomatisasi dibuat pada
task berikutnya, syaratnya:

1. Diberi kelas task sendiri. Otomasi yang mengubah `scripts/` adalah `TOOL`
   dan wajib reviewer terpisah.
2. Didasarkan pada kontrak ini, bukan pada interpretasi bebas.
3. Tidak ada privilege escalation: pemeriksa tidak boleh mendapat hak akses baru.
4. Tidak boleh mengubah workflow CI tanpa approval manusia tertulis pada task
   kelas `CI`.
5. Kegagalan harus menjadi exit code, bukan peringatan yang diabaikan.
6. Status output harus jujur: lulus berarti pemeriksaan lulus, bukan berarti
   governance benar.
6. Tidak ada dependency baru kecuali disetujui eksplisit pada file task.

## 5. Apa yang tidak dilakukan T003

- Tidak ada skrip validation baru.
- Tidak ada perubahan pada `.github/workflows/ci.yml`.
- Tidak ada perubahan pada `scripts/check_agent_governance.py`.
- Tidak ada klaim bahwa pemeriksaan 1 sampai 8 sudah dijalankan otomatis.