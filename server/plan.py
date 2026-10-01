"""Build Studio v2: the plan (architecture + PRD), drafted in the BACKGROUND while the participant learns.

Multi-step, because we have the time (Learn takes minutes) and fidelity matters more than speed here:
  1. draft   - the PRD from everything the Sit-Down produced (brief, facts, shape, scope lanes, data, risks)
  2. check   - a critic compares the draft against the Sit-Down: stated facts kept verbatim, essentials in
               scope, nothing invented, components used as intended, honest about data that doesn't exist
  3. refine  - fixes exactly what the check found (skipped when the check is clean)
The architecture diagram is pure code from the component list (components.spec_for).

Jobs run in a thread; the UI polls /api/plan/{job_id}. A refine note starts a new job from the previous plan.
"""
import json
import threading
import time
import uuid

from . import components as C
from . import llm
from .jsonx import loads_tolerant
from .scope import VOICE, WORKSHOP_SCOPE, clamp_idea, strip_em_dashes

PLAN_MODEL = "databricks-claude-sonnet-5"

SYSTEM = f"""You are a senior Databricks Solutions Architect writing the plan for a build a workshop participant will
finish in one day. You have their whole Sit-Down: the sharpened idea, their brief, the facts they stated, the build
shape they chose, what is in today's scope and what is stretch or later, the data plan, risks and watch-outs.

{WORKSHOP_SCOPE}

{VOICE}

THE PIECES (use only the ones listed for this build; never add others):
- Declarative Pipelines: Lakeflow Declarative Pipelines that take the data through bronze (raw), silver (cleaned,
  joined) and gold (ready to use) tables. Any scoring, flagging, ranking or "drafted suggestion" logic lives here,
  as rules in the gold layer. There are NO AI agents in these builds.
- Genie: a Genie space over the gold tables so people ask questions in plain English.
- AI/BI Dashboards: a dashboard over the gold tables showing the key numbers and trends.
- Lakebase: a Postgres database that records what people decide, approve, change or note.
- Databricks Apps: the screen people open. It is built separately with Genie App Builder (Apps > Build), from
  a natural-language description of the screens. Describe the screens and behaviour clearly; never describe code.

PRD DISCIPLINE: no code, SQL, schemas, column lists or API endpoints. Use THEIR words and THEIR numbers exactly
(targets, baselines, deadlines, roles, devices). Anything you propose that they did not confirm is marked
"(suggested)". Today's scope is what the Sit-Down put in Today; stretch comes after the core works; later is out.
Never claim data exists that the data plan does not list; say what is generated instead. If they said to use
data they already have, plan to read it, not regenerate it. When the app records decisions in Lakebase, the
app's list must reflect them (the latest decision per item and date), so the loop closes. If Lakebase is not
one of the pieces, nothing is recorded: never plan a decision log without it. Model the data so the decision
works: the right grain (per user, site, day), keys that join, and time-based metrics relative to today. The app records
decisions in Lakebase but cannot act on external systems: say so and put the real integration in later.
Write it so a newcomer can follow it, plain and specific."""

SHAPE = """Return ONLY one JSON object:
{
 "prd_markdown": "<markdown with these sections: ## Summary, ## Who it's for, ## The moment it's used, ## What it does,
   ## First screen, ## Primary action, ## How it's built (one short paragraph per piece used: what that piece does in
   this build), ## Data (seeded tables read, tables generated, the gold tables everything reads, in plain words),
   ## Success measure (their metric, baseline and target), ## Scope (Today / Stretch / Later), ## Risks and guards>",
 "flow": [{"n": 1, "title": "<verb phrase>", "sub": "<short>"}, ...3 to 4 steps of how a person uses it],
 "decisions": [{"tag": "<one of the pieces used>", "text": "<why it is in this build, one line>",
                "tradeoff": "<the honest cost, one line>"}, ...one per piece used],
 "scope_in": ["<specific thing working by end of day>", ...3 to 5],
 "scope_later": ["<honest follow-up>", ...2 to 4],
 "app_screens": ["<if Databricks Apps is used: one line per screen, what it shows and what you can do>", ...],
 "change_note": "<only for a refine: one plain sentence on what changed, else ''>"
}"""

