# Requirements — Cloud Backend + Hosted UI Auth

## Introduction

This feature takes the Yorùbá Yé Mi app from a local-only, offline-first tool
to a cloud-hosted application with authenticated, cross-device state sync. It
covers three connected pieces of work:

1. A Python backend for state persistence — a Python Lambda behind API Gateway
   in the cloud, and a matching FastAPI server kept for local development.
2. Reusable, resource-oriented CDK constructs whose configuration is injected
   by the consuming stacks (already refactored this session).
3. A hard authentication gate using Cognito Hosted UI (OAuth2 authorization
   code + PKCE), so a user must sign in before using the app, with their
   learner state synced to their own record in the cloud.

Out of scope (parked as a separate future spec): the event-driven, agent-based
PDF→content ingestion pipeline. The chatbot/RAG roadmap is also out of scope.

## Locked-in decisions

- Backend language: Python. Cloud = Lambda; local dev = FastAPI (no auth locally).
- Auth: hard gate — no anonymous use.
- Login: Cognito Hosted UI, OAuth2 authorization code grant with PKCE (public
  SPA client, no client secret).
- Cognito domain: prefix domain (`<prefix>.auth.<region>.amazoncognito.com`).
- Callback/logout URLs: supplied manually as a configuration value (localhost
  for dev; the CloudFront URL pasted in after the first frontend deploy, then
  redeploy the backend). Migrate to a custom domain later.
- Auth client library: a small OIDC/PKCE client. No Amplify.
- Conflict resolution on sync: last-write-wins by `updatedAt`.
- CDK constructs: resource-named, defaults-with-override; stacks inject config.

## Requirements

### Requirement 1 — Cloud state API (authenticated)

**User Story:** As a signed-in learner, I want my progress stored in the cloud
against my identity, so that it follows me across devices.

#### Acceptance Criteria

1. THE cloud API SHALL expose `GET /state` and `PUT /state` behind an API Gateway HTTP API secured by a Cognito JWT authorizer.
2. WHEN a request carries a valid Cognito JWT THEN the handler SHALL derive the user id from the token's `sub` claim and operate only on that user's record.
3. WHEN a request has no valid token THEN API Gateway/handler SHALL reject it with `401`.
4. THE handler SHALL preserve the existing contract: `GET` → `200 { state, updatedAt }` or `404 { error }`; `PUT { state }` → `200 { updatedAt }`, `400` invalid body, `413` over 380 KB.
5. THE handler SHALL be implemented in Python and deployed via the refactored `HttpLambdaApi` construct.

### Requirement 2 — Local dev server (FastAPI, no auth)

**User Story:** As a developer, I want a local backend that works without AWS or
sign-in, so that I can develop and test offline.

#### Acceptance Criteria

1. THE local server SHALL be reimplemented in Python/FastAPI, replacing the Express/Postgres server, and remain a dev-only convenience.
2. THE local server SHALL expose the same request/response contract used by the frontend, requiring no auth token locally.
3. THE local server SHALL listen on the existing local port/base so the frontend can target it in development.
4. THE local server SHALL have a documented run command and a documented persistence approach (e.g. Postgres or a simpler local store).

### Requirement 3 — Frontend auth gate (Cognito Hosted UI)

**User Story:** As a user, I must sign in before using the app, via a hosted
login page, so that my session is authenticated.

#### Acceptance Criteria

1. WHILE the auth status is `signed-out` THE app SHALL NOT render the learning UI and SHALL present a way to start sign-in that redirects to the Cognito Hosted UI.
2. WHEN Cognito redirects back with an authorization code THEN the app SHALL complete the PKCE code exchange, obtain tokens, and transition to `signed-in`.
3. WHILE the auth status is `loading` (session restore in progress) THE app SHALL show a neutral splash and render neither the auth screen nor the app.
4. WHEN a signed-in user's id token is expired THEN the auth layer SHALL refresh it using the refresh token without forcing re-login, until the refresh token itself expires.
5. WHEN the user signs out THEN the app SHALL clear local session/tokens and redirect to the Cognito logout endpoint, returning to `signed-out`.
6. THE app SHALL only mount the state `StoreProvider` (and thus start cloud sync) after reaching `signed-in`.

