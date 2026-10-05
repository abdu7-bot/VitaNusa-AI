# Checkpoint & Rollback Contract

Dokumen ini adalah kontrak checkpoint dan rollback untuk autonomous coding,
beserta catatan jujur tentang apa yang sudah dijalankan dan apa yang belum.
Kontrak ini adalah kontrak pemanggil: ia merinci aturan di `.agents/` dan
`tasks/TODO.md` T004, dan tidak menambah aturan baru.

## 1. Mengapa checkpoint dan rollback

`.agents/RULES.md` §Git memerintahkan "Buat checkpoint sebelum perubahan
berisiko" tanpa menentukan mekanismenya. `.agents/WORKFLOW.md` §9 menahan loop
multi-task sampai checkpoint dan rollback tersedia. Tanpa mekanisme, tiga
kegagalan nyata terjadi pada sesi agent:

1. Perubahan yang belum selesai tertinggal di working tree saat task di-drop.
2. Task yang berakhir `BLOCKED` meninggalkan perubahan yang tidak terkontrol dan
   tidak dapat dipulihkan.
3. Kegagalan test atau worker tidak memiliki jalur pemulihan yang tercatat.

Yang ditetapkan di sini adalah mekanisme pemulihan, bukan otomasi autonomous
loop. Pemotongan autonomous multi-task tetap di luar cakupan.

## 2. Artefak

| Artefak | Isi | Kategori |
|---|---|---|
| `scripts/task_checkpoint.py` | Perkakas non-runtime: create, list, verify, restore, rollback, run-validation, blocked-check | `TOOL` |
| `tests/governance/test_task_checkpoint.py` | Test yang membuktikan lima properti T004 dan kasus negatif | `TEST` |
| `tasks/active/T004-checkpoint-and-rollback.md` | Task record, claim, scope, validasi, review | `DOC` |

Perkakas memakai Python standard library saja, tidak menambah dependency, tidak
dipanggil aplikasi, dan tidak dijalankan CI. Letak test di `tests/governance/`
memilih test Python tanpa bergantung pada npm script; menambah npm script berarti
menyentuh `package.json`, yaitu kategori `CONFIG` pada manifest dependency
runtime, dan itu tidak dikerjakan pada T004. Konsekuensinya harus jujur: **test
T004 tidak dijalankan CI**, sama seperti `scripts/check_agent_governance.py` yang
juga hanya dijalankan manual (`.agents/ARCHITECTURE.md` §3.1).

## 3. Model checkpoint

Checkpoint adalah snapshot **berbasis isi**, bukan manipulasi history:

| Aspek | Keputusan |
|---|---|
| Apa yang disimpan | Isi byte, mode file, jenis entri (`file`, `symlink`, `absent`), sha256, ukuran |
| Di mana | Store di luar working tree, default `~/.local/state/vitanusa-agent/checkpoints` |
| Bentuk | `<store>/CP-<TASK-ID>-<NNN>/manifest.json` plus `blobs/<sha256>` |
| Git | Hanya `rev-parse HEAD`, `branch --show-current`, `status --porcelain`, `ls-files --error-unmatch` |
| Perintah destruktif | Tidak ada. Perkakas tidak pernah menjalankan `git reset --hard`, `git clean`, `git checkout --`, atau force-push |

Pemilihan snapshot berbasis isi disengaja. `.agents/RULES.md` §Git melarang
perintah destruktif pada file di luar scope, dan stash yang menyatu dengan stash
lain membuat rollback bergantung pada urutan stash yang rapuh. Menyalin isi
memberikan pemulihan yang dapat diverifikasi per file.

### 3.1 Identitas repository

Checkpoint terikat pada repository tempat ia dibuat. `verify`, `restore`,
`rollback`, dan `run-validation` menolak repository yang berbeda, dan CLI tidak
menyediakan opsi untuk memaksa. Dua batasan lain yang berasal dari kejadian nyata
selama T004 dikerjakan: purge hanya mempertimbangkan path yang Git anggap
untracked dan tidak terabaikan, sehingga file tracked tidak pernah terhapus oleh
purge; dan purge ditolak tanpa opt-in eksplisit bila scope mencakup root
repository.

## 4. Life cycle

```text
create checkpoint  →  ubah file dalam scope  →  validate
                                              ├─ lulus        →  lanjut workflow
                                              └─ gagal        →  rollback otomatis
worker gagal                                   →  rollback otomatis
BLOCKED                                        →  blocked-check, lalu rollback
                                                 atau acknowledge eksplisit
```

## 5. Kontrak laporan

| Laporan | Isi minimum | Exit code |
|---|---|---|
| `manifest` | `checkpoint_id`, `task_id`, `created_at`, `store`, `repo_root`, `note`, `git`, `entries` | 0 |
| `verify` | `checkpoint_id`, `drifted`, `status` | 0 saat cocok, 5 saat drift |
| `restore` | `checkpoint_id`, `task_id`, `reason`, `status`, `restored`, `removed`, `unchanged`, `failed`, `failures`, `manual_intervention_required`, `notes` | 0 |
| `validation` | `checkpoint_id`, `task_id`, `command`, `exit_code`, `status`, `restore` | 0 saat lulus, 1 saat rollback |
| `blocked` | `task_id`, `status`, `uncontrolled`, `checkpointed`, `clean`, `head_clean`, `acknowledgement`, `notes` | 0, atau 4 saat ada perubahan tak terkontrol |

