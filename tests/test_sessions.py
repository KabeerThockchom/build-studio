"""M2.6 tests — no network. Session route degrades gracefully when Lakebase is off."""
from fastapi.testclient import TestClient
import app as app_module
from server import sessions

client = TestClient(app_module.app)


def test_enabled_flag_present():
    r = client.get("/api/session/enabled")
    assert r.status_code == 200
    assert "enabled" in r.json()


def test_save_is_noop_safe_when_disabled(monkeypatch):
    # Force disabled path: save returns a session id, ok True, persisted False, no crash.
    monkeypatch.setattr(sessions, "_ENABLED", False)
    r = client.post("/api/session/save", json={"session_id": None, "state": {"idea": "x"}})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["session_id"]                 # a new id was minted
    assert body["persisted"] is False


def test_load_missing_returns_404_when_disabled(monkeypatch):
    monkeypatch.setattr(sessions, "_ENABLED", False)
    r = client.get("/api/session/does-not-exist")
    assert r.status_code == 404
