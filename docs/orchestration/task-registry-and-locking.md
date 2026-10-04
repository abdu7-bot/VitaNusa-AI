# Task Registry dan Locking Contract

Dokumen ini menentukan struktur task registry dan bagaimana dua agent tidak
boleh mengklaim task atau file yang sama. Repository sudah punya state machine
di `.agents/WORKFLOW.md` §1; T003 tidak menambah state baru, hanya merinci field
dan aturan klaim.

## 1. Sumber registry

Registry task pada repository ini adalah berkas Git, bukan database:

| Sumber | Isi |
|---|---|
| `tasks/BACKLOG.md` | Task yang belum READY atau menunggu dependency |
| `tasks/TODO.md` | Antrean kerja aktif dan status ringkas |
| `tasks/active/T<NNN>-<slug>.md` | Task record: objective, scope, class, acceptance, hasil |
| `.agents/AGENTS.md` §7 dan `.agents/WORKFLOW.md` §4 | Aturan claim dan anti-tabrakan |

`tasks/completed/` tercantum di `ROADMAP.md` §1 tetapi direktori itu tidak ada di
checkout ini, dan `.agents/WORKFLOW.md` tidak mewajibkan pemindahan file setelah
`DONE`. T003 tidak membuat direktori itu; lifecycle file dicatat sebagai
follow-up.

## 2. Field minimum setiap task

| Field | Sumber di berkas task | Wajib |
|---|---|---|
| Task ID | Heading `# T<NNN> — <title>` | Ya |
| Title | Heading yang sama | Ya |
| Class | `**Class:**` dengan kelas per kategori perubahan | Ya |
| State | `**State:**` | Ya |
| Priority | `**Priority:**` | Ya |
| Dependencies | `**Dependency:**` | Ya |
| Owner atau Implementer | `**Owner:**` | Ya |
| Reviewer | Nama reviewer pada bagian Review | Ya untuk kelas yang mewajibkan reviewer terpisah |
| Scope file | `**Claimed files:**` dan bagian `## Scope` | Ya |
| Workspace dan branch | `**Workspace:**`, `**Branch:**` bila isolation dipakai | Ya bila workspace agent dibuat |
| Approval | `**Approval:**` | Ya untuk `CODE`, `CONFIG`, `CI`, `DEPLOY` |
| Acceptance criteria | `## Acceptance criteria` dengan checkbox | Ya |
| Validation status | Hasil perintah validasi beserta ringkasan | Ya |
| Commit SHA | `**Commit:**` | Ya |
| Audit | Rujukan ke entri audit pada `audit-trail.md` | Ya |

Field `**Workspace:**`, `**Branch:**`, dan `**Reviewer:**` adalah tambahan T003.
Task record lama (`T001`, `T002`) belum memfield tersebut; keduanya tidak
diubah pada T003 dan kesenjangan itu dicatat sebagai follow-up.

## 3. Lifecycle

Repository memakai state machine ini, dan T003 mengikutinya apa adanya
(`.agents/WORKFLOW.md` §1):

```text
BACKLOG → READY → ACTIVE → TESTING → REVIEW → DONE
ACTIVE → BLOCKED
TESTING → FAILED
REVIEW → BLOCKED
```

Istilah lain yang sering dipakai untuk tahap yang sama dipetakan seperti ini,
tanpa menambah state:

| Istilah lain | State repository | Catatan |
|---|---|---|
| CLAIMED | `READY` ke `ACTIVE` | Claim dicatat pada file task saat masuk `ACTIVE`; tidak ada state `CLAIMED` |
| IN_PROGRESS | `ACTIVE` | Diff terbatas pada scope |
| IMPLEMENTED | batas `ACTIVE` ke `TESTING` | Repository menyatukan implementasi selesai dengan mulai validasi |
| VALIDATED | `TESTING` | Validasi dijalankan pada state ini |
| REVIEWED | `REVIEW` | Checklist reviewer dan keputusan PASS atau BLOCKED |
| APPROVAL_REQUIRED, APPROVED | bukan state | Approval adalah gate yang direkam pada file task, bukan state |
| INTEGRATION | aktivitas Integrator setelah review PASS | Dijelaskan di `review-approval-integration.md` |
| MERGED | `DONE` | Satu commit dengan task ID dan status task diperbarui |