Nilai `status` pada laporan restore hanya `restored`, `partial`, atau `failed`.
Tidak ada status yang berarti "rollback gagal tetapi dilaporkan sukses".

## 6. Aturan rollback

| aturan | Alasan |
|---|---|
| Rollback hanya menulis path yang tercatat di manifest | `.agents/RULES.md` §Scope |
| Rollback menghapus path `absent` dan path untracked baru di dalam scope direktori | Mengembalikan tree ke kondisi aman |
| File yang sudah untracked saat checkpoint tidak pernah dihapus | Bukan hasil worker |
| File ignored tidak pernah disentuh | Git tidak melaporkannya |
| Direktori tidak pernah dihapus rekursif | Di luar scope eksplisit |
| Purge saat scope mencakup repository root ditolak tanpa opt-in eksplisit | Mencegah penghapusan massal di luar scope |
| Kegagalan per file tidak berhenti rollback; semuanya dicatat | Laporan jujur tentang apa yang berhasil |
| Restore manual tidak purge file baru kecuali diminta | Restore manual tidak menghapus pekerjaan yang tidak tercatat |

## 7. Kegagalan rollback tidak disembunyikan

Ini adalah ketentuan paling penting dari T004:

1. Setiap file yang gagal dipulihkan masuk ke `failed` dan `failures`.
2. Status `partial` berarti sebagian berhasil; status `failed` berarti tidak ada
   yang berhasil dipulihkan.
3. `manual_intervention_required` bernilai `true` pada kedua kasus.
4. Perkakas melempar `RollbackError`; tidak ada jalur di mana exception itu
   ditelan.
5. CLI mencetak laporan JSON ke `stderr` dan keluar dengan exit code `3` yang
   berbeda dari exit code rollback Biasa, disertai kalimat
   "rollback did not complete; manual intervention is required".
6. Kegagalan verifikasi setelah tulis diperlakukan sebagai kegagalan, bukan
   sebagai restore yang berhasil diam-diam.

## 8. Status BLOCKED

`.agents/WORKFLOW.md` §2 mensyaratkan alasan saat task masuk `BLOCKED`, tetapi
tidak mengatur apa yang terjadi pada working tree. `blocked-check` menutup celah
itu tanpa menambah approval gate:

| Status laporan | Arti |
|---|---|
| `clear` | Semua path scope tercakup checkpoint atau identik dengan HEAD |
| `uncontrolled-changes` | Ada path scope yang berbeda dari checkpoint dan dari HEAD |
| `acknowledged` | Perubahan tidak terkontrol sengaja dibiarkan dan dicatat tertulis |

`acknowledged` **bukan** PASS. Laporan memuat catatan yang menyatakannya, dan
`git status` tetap menunjukkan perubahan tersebut. Yang membuat acknowledge
layak adalah tertulisnya alasan pada file task, bukan flag di CLI.

## 9. Batas T004

T004 **tidak**:

- menambah persistence audit entri task otomatis; itu T005
  (`docs/orchestration/audit-trail.md` §6);
- mengaktifkan autonomous multi-task loop; `.agents/WORKFLOW.md` §9 tetap
  berlaku;
- membuat approval gate baru, tidak menyentuh `.agents/AGENTS.md`,
  `.agents/RULES.md`, atau `.agents/WORKFLOW.md`;
- mengubah workflow CI, konfigurasi deployment, manifest dependency, atau
  production code;
- mengintegrasikan verify ke `.github/workflows/ci.yml`; itu kategori `CI` dan
  memerlukan approval manusia tertulis;
- mengotomasi bootstrap worker atau task locking; itu pekerjaan terpisah pada
  `tasks/active/T003-multi-agent-orchestration.md` Follow-up butir 1 dan 2.

## 10. Pemakaian

```bash
# sebelum perubahan berisiko, pada canonical workspace
python3 scripts/task_checkpoint.py create --task T004 \
  --path docs/orchestration/checkpoint-and-rollback.md \
  --path scripts/task_checkpoint.py

# menjalankan validasi; exit non-zero memicu rollback otomatis
python3 scripts/task_checkpoint.py run-validation --id CP-T004-001 -- \
  python3 tests/governance/test_task_checkpoint.py

# worker gagal
python3 scripts/task_checkpoint.py rollback --id CP-T004-001 \
  --cause worker-failure --detail "worker exited 1"

# sebelum menutup task sebagai BLOCKED
python3 scripts/task_checkpoint.py blocked-check --task T004 \
  --path scripts/task_checkpoint.py
```

## 11. Pemisahan identitas T004

`tasks/TODO.md` dan `.agents/WORKFLOW.md` §9 menetapkan T004 sebagai
checkpoint/rollback. PR #108 memakai ID `T004` untuk Agent Task Orchestrator
Runtime, yaitu pekerjaan berbeda yang belum direview dan CI Frontend-nya gagal;
PR itu bukan penyelesaian T004 checkpoint/rollback. Renumbering atau penamaan
resmi adalah keputusan manusia (`.agents/AGENTS.md` §7 butir 7) dan tidak
dikerjakan pada T004.