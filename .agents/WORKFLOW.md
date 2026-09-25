# VitaNusa-AI Agent Workflow

## Siklus task

`BACKLOG → READY → ACTIVE → TESTING → REVIEW → DONE`

Kegagalan:

`ACTIVE → BLOCKED`
`TESTING → FAILED`

## Sebelum coding
1. Baca roadmap.
2. Pilih satu task yang dependency-nya terpenuhi.
3. Pastikan scope file jelas.
4. Cek `git status`.
5. Buat checkpoint bila perubahan berisiko.

## Saat coding
1. Kerjakan hanya scope task.
2. Hindari perubahan tidak terkait.
3. Simpan perubahan kecil dan dapat ditinjau.

## Setelah coding
1. Jalankan test/lint/type-check yang relevan.
2. Tinjau `git diff`.
3. Periksa secrets dan security regression.
4. Reviewer memutuskan PASS atau BLOCKED.
5. Commit hanya setelah gate lolos.
6. Catat hasil pada task.

## Autonomous loop
Agent boleh mengambil task berikutnya hanya jika:
- task tersedia;
- dependency terpenuhi;
- tidak ada lock/conflict;
- test gate lolos;
- policy keamanan lolos;
- task bukan zona human approval.

Jika syarat gagal, hentikan loop dan catat alasan.
