# MASTER MISSION 99X
# Universal Knowledge Intelligence Engine
## VitaNusa-AI

**Mission type:** Comprehensive repository audit, architecture design, and controlled implementation  
**Execution mode:** Autonomous only within repository governance  
**Knowledge scope:** All scientific, religious, medical, technological, economic, historical, social, educational, environmental, and practical domains  
**Data acquisition:** Free and officially accessible APIs first  
**Report language:** Indonesian; code, identifiers, and technical documentation may use English.

---

## 1. Role and objective

Act as Principal Software Architect, Senior Backend Engineer, Knowledge Infrastructure Engineer, Data Governance Specialist, API Integration Engineer, AI Safety Engineer, and QA Lead for VitaNusa-AI.

Establish a reliable, secure, auditable, license-aware, evidence-grounded Universal Knowledge Intelligence Engine.

The system must be architecturally capable of supporting many knowledge domains. Do not claim it can collect all human knowledge. Actual coverage is limited by API availability, quotas, access approval, licensing, and source quality.

The actual repository state is the source of truth. Do not assume previously reported branches, features, tests, commits, or architecture remain accurate. Inspect before modifying. Never fabricate API capabilities, licenses, implementation status, or test results.

## 2. Non-negotiable governance and Git safety

Before any work, inspect applicable instructions and governance, including where present:

- `AGENTS.md`
- `.agents/AGENTS.md`
- `.agents/RULES.md`
- `.agents/WORKFLOW.md`
- `.agents/ARCHITECTURE.md`
- Repository constitution and developer instructions
- Workspace governance and Git configuration

Record missing files rather than assuming they exist.

Determine and report:
- Current working directory and Git root
- Canonical authorized workspace and whether current workspace is permitted
- Current branch, HEAD, remotes, and upstream
- Working-tree status, staged changes, and untracked files
- Existing user modifications

Prior governance may have named `/root/VitaNusa-AI` as canonical and other checkouts as restricted. Verify the current rules. If the current workspace is unauthorized, stop all repository writes. Do not bypass governance by switching to another checkout, copying files, changing governance, or creating an alternate workspace.

Never run destructive commands such as:
- `git reset --hard`
- `git clean -fd`
- `git checkout -- .`
- `git push --force`
- Destructive branch operations or commands that discard user changes

Do not overwrite user files. Do not silently change governance. Do not commit, push, merge, or create pull requests unless explicitly authorized. Never expose secrets in output, logs, tests, or documentation.

## 3. Execution protocol

Execute the phases below in order in one mission. Produce evidence and a phase report for each. If one phase is blocked, continue only with independent read-only work that remains authorized. Do not skip the governance gate.

### Phase 0: Repository forensic audit

Inspect the actual project structure and relevant implementation files. Inventory:

- Backend and frontend architecture
- Database, ORM, and migrations
- API endpoints and external integrations
- Background workers, queues, and schedulers
- AI orchestration and agent execution
- Policy Engine and safety boundaries
- Memory and retrieval/RAG systems
- Search infrastructure
- Logging, monitoring, and audit mechanisms
- Security controls and secrets handling
- Tests, CI, dependency versions, and documentation

Identify reusable components, duplicated systems, missing capabilities, technical debt, and risks. Do not infer implementation from filenames alone.

Deliver: `docs/knowledge-engine/PHASE-0-REPOSITORY-AUDIT.md`.

### Phase 1: Universal architecture

Design modular layers:

1. Source Connectors
2. Source Registry
3. License Registry
4. Provider-specific Rate Limiting
5. Ingestion Scheduler
6. Job Queue
7. Fetching and Parsing
8. Normalization
9. Deduplication
10. Validation
11. Knowledge Metadata
12. Authorized Content Storage
13. Full-Text Search
14. Vector Search
15. Knowledge Relationships
16. Evidence Ranking
17. Conflict Detection
18. Citation and Provenance
19. Retrieval API
20. Reasoning Integration
21. Monitoring and Audit

A provider failure must not stop unrelated providers. Prefer existing reliable project technologies. Avoid unnecessary dependencies.

Deliver: `docs/knowledge-engine/UNIVERSAL-KNOWLEDGE-ARCHITECTURE.md`, including diagrams, component responsibilities, data flow, dependency boundaries, failure isolation, security boundaries, scaling, deployment, and architecture decisions.

### Phase 2: Official free API source discovery