PIECES_ASK = """
PIECES CAN CHANGE ON A REFINE. Also return "pieces": the full list of pieces after this change, chosen only from
Declarative Pipelines, Genie, AI/BI Dashboards, Lakebase, Databricks Apps. Map what they ask for onto a piece:
asking questions or chatting with the data (even if they say "an agent" or "a chatbot") -> Genie; numbers or trends
on one page -> AI/BI Dashboards; recording approvals, notes or changes -> Lakebase; a screen to act from ->
Databricks Apps. Remove a piece when they ask to drop it or what it did. There are no AI agents in these builds:
if they asked for one, say in change_note that Genie is how people chat with the data here. If nothing about the
pieces changed, return the current list unchanged. Write the PRD for the NEW list of pieces."""


def _context(sd: dict) -> str:
    a = sd.get("answers") or {}
    lines = [f"IDEA (sharpened): {sd.get('idea', '')}", f"PIECES IN THIS BUILD: {', '.join(sd.get('capabilities') or [])}"]
    lines += [f"- {k}: {v}" for k, v in a.items() if v and k not in ("seeded_schema",)]
    if a.get("participant_context"):
        lines.append(f"Use the participant's own context throughout ({a['participant_context']}); never assume another company.")
    return "\n".join(lines)


def _call(messages, max_tokens=8000) -> dict:
    last = None
    for attempt in range(3):
        try:
            r = llm.client().chat.completions.create(model=PLAN_MODEL, messages=messages, max_tokens=max_tokens)
            t = llm.text_of(r.choices[0].message.content)
            s, e = t.find("{"), t.rfind("}")
            return loads_tolerant(t[s:e + 1])
        except Exception as ex:
            last = ex
            time.sleep(1 + attempt)
    raise ValueError(f"plan model failed: {last}")


def draft(sd: dict, previous: dict | None = None, adjust: str = "") -> dict:
    user = _context(sd)
    if previous and adjust:
        user += (f"\n\nTHE CURRENT PLAN:\n{previous.get('prd_markdown', '')}\n\nTHE PARTICIPANT ASKED FOR THIS CHANGE: "
                 f"\"{adjust}\". Honour it if it fits the pieces and the one-day scope; if it doesn't, say so in change_note "
                 "and do the closest honest thing.")
        return _call([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user + "\n\n" + SHAPE.rstrip()[:-1].rstrip() +
                       ',\n "pieces": ["<every piece in the build after this change>"]\n}' + PIECES_ASK}])
    return _call([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user + "\n\n" + SHAPE}])


CHECK = """You are reviewing a build plan against the participant's own Sit-Down. Context you must not flag: the
Databricks Apps piece is ALWAYS built with Genie App Builder (Apps > Build tab, from a plain description of the
screens); naming it is correct and required. Declarative Pipelines, Genie, AI/BI Dashboards and Lakebase are
Databricks products. List concrete problems only:
- a fact they stated (number, target, deadline, role, device, essential component, worry) missing or changed
- something in Today's scope missing from the plan, or something from Later/parked presented as built today
- invented data, tables or columns not in the data plan; generated data presented as real
- a piece used that is not in the build's list, or an AI agent / document Q&A anywhere
- an essential step with no piece to do it (e.g. ranking with no pipeline rule), or a success measure today's build can't measure
- vague or generic sections that ignore their specifics
- the data grain and keys can't support the decision (e.g. a per-rep list with no rep column; a daily decision
  log keyed without the date so one decision blocks every later day; no way to scope to the user's own sites)
- time-sensitive logic (age, SLA, "right now", "this week") that breaks on static sample data: generated data
  must be relative to today's date, or the metric computed at read time
- a dashboard or Genie space reading Lakebase directly (they read Unity Catalog gold tables; leave Lakebase-only
  metrics to the app or say how they reach a gold table)
- a step writing to Lakebase, or using any piece, when that piece is not in the build
Reply ONLY JSON: {"issues": ["<specific problem and the fix, <=30 words>", ...], "ok": true|false}"""


def check(sd: dict, plan: dict) -> list[str]:
    try:
        r = _call([{"role": "system", "content": CHECK},
                   {"role": "user", "content": _context(sd) + "\n\nTHE PLAN:\n" + json.dumps(plan, ensure_ascii=False)[:12000]}],
                  max_tokens=3000)
        return [str(x) for x in (r.get("issues") or []) if str(x).strip()][:10]
    except Exception:
        return []