### Requirement 4 — Runtime configuration (no rebuild per environment)

**User Story:** As an operator, I want environment-specific settings delivered
at runtime, so that the SPA build is environment-agnostic.

#### Acceptance Criteria

1. THE frontend stack SHALL write a `config.json` containing at least: `apiUrl`, `userPoolId`, `userPoolClientId`, `cognitoDomain`, `region`, and the redirect (callback/logout) URIs.
2. THE SPA SHALL fetch `config.json` at startup and use it to configure the API base URL and the OIDC/PKCE client.
3. WHERE the app runs in local development THE config SHALL resolve to the local FastAPI server with auth disabled.
4. THE Cognito callback/logout URLs SHALL be supplied to the infra as a configuration value (context/parameter), not auto-derived, per the locked-in decision.

### Requirement 5 — Token-aware, config-driven API client

**User Story:** As the frontend, I want one API client that works against both
the local dev server and the authenticated cloud API.

#### Acceptance Criteria

1. THE `api.ts` client SHALL read its base URL and auth mode from runtime config.
2. WHEN auth is enabled (cloud) THEN every request SHALL include `Authorization: Bearer <idToken>` with a current (auto-refreshed) token.
3. WHEN auth is disabled (local dev) THEN requests SHALL be sent without a token.
4. THE client SHALL keep its best-effort behavior: network/server failures are logged, never thrown into the UI, so the app keeps working from the local cache.

### Requirement 6 — Per-user local cache

**User Story:** As a user on a shared browser, I want my cached progress kept
separate from other users, so that no one sees another's data.

#### Acceptance Criteria

1. THE localStorage cache key SHALL be namespaced by the authenticated user's `sub`.
2. WHEN a different user signs in on the same browser THEN the app SHALL NOT hydrate from another user's cached state.
3. WHEN a user signs out THEN the app SHALL stop syncing and SHALL NOT display the previous user's state to a subsequent visitor.

### Requirement 7 — Sync + conflict resolution

**User Story:** As a learner using multiple devices, I want a predictable rule
for whose progress wins, so that sync is not surprising.

#### Acceptance Criteria

1. WHEN a signed-in session starts THEN the app SHALL fetch the user's server state, reconcile it against content, and hydrate the store.
2. WHEN local and server state diverge THEN the app SHALL resolve using last-write-wins by `updatedAt`.
3. THE app SHALL keep the existing debounced background save of state to the server after mutations.

### Requirement 8 — Reusable, resource-oriented constructs

**User Story:** As an infra maintainer, I want common constructs named for the
resource they create and configured by the stacks, so that future components
can reuse them.

#### Acceptance Criteria

1. THE common constructs SHALL be named for their AWS resource (`DynamoDbTable`, `CognitoUserPool`, `HttpLambdaApi`, `CloudFrontSite`).
2. EACH construct SHALL merge caller-supplied props over house defaults (defaults-with-override), exposing overridable configuration rather than hardcoding a single use case.
3. USE-CASE specifics (routes, table key, runtime config values, Cognito OAuth/callback settings) SHALL live in the consuming stacks.
4. THE infra SHALL type-check (`tsc --noEmit`) and `cdk synth` successfully using the project-local CDK CLI.

### Requirement 9 — Deployment pipeline compatibility

**User Story:** As an operator, I want the existing gated CI/CD pipeline to keep
working, so that deploys stay controlled.

#### Acceptance Criteria

1. THE changes SHALL remain deployable via the existing `deploy.yml` (validate → backend → frontend, each gated).
2. THE backend stack SHALL output `ApiUrl`, `UserPoolId`, `UserPoolClientId`, and the Cognito domain so the frontend stack can consume them into `config.json`.
3. THE first-deploy manual step (paste CloudFront URL into the callback config, redeploy backend) SHALL be documented.
