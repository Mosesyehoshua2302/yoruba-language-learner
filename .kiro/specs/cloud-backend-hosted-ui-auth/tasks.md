# Tasks — Cloud Backend + Hosted UI Auth

Tasks marked `[x]` were completed earlier this session. Remaining tasks are in
dependency order.

## Infra: constructs + Python Lambda

- [x] 1. Port the cloud state handler to Python (`state_handler.py`), replacing the TS handler.
  - _Requirements: 1.4, 1.5_
- [x] 2. Refactor common constructs to resource-named, defaults-with-override.
  - `DynamoDbTable`, `CognitoUserPool`, `HttpLambdaApi`, `CloudFrontSite`; update `common/index.ts`.
  - _Requirements: 8.1, 8.2, 8.3_
- [x] 3. Rewire `backend-stack.ts` and `frontend-stack.ts` to the new constructs.
  - _Requirements: 8.3_
- [x] 4. Type-check and synth the infra with the project-local CDK CLI.
  - `tsc --noEmit` clean; `cdk synth` renders both stacks; template confirms python3.13 + /state routes.
  - _Requirements: 8.4_

## Infra: Cognito Hosted UI

- [x] 5. Add Hosted UI to the Cognito setup.
  - Prefix user-pool domain added; app client set to authorization-code + PKCE with `openid email profile`.
  - `authCallbackUrls` / `authLogoutUrls` read from CDK context (localhost defaults). Verified in synth template.
  - _Requirements: 3.1, 4.4_
- [x] 6. Surface auth outputs and thread them to the frontend stack.
  - Backend exposes `apiUrl`/`userPoolId`/`userPoolClientId`/`cognitoDomain` fields + CfnOutputs; passed into `FrontendStackProps` via `bin/app.ts`.
  - _Requirements: 9.2_
- [x] 7. Extend `CloudFrontSite` runtime config in the frontend stack.
  - `config.json` now carries `apiUrl`, `region`, `userPoolId`, `userPoolClientId`, `cognitoDomain`, `redirectUri`, `logoutUri`. Verified in the staged asset.
  - _Requirements: 4.1_

## Local dev server (FastAPI)

- [x] 8. Implement `App/server-py/` FastAPI server (no auth), same contract and local port.
  - SQLite persistence (`state.db`, `STATE_DB_PATH` override); lifespan init; permissive CORS; `GET/PUT /api/state` with 380KB cap + version validation. README + requirements.txt added.
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
- [x] 9. pytest suite for the local server (GET/PUT/round-trip/400/413).
  - 8 tests, all passing (incl. 404, upsert, boolean-version rejection, invalid JSON).
  - _Requirements: 2.x_
- [x] 10. Retire the old Express server and update `CLAUDE.md` / `README.md`.
  - Deleted `App/server/*`; updated `package.json` scripts (`server`/`server:setup`/`server:test`) and removed express/pg/cors/dotenv deps; updated `CLAUDE.md`.
  - _Requirements: 2.1_

## Frontend: config + auth

- [x] 11. `src/lib/config.ts` — fetch `config.json`; dev fallback (local FastAPI, auth disabled). Unit-tested.
  - _Requirements: 4.2, 4.3_
- [x] 12. Selected `oidc-client-ts` (v3, no Amplify); added to package.json + installed.
  - _Requirements: 3.x_
- [x] 13. `src/lib/auth.ts` — login/handleCallback/getIdToken(auto-refresh)/logout/restoreSession via UserManager.
  - _Requirements: 3.2, 3.4, 3.5_
- [x] 14. `src/state/auth.tsx` — AuthProvider hard-gate status machine; handles `?code=` callback (StrictMode-guarded).
  - _Requirements: 3.1, 3.2, 3.3, 3.6_
- [x] 15. `src/components/Auth/AuthScreen.tsx` — themed sign-in gate + splash.
  - _Requirements: 3.1_
- [x] 16. Wired `main.tsx`: loadConfig → AuthProvider → gate → StoreProvider (signed-in only) → App; sign-out added to header (new `logout` icon).
  - _Requirements: 3.5, 3.6_

## Frontend: API client + store

- [x] 17. `api.ts` — config-driven base URL + auth mode; Bearer token when enabled; best-effort errors. Unit-tested.
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
- [x] 18. `store.tsx` + `storage.ts` — `sub`-namespaced cache key; reset takes sub; reconcile + LWW preserved.
  - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3_
- [x] 19. Frontend unit tests: config, api token attachment, sub-namespaced cache. 21 vitest tests pass; `vite build` clean.
  - _Requirements: 5.x, 6.x_

## Deploy + verify

- [x] 20. Confirmed the pipeline's validate stage locally (frontend build + infra tsc + `cdk synth` all pass); documented the first-deploy manual callback-URL step + backend/frontend redeploy in `infra/README.md`.
  - _Requirements: 9.1, 9.3_
- [ ] 21. End-to-end smoke — REQUIRES USER: deploy to AWS (`cdk bootstrap` then the gated pipeline or `cdk deploy`), do the manual callback-URL redeploy, then sign in via Hosted UI and verify sync across two sessions. Cannot be run without deploying to your AWS account.
  - _Requirements: 1.x, 3.x, 7.x_

```

```
