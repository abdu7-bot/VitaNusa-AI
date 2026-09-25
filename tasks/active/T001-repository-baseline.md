# T001 — Repository Baseline Audit

**Priority:** P0  
**State:** READY  
**Dependency:** none  
**Owner:** autonomous agent

## Objective

Mendapatkan baseline faktual repository sebelum agent mulai mengubah kode.

## Scope

- Struktur repository.
- Git branch/status/remote.
- Runtime Python dan Node.
- Dependency manifest.
- Test suite.
- Existing backend/frontend entry points.
- Environment variable names tanpa membocorkan secret.
- Perbedaan workspace `/root/VitaNusa-AI` dan `/home/vita/VitaNusa-AI` jika keduanya masih ada.

## Required output

Buat laporan baseline di `docs/architecture/BASELINE.md`.

Laporan minimal berisi:

1. timestamp;
2. commit HEAD;
3. branch;
4. clean/dirty status;
5. runtime versions;
6. dependency manifests;
7. test commands yang ditemukan;
8. hasil test baseline;
9. entry points;
10. risiko/temuan;
11. rekomendasi task berikutnya.

## Safety

- Jangan menghapus file.
- Jangan reset/rebase repository.
- Jangan commit secret.
- Jangan mengubah source code aplikasi pada task ini.

## Acceptance criteria

- [ ] `docs/architecture/BASELINE.md` dibuat.
- [ ] Semua klaim memiliki dasar command/output atau referensi file.
- [ ] Tidak ada secret yang ditulis ke laporan.
- [ ] Test baseline dijalankan bila aman dan tersedia.
- [ ] Diff direview.
