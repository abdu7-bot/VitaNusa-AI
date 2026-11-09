# Proposal: Vesuvius Research Adapter for VitaNusa AI

**Status:** PROPOSAL ONLY — not implemented  
**Target:** architecture review before any code or dataset integration  
**Branch:** `docs/vesuvius-vision-intelligence-proposal`

## 1. Executive summary

This proposal evaluates whether selected components from the Vesuvius Challenge ecosystem (the `ScrollPrize/villa` repository and compatible pretrained models) can be used behind an isolated research service connected to VitaNusa AI.

The proposed capability is a specialist visual-computing worker for research workflows involving volumetric scans, papyrus surface reconstruction, and ink-signal prediction. It is **not** a general-purpose OCR system, Arabic manuscript reader, medical-image interpreter, or conversational model.

The Vesuvius ink-detection models are trained for a specific imaging domain. They must not be represented as capable of reading Arabic, Islamic manuscripts, ordinary photographs, or arbitrary documents without separate datasets, training, and evaluation.

## 2. Product and scope fit

The current VitaNusa AI product is an educational health platform with explicit safety, privacy, source-governance, and zero-cost constraints. A Vesuvius research capability is not a direct health-product feature.

Therefore:

- Keep this capability outside the public Nusa Chat, VitaCheck, Navigator Kesehatan, product catalog, and health-policy routing.
- Treat it as an optional, separately governed research/heritage-computing experiment.
- Do not expose predictions to end users until a distinct product case, responsible owner, and validation plan are approved.
- Do not infer medical conditions or make health recommendations from any image or scan processed by this worker.

Potential future adjacent work, such as Arabic manuscript OCR, must be evaluated as a separate project with suitable Arabic manuscript datasets and specialist review. It must not inherit Vesuvius model claims.

## 3. Proposed architecture

Use a separately deployable Python worker rather than importing the full Vesuvius dependency stack into the main VitaNusa backend.

```text
Research operator / approved admin workflow
                  |
                  v
        VitaNusa API gateway
        - authentication / authorization
        - request validation
        - quota and file-size limits
        - audit event (metadata only)
                  |
                  v
        Research job adapter
        - explicit job type
        - dataset and model allowlists
        - job status / cancellation
                  |
          isolated boundary
                  |
                  v
        Vesuvius Python worker
        - pinned villa revision
        - pinned Python dependencies
        - approved checkpoint
        - CPU/GPU inference
                  |
                  v
        Result quarantine and validation
        - output schema and dimensions
        - provenance / model version
        - no automatic publication
                  |
                  v
        Private research storage
        - retention policy
        - access-controlled result links
        - deletion workflow
```

The worker must not have direct access to the main application database, user health records, authentication secrets, or unrelated storage buckets. The API gateway should pass short-lived job references and narrowly scoped storage access only.

## 4. Initial capability boundary

The first proof of concept should be limited to one reproducible, officially documented Vesuvius inference workflow:

1. Use a small, legally reusable sample volume supplied by the challenge or another clearly licensed source.
2. Verify the exact data format and preprocessing requirements.
3. Pin one compatible model checkpoint and record its source, revision, checksum, and license.
4. Run inference in an isolated environment.
5. Save the prediction as a research artifact with input and output provenance.
6. Compare the result with a documented baseline or ground-truth sample where available.
7. Record runtime, peak memory, device, and failure modes.

Do not start with model training, full-scroll processing, automatic virtual unwrapping, or a public upload interface. Those steps require separate capacity, data-rights, and evaluation decisions.

## 5. API contract proposal

These are conceptual endpoints, not implemented routes:

| Endpoint | Purpose |
|---|---|
| `POST /research/vision/jobs` | Create an authorized, allowlisted research job |
| `GET /research/vision/jobs/{job_id}` | Read job status and safe metadata |
| `POST /research/vision/jobs/{job_id}/cancel` | Request cancellation |
| `GET /research/vision/jobs/{job_id}/result` | Retrieve an access-controlled result manifest |

A job request should identify only an approved dataset reference, task type, and model identifier. It should not accept arbitrary shell commands, arbitrary model URLs, arbitrary Python modules, or unrestricted filesystem paths.

A result manifest should include:

- job ID and task type;
- input dataset identifier, origin, license, and checksum;
- preprocessing configuration and version;
- model identifier, revision, checkpoint checksum, and license;
- code repository and pinned commit;
- runtime environment, device, and resource measurements;
- output artifact identifiers and checksums;
- limitations, warnings, and human-review status.

Predicted ink probability is a model output, not a transcription or verified historical fact.