Aturan: jangan menambah state baru hanya karena istilah lain lebih lengkap.
Menambah state berarti mengubah `.agents/WORKFLOW.md` §1, dan itu pekerjaan
`ADR`, bukan pekerjaan orchestration.

## 4. Locking dan klaim

### 4.1 Unit klaim

| Unit | Aturan | Sumber |
|---|---|---|
| Task | Satu task satu owner pada satu waktu | `.agents/RULES.md` §Anti-tabrakan |
| File | Satu file satu agent pada satu waktu | `.agents/RULES.md` §Anti-tabrakan |
| Branch | Satu branch `task/<TASK-ID>` untuk satu task | `workspace-isolation.md` |

### 4.2 Isi lock

Lock pada repository ini adalah catatan claim pada file task. Lock itu tidak
dihapus, hanya berubah statusnya, sehingga jejaknya tetap dapat diaudit:

```text
**Owner:** <nama agen>
**Claimed at:** <YYYY-MM-DDTHH:MM:SSZ>
**Class:** <kelas per kategori>
**Claimed files:** <daftar path eksplisit>
**Approval:** <bukti approval atau "not required">
```

### 4.3 Claim

1. Agent membaca `tasks/TODO.md`, `tasks/active/`, dan `tasks/BACKLOG.md`.
2. Agent memastikan dependency terpenuhi dan file yang akan diklaim belum
   diklaim agen lain.
3. Agent mencatat claim pada file task **sebelum** file pertama disentuh.
4. Baru setelah claim tercatat, agent boleh membuat branch atau workspace.

Claim yang tidak tercatat bukan claim. Dua agen yang belum memeriksa claim atas
file yang sama wajib berhenti dan escalate ke manusia; tidak ada yang otomatis lebih berhak.

### 4.4 Release

| Kondisi | Aksi |
|---|---|
| Task mencapai `DONE` | Status, commit, dan bukti ditulis; claim ditutup dengan noting completion |
| Task mencapai `BLOCKED` atau `TESTING` failed | Alasan ditulis pada file task; claim ditutup dengan noting alasan |
| Owner berhenti sebelum selesai | Owner mencatat status sebenarnya; tidak ada take-over diam-diam |
| Claim hanya untuk file yang tidak jadi disentuh | File dilepas dari `**Claimed files:**` dengan alasan |

Setelah release, file baru boleh diklaim agen lain. Sebelum release, file tetap
terkunci meski owner terlihat tidak aktif.

### 4.5 Stale lock

Stale lock adalah claim yang tercatat tanpa aktivitas: tidak ada perubahan file
pada claim, tidak ada entri audit baru, dan tidak ada catatan baru pada file task
selama lebih dari satu hari kerja, atau owner menyatakan berhenti.

Penanganan stale lock pada fondasi ini:

1. Reviewer atau agent lain **tidak boleh** mengambil alih lock secara otomatis.
2. Agent yang melihat stale lock mencatatkannya di file task sebagai temuan.
3. Penyelesaiannya manusia: manusia yang memindahkan state, melepas claim, atau
   menetapkan owner baru.
4. Auto-expiry berbasis waktu tidak diperbolehkan pada fondasi ini, karena dapat
   diambil alih oleh agent yang salah tanpa bukti.

### 4.6 Pemisahan reviewer

Reviewer tidak boleh sama dengan implementer, kecuali governance secara eksplisit
mengizinkan: kelas `DOC` dan `TEST` boleh memakai self-review dengan checklist
lengkap (`.agents/AGENTS.md` §2). Kelas `TOOL`, `CONFIG`, `CI`, `CODE`, dan `ADR`
wajib reviewer terpisah. Validator tidak boleh menjadi satu-satunya penilai
perubahan yang ia buat sendiri untuk kelas yang melarang self-review.

## 5. Batas T003

Lock di T003 adalah kontrak dan prosedur manual, bukan implementasi. Tidak ada
lock file, database lock, atau daemon yang dibuat. Otomasi claim terpusat adalah
pekerjaan lanjutan; sampai itu ada, disiplin claim manual di atas adalah satu-satunya
pagar dan tidak boleh dilewati karena tidak ada tool
(`.agents/WORKFLOW.md` §4).