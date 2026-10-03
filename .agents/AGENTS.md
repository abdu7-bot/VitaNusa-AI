# VitaNusa-AI Agent Governance Contract

Dokumen ini adalah kontrak kerja wajib untuk setiap coding agent (Kilo, Copilot,
Codex, atau agent lain) yang bekerja di VitaNusa-AI. Dokumen lain menguraikan;
dokumen ini menetapkan batas, ownership, dan urutan kerja.

Rujukan rinci:

- `.agents/RULES.md` — aturan yang tidak boleh dilanggar.
- `.agents/WORKFLOW.md` — state machine, gate, dan checklist per fase.
- `.agents/ARCHITECTURE.md` — posisi governance dalam arsitektur.
- `ROADMAP.md` — arah pekerjaan.
- `tasks/TODO.md` — antrean kerja aktif.

## 0. Workspace

| Peran | Path | Aturan |
|---|---|---|
| Canonical workspace | `/root/VitaNusa-AI` | Satu-satunya tempat agent boleh membaca dan menulis. |
| Read-only secondary copy | `/home/vita/VitaNusa-AI` | Jangan ditulis, dipindahkan, atau dihapus. Jangan dijadikan asal perubahan. |

Semua path relatif pada dokumen ini dihitung dari canonical workspace. Jika
pekerjaan dilakukan di checkout lain, agent wajib BERHENTI dan melaporkannya,
bukan memindahkan sendiri pekerjaan ke sana.

## 1. Urutan sumber kebenaran

1. Kode dan test yang sedang berjalan.
2. `docs/vitanusa-master-architecture-2026.md`.
3. `AGENTS.md` (root).
4. Dokumen domain, termasuk `.agents/`.
5. `ROADMAP.md` dan `tasks/`.
6. Asumsi agent.

Konflik antar sumber tidak diselesaikan oleh agent dengan menebak. Agent
berhenti dan escalate (§7).

## 2. Peran agent

Tiga peran wajib. Pada task kelas `DOC` atau `TEST`, satu agen boleh menjadi
Implementer sekaligus Reviewer, asalkan checklist review (§7 di
`.agents/WORKFLOW.md`) dijalankan dan hasilnya dicatat. Pada task kelas `CODE` atau
`ADR`, reviewer harus orang atau agen lain yang tidak menulis perubahan itu.

| Peran | Tanggung jawab | Wajib | Tidak boleh |
|---|---|---|---|
| Planner | Scope, urutan, kelas task | Membaca roadmap, memecah pekerjaan, menulis objective/scope/acceptance, menentukan file yang boleh disentuh | Menulis kode aplikasi, memperluas scope sendiri |
| Implementer | Eksekusi | Mengubah hanya file di scope, menjalankan validasi, menyiapkan diff | Menentukan scope, menandai DONE, mengubah area terlindungi tanpa approval |
| Reviewer | Penolakan | Menjalankan checklist review, menolak perubahan yang melanggar aturan, memutuskan PASS atau BLOCKED | Menulis perubahan yang sedang direview, meloloskan perubahan yang tidak ditelusuri ke task |

Siapa menentukan scope: **Planner**, berdasarkan `ROADMAP.md` dan
`tasks/TODO.md`. Planner tidak boleh mengubah prioritas atau urutan task yang
sedang aktif; pemindahan task dan perubahan roadmap adalah keputusan manusia
kecuali pemilik task menyuruh secara eksplisit.

Integrator adalah peran Planner: ia menggabungkan perubahan yang sudah PASS dan
menjaga test tetap hijau.

## 3. Alur dasar

```text
PLAN
  ↓
IMPLEMENT
  ↓
VALIDATE
  ↓
REVIEW
  ↓
COMMIT
  ↓
DONE
```

Tahapan tidak boleh dilompati. `VALIDATE` berjalan pada state `TESTING`;
`REVIEW` pada state `REVIEW`; `COMMIT` hanya setelah reviewer PASS. Rinci gate
ada di `.agents/WORKFLOW.md`.

## 4. Kapan agent boleh coding

Agent boleh coding hanya bila seluruh kondisi berikut benar:

1. Ada task dengan ID di `tasks/TODO.md` atau file task di `tasks/active/`.
2. Task sedang pada state `ACTIVE` dan diklaim oleh agent tersebut.
3. Scope file tertulis eksplisit, bukan "yang relevan" atau "sedikit saja".
4. Kelas task (§5) sudah ditentukan dan gate-nya jelas.
5. Dependency task sebelumnya sudah DONE.
6. `git status --short` dibaca dan kondisi tree diketahui.
7. Perubahan tidak menyentuh area terlindungi (§6) tanpa approval manusia.

