# Content Ingestion Pipeline

Automated path for turning source material (e.g. a textbook PDF) into the app's
learning content, **conforming to the app's existing schema** and published to
the S3/CloudFront bucket the frontend already fetches at runtime.

## Intent

Today, updating content means hand-editing `frontend/src/data/content.json`
(and `sentences.json`) — the deterministic Python extraction in
`backend/scripts/` only produces part of it; the grammar prose and chapter
framing are hand-authored. The goal here is to let new source material be
transformed into schema-valid content with minimal manual effort, while
**never** letting bad or off-schema content reach learners.

## Core principles (locked-in decisions)

1. **Populate a KNOWN schema — never invent one.** The frontend can only render
   shapes it has code for. The schema is a fixed, versioned contract; the model
   conforms to it. Changing the shape (new item type / field) is a separate,
   deliberate, human-gated process (Phase 4), never done automatically.
2. **Standard model inference — no AgentCore, no fine-tuning.** A single
   structured "read source → emit JSON matching the schema" Bedrock call, with
   the JSON Schema + few-shot examples + structured-output enforcement, then
   deterministic validation and a self-correct retry. No agent runtime, no
   orchestration framework, no training/labeled dataset. Fine-tuning is a
   last-resort optimization only if prompt+validation quality is insufficient.
3. **Validation is deterministic and authoritative.** Whatever produces content
   (the model, the Python scripts, or a hand edit) must pass the same validation
   gate before it can be published.
4. **`id` stability protects learner progress.** SRS cards are keyed by item
   `id`. Ids are **append-only and stable**: editing the text on an existing id
   is safe; renaming or removing an id orphans a learner's progress. The
   validator enforces this by diffing against the currently-published content.

## Architecture (target)

```
   upload source ─► S3 ingest bucket ─(event)─► Bedrock inference Lambda
                                                    │  (schema + few-shot → candidate JSON)
                                                    ▼
                                          Phase 1 validation gate
                                          (schema + invariants + id-diff)
                                                    │ pass
                                                    ▼
                                          S3 "pending" (draft) ─► HUMAN REVIEW
                                                    │ approve
                                                    ▼
                                          content bucket (CloudFront)  ◄── frontend fetches /content.json
```

## Consumer contract (already built — Level 1)

The frontend fetches `/content.json` and `/sentences.json` at runtime
(`frontend/src/lib/content.ts`), served same-origin from CloudFront. This
pipeline's job is to *produce* those files. Source of truth for the schema is
`frontend/src/types.ts`; this pipeline mirrors it as machine-checkable JSON
Schema (Phase 0).

## Phased plan

### Phase 0 — Schema contract (foundation; valuable standalone)
- [ ] Author versioned JSON Schema for `content.json` (Content/Chapter/VocabItem/GrammarItem).
- [ ] Author versioned JSON Schema for `sentences.json` (SentencesData/...).
- [ ] Verify the current `frontend/src/data/*.json` validate against the schemas.

### Phase 1 — Deterministic validation gate (foundation; valuable standalone)
- [ ] Validator: JSON Schema validation for both files.
- [ ] Invariant checks beyond schema:
  - item `type` ∈ {`vocab`,`grammar`} (known discriminant only)
  - all item ids unique across the whole content
  - chapter ids present and sequential (1..N)
  - grammar `examples` present; required fields non-empty
  - **append-only ids**: given a "current published" content, no id removed or
    repurposed (same id must keep the same `type`).
- [ ] CLI entry: validate a candidate file (optionally against a baseline for the
      id-diff), exit non-zero on failure with clear messages.
- [ ] Tests: a valid file passes; each invariant violation fails.

### Phase 2 — Bedrock inference Lambda (later)
- [ ] S3 upload → event → Lambda → Bedrock structured call → candidate JSON.
- [ ] Run Phase 1 validation; self-correct/retry loop on failure.

### Phase 3 — Human review gate (later)
- [ ] Draft → pending location → human approves → publish to content bucket.

### Phase 4 — Schema evolution (later, deliberate)
- [ ] New content shape = bump schema version + add frontend type + rendering
      component, THEN allow the model to emit it. Never automatic.

## Status
- Level 1 (runtime-fetched content): DONE.
- Phase 0 / Phase 1: in progress (this directory).
- Phases 2–4: not started (see `.kiro/specs/PARKED-future-work.md`).