def refine(sd: dict, plan: dict, issues: list[str]) -> dict:
    user = (_context(sd) + "\n\nYOUR DRAFT PLAN:\n" + json.dumps(plan, ensure_ascii=False)[:12000]
            + "\n\nA REVIEWER FOUND THESE PROBLEMS. Fix every one, change nothing else. Keep Genie App Builder as how the app is built:\n- " + "\n- ".join(issues)
            + "\n\n" + SHAPE)
    return _call([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}])


def to_blueprint(sd: dict, p: dict, components: list[str], changed: dict | None = None) -> dict:
    a = sd.get("answers") or {}
    seeded = a.get("seeded_schema", "none") not in ("", "none") if "seeded_schema" in a else bool(a.get("data_seeded (read only)"))
    spec = C.spec_for(components, "Your seeded data" if seeded else "Sample data",
                      "read-only tables" if seeded else "tables we generate for you")
    clean = lambda x: strip_em_dashes(str(x or ""))
    return {
        "archetype": "v2",
        "idea": sd.get("idea", ""),
        "capabilities": components,
        "spec": spec,
        "prd_markdown": clean(p.get("prd_markdown")),
        "flow": [{"n": f.get("n", i + 1), "title": clean(f.get("title")), "sub": clean(f.get("sub"))}
                 for i, f in enumerate(p.get("flow") or []) if isinstance(f, dict)][:4],
        "decisions": [{"tag": clean(d.get("tag")), "text": clean(d.get("text")), "tradeoff": clean(d.get("tradeoff"))}
                      for d in p.get("decisions") or [] if isinstance(d, dict) and d.get("tag") in components],
        "scope_in": [clean(x) for x in p.get("scope_in") or [] if isinstance(x, str)][:5],
        "scope_later": [clean(x) for x in p.get("scope_later") or [] if isinstance(x, str)][:4],
        "app_screens": [clean(x) for x in p.get("app_screens") or [] if isinstance(x, str)][:6] if C.APPS in components else [],
        "decisions_note": "",
        "refine_note": clean(p.get("change_note")),
        "components_changed": changed or {"added": [], "removed": [], "notes": []},
    }


def run_plan(sd: dict, job: dict, previous: dict | None = None, adjust: str = ""):
    comps = [c for c in (sd.get("capabilities") or []) if c in C.COMPONENTS] or [C.PIPELINES, C.GENIE]
    sd = {**sd, "idea": clamp_idea(sd.get("idea", ""))}
    job["stage"] = "drafting"
    p = draft(sd, previous, adjust)
    changed = None
    if adjust and isinstance(p.get("pieces"), list):
        new, notes = C.reconcile([str(x) for x in p["pieces"]], comps)
        if new != comps:
            changed = {"added": [c for c in new if c not in comps], "removed": [c for c in comps if c not in new],
                       "notes": notes}
            comps = new
            sd = {**sd, "capabilities": comps}
            if notes:                          # the rules overrode part of the model's list: redraft for the real one
                p = draft(sd, previous, adjust)
    job["stage"] = "checking"
    issues = check(sd, p)
    job["issues"] = issues
    if issues:
        job["stage"] = "refining"
        try:
            p2 = refine(sd, p, issues)
            if p2.get("prd_markdown"):
                # The internal check is not a user request: only a participant's own refine gets a "what changed".
                p = {**p2, "change_note": p.get("change_note", "") if adjust else ""}
        except Exception:
            pass
    if not adjust:
        p["change_note"] = ""
    job["blueprint"] = to_blueprint(sd, p, comps, changed)
    job["stage"] = "done"
    job["status"] = "done"


# ── jobs ──────────────────────────────────────────────────────────────────────
_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def start(sd: dict, previous: dict | None = None, adjust: str = "") -> str:
    jid = uuid.uuid4().hex
    job = {"status": "running", "stage": "queued", "t": time.time()}
    with _lock:
        _jobs[jid] = job
        for k in [k for k, j in _jobs.items() if time.time() - j["t"] > 6 * 3600]:
            _jobs.pop(k, None)

    def go():
        try:
            run_plan(sd, job, previous, adjust)
        except Exception as e:
            job["status"], job["error"] = "error", f"{type(e).__name__}: {str(e)[:200]}"
    threading.Thread(target=go, daemon=True).start()
    return jid


def status(jid: str) -> dict:
    with _lock:
        job = _jobs.get(jid)
    if not job:
        return {"status": "error", "error": "unknown job (the server may have restarted); start again"}
    return {k: job.get(k) for k in ("status", "stage", "blueprint", "error", "issues") if job.get(k) is not None}
