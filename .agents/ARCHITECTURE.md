# VitaNusa-AI Architecture

## Lapisan utama

1. **Frontend** — UI, chat, knowledge explorer, monitoring.
2. **Backend/API** — authentication, business logic, API contracts.
3. **Knowledge Engine** — ingestion, normalization, metadata, retrieval, provenance.
4. **Islamic Knowledge Layer** — Qur'an, hadits, tafsir, ijma'/ikhtilaf dengan sumber dan status.
5. **Arabic Verification Layer** — teks Arab, token, lemma/root, morphology, syntax, dictionary, context.
6. **Reasoning & Answer Verification** — evidence comparison, citation, uncertainty, answer policy.
7. **Agent Orchestrator** — planner, worker, reviewer, integrator, provider routing.
8. **Task Queue** — TODO, active tasks, backlog, completion state.
9. **Audit & Observability** — logs, health checks, provenance, agent actions.
10. **Persistence** — database, knowledge store, configuration, memory, audit history.

## Prinsip dependency

Frontend tidak menjadi sumber kebenaran. Model AI tidak menjadi sumber kebenaran. Memory percakapan tidak menjadi sumber kebenaran agama. Evidence dan provenance harus berada di bawah knowledge/verification layer.

## Alur jawaban

`Question → Intent → Retrieval → Evidence → Verification → Reasoning → Citation → Safety Check → Answer`

Untuk ayat/hadits:

`Question → Arabic/Text Identification → Exact Source → Arabic Verification → Scholarly Context → Evidence Comparison → Answer`

## Alur coding agent

`Roadmap → Task Queue → Planner → Worker → Test → Reviewer → Commit → Next Task`

Provider/model adalah komponen yang dapat diganti; logic keselamatan dan governance tidak boleh bergantung pada satu provider.