Verify official documentation and access conditions. Never invent endpoints or assume that free access grants storage, embedding, redistribution, or commercial-use rights.

Initial Islamic sources:
- Quran Foundation API: https://api-docs.quran.com/
- Quran.com developers: https://quran.com/developers
- Tanzil: https://tanzil.net/download/
- Sunnah.com developers: https://sunnah.com/developers
- LPMQ/Kemenag official Quran resources

Medicine and health:
- NCBI E-utilities: https://www.ncbi.nlm.nih.gov/home/develop/api/
- PubMed: https://pubmed.ncbi.nlm.nih.gov/
- PubMed Central: https://pmc.ncbi.nlm.nih.gov/
- WHO publications: https://www.who.int/publications
- Kemenkes data: https://layanandata.kemkes.go.id/

General research:
- OpenAlex: https://openalex.org/
- Crossref REST API: https://www.crossref.org/documentation/retrieve-metadata/rest-api/
- Global Index Medicus: https://globalindexmedicus.net/

Also investigate reliable official or open-data sources for education, mathematics, physics, chemistry, biology, agriculture, economics, finance, business, history, geography, climate, environment, energy, engineering, computer science, AI, robotics, government statistics, and Indonesian local data.

For every provider document:
- Provider and official documentation URL
- Domain and API availability
- Authentication requirements
- Free-tier conditions and quotas
- Rate limits and pagination
- Response formats and metadata/full-text availability
- Terms and license URL
- Attribution requirements
- Persistent storage, extraction, chunking, embedding, indexing, display, redistribution, and commercial-use permissions
- Retention/deletion requirements
- Restrictions and integration priority

Use statuses: `VERIFIED`, `VERIFIED_WITH_RESTRICTIONS`, `METADATA_ONLY`, `REQUIRES_APPROVAL`, `UNVERIFIED`, `BLOCKED`.

Deliver: `docs/knowledge-engine/API-SOURCE-CATALOG.md`.

### Phase 3: License and data governance engine

Implement or design a central license-control system. Evaluate each provider and, where applicable, each individual document before content enters permanent storage or embedding.

Track separate permissions for:
- API access
- Metadata storage
- Full-text storage
- Text extraction
- Chunking
- Embedding
- Search indexing
- User display
- Redistribution
- Commercial use
- Attribution
- Retention and deletion

Statuses:
- `ALLOW`
- `RESTRICTED`
- `METADATA_ONLY`
- `REQUIRES_REVIEW`
- `BLOCKED`

Default to deny when permission is unclear. Document-level restrictions override provider-level assumptions. A provider may expose reusable metadata while individual full texts have different licenses.

Create license validation, provider configuration, document-level permission records, license-change audit, retention/expiration handling, and deletion workflows that also remove affected chunks and embeddings when required.

Do not invent legal interpretations. Flag ambiguous terms for human legal review.

Deliver: `docs/knowledge-engine/LICENSE-AND-DATA-GOVERNANCE.md`.

### Phase 4: Database and storage design

Inspect the existing database before proposing changes. Prefer PostgreSQL if compatible. Evaluate pgvector and PostgreSQL full-text search. Do not introduce a second database without a demonstrated need.

Design logical entities:
- `knowledge_sources`
- `source_licenses`
- `license_permissions`
- `ingestion_jobs`
- `ingestion_job_events`
- `knowledge_documents`
- `knowledge_contents`
- `knowledge_chunks`
- `knowledge_embeddings`
- `knowledge_citations`
- `knowledge_relations`
- `verification_records`
- `evidence_records`
- `source_audit_logs`
- `sync_checkpoints`

Documents should support stable internal IDs, provider/external IDs, DOI or equivalent, domain/discipline, title, authors, publication/update dates, language, document type, source URL, license, content permissions, authority classification, verification status, content hash, ingestion/verification timestamps, and version.

Preserve relationships between source documents, chunks, embeddings, and citations. Never store unauthorized full text. Propose safe, reversible migrations only; no destructive database changes.

Deliver: `docs/knowledge-engine/DATABASE-AND-STORAGE-DESIGN.md`.

### Phase 5: Ingestion engine

Design a reliable pipeline:

Discovery → License Check → Fetch → Parse → Normalize → Deduplicate → Validate → Enrich Metadata → Authorize Storage → Store → Authorize Indexing → Embed → Register Citations → Audit.

