# Yorùbá Yé Mi — AWS Infrastructure (CDK / TypeScript)

Infrastructure-as-code for hosting the Yorùbá Yé Mi app on AWS. Two CloudFormation
stacks, defined with AWS CDK v2 in TypeScript:

| Stack    | Name                 | What it holds                                                              |
| -------- | -------------------- | -------------------------------------------------------------------------- |
| Frontend | `YorubaYeMiFrontend` | S3 (private) + CloudFront — serves the built SPA                           |
| Backend  | `YorubaYeMiBackend`  | Cognito user pool + HTTP API + Lambda + DynamoDB — cross-device state sync |

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
- **Cognito user pool + Hosted UI** — email sign-up/sign-in via the Cognito
  Hosted UI (OAuth2 authorization code + PKCE, no client secret), on a prefix
  domain. `RETAIN`ed so user accounts survive accidental stack deletion.
- **HTTP API (API Gateway v2)** — cheaper and simpler than REST API Gateway.
  Every route requires a valid Cognito JWT (JWT authorizer); the Lambda derives
  the user id from the token's `sub` claim, so a user can only ever touch their
  own row.
- **One Lambda** (`lambda/state_handler.py`, Python 3.13, ARM64; boto3 ships in
  the managed runtime, so no bundling step):
  - `GET /state` → returns the saved `{ state, updatedAt }` or 404 if none.
  - `PUT /state` → validates and stores `{ state }`, returns `{ updatedAt }`.
  - Payloads capped at 380 KB; body must parse as JSON with a numeric
    `state.version` (matches the app's persisted shape).

**Why this shape:** serverless end-to-end means zero idle cost and nothing to
patch. Every piece is pay-per-request, which fits an app with one (or a handful
of) users today but doesn't need rearchitecting if that grows.

### Auth + first deploy (the manual callback-URL step)

The Cognito app client must list the app's callback/logout URLs, but the
CloudFront URL does not exist until the frontend stack is first deployed. These
URLs are therefore supplied manually as CDK context (they default to
`http://localhost:5173/...` for dev):

1. **First deploy** with the localhost defaults (backend then frontend). Note
   the `YorubaYeMiFrontend.SiteUrl` (CloudFront URL) from the outputs.
2. **Redeploy the backend** with the real URLs so Hosted UI will redirect back:
   ```bash
   npx cdk deploy YorubaYeMiBackend \
     -c authCallbackUrls=https://<cloudfront-domain>/callback \
     -c authLogoutUrls=https://<cloudfront-domain>/
   ```
3. **Redeploy the frontend** so `config.json` carries the same redirect URIs:
   ```bash
   npm run build   # in App/
   npx cdk deploy YorubaYeMiFrontend \
     -c authCallbackUrls=https://<cloudfront-domain>/callback \
     -c authLogoutUrls=https://<cloudfront-domain>/
   ```

Optionally override the Hosted UI domain prefix with
`-c cognitoDomainPrefix=<globally-unique-prefix>`. Migrating to a custom domain
later removes this manual step (a stable URL is known up front).

### What is deliberately NOT built yet

- **No custom domain / ACM certificate** — add a `DomainName` + Route 53 records
  once a domain is chosen; this also removes the manual callback-URL step above.
- **No conflict resolution beyond last-write-wins** — fine for a single learner
  on a couple of devices; revisit if that assumption changes.
- **CORS is `*`** while there's no fixed domain; tighten `allowOrigins` to the
  CloudFront URL (or custom domain) once a stable origin exists.

## Prerequisites

- Node 18+ and npm
- An AWS account + credentials configured (`aws configure` or SSO)
- CDK bootstrapped in the target account/region (one-time):

```bash
npx cdk bootstrap
```

## What `dist/` is, and why the frontend deploy needs it

`dist/` is the app **compiled into browser-runnable files** — it _is_ the app
that actually runs. The `src/` folder is developer source (TypeScript, JSX,
Tailwind, ~60 modules); browsers can't run any of that directly. `npm run build`
(Vite) translates `src/` into `dist/`: a plain `index.html`, one bundled+minified
`.js`, and one processed `.css`.

S3 + CloudFront is **dumb static hosting** — it serves files exactly as-is and
knows nothing about TypeScript or React. So it can only host the already-compiled
`dist/`, never `src/`. That is why the deploy must produce `dist/` first.

`dist/` is **generated output** (gitignored, reproducible), so it does not exist
on a fresh checkout and is stale after any source change — always rebuild before
deploying.

> **Gotcha — empty bucket.** The frontend stack's `BucketDeployment` (which
> uploads the SPA _and_ writes `config.json`) is guarded by
> `fs.existsSync(distDir)`. If `dist/` is absent at deploy time, the bucket +
> CloudFront are still created but **nothing is uploaded** — no SPA, no
> `config.json`, empty bucket. If you deployed and the bucket is empty, you
> almost certainly skipped `npm run build`. Fix: build, then redeploy the
> frontend.

## Deploy

Use the project-local CDK CLI (`./node_modules/.bin/cdk` or `npx cdk`); a stale
global `cdk` can be too old for the installed `aws-cdk-lib`.

```bash
# 0. Refresh credentials + confirm target account/region
aws sso login                    # if using SSO
aws sts get-caller-identity

# 1. Build the SPA — produces dist/ (REQUIRED before the frontend deploy)
npm run build                    # from the App/ root

# 2. Install infra deps
cd infra && npm install

# 3. Deploy backend first (frontend consumes its outputs), then frontend
npx cdk deploy YorubaYeMiBackend
npx cdk deploy YorubaYeMiFrontend
```

Outputs after deploy:

- `YorubaYeMiFrontend.SiteUrl` — the CloudFront URL to open
- `YorubaYeMiBackend.ApiUrl`, `UserPoolId`, `UserPoolClientId`, `UserPoolDomain`
  — the values the frontend stack folds into `config.json` (see below)

### How `config.json` is created (deploy) vs. consumed (runtime)

`config.json` is **never a source file**. The frontend CDK stack _creates_ it at
deploy time: `bin/app.ts` passes the backend outputs into the frontend stack,
`frontend-stack.ts` puts them in `runtimeConfig`, and `cloudfront-site.ts`
serializes that to `config.json` via the same `BucketDeployment` that uploads
`dist/` (so no `dist/` also means no `config.json`). At **runtime**, the browser
_loads_ it: `main.tsx` → `loadConfig()` → `fetch('/config.json')`, and the values
are injected into the OIDC client (`auth.ts`) and the API client (`api.ts`).

This keeps the build environment-agnostic: the same `dist/` bundle works in any
environment because config is fetched, not baked in. In local dev there is no
`config.json` (fetch 404s) so the app falls back to the local FastAPI server with
auth disabled. Note the backend Lambda does **not** read `config.json` — it gets
its config from environment variables (`TABLE_NAME`) and the JWT authorizer wired
at deploy time.

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
