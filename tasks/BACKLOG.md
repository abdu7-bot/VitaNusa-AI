# VitaNusa-AI — BACKLOG

Backlog berisi pekerjaan yang belum READY atau masih menunggu dependency.

## Phase A — Baseline & Audit

- [ ] Audit seluruh backend dan frontend.
- [ ] Inventarisasi dependency Python/Node.
- [ ] Inventarisasi test yang sudah tersedia.
- [ ] Inventarisasi environment variables dan secrets.
- [ ] Dokumentasikan runtime lokal/Termux/Ubuntu.
- [ ] Bandingkan `/root/VitaNusa-AI` dan `/home/vita/VitaNusa-AI` sebelum memilih workspace canonical.

## Phase B — Autonomous Governance

- [ ] Task manifest machine-readable.
- [ ] Task locking.
- [ ] Agent workspace isolation.
- [ ] Checkpoint otomatis.
- [ ] Rollback otomatis.
- [ ] Audit trail.
- [ ] Human approval gates.

## Phase C — Provider Orchestration

Target konseptual:

```text
AUTO/FREE
  Kilo utama
  Kilo alternatif 1
  Kilo alternatif 2
  Kilo alternatif 3

DAILY QUOTA
  Copilot 1
  Copilot 2
  Copilot 3
  Copilot 4

MONTHLY QUOTA
  Codex 1
  Codex 2
  Codex 3
  Codex 4
  Agy 1
  Agy 2
  Agy 3
  Agy 4
```

Catatan: nama provider/slot adalah konfigurasi. Sistem wajib mengecek availability, quota, error rate, capability, dan policy sebelum memakai provider. Jangan mengasumsikan layanan gratis selalu tersedia.

## Phase D — Knowledge Engine

- [ ] Source registry.
- [ ] Downloader/importer.
- [ ] Normalizer.
- [ ] Deduplicator.
- [ ] Structured chunker.
- [ ] Provenance store.
- [ ] Hybrid retrieval.
- [ ] Reranker.
- [ ] Evidence graph.

## Phase E — Islamic Knowledge

- [ ] Qur'an verified corpus.
- [ ] Translation corpus.
- [ ] Tafsir corpus dengan metadata.
- [ ] Hadith corpus dengan metadata kualitas.
- [ ] Ijma' evidence registry.
- [ ] Ikhtilaf registry.
- [ ] Scholarly opinion registry.
- [ ] Source conflict resolver.

## Phase F — Arabic Intelligence

- [ ] Arabic dictionary registry.
- [ ] Root extraction.
- [ ] Lemma.
- [ ] Morphology/sharf.
- [ ] Syntax/nahwu.
- [ ] Semantic relations.
- [ ] Context analysis.
- [ ] Cross-dictionary comparison.
- [ ] Arabic verification report.

## Phase G — Answer Engine

- [ ] Intent router.
- [ ] Retrieval planner.
- [ ] Evidence verifier.
- [ ] Claim verifier.
- [ ] Citation generator.
- [ ] Uncertainty classifier.
- [ ] Islamic answer policy.
- [ ] General knowledge answer policy.

## Phase H — User Interface

- [ ] Citation/source panel.
- [ ] Arabic analysis panel.
- [ ] Knowledge explorer.
- [ ] Agent monitor.
- [ ] Task monitor.
- [ ] Provider/quota monitor.
- [ ] Audit viewer.
- [ ] System health page.

## Phase I — Evaluation

- [ ] Golden question set.
- [ ] Arabic text accuracy benchmark.
- [ ] Hadith citation benchmark.
- [ ] Qur'an citation benchmark.
- [ ] Retrieval benchmark.
- [ ] Hallucination benchmark.
- [ ] Regression suite.
- [ ] Autonomous coding benchmark.

## Phase J — Controlled Continuous Operation

- [ ] Scheduled source refresh.
- [ ] Knowledge versioning.
- [ ] Periodic evaluation.
- [ ] Automatic regression tests.
- [ ] Controlled autonomous maintenance.
- [ ] Human escalation queue.
