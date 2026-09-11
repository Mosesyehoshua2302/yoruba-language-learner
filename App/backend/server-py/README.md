# Local dev state server (FastAPI + SQLite)

A dev-only convenience so the SPA can run fully offline from AWS. It mirrors the
cloud state API's contract but with **no authentication** and a local SQLite
file for storage. This replaces the old Express/Postgres server.

## Contract

Same shape the frontend's `src/lib/api.ts` uses:

- `GET /api/state` → `200 { state, updatedAt }` or `404 { error }`
- `PUT /api/state` → body `{ state }` → `200 { updatedAt }`, `400` invalid body,
  `413` if over 380 KB

## Run

```bash
cd App/server-py
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --port 8787 --reload
```

The server listens on `http://localhost:8787` (the base URL the SPA targets in
development). The SQLite file defaults to `App/server-py/state.db`; override with
the `STATE_DB_PATH` environment variable.

## Test

```bash
.venv/bin/python -m pytest
```

## Notes

- No auth: the cloud backend keys learner state by Cognito `sub`; locally there
  is no sign-in, so a single fixed row (`id = "local"`) holds the state,
  matching the single-item design of both the cloud backend and the old server.
- CORS is permissive (`*`) so the SPA can call it directly regardless of the
  Vite dev-server port.
