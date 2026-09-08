"""Contract tests for the local FastAPI dev server.

Each test uses a fresh temporary SQLite file (via STATE_DB_PATH) so runs are
isolated and never touch a developer's local state.db.
"""

import importlib
import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    # Point the app at a throwaway DB, then (re)import so DB_PATH is picked up.
    monkeypatch.setenv("STATE_DB_PATH", str(tmp_path / "state.db"))
    import app as app_module

    importlib.reload(app_module)
    app_module.init_db()
    with TestClient(app_module.app) as c:
        yield c


def _valid_state(version: int = 1) -> dict:
    return {"version": version, "cards": {}, "chapters": {}}


def test_get_before_any_save_returns_404(client):
    res = client.get("/api/state")
    assert res.status_code == 404
    assert "error" in res.json()


def test_put_then_get_round_trips_state(client):
    state = _valid_state(version=3)
    put = client.put("/api/state", json={"state": state})
    assert put.status_code == 200
    assert "updatedAt" in put.json()

    got = client.get("/api/state")
    assert got.status_code == 200
    body = got.json()
    assert body["state"] == state
    assert body["updatedAt"] == put.json()["updatedAt"]


def test_put_upsert_overwrites_previous_state(client):
    client.put("/api/state", json={"state": _valid_state(version=1)})
    client.put("/api/state", json={"state": _valid_state(version=2)})
    body = client.get("/api/state").json()
    assert body["state"]["version"] == 2


def test_put_missing_state_key_is_400(client):
    res = client.put("/api/state", json={"nope": 1})
    assert res.status_code == 400


def test_put_non_numeric_version_is_400(client):
    res = client.put("/api/state", json={"state": {"version": "one"}})
    assert res.status_code == 400


def test_put_boolean_version_is_400(client):
    # bool is a subclass of int in Python; must be rejected like the TS handler.
    res = client.put("/api/state", json={"state": {"version": True}})
    assert res.status_code == 400


def test_put_oversized_body_is_413(client):
    big = {"version": 1, "blob": "x" * 400_000}
    res = client.put("/api/state", json={"state": big})
    assert res.status_code == 413


def test_put_invalid_json_is_400(client):
    res = client.put(
        "/api/state",
        content="{not json",
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 400
