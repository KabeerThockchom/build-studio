"""Admin / proctor console API. All routes gated on CAN_MANAGE (see server/admin.py).

Reads the shared Lakebase session table for the live board, derives where each
participant is + whether they're stuck, offers an LLM triage ("what's blocking them,
what to do"), surfaces deep-links a proctor opens in their own browser, and stores the
per-workshop config the harness reads.
"""
import traceback
from datetime import datetime, timezone
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .. import sessions, admin, workshop, config, llm

router = APIRouter()

PHASE_LABEL = {"overview": "Overview", "shape": "Shape", "teach": "Learning", "design": "Design",
               "assemble": "Assemble", "blueprint": "Blueprint", "build": "Build"}


def _guard(req: Request):
    if not admin.is_admin(req):
        return JSONResponse(status_code=403, content={"error": "not an admin"})
    return None


def _idle_min(updated_at: str | None) -> float | None:
    if not updated_at:
        return None
    try:
        t = datetime.fromisoformat(updated_at)
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        return round((datetime.now(timezone.utc) - t).total_seconds() / 60, 1)
    except Exception:
        return None


def _progress(state: dict) -> dict:
    """Human-readable where-are-they from the raw session state."""
    phase = state.get("phase", "shape")
    label = PHASE_LABEL.get(phase, phase)
    detail = ""
    if phase == "design":
        qs = (state.get("plan") or {}).get("questions") or []
        detail = f"question {state.get('designIdx', 0) + 1}" + (f" of {len(qs)}" if qs else "")
    elif phase == "build":
        bp = state.get("buildPlan") or {}
        steps = bp.get("steps") or []
        done = len(state.get("buildDone") or [])
        detail = f"step {state.get('buildStepIdx', 0) + 1}" + (f" of {len(steps)}" if steps else "") + f" ({done} done)"
    return {"phase": phase, "phase_label": label, "detail": detail}


@router.get("/admin/me")
def me(request: Request):
    return {"email": admin.viewer_email(request), "is_admin": admin.is_admin(request),
            "sessions_enabled": sessions.enabled()}


@router.get("/admin/roster")
def roster(request: Request):
    g = _guard(request)
    if g:
        return g
    out = []
    for s in sessions.list_sessions():
        prog = _progress(s["state"])
        idle = _idle_min(s["updated_at"])
        # "stuck": sitting mid-build for a while, or idle a long time anywhere.
        stuck = bool(idle is not None and ((prog["phase"] == "build" and idle >= 8) or idle >= 20))
        out.append({"session_id": s["session_id"], "app_user": s["app_user"],
                    "idea": (s["state"].get("idea") or "")[:120],
                    **prog, "idle_min": idle, "stuck": stuck,
                    "updated_at": s["updated_at"]})
    # stuck first, then most-recently-active
    out.sort(key=lambda r: (not r["stuck"], -(r["idle_min"] or 0)))
    counts: dict = {}
    for r in out:
        counts[r["phase_label"]] = counts.get(r["phase_label"], 0) + 1
    return {"count": len(out), "by_phase": counts, "participants": out}


@router.get("/admin/participant/{session_id}")
def participant(session_id: str, request: Request):
    g = _guard(request)
    if g:
        return g
    state = sessions.load(session_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "not found"})
    host = ""
    try:
        host = config.get_workspace_host().rstrip("/")
    except Exception:
        pass
    links = {}
    if host:
        links = {"Genie": f"{host}/genie", "Catalog": f"{host}/explore/data",
                 "Apps": f"{host}/apps", "SQL": f"{host}/sql/editor"}
    return {"session_id": session_id, "state": state, "progress": _progress(state),
            "capabilities": state.get("capabilities", []),
            "blueprint": state.get("blueprint"), "deep_links": links}


TRIAGE_SYS = """You are an expert Databricks workshop proctor triaging a participant who may be
stuck. Given their current state, respond with ONE JSON object:
{"status": "<one plain line: where they are>", "likely_blocker": "<the most probable thing blocking them, or 'none — progressing'>", "suggested_action": "<what the proctor should do/check, concrete>"}
Ground it in the specifics. Common workshop blockers: a build step running long (app deploys and
SDP pipeline runs take a few minutes — usually fine, just slow), Zerobus ingest not landing rows
(missing table grants for the ingesting service principal), an empty/misconfigured Genie space, or a
deploy that says SUCCEEDED but didn't render. Keep each field to one sentence."""


@router.post("/admin/participant/{session_id}/triage")
def triage(session_id: str, request: Request):
    g = _guard(request)
    if g:
        return g
    state = sessions.load(session_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "not found"})
    prog = _progress(state)
    bp = state.get("buildPlan") or {}
    cur_step = None
    if prog["phase"] == "build" and bp.get("steps"):
        i = state.get("buildStepIdx", 0)
        if 0 <= i < len(bp["steps"]):
            cur_step = bp["steps"][i]
    user = (f"Idea: {state.get('idea','')}\nPhase: {prog['phase_label']} ({prog['detail']})\n"
            f"Capabilities: {state.get('capabilities', [])}\n"
            f"Current build step: {cur_step.get('title') if cur_step else 'n/a'}"
            f"{' — ' + cur_step.get('concept','') if cur_step else ''}\n"
            "Triage this participant now. JSON only.")
    try:
        raw = llm.complete([{"role": "system", "content": TRIAGE_SYS},
                            {"role": "user", "content": user}], max_tokens=400)
        import json
        t = raw.strip()
        if t.startswith("```"):
            t = t.split("```", 2)[1] if t.count("```") >= 2 else t.strip("`")
            t = t.lstrip()
            if t.lower().startswith("json"):   # strip the language tag, not chars
                t = t[4:]
        s, e = t.find("{"), t.rfind("}")
        return {"triage": json.loads(t[s:e + 1]) if s != -1 else {"status": raw[:200]}}
    except Exception as e:
        return {"triage": {"status": "triage unavailable", "likely_blocker": str(e)[:120], "suggested_action": ""}}


@router.get("/admin/config")
def get_config(request: Request):
    g = _guard(request)
    if g:
        return g
    return {"config": workshop.effective_config(), "all_capabilities": workshop.ALL_CAPABILITIES}


class ConfigBody(BaseModel):
    config: dict


@router.put("/admin/config")
def put_config(body: ConfigBody, request: Request):
    g = _guard(request)
    if g:
        return g
    try:
        # merge over effective so partial saves are safe
        merged = {**workshop.effective_config(), **body.config}
        sessions.set_config(merged)
        return {"ok": True, "config": workshop.effective_config()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "detail": traceback.format_exc()[-400:]})
