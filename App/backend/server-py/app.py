"""Local dev state server (FastAPI, SQLite) — a dev-only convenience.

Replaces the old Express/Postgres server. No auth: this exists purely so the
SPA can develop and test fully offline from AWS. It mirrors the same HTTP
contract the frontend's `src/lib/api.ts` uses against the cloud API:

    GET  /api/state -> 200 { state, updatedAt } | 404 { error }
    PUT  /api/state -> 200 { updatedAt } | 400 | 413

State is a single row (one learner locally) in a SQLite file. The cloud
backend keys by Cognito `sub`; locally there is no auth, so a fixed row id is
used, matching the single-item design of both cloud and the old local server.
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Single-learner local app: one fixed row holds the whole LearnerState blob.
ROW_ID = "local"
MAX_STATE_BYTES = 380_000
DB_PATH = Path(os.environ.get("STATE_DB_PATH", Path(__file__).parent / "state.db"))


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the state table if it does not exist."""
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS learner_state (
              id text PRIMARY KEY,
              state text NOT NULL,
              updated_at text NOT NULL
            )
            """
        )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Yoruba Ye Mi — local dev state server", lifespan=lifespan)

# Permissive CORS so the SPA can call this directly in dev/preview regardless
# of the Vite port (matches the old server's behaviour).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "PUT", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/state")
def get_state() -> Response:
    with _connect() as conn:
        row = conn.execute(
            "SELECT state, updated_at FROM learner_state WHERE id = ?", (ROW_ID,)
        ).fetchone()
    if row is None:
        return JSONResponse(status_code=404, content={"error": "no state saved yet"})
    return JSONResponse(
        content={"state": json.loads(row["state"]), "updatedAt": row["updated_at"]}
    )


@app.put("/api/state")
async def put_state(request: Request) -> Response:
    raw = await request.body()
    if len(raw) > MAX_STATE_BYTES:
        return JSONResponse(status_code=413, content={"error": "state too large"})
    try:
        parsed: Any = json.loads(raw) if raw else None
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "invalid JSON"})

    state = parsed.get("state") if isinstance(parsed, dict) else None
    if (
        not isinstance(state, dict)
        or isinstance(state.get("version"), bool)
        or not isinstance(state.get("version"), (int, float))
    ):
        return JSONResponse(
            status_code=400, content={"error": "body must be { state: LearnerState }"}
        )

    updated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO learner_state (id, state, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
            """,
            (ROW_ID, json.dumps(state), updated_at),
        )
    return JSONResponse(content={"updatedAt": updated_at})
