# Roadmap: AWS backend + RAG chatbot

Task list for (1) finishing/deploying the AWS backend already scaffolded in this
`infra/` directory, and (2) adding a grammar/vocab Q&A chatbot grounded in the
textbook via an AWS Bedrock Knowledge Base. See `infra/README.md` for what the
existing stacks (`YorubaYeMiFrontend`, `YorubaYeMiBackend`) already do.

Decisions locked in:
- Chatbot purpose: grammar/vocab Q&A tutor, grounded in the textbook, with citations.
- RAG approach: AWS Bedrock Knowledge Bases (managed — chunking, embeddings,
  OpenSearch Serverless vector store) rather than a hand-rolled pipeline.

## Phase 1 — Finish & deploy the AWS backend (state sync) that already exists but isn't wired up
- [ ] Add sign-in UI (Cognito, SRP flow) to the SPA
- [ ] Add a sync module in `src/lib/` that fetches `config.json` for the API URL, pushes `LearnerState` on mutation (debounced, like the local server does today), pulls + merges on load by `updatedAt`
- [ ] Tighten `backend-stack.ts` CORS from `*` to the real CloudFront origin
- [ ] `npx cdk bootstrap` in the target AWS account/region
- [ ] `npm run build` in `App/`, then `cdk deploy --all` (backend first)
- [ ] Smoke-test cross-device sync end to end; capture `ApiUrl` / `UserPoolId` / `UserPoolClientId`
- [ ] Optional: custom domain + ACM cert + Route 53

## Phase 2 — Knowledge base for the chatbot
- [ ] Decide KB scope: full textbook content vs. a curated subset (grammar explanations + examples first, vocab second)
- [ ] Reshape source docs into chunk-friendly form for ingestion — per-lesson JSON/Markdown derived from `content.json`, not the raw extracted PDF text
- [ ] New S3 bucket (new CDK construct, likely a third stack e.g. `YorubaYeMiChatbot`) to hold KB source docs
- [ ] Provision a Bedrock Knowledge Base backed by OpenSearch Serverless (vector store) via CDK
- [ ] Pick embeddings model (Titan Embeddings) and chunking strategy; run ingestion
- [ ] Validate retrieval quality with a set of sample grammar/vocab questions before wiring the LLM
- [ ] Define a re-sync workflow so the KB stays current when `content.json` changes

## Phase 3 — Chatbot backend
- [ ] Request/enable Bedrock model access (Claude) in the target account/region
- [ ] Lambda that: takes a question → retrieves from the KB → calls the model with a system prompt scoped to "Yorùbá learning content only" → returns answer + source-lesson citations
- [ ] Extend the existing HTTP API with `POST /chat`, reusing the same Cognito JWT authorizer
- [ ] Decide conversation-history handling (client resends recent turns vs. a small DynamoDB session table)
- [ ] Guardrails: refuse out-of-scope questions, cap tokens, basic rate limiting per user
- [ ] Add all of this to CDK (extend `backend-stack.ts` or new stack) — keep it IaC, not console-clicked

## Phase 4 — Frontend integration
- [ ] Chat UI component (panel or floating widget) under `src/components/`
- [ ] Client in `src/lib/` calling `/chat`, following the existing `api.ts` pattern; consider streaming
- [ ] Surface citations (link back to the source chapter/lesson)
- [ ] Loading/error/rate-limit states
- [ ] Optional: pass the learner's current chapter/lesson as context so answers can be scoped

## Phase 5 — Testing & polish
- [ ] Unit tests for new `lib/` chat client logic
- [ ] Manual QA pass: check answers against the textbook for hallucination
- [ ] CloudWatch budget alarm for Bedrock spend
- [ ] Update `CLAUDE.md` and `App/infra/README.md` once built, matching how the existing infra is documented
