---
id: T004
status: READY
priority: P1
title: Agent task orchestrator runtime
allowedPaths: scripts/agent|tests/agent|tasks/active|docs/architecture
---
# T004 — Agent Task Orchestrator Runtime

## Tujuan
Membuat controller nyata yang membaca task, memilih satu pekerjaan, menjalankan satu worker, memeriksa hasil, lalu berhenti pada titik aman.

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
- unit test orchestrator wajib lulus;
- `git diff --check` wajib lulus;
- changed-file scope wajib sesuai kontrak task;
- execution state disimpan di `.git/vitanusa-agent/`, bukan di repository tracked.

## Hasil
Jika semua verifikasi lolos, status berhenti di `DRAFT_PR_READY`. Merge tetap keputusan manusia.
