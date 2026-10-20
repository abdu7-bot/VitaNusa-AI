# Laporan singkat — Agent Orchestrator

## Yang sudah jadi

Bagian yang tadinya baru peta sekarang sudah punya mesin awal:

- controller runtime: `scripts/agent/task-orchestrator.mjs`;
- test: `tests/agent/task-orchestrator.test.mjs`;
- task contract: `tasks/active/T004-agent-task-orchestrator.md`;
- command test: `npm run test:agent-orchestrator`.

## Cara kerja

Mode biasa:

```bash
node scripts/agent/task-orchestrator.mjs
```

Mode itu cuma membuat rencana. Jadi aman untuk cek dulu.

Kalau memang mau kerja:

```bash
node scripts/agent/task-orchestrator.mjs --execute
```

Worker default:

```text
kilo --auto
```

Bisa diganti melalui `VITANUSA_WORKER_CMD`, tetapi binary worker tetap harus masuk allowlist.

## Pagar yang sudah dipasang

- tidak boleh jalan dari `main`/`master`;
- repository harus bersih sebelum unattended run;
- hanya satu task yang dipilih;
- task harus `READY`;
- prioritas dipilih deterministik;
- worker dibatasi allowlist;
- paid marker ditolak tanpa `VITANUSA_ALLOW_PAID=1`;
- perubahan file di luar scope task menghentikan proses;
- test gagal menghentikan proses;
- `git diff --check` gagal menghentikan proses;
- state runtime disimpan di `.git/vitanusa-agent/` agar tidak ikut commit;
- tidak ada auto-merge;
- tidak ada deployment;
- tidak ada destructive migration.

## Status jujur

Mesinnya sudah dibuat, tetapi **belum boleh disebut 100% selesai** sebelum test dijalankan pada checkout nyata dan PR direview. Ini sengaja. Lebih baik satu centang jujur daripada sepuluh centang hasil halusinasi.

## Urutan setelah PR ini

1. Jalankan `npm ci` jika dependency belum tersedia.
2. Jalankan `npm run test:agent-orchestrator`.
3. Jalankan `git diff --check`.
4. Review scope perubahan.
5. Buat/cek Draft PR.
6. Setelah review dan CI hijau, baru controller boleh dipakai sebagai worker unattended.

## Belum dikerjakan oleh controller

- auto-merge;
- auto-deployment;
- multi-agent editing bersamaan;
- router quota harian/bulanan penuh untuk semua provider;
- integrasi GitHub API otomatis dari controller.

Bagian-bagian itu sengaja dipisah supaya satu kesalahan agent tidak berubah menjadi pesta pora di seluruh repository.