## 5. Kelas task

Setiap file task wajib menyebut kelasnya. Gate berbeda per kelas.

| Kelas | Arti | Boleh disentuh | Gate minimum |
|---|---|---|---|
| `DOC` | Documentation-only | Hanya file dokumentasi yang disebut scope | `git diff --check`, `scripts/check_agent_governance.py`, review dokumen |
| `TEST` | Test-only | Hanya file test dan fixture yang disebut scope | Suite lama dan baru lulus, nol perubahan production |
| `CODE` | Production-code | Hanya file runtime yang disebut scope | Approval manusia untuk area terlindungi, regression suite, diff review penuh |
| `ADR` | Architecture decision | Dokumen arsitektur dan konsekuensinya | Human approval mandatory, tidak dikerjakan otonom |

Aturan kelas:

- `DOC` dan `TEST` tidak boleh diam-diam menjadi `CODE`. Jika dokumentasi atau
  test menuntut perubahan production, task dipecah; implementer berhenti.
- `CODE` pada area terlindungi selalu memerlukan human approval lebih dulu.
- `ADR` tidak dapat diselesaikan hanya dengan menulis dokumen; harus ada
  keputusan manusia yang tercatat.

## 6. Area terlindungi

Area berikut tidak boleh diubah tanpa scope eksplisit **dan** approval manusia:

- homepage publik dan layout utama;
- chat UI Nusa AI;
- logika VitaCheck;
- halaman produk dan halaman kontak;
- Firebase config dan Firestore rules;
- WhatsApp/email dan asset path;
- service worker dan deployment config.

Perlindungan bersifat default. "Tidak diminta secara eksplisit" berarti tidak
boleh diubah.

## 7. Kapan agent wajib berhenti

Agent wajib BERHENTI, tidak melanjutkan sendiri, dan mencatat alasannya pada file
task bila salah satu kondisi ini terjadi:

1. Scope task tidak jelas.
2. Requirement bertentangan satu sama lain.
3. Perubahan keluar dari scope.
4. Production behavior berubah tanpa otorisasi.
5. Test gagal dan penyebab belum dipahami.
6. Ditemukan konflik arsitektur.
7. Membutuhkan keputusan manusia.

Tanda berhenti yang sah: state `BLOCKED` pada file task atau
`TESTING → FAILED`. "Rasa yakin", "test hijau", dan "hanya sedikit lagi" bukan
alasan melanjutkan.

## 8. Aturan yang tidak dapat dinegosiasikan

1. Test hijau **tidak** memberi hak memperluas scope. Perbaikan di luar scope
   adalah pekerjaan baru, bukan penyelesaian pekerjaan lama.
2. Setiap perubahan harus dapat ditelusuri ke task dan requirement tertentu.
   Perubahan tanpa jejak task ditolak reviewer.
3. Satu task, satu owner, satu rentang file. Dua agent tidak boleh mengerjakan
   scope yang sama pada waktu yang sama (lihat `.agents/WORKFLOW.md` bagian
   claim).
4. Jangan memperbaiki di luar scope hanya karena mudah.
5. Jangan menghapus file, test, atau dokumentasi tanpa bukti kuat bahwa file
   tersebut obsolete dan tanpa persetujuan reviewer.
6. Jangan membuat klaim tentang repository yang belum diverifikasi dengan
   command atau referensi file.
7. Jangan menambahkan dependency runtime hanya untuk keperluan governance.
8. Jangan mengaktifkan loop autonomous baru di luar yang tertulis di
   `.agents/WORKFLOW.md`.

## 9. Syarat task DONE

Task hanya DONE bila seluruhnya terpenuhi:

1. Objective tercapai dan dapat dibuktikan.
2. Acceptance criteria terisi dan terverifikasi.
3. Validasi relevan dijalankan dan dicatat hasilnya.
4. Diff direview sesuai aturan reviewer pada §2: reviewer terpisah untuk
   `CODE` dan `ADR`, atau self-review dengan checklist lengkap untuk `DOC` dan `TEST`.
5. Tidak melanggar `.agents/RULES.md`.
6. Perubahan ter-commit dengan pesan yang menyebut task ID.
7. Status task dan bukti diperbarui pada file task.

Kode berhasil ditulis bukan berarti task selesai.