Required controls:
- Pagination and incremental sync
- Provider-specific rate limits
- Exponential backoff and bounded retries
- Retry-After handling
- Circuit breakers and timeouts
- Idempotency
- Checkpoint recovery
- Partial-failure isolation
- Dead-letter jobs
- Structured logs
- Job cancellation

Never retry forever, ignore quotas, or treat failed responses as valid knowledge. Every job must have a traceable result.

Deliver: `docs/knowledge-engine/INGESTION-ENGINE-DESIGN.md`.

### Phase 6: Domain taxonomy and integrity

Support at least:
- Islamic Knowledge
- Medical and Health Sciences
- Natural Sciences
- Mathematics
- Social Sciences
- Economics and Finance
- Business and Management
- History and Civilization
- Law and Government
- Education
- Technology and Engineering
- AI and Robotics
- Agriculture and Food
- Environment and Climate
- Language and Linguistics
- Arts and Culture
- Geography and Local Knowledge

Use domain-specific evidence policies. Do not impose one universal credibility score on every discipline.

Islamic Knowledge must distinguish:
- Quranic text
- Quran translations
- Tafsir
- Hadith text
- Hadith grading
- Hadith commentary
- Fiqh opinions
- Scholarly analysis
- AI-generated inference

Store hadith collection, book/chapter, identifier, narrator information where available, grading, grading scholar, grading source, and edition/reference separately. Never infer authenticity from a website label alone. Never fabricate Quran verses, hadith references, or scholarly attribution. Report uncertainty when evidence is incomplete. Islamic methodology must be configurable and subject to qualified human review. The system must not autonomously issue binding fatwas.

Medical Knowledge must distinguish clinical guidelines, systematic reviews, meta-analyses, randomized trials, observational studies, case reports, preprints, and editorials. Do not infer evidence strength from popularity. Do not present AI interpretation as diagnosis.

Deliver: `docs/knowledge-engine/KNOWLEDGE-DOMAIN-TAXONOMY.md`.

### Phase 7: Search, RAG, and evidence

Design hybrid retrieval using full-text, vector similarity, metadata/domain/date/source filters, and license-aware filtering.

Evidence ranking may consider source authority, study design where relevant, date, verification, relevance, corroboration, and methodological limitations. Explain ranking per domain; do not collapse unlike evidence into one misleading score.

Detect conflicts caused by different dates, populations, methods, scholarly interpretations, or geographic/legal contexts. Every retrieved chunk must retain document provenance. The reasoning engine must receive citations and source metadata, not untraceable text. Return insufficient evidence when appropriate.

Deliver: `docs/knowledge-engine/RETRIEVAL-RAG-AND-EVIDENCE-DESIGN.md`.

### Phase 8: Security and prompt-injection defense

Treat external documents as untrusted data. Design or implement:
- Input/output validation
- Secret redaction and API key isolation
- Least-privilege database access
- Provider allowlists and URL validation
- SSRF protection
- File size and MIME validation
- Malware scanning where applicable
- Prompt-injection detection
- Strict separation of content and instructions
- Audit logs and retention controls

External documents must never override system instructions, Policy Engine decisions, Islamic boundaries, security controls, or user authorization.

Deliver: `docs/knowledge-engine/SECURITY-AND-THREAT-MODEL.md`.

### Phase 9: VitaNusa integration

Inspect existing integration points. Reuse existing Policy Engine, orchestration, memory, and reasoning modules where appropriate. Do not create competing policy systems or bypass existing safety/authorization architecture.

Define clean interfaces as appropriate:
- `SourceConnector`
- `LicensePolicy`
- `IngestionService`
- `DocumentNormalizer`
- `KnowledgeRepository`
- `SearchService`
- `EvidenceRanker`
- `CitationResolver`
- `ConflictDetector`
- `KnowledgeRetrievalService`

Specify how the reasoning engine receives the user question, domain, evidence, source metadata, license information, citations, limitations, and conflict warnings.

Deliver: `docs/knowledge-engine/VITANUSA-INTEGRATION-DESIGN.md`.

### Phase 10: Testing and QA

Cover unit, integration, connector contract, license enforcement, migration, deduplication, retry/rate-limit, checkpoint recovery, citation integrity, prompt injection, domain isolation, security, failure isolation, and regression tests.

Use mocked API responses in normal automated tests. Live API smoke tests must be optional, rate-limited, and separate.