## 6. Security, privacy, and governance

Required controls before any implementation:

- Authenticate and authorize every job; default access is deny.
- Keep the worker network-isolated where practical and restrict outbound access.
- Validate archive contents, file types, dimensions, tensor shapes, and decompressed size.
- Protect against path traversal, archive bombs, unsafe deserialization, and malicious model files.
- Never load untrusted checkpoints or pickle artifacts without a documented trust and sandbox strategy.
- Enforce CPU, RAM, VRAM, wall-clock, concurrency, and storage quotas.
- Support cancellation and cleanup of temporary files.
- Keep credentials out of the repository, logs, model artifacts, and job payloads.
- Store no unnecessary personal or health information in research jobs.
- Keep audit logs limited to operational metadata; avoid logging raw uploaded content.
- Require human review before any result is described as a reading, transcription, or historical conclusion.

Dataset, code, and checkpoint licenses must be checked independently. Open-source code does not automatically make every dataset or pretrained checkpoint unrestricted for redistribution or commercial use. Record attribution and usage restrictions in a source/model registry before use.

## 7. Zero-cost and resource policy

The existing VitaNusa roadmap targets Rp0 operation, prohibits payment methods and paid fallbacks, and requires stopping when free quotas are exhausted.

The Vesuvius worker must preserve that policy:

- No cloud GPU, paid inference API, paid storage, or automatic free-trial conversion.
- Prefer local execution on an explicitly approved operator machine for the first proof of concept.
- Do not assume a free hosted GPU is available or reliable.
- If local hardware is insufficient, mark the job unsupported or blocked; do not silently route it to a paid provider.
- Set hard limits for dataset size, runtime, storage, and concurrency.

A local worker is not automatically cost-free in operational terms: electricity, hardware wear, storage, and operator time must be acknowledged.

## 8. Licensing and upstream maintenance

Before selecting any component:

1. Review the current `ScrollPrize/villa` license and notices.
2. Review the exact dataset license and attribution requirements.
3. Review the exact Hugging Face checkpoint card, license, revision, and intended use.
4. Pin dependencies and upstream commit; do not track a moving branch in production.
5. Maintain a software bill of materials and vulnerability review.
6. Reassess upstream compatibility before upgrades.

This proposal does not grant VitaNusa any additional rights to Vesuvius data, checkpoints, or third-party content.

## 9. Validation and acceptance gates

Implementation may be proposed only after all gates pass:

| Gate | Acceptance evidence |
|---|---|
| Product boundary | Written approval that this is an isolated research tool, not a health feature |
| License | Reviewed code, dataset, and checkpoint terms with attribution record |
| Reproducibility | Pinned commit, dependencies, model revision, and checksums |
| Functional | Repeatable inference on an approved sample with documented expected outputs |
| Safety/security | File validation, sandbox, quotas, cancellation, and hostile-input tests |
| Privacy | Data minimization, retention, deletion, and access-control review |
| Resource | Measured CPU/RAM/VRAM/runtime and explicit local hardware requirements |
| Regression | Existing backend and frontend tests pass; no changes to health policy behavior |
| Human review | Output labels clearly distinguish prediction from verified transcription |

No gate should be marked complete based solely on this proposal.

## 10. Suggested phased plan

### Phase A — Research and feasibility (documentation/review only)
- Confirm repository and model licenses.
- Select a small sample dataset.
- Inspect Windows local hardware and Python/CUDA compatibility.
- Produce a reproducibility note and resource estimate.

### Phase B — Isolated proof of concept
- Build a standalone worker outside the production backend.
- Run one approved inference sample.
- Capture provenance, metrics, and limitations.
- Do not connect public user uploads or health data.

### Phase C — Controlled VitaNusa adapter
- Only after Phase B review, add authenticated job orchestration and private artifact references.
- Add contract tests, security tests, quota tests, and deletion tests.
- Keep the feature disabled by default and admin-only.

### Phase D — Separate Arabic manuscript research (optional)
- Select an appropriate Arabic manuscript OCR/HTR model and dataset.
- Establish rights, scholarly transcription standards, and Arabic-specialist review.
- Evaluate independently; do not reuse Vesuvius model weights as if they were Arabic OCR.

## 11. Decision requested

Reviewers are asked to decide whether Phase A feasibility research is worthwhile. This PR intentionally adds a proposal only. It does not add dependencies, application routes, model weights, datasets, secrets, worker code, or runtime behavior.

**Recommended decision:** accept the document as a research proposal only; do not authorize production integration or public exposure through this PR.
