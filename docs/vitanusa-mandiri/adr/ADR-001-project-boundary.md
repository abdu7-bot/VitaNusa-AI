# ADR-001 — Project Boundary

## Status

**Proposed**.

## Context

VitaNusa AI existing memiliki PWA, Nusa Chat/Agent, VitaCheck, artikel, akun pengguna, admin platform, dan safety policy. VitaNusa Mandiri menambah learning dan POS yang memiliki data, lifecycle, risiko, dan vocabulary berbeda. Menempatkan semua fitur pada modul core atau membuat aplikasi/repository terpisah sama-sama membawa biaya.

## Decision

Bangun VitaNusa Mandiri sebagai area modular dan feature-flagged dalam repository serta PWA VitaNusa yang sama. Reuse shell, auth identity, visual primitives, Nusa Agent UI, dan Policy Engine. Buat domain/application/repository Mandiri terpisah. VitaCheck, data kesehatan, admin platform, konten core, dan backend route existing tidak dipindahkan atau dicampur.

Fase implementasi dimulai local-only. Route/nav Mandiri tidak tampil ketika feature flag off. Domain Mandiri tidak boleh mengimpor modul admin atau VitaCheck history sebagai repository.

## Alternatives

1. **Masukkan logic ke modul core existing:** cepat pada awal, tetapi coupling dan privacy boundary kabur; ditolak.
2. **Repository/aplikasi terpisah:** isolasi deployment kuat, tetapi menggandakan shell/auth/PWA/safety dan maintenance; deferred sampai skala membuktikan perlu.
3. **Microfrontend:** deployment/contract kompleks tanpa kebutuhan terukur; rejected untuk MVP.

## Consequences

Positif: reuse fondasi, satu install PWA, regresi dapat dijalankan bersama, dan feature flag memberi rollback. Negatif: bundle/navigation/shared-origin perlu disiplin; kesalahan import dapat membuka data lintas domain; release cadence masih terkait core.

## Security impact

Shared origin berarti XSS core dapat mengancam IndexedDB Mandiri. CSP, plain-text rendering, scoped repository, dan dependency review menjadi penting. Feature flag tidak dianggap authorization.

## Privacy impact

Common identity boleh dipakai, tetapi profiling/join data dilarang. Consent, export, audit, retention, dan deletion tetap per domain.

## Offline impact

Shell/service worker dapat direuse, tetapi Cache API hanya menyimpan shell/aset publik. IndexedDB Mandiri memiliki version/migration sendiri dan tidak dibersihkan oleh cache update.

## Migration impact

Fase 1 menambah route/modules di balik flag tanpa migrasi core. Bila kelak dipisah repository/origin, diperlukan export/import, auth handoff, dan new-origin storage migration; jangan bergantung pada akses cross-origin IndexedDB.

## Open questions

- Apakah satu install PWA dengan banyak fitur tetap mudah dipahami dalam pilot?
- Perlukah build chunk Mandiri dipisah agar tidak membebani pengguna core?
- Apakah feature flag local cukup atau diperlukan remote rollout berprivasi rendah pada fase pilot?
