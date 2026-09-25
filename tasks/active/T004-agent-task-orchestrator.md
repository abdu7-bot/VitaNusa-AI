---
id: T004
status: IN_REVIEW
priority: P1
title: Agent task orchestrator runtime
allowedPaths: scripts/agent|tests/agent|tasks/active|docs/architecture|package.json
---
# T004 — Agent Task Orchestrator Runtime

## Tujuan
Membuat controller nyata yang membaca task, memilih satu pekerjaan, menjalankan satu worker, memeriksa hasil, lalu berhenti pada titik aman.

## Sudah dibuat
- `scripts/agent/task-orchestrator.mjs`
- `tests/agent/task-orchestrator.test.mjs`
- `package.json` script `test:agent-orchestrator`

## Batas
- default mode hanya PLAN;
- `--execute` wajib eksplisit;
- worker default: `kilo --auto`;
- tidak ada auto-merge;
- tidak ada deployment;
- tidak ada destructive migration;
- paid fallback harus ditolak kecuali ada izin eksplisit;
- repository dirty langsung dihentikan;
- branch main/master tidak boleh dipakai worker.

## Verifikasi
- task dipilih secara deterministik berdasarkan priority;
- task harus berstatus `READY`;
- worker dibatasi allowlist;
- changed-file scope diperiksa;
- `git diff --check` diperiksa;
- execution state disimpan di `.git/vitanusa-agent/`, bukan tracked repository;
- kegagalan worker/test menghasilkan `BLOCKED`.

## Hasil
Jika semua verifikasi lolos, status berhenti di `DRAFT_PR_READY`. Merge tetap keputusan manusia.

## Catatan
PR ini masih perlu menjalankan test di environment repository dan review sebelum dianggap selesai.
