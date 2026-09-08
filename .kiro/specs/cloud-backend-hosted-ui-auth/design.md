# Design — Cloud Backend + Hosted UI Auth

## Overview

The app moves from offline-first-only to a hard-gated, cloud-synced app. A user
signs in through Cognito Hosted UI; the SPA obtains OAuth2 tokens (authorization
code + PKCE) and calls an authenticated API Gateway → Lambda → DynamoDB backend
that stores one record per user. A FastAPI server is retained purely as a local
dev convenience (no auth). The SPA build stays environment-agnostic: all
environment values arrive at runtime via a fetched `config.json`.

This document reflects work already completed this session (the Python Lambda
handler and the resource-oriented construct refactor) and the design for the
remaining work (Cognito Hosted UI, frontend auth, config plumbing, FastAPI dev
server, api-client changes).

## Architecture

```
                         ┌──────────────────────────────────────┐
                         │            Browser (SPA)              │
                         │  AuthProvider (hard gate)             │
   sign in redirect ───► │   loading → splash                    │
                         │   signed-out → "Sign in" → Hosted UI  │
   code+PKCE callback ◄─ │   signed-in → StoreProvider → App     │
                         └───────────┬───────────────┬──────────┘
                                     │ fetch config  │ Bearer token
                                     ▼               ▼
                    S3 + CloudFront (config.json)   API Gateway (HTTP API)
                    [CloudFrontSite]                 JWT authorizer (Cognito)
                                                     │
                                                     ▼
                                          Python Lambda (state_handler)
                                          [HttpLambdaApi]
                                                     │
                                                     ▼
                                          DynamoDB (userId → state)
                                          [DynamoDbTable]

   Cognito User Pool + Hosted UI (prefix domain)   [CognitoUserPool]

   Local dev only:  SPA (auth disabled) ──► FastAPI server ──► local store
```

## Components and Interfaces

### 1. Constructs (DONE this session)

Resource-named, defaults-with-override, config injected by stacks:

- `DynamoDbTable` — merges caller `TableProps` over defaults (PAY_PER_REQUEST,
  PITR on, RETAIN). Backend stack supplies `partitionKey: userId`.
- `CognitoUserPool` — user pool + app client, each defaults-with-override. This
  spec extends usage to configure Hosted UI (domain, OAuth flows, callback/
  logout URLs) via props from the stack — see decision B / open items.
- `HttpLambdaApi` — compound: HTTP API + optional JWT authorizer + one Lambda +
  injected routes. Backend stack supplies the Python asset/handler/runtime,
  `/state` routes, and JWT auth config.
- `CloudFrontSite` — bucket + distribution + optional deployment; `runtimeConfig`
  writes `config.json`. Frontend stack extends `runtimeConfig` with Cognito
  values.

### 2. Python Lambda handler (DONE this session)

`App/infra/lambda/state_handler.py` — faithful port of the TS handler: reads
`sub` from the JWT authorizer claims, `GET`/`PUT /state`, 380 KB cap, numeric
`version` validation (booleans excluded), ISO-8601 `updatedAt`. Uses boto3
(bundled in the managed Python runtime, no packaging step).

### 3. Cognito Hosted UI (infra, to build)

Additions to the Cognito setup, driven from the stack (not hardcoded in the
construct):

- **User pool domain** — prefix domain, e.g. `yoruba-ye-mi-<suffix>`.
- **App client OAuth config** — `authorizationCodeGrant: true`, scopes
  `openid email profile`, `preventUserExistenceErrors`, no client secret.
- **Callback + logout URLs** — supplied as a CDK context/parameter value
  (`authCallbackUrls`, `authLogoutUrls`). Dev value: `http://localhost:<port>`.
  Prod value: the CloudFront URL, pasted in after first deploy, then redeploy.

Stack outputs add `UserPoolDomain` (and existing `UserPoolId`,
`UserPoolClientId`, `ApiUrl`) for the frontend to consume.

### 4. Runtime config (`config.json`)

Written by `CloudFrontSite.runtimeConfig` in the frontend stack:

