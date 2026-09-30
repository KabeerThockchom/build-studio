"""M0 tests — no network. Exercises health route, llm.text_of coercion, and
that fmapi_ping degrades to a clean 500 (not a crash) when FMAPI is unreachable."""
from unittest.mock import patch
from fastapi.testclient import TestClient
import app as app_module
from server import llm

client = TestClient(app_module.app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_text_of_coercion():
    assert llm.text_of("hi") == "hi"
    assert llm.text_of(None) == ""
    assert llm.text_of([{"type": "text", "text": "a"}, {"text": "b"}]) == "ab"
    assert llm.text_of([{"content": "x"}]) == "x"


def test_fmapi_ping_success():
    with patch.object(llm, "complete", return_value="pong"):
        r = client.get("/api/fmapi_ping")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["reply"] == "pong"


def test_fmapi_ping_failure_is_clean_500():
    with patch.object(llm, "complete", side_effect=RuntimeError("no auth")):
        r = client.get("/api/fmapi_ping")
    assert r.status_code == 500
    assert r.json()["ok"] is False
    assert "no auth" in r.json()["error"]
