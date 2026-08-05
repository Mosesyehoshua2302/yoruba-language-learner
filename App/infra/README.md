# Yorùbá Yé Mi — AWS Infrastructure (CDK / TypeScript)

Infrastructure-as-code for hosting the Yorùbá Yé Mi app on AWS. Two CloudFormation
stacks, defined with AWS CDK v2 in TypeScript:

| Stack | Name | What it holds |
|---|---|---|
| Frontend | `YorubaYeMiFrontend` | S3 (private) + CloudFront — serves the built SPA |
| Backend | `YorubaYeMiBackend` | Cognito user pool + HTTP API + Lambda + DynamoDB — cross-device state sync |

## What is being built, and why

### The app today
The SPA is fully offline-first: all learner state (SRS cards, chapter progress,
XP/badges) lives in `localStorage`. That is great for a single browser but state
is lost if the browser data is cleared and can't follow the learner across
devices.

### Frontend stack — static hosting done properly
- **S3 bucket, fully private** (`BlockPublicAccess.BLOCK_ALL`, SSL enforced).
  Nothing is served from S3 directly.
- **CloudFront distribution** in front, using **Origin Access Control** so only
  CloudFront can read the bucket. HTTPS enforced, AWS-managed security headers
  policy, `PriceClass_100` (NA + EU edges — cheapest tier; widen later if the
  audience does).
- **SPA fallback**: 403/404 → `/index.html` so deep links into the app resolve.
- **`BucketDeployment`** uploads `../dist` (the Vite build output) and issues a
  CloudFront invalidation on every deploy. It also writes a `config.json`
  containing the backend API URL — the SPA can fetch this at runtime, so the
  frontend build stays environment-agnostic (no rebuild per environment).
- Bucket is `DESTROY` + auto-delete: it holds only build artifacts that are
  reproducible from source, so nothing of value can be lost.

**Why this shape:** it's the canonical, lowest-cost, zero-maintenance way to host
a static SPA on AWS. No servers, scales automatically, and the whole thing is
usually pennies per month at small scale.

### Backend stack — the "empower it" foundation
The goal is to let a signed-in learner sync progress across devices without
giving up the offline-first model. localStorage remains the source of truth in
the browser; the backend is a durable mirror.

- **DynamoDB table** (`userId` partition key, on-demand billing, point-in-time
  recovery, `RETAIN` on stack deletion). One item per learner holding the whole
  `LearnerState` blob plus `updatedAt`. The state is small (≪ 400 KB item limit)
  and is always read/written whole, so a single-item model is the simplest
  correct design — no migrations, no partial-update conflicts.
- **Cognito user pool** — email sign-up/sign-in, SRP auth flow, email recovery.
  `RETAIN`ed so user accounts survive accidental stack deletion.
- **HTTP API (API Gateway v2)** — cheaper and simpler than REST API Gateway.
  Every route requires a valid Cognito JWT (JWT authorizer); the Lambda derives
  the user id from the token's `sub` claim, so a user can only ever touch their
  own row.
- **One Lambda** (`lambda/state-handler.ts`, Node 20, ARM64, bundled by
  esbuild):
  - `GET /state` → returns the saved `{ state, updatedAt }` or 404 if none.
  - `PUT /state` → validates and stores `{ state }`, returns `{ updatedAt }`.
  - Payloads capped at 380 KB; body must parse as JSON with a numeric
    `state.version` (matches the app's persisted shape).

**Why this shape:** serverless end-to-end means zero idle cost and nothing to
patch. Every piece is pay-per-request, which fits an app with one (or a handful
of) users today but doesn't need rearchitecting if that grows.

### What is deliberately NOT built yet
- **No frontend wiring to the API.** The SPA does not call the backend yet;
  that's the next iteration (sign-in UI + a sync module that pushes/pulls
  `LearnerState` and resolves conflicts by `updatedAt`).
- **No custom domain / ACM certificate** — add a `DomainName` + Route 53 records
  once a domain is chosen.
- **No conflict resolution beyond last-write-wins** — fine for a single learner
  on a couple of devices; revisit if that assumption changes.
- **CORS is `*`** while there's no fixed domain; tighten `allowOrigins` to the
  CloudFront URL (or custom domain) as soon as the frontend is wired up.

## Prerequisites

- Node 18+ and npm
- An AWS account + credentials configured (`aws configure` or SSO)
- CDK bootstrapped in the target account/region (one-time):

```bash
npx cdk bootstrap
```

## Deploy

```bash
# 1. Build the SPA (from the app root, one level up)
npm run build

# 2. Install infra deps
cd infra && npm install

# 3. See what will be created
npx cdk diff

# 4. Deploy both stacks (backend first — frontend consumes its API URL)
npx cdk deploy --all
```

Outputs after deploy:
- `YorubaYeMiFrontend.SiteUrl` — the CloudFront URL to open
- `YorubaYeMiBackend.ApiUrl`, `UserPoolId`, `UserPoolClientId` — needed when the
  SPA gets wired to the backend

If `dist/` doesn't exist the frontend stack still synthesizes/deploys — it just
skips the upload step (useful for infra-only iteration).

## Costs

Everything is serverless / pay-per-use. At personal-use scale:
S3 + CloudFront a few cents, DynamoDB on-demand effectively $0, Lambda within
free tier, HTTP API ~$1 per million requests, Cognito free below 50k MAU.
Practically: **under a dollar a month**.

## Teardown

```bash
npx cdk destroy --all
```

The DynamoDB table and Cognito user pool are `RETAIN`ed — they survive destroy
so learner data and accounts aren't lost by accident. Delete them manually from
the console if you truly want them gone.

## Layout

```
infra/
├── bin/app.ts                 CDK app entry — instantiates both stacks
├── lib/frontend-stack.ts      S3 + CloudFront + deployment
├── lib/backend-stack.ts       Cognito + HTTP API + Lambda + DynamoDB
├── lambda/state-handler.ts    GET/PUT /state handler (bundled by esbuild)
├── cdk.json                   CDK config (ts-node entry)
└── package.json               scripts: build / synth / diff / deploy / destroy
```

## Roadmap (iterating on this)

1. **Wire the SPA to the backend**: fetch `config.json`, add sign-in
   (amazon-cognito-identity-js or Amplify Auth), and a sync module —
   push `LearnerState` after mutations (debounced), pull + merge on load.
2. Tighten CORS to the real origin.
3. Custom domain + ACM + Route 53.
4. Optional: per-chapter leaderboard or shared-progress features → would add a
   GSI, not a redesign.