```json
{
  "apiUrl": "https://<api-id>.execute-api.<region>.amazonaws.com",
  "region": "<region>",
  "userPoolId": "<pool-id>",
  "userPoolClientId": "<client-id>",
  "cognitoDomain": "https://<prefix>.auth.<region>.amazoncognito.com",
  "redirectUri": "https://<cloudfront>/callback",
  "logoutUri": "https://<cloudfront>/"
}
```

Frontend `src/lib/config.ts` fetches this at startup; in dev it falls back to a
static local config (`apiUrl` = local FastAPI, `authDisabled: true`).

### 5. Frontend auth layer (to build)

- `src/lib/auth.ts` — thin wrapper over a small OIDC/PKCE client:
  `login()` (redirect to Hosted UI with PKCE challenge), `handleCallback()`
  (exchange `code` for tokens, store them), `getIdToken()` (return current,
  auto-refresh if expired), `logout()` (clear + redirect to Cognito logout),
  `restoreSession()` (rehydrate tokens on load).
- `src/state/auth.tsx` — `AuthProvider` exposing
  `{ status: 'loading'|'signed-out'|'signed-in', user, login, logout }`; handles
  the `?code=` callback on load; drives the hard gate.
- `src/components/Auth/AuthScreen.tsx` — the gate view (a themed "Sign in"
  landing that triggers the redirect). Minimal, since credentials are collected
  on the hosted page, not here.
- `main.tsx` — `AuthProvider` → gate → (`signed-in`) `StoreProvider` → `App`.

### 6. API client + store (to modify)

- `api.ts` — base URL + auth mode from config; attach `Authorization: Bearer`
  when auth enabled; keep best-effort error handling; path `/state` for cloud,
  existing path for the local dev server.
- `store.tsx` — localStorage key namespaced by `sub`; sync effects assume a
  token in the cloud path; reset/stop on sign-out. Existing hydrate/reconcile/
  debounced-save flow is preserved (last-write-wins by `updatedAt`).

### 7. Local dev server (FastAPI, to build)

`App/server-py/` (replacing `App/server/`): FastAPI app, same contract, no auth,
same local port. Persistence approach documented (reuse local Postgres, or a
simpler file/SQLite store for zero-setup dev — see open items). Run command and
docs updated in `CLAUDE.md` / `README.md`.

## Data Model

DynamoDB item (cloud): `{ userId (PK), state (LearnerState blob), updatedAt }`.
Single item per user, always read/written whole; unchanged from the existing
DynamoDB design. `LearnerState` shape is unchanged (`src/types.ts`).

## Error Handling

- API: `401` no/invalid token, `400` bad body, `413` oversized, `404` no state,
  `200` success. Client treats network errors as non-fatal (cache fallback).
- Auth: failed code exchange or refresh → drop to `signed-out` and re-prompt;
  never surface tokens in logs.

## Testing Strategy

- Python Lambda: unit tests for GET/PUT/404/400/413/401 and `sub` scoping,
  with DynamoDB mocked.
- FastAPI dev server: pytest for the contract (GET/PUT/round-trip/400/413).
- Frontend auth: unit tests for the PKCE/token-refresh logic in `auth.ts`;
  tests for `api.ts` token attachment and config-driven base URL; a test that
  the store cache key is `sub`-namespaced.
- Infra: `tsc --noEmit` + `cdk synth` via the project-local CLI.

## Resolved Decisions

1. **Cognito ownership vs. callback URL (deploy ordering).** Callback URLs are a
   manual config value; the Cognito pool stays in the backend stack; the backend
   is redeployed after the first frontend deploy to pick up the CloudFront
   callback URL. Migrate to a custom domain later to remove the manual step.
2. **Local FastAPI persistence — SQLite.** The local dev server uses a SQLite
   file for zero-setup, fully-offline dev (no auth, no cross-device needs). The
   old Express/Postgres server is retired.
3. **OIDC/PKCE library — small client lib.** Use a small, maintained OIDC/PKCE
   client for the Hosted UI code exchange + token refresh (no Amplify, not
   hand-rolled). Specific package selected at task 12.
