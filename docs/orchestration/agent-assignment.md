# Agent Assignment Model

Dokumen ini memetakan peran governance ke agent dan provider yang tersedia.
Peran tetap sumber kebenaran; provider hanyalah implementasi peran.

## 1. Peran adalah kewenangan, bukan nama provider

`.agents/AGENTS.md` §2 menetapkan empat peran: Planner, Implementer, Reviewer,
dan Integrator. Kewenangan attach pada peran tersebut, bukan pada nama tool:

| Peran | Kewenangan | Larangan |
|---|---|---|
| Planner | Menentukan scope, urutan, kelas task, dan kategori perubahan | Menulis kode aplikasi; memperluas scope sendiri |
| Implementer | Mengubah hanya file di scope, menjalankan validasi, menyiapkan diff | Menentukan scope; menandai DONE; mengubah production code atau area terlindungi tanpa approval tertulis |
| Reviewer | Menjalankan checklist review dan memutuskan PASS atau BLOCKED | Menulis perubahan yang sedang direview; meloloskan perubahan tanpa jejak task |
| Integrator | Menggabungkan perubahan yang sudah PASS; menjaga build dan test hijau | Menulis perubahan baru; memperluas scope; menyetujui karyanya sendiri |

## 2. siapa boleh melakukan apa

| Kegiatan | Peran yang boleh | Syarat tambahan |
|---|---|---|
| Menentukan scope dan acceptance criteria | Planner | Berdasarkan `ROADMAP.md` dan `tasks/TODO.md` |
| Claim task dan lock file | Planner atau Implementer yang akan mengerjakan | Claim tercatat sebelum file pertama disentuh |
| Implementasi | Implementer | Scope eksplisit, kelas task jelas, approval tertulis bila `CODE`, `CONFIG`, `CI`, atau `DEPLOY` |
| Validasi perintah | Implementer atau Reviewer | Sesuai `.agents/WORKFLOW.md` §6 |
| Review dan keputusan PASS | Reviewer | Terpisah dari implementer untuk `TOOL`, `CONFIG`, `CI`, `CODE`, `ADR`; self-review hanya untuk `DOC` dan `TEST` |
| Merge dan penggabungan | Integrator | Semua gate pada `review-approval-integration.md` terpenuhi |
| Persetujuan manusia | Manusia | Tercatat pada file task; tidak dapat diwakili agent |

## 3. Slot provider

Slot provider mengikuti `ROADMAP.md` §6 dan `tasks/BACKLOG.md`. Slot adalah
konfigurasi, bukan jaminan:

| Kelompok | Slot | Kegunaan yang lazim | Catatan |
|---|---|---|---|
| Auto dan free | Kilo utama, Kilo alternatif 1, 2, 3 | Implementasi dan perbaikan | Slot utama; alternatif dipakai bila utama gagal atau kuota habis |
| Gratisan harian | Copilot 1, 2, 3, 4 | Review independen, implementasi | Digunakan sebagai reviewer independen pada review T002 |
| Gratisan bulanan | Codex 1, 2, 3, 4 dan Agy 1, 2, 3, 4 | Implementasi, riset, analisis kode | Ketersediaan tidak boleh diasumsikan |

Aturan yang mengikat:

1. Jangan menganggap semua agent identik. Kemampuan, biaya, dan ketersediaan
   setiap slot berbeda dan harus dicek, bukan diasumsikan
   (`ROADMAP.md` §6, `tasks/BACKLOG.md` Phase C).
2. Jangan menulis availability, kuota, atau error rate sebagai fakta tanpa
   pemeriksaan. Pemeriksaan provider otomatis adalah pekerjaan terpisah pada
   antrean P2 (`T021` health check, `T022` quota tracking).
3. Provider yang tidak bisa diakses pada sesi itu bukan alasan melewati gate.
   Gate yang gagal berarti task berhenti pada state yang sesuai, bukan dilewati.
4. Pergantian provider tidak mengubah kewenangan: Implementer tetap
   Implementer, dan reviewer tetap harus terpisah.
5. Copilot dipakai sebagai reviewer independen bukan karena lebih baik secara
   default, melainkan karena harus bisa mereview tanpa menjadi penulis perubahan.

## 4. Formulir assignment

Setiap task record menuliskan assignment dengan field berikut:

```text
**Owner:** <agent yang mengimplementasikan>
**Reviewer:** <agent atau manusia yang mereview; "self-review" hanya untuk DOC dan TEST>
**Integrator:** <agent yang menggabungkan bila lebih dari satu task>
**Branch:** task/<TASK-ID>
**Workspace:** <path bila isolation dipakai>
**Approval:** <bukti approval manusia, atau "not required" untuk DOC dan TEST>
```

Field `**Reviewer:**`, `**Integrator:**`, `**Branch:**`, dan `**Workspace:**`
wajib diisi sebelum implementasi dimulai dan tidak boleh diisi setelah diff
selesai.

## 5. Pelanggaran yang paling sering terjadi

| Pelanggaran | Akibat |
|---|---|
| Assign agent sama sebagai implementer dan reviewer untuk `CODE` | Review tidak sah |
| Mengisi approval setelah diff selesai | Approval dianggap tidak ada (`.agents/RULES.md`) |
| Menganggap semua provider selalu tersedia | Klaim palsu soal kuota dan kemampuan |
| Mengganti provider agar gate dilewati | Perubahan di luar scope dan risk tidak tercatat |
| Melewati Integrator dan langsung merge dari branch implementer | Pelanggaran `review-approval-integration.md` |

## 6. Yang tidak dikerjakan pada T003

T003 tidak membangun router, health check, quota tracking, atau fallback
provider. Dokumen ini hanya menetapkan bentuk assignment dan batas kewenangan.
Implementasi provider routing berada di P2 pada `tasks/TODO.md`.