Prove with tests that:
- BLOCKED content cannot enter persistent storage.
- METADATA_ONLY content cannot be stored as full text.
- Unauthorized content cannot be embedded.
- Citations resolve to original documents.
- Duplicate documents do not create duplicate records.
- Failed jobs resume safely.
- One provider failure does not stop other providers.
- Retrieved prompt injection cannot override policy.
- Deletion removes associated embeddings when required.

Do not weaken or delete existing tests to make new tests pass.

Deliver: `docs/knowledge-engine/TESTING-AND-QUALITY-STRATEGY.md`.

### Phase 11: Controlled implementation

This mission may produce a comprehensive design and implementation proposal. Implement code only if repository governance explicitly permits it.

If authorized, implement only isolated, reversible, low-risk foundational modules. Avoid broad refactoring, production data changes, large-scale ingestion, unverified API calls, unnecessary dependencies, and credentials in source control.

If implementation is blocked, still deliver complete technical designs, interfaces, schemas, migration proposals, and actionable implementation tickets. Clearly distinguish implemented, tested, proposed, and blocked work.

### Phase 12: Roadmap and architecture decisions

Deliver:
- `docs/knowledge-engine/IMPLEMENTATION-ROADMAP.md`
- `docs/knowledge-engine/ARCHITECTURAL-DECISIONS.md`

Prioritize dependencies, risks, estimated complexity, acceptance criteria, and phase gates. Design for universal extensibility while activating data sources incrementally.

## 4. Required documentation package

Create a coherent package under `docs/knowledge-engine/`:

1. `PHASE-0-REPOSITORY-AUDIT.md`
2. `UNIVERSAL-KNOWLEDGE-ARCHITECTURE.md`
3. `API-SOURCE-CATALOG.md`
4. `LICENSE-AND-DATA-GOVERNANCE.md`
5. `DATABASE-AND-STORAGE-DESIGN.md`
6. `INGESTION-ENGINE-DESIGN.md`
7. `KNOWLEDGE-DOMAIN-TAXONOMY.md`
8. `RETRIEVAL-RAG-AND-EVIDENCE-DESIGN.md`
9. `SECURITY-AND-THREAT-MODEL.md`
10. `VITANUSA-INTEGRATION-DESIGN.md`
11. `TESTING-AND-QUALITY-STRATEGY.md`
12. `IMPLEMENTATION-ROADMAP.md`
13. `ARCHITECTURAL-DECISIONS.md`
14. `FINAL-MISSION-REPORT.md`

Documentation must match actual repository state. Never describe proposed functionality as implemented.

## 5. Final validation

Before finishing:
1. Inspect every changed file and Git diff.
2. Check for accidental secret exposure.
3. Validate documentation links and schemas where practical.
4. Run relevant tests if code changed.
5. Run existing tests if feasible.
6. Record exact commands and actual outcomes.
7. Record blockers and limitations.
8. Confirm user modifications remain untouched.
9. Confirm no unauthorized writes occurred.

Never claim a test passed unless it was actually executed. Never claim API compatibility without verifying official documentation or actual schemas.

## 6. Final report

Write the final report in Indonesian and include:

A. Executive Summary  
B. Repository Integrity: workspace, branch, HEAD, worktree, governance  
C. Existing Architecture: reused and missing capabilities  
D. API Source Coverage: verified providers and restrictions  
E. License Compliance: storage, embedding, display, link-only permissions  
F. Database and Storage: implemented versus proposed  
G. Ingestion Pipeline: completed versus missing  
H. Islamic Knowledge Integrity  
I. Security and Remaining Risks  
J. Tests: exact commands and results  
K. Modified/created files  
L. Remaining work and prioritized tickets  
M. Final verdict with evidence

Choose exactly one verdict:
- **GO:** declared scope is implemented and verified.
- **CONDITIONAL GO:** a safe foundation exists but stated conditions remain.
- **NO-GO:** governance, security, provenance, or correctness blockers prevent implementation.

## 7. Mission execution

Begin by inspecting governance and actual repository state. Execute phases in order. Do not ask unnecessary questions, guess missing facts, bypass blockers, or claim completion without evidence.

Maximize useful work within the authorized workspace and available resources.

**BUILD WITH DISCIPLINE. VERIFY WITH EVIDENCE. PRESERVE PROVENANCE.**
