# Parked future work

Two workstreams deliberately paused. This file is the memory of where they stand
so they can be resumed cleanly.

## 1. Per-user state — finish + verify (mostly done)

Per-user state storage is **already implemented end to end** (this session's
work): DynamoDB keyed by `userId`, the Python Lambda reads `sub` from the JWT
(users can only touch their own row), API Gateway JWT authorizer, `api.ts`
attaches the Bearer token, `storage.ts` namespaces the localStorage cache by
`sub`, and `store.tsx` fetches/reconciles/debounce-saves per user.

Remaining before it's "live for real users":

- **Account-creation decision (BLOCKER).** `selfSignUpEnabled` is now `false`
  (invite-only), so the Hosted UI sign-up tab is disabled and new users cannot
  self-register. Decide: invite-only (admin creates users via console /
  `aws cognito-idp admin-create-user`), open self-sign-up, or an invite flow.
  User leaning: invite-only for now (unconfirmed).
- **Live smoke test (spec task 21).** Verified so far only via tsc / unit tests
  / `cdk synth` — never against a live deploy. Need: deploy, do the manual
  callback-URL redeploy, sign in via Hosted UI, confirm save→reload→state
  returns, and cross-device sync.

## 2. Runtime-fetched content (Level 1) — DONE

The app no longer bundles content. `frontend/src/lib/content.ts` fetches
`/content.json` + `/sentences.json` at startup (main.tsx awaits them before
render via `Promise.all([loadConfig(), loadContent()])` + `initContentExports()`);
`store.tsx` reads them via `getContent()`. Files live in `frontend/src/data/`
(source of truth), auto-copied to `frontend/public/` by the `sync:content`
npm script (pre-dev/pre-build), and Vite copies `public/` into `dist/`, which
`CloudFrontSite` uploads to S3 — so they're served same-origin from CloudFront
(no API/auth), exactly like `config.json`. Verified: content values gone from
the JS bundle (~384KB→272KB), 21/21 tests pass, synth clean.

This is the **consumer contract** the ingestion pipeline (below) produces into.

## 3. Content ingestion pipeline — populate the KNOWN schema via model inference (not started)

Goal: drop source material (e.g. a PDF) into S3, have it transformed into a
`content.json` that conforms to the app's EXISTING schema, and published to the
content bucket the frontend already fetches.

### Locked-in decisions

- **Populate a known, fixed schema** — the agent/model does NOT invent structure.
  Schema is a fixed contract; the model conforms to it. Schema _evolution_ (new
  item types/fields) is a separate, deliberate, human-gated process (Phase 4),
  never done unilaterally by the model.
- **Standard model inference (Bedrock), NOT AgentCore, NOT fine-tuning.** A
  single structured "read source → emit JSON matching schema" call with the
  schema + few-shot examples + structured-output enforcement. No agent runtime,
  no orchestration framework, no training/labeled dataset. Revisit fine-tuning
  only if prompt+validation quality is genuinely insufficient.

### Phases

- **Phase 0 — Schema contract (do first; valuable standalone).** Extract the
  frontend `Content` / `SentencesData` TS types into an explicit versioned JSON
  Schema file = single source of truth. Frontend types AND model-output
  validation both derive from it.
- **Phase 1 — Deterministic validation gate (do first; valuable standalone).**
  Validator checks any candidate content.json against the JSON Schema AND the
  frontend's invariants: item `type` is a known discriminant
  (`vocab`|`grammar`), ids unique + APPEND-ONLY vs. current published version,
  chapter ids sequential, required fields present. Protects learner SRS progress
  (cards keyed by item id) and the UI regardless of who produced the content.
- **Phase 2 — Bedrock inference Lambda.** S3 upload → event → Lambda → Bedrock
  model call (schema + few-shot) → candidate content.json → run Phase 1
  validation → self-correct/retry on failure (simple loop in the Lambda, no
  AgentCore).
- **Phase 3 — Human review gate.** Generated output → "pending" location →
  human approves → publish to the content bucket the frontend reads. Effectively
  mandatory for teaching-content correctness (hallucination risk).
- **Phase 4 — Schema evolution (the honest hard part).** A genuinely new content
  shape = coordinated, versioned change: bump schema version, add frontend type
  - rendering component, THEN allow the model to emit the new shape. Managed
    process, not breakage.

### Dependencies / notes

- Depends on Level 1 (DONE) as the consumer contract.
- Still needs the S3 ingest bucket + event trigger + publish path (plumbing).
- **id-stability rule** is critical: append-only ids; edits to text on the same
  id are safe; renaming/removing ids orphans learner progress. Model likely must
  diff against currently-published content.
- Optional versioning/manifest (x.y.z + rollback) can be added; current Level 1
  serves a plain `/content.json` (overwrite + CloudFront invalidation).
- **Unify with chatbot KB?** Parked chatbot roadmap (Phase 2,
  `App/backend/infra/CHATBOT_ROADMAP.md`) plans a Bedrock Knowledge Base from the
  same content — decide later whether ingestion feeds it or stays standalone.

Also parked earlier: the chatbot/RAG roadmap itself
(`App/backend/infra/CHATBOT_ROADMAP.md`).
