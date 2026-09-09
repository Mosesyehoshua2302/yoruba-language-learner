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

## 2. Level 3 — event-driven agent content pipeline (new spec, not started)

The big new feature the user wants to focus on. Replace bundled content with an
automated ingestion pipeline.

Design sketch (from discussion):
- Upload PDF → S3 ingest bucket → S3 event → orchestrator Lambda.
- A Bedrock-powered agent step extracts vocab/examples AND authors the grammar
  prose + chapter framing (the part the deterministic Python scripts can't
  regenerate — half of content.json is hand-authored in build_content.py today).
- Output: a versioned `content.json` + `manifest.json` published to the content
  (CloudFront) bucket.

Prerequisite / dependency:
- The app currently **bundles** `content.json` (static import in `store.tsx`),
  so nothing consumes a published content file yet. Level 3 needs the
  **frontend-fetch change** (Level 1: `content.ts` loader + manifest + rewire
  store; fetch at startup like `config.json`; load ordering matters — content
  before store init). Level 1 and Level 3 share the same consumer contract
  (versioned content via manifest), so Level 1 is the clean seam, not throwaway.

Hard parts / open decisions:
- **Hallucination risk** in teaching content → a human **review gate** before
  generated content goes live (the chatbot roadmap already assumes QA for
  hallucination).
- **Determinism / id-stability** → SRS cards are keyed by item `id`. Rule: ids
  are **append-only and stable**; edits to text on the same id are safe, but
  renaming/removing ids orphans learner progress. Agent likely must diff against
  currently-published content rather than regenerate from scratch.
- **Unify with chatbot KB?** The parked chatbot roadmap (Phase 2) plans a
  Bedrock Knowledge Base from the same content. Decide whether the ingestion
  agent feeds that KB or stays standalone for now.
- Bedrock Agent (tool-using) vs. a single structured "read text → emit JSON"
  model call — likely the latter is enough.

Also parked earlier: the chatbot/RAG roadmap itself
(`App/infra/CHATBOT_ROADMAP.md`).
