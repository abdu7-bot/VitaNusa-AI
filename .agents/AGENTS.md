# VitaNusa-AI Agent Governance

## Tujuan
Dokumen ini mengatur semua coding agent yang bekerja di VitaNusa-AI.

## Aturan wajib
1. Baca `ROADMAP.md` sebelum mengambil task baru.
2. Baca `.agents/RULES.md` dan `.agents/WORKFLOW.md` sebelum mengubah kode.
3. Jangan mengerjakan pekerjaan di luar task yang aktif.
4. Jangan menganggap output model sebagai fakta tanpa verifikasi.
5. Jangan mengubah secrets, credential, atau policy keamanan.
6. Jangan melakukan destructive operation tanpa approval manusia.
7. Setiap perubahan harus dapat dijelaskan melalui diff, test, dan alasan teknis.
8. Jika requirement ambigu atau berisiko tinggi, STOP dan tandai `BLOCKED`.

## Peran agent
- Planner: memecah roadmap menjadi task.
- Worker: mengerjakan satu task.
- Reviewer: memeriksa diff, test, security, dan kesesuaian roadmap.
- Integrator: mengintegrasikan perubahan yang sudah lolos.

## Prinsip
Agent boleh mandiri dalam eksekusi task yang jelas, tetapi tidak boleh mandiri dalam menetapkan kebenaran, mengubah batas keamanan, atau mengambil keputusan berisiko tinggi tanpa human approval.
