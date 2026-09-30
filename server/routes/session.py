import traceback
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from .. import sessions

router = APIRouter()


class SaveRequest(BaseModel):
    session_id: str | None = None
    state: dict


def _user(req: Request) -> str:
    # Databricks Apps forwards the end-user identity; fall back to 'local'.
    return req.headers.get("x-forwarded-email") or req.headers.get("x-forwarded-user") or "local"


@router.get("/session/enabled")
def session_enabled():
    return {"enabled": sessions.enabled()}


@router.post("/session/save")
def save(body: SaveRequest, request: Request):
    try:
        sid = sessions.save(body.session_id, _user(request), body.state)
        return {"ok": True, "session_id": sid, "persisted": sessions.enabled()}
    except Exception as e:
        # Never block the flow on a save failure — report but stay 200.
        return {"ok": False, "session_id": body.session_id, "persisted": False,
                "error": str(e), "detail": traceback.format_exc()[-600:]}


@router.get("/session/latest")
def latest(request: Request):
    """The current user's most recent session, so returning to the base URL (no ?s=) can
    offer 'pick up where you left off'. Only surfaces real progress (past shape)."""
    row = sessions.latest_for_user(_user(request))
    if not row:
        return {"found": False}
    st = row.get("state") or {}
    phase = st.get("phase", "overview")
    if phase in ("overview", "shape"):   # nothing worth resuming yet
        return {"found": False}
    return {"found": True, "session_id": row["session_id"], "phase": phase,
            "idea": (st.get("idea") or "")[:140], "project_name": st.get("projectName") or "",
            "updated_at": row.get("updated_at")}


@router.get("/session/{session_id}")
def load(session_id: str):
    try:
        state = sessions.load(session_id)
        if state is None:
            return JSONResponse(status_code=404, content={"error": "not found"})
        return {"state": state}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
