# Audit Trail Contract

Audit trail T003 berupa kontrak dan skema, bukan persistence yang sudah berjalan.
`.agents/RULES.md` melarang membangun mekanisme berlapis sebelum kebutuhan nyata
terbukti, dan audit log otomatis adalah pekerjaan T005. Yang ditetapkan di sini
adalah data minimum yang harus dapat ditelusuri untuk setiap tindakan agent.

## 1. Mengapa audit trail

Prinsip utama `ROADMAP.md` §0 adalah amanah dan auditability: setiap perubahan
kode dapat dilacak. Audit trail adalah bentuk teknis dari prinsip itu, dan
`.agents/AGENTS.md` §8.2 menolak perubahan tanpa jejak task.

## 2. Field minimum satu entri

| Field | Tipe | Isi | Wajib |
|---|---|---|---|
| `task_id` | string | ID task format `T<NNN>` | Ya |
| `actor` | string | Nama agent atau `human` | Ya |
| `role` | enum | `planner`, `implementer`, `reviewer`, `integrator`, `human` | Ya |
| `timestamp` | ISO 8601 UTC | Waktu aksi terjadi | Ya |
| `action` | enum | `claim`, `implement`, `validate`, `review`, `approve`, `integrate`, `merge`, `block`, `release` | Ya |
| `workspace` | string | Path workspace; `canonical` bila di canonical repository | Ya |
| `branch` | string | Nama branch; `main` untuk canonical | Ya |
| `class` | string | Kelas task yang sedang berjalan | Ya |
| `reviewer` | string atau null | Nama reviewer | Ya untuk action `review` |
| `validation` | object | Perintah yang dijalankan dan statusnya | Ya untuk action `validate` |
| `approval` | object atau null | Siapa menyetujui, kapan, untuk file apa | Ya bila task memerlukannya |
| `commit_sha` | string atau null | SHA commit yang dihasilkan | Ya untuk `implement`, `integrate`, `merge` |
| `result` | enum | `pass`, `fail`, `blocked` | Ya |
| `note` | string | Alasan singkat; wajib pada `blocked` dan `fail` | Conditionally |

## 3. Skema contoh

Satu entri audit minimal, dalam bentuk JSON Lines. Ini contoh kontrak, bukan
data yang sudah terekam:

```json
{"schema":"vitanusa.audit.v1","task_id":"T011","actor":"kilo-auto","role":"implementer","timestamp":"2026-10-05T02:10:00Z","action":"implement","workspace":"canonical","branch":"task/T011","class":"CODE","reviewer":null,"validation":null,"approval":{"by":"human","at":"2026-10-05T01:00:00Z","scope":["backend/app/x.py"]},"commit_sha":"0000000000000000000000000000000000000000","result":"pass","note":""}
```

## 4. Keputusan storage

| Opsi | Status | Alasan |
|---|---|---|
| Berkas JSON Lines append-only per task, contoh `tasks/audit/<TASK-ID>.jsonl` | Kontrak, belum dibuat | Tidak menambah dependency, mudah dibaca dan diaudit, sesuai `.agents/WORKFLOW.md` §4 bahwa claim dicatat pada file task bukan sistem eksternal |
| Database orchestration | Ditolak | Tidak ada kebutuhan nyata; menambah permukaan risiko tanpa bukti |
| Branch atau tag Git untuk audit | Ditolak | Audit bukan riwayat kode; histone Git bukan jejak tindakan |

Aturan penyimpanan yang berlaku begitu persistence dibuat:

1. Append-only. Entri tidak diedit dan tidak dihapus; koreksi ditulis sebagai
   entri baru dengan `action` yang sama dan `note` yang menjelaskan koreksi.
2. Satu file per task, disebut dari file task dengan path eksplisit.
3. Entri ditulis oleh actor yang melakukan aksi, bukan oleh agent lain.
4. Setiap entri yang tercatat pada file task dapat diverifikasi ulang terhadap
   Git: commit SHA harus benar-benar ada dan task ID harus muncul pada pesan
   commit.
5. Penyimpanan audit tidak boleh memuat secret. Nilai credential tidak masuk
   entri audit (`.agents/RULES.md` §Secrets).
6. Audit log otomatis adalah T005. T003 hanya menetapkan skema.

## 5. Pemisahan terhadap T005

| Termasuk T003 | Bukan T003 |
|---|---|
| Daftar field minimum dan enum | Penulisan entri otomatis oleh runtime |
| Skema contoh | Penyimpanan dan rotasi file audit |
| Keputusan storage dan alasannya | Audit viewer di UI (`tasks/BACKLOG.md` Phase H) |
| Aturan append-only dan verifikasi terhadap Git | Integrasi audit ke CI |

## 6. Verifikasi yang bisa dilakukan sekarang

Tanpa persistence, jejak audit sudah dapat diverifikasi dari Git dan berkas task:

| Pertanyaan | Sumber verifikasi |
|---|---|
| Apakah ada actor yang bekerja? | `**Owner:**` pada file task |
| Apakah reviewer terpisah? | Bagian Review pada file task |
| Apakah validasi dijalankan? | Ringkasan hasil validasi pada file task |
| Apakah approval ada dan mendahului perubahan? | Field `**Approval:**` |
| Apakah commit dapat ditelusuri? | Pesan commit dan `**Commit:**` |
| Apakah perubahan sesuai scope? | `git diff --name-only` terhadap `**Claimed files:**` |

Keterbatasan yang harus jujur: verifikasi ini bergantung pada isi berkas task.
Agent yang berbohong tentang field tersebut tidak dapat dideteksi oleh Git.
Otomasi yang memeriksa konsistensi tersebut adalah pekerjaan lanjutan dan
tidak diklaim sebagai kemampuan yang sudah ada.