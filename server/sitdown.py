"""The Sit-Down — the SA pressure-test agent behind the new Shape stage.

Design for snappiness:
- Every call carries a COMPACT STATE (pinned idea, brief sections, grades, decisions,
  parked items, last exchange) instead of the whole chat history. Prompts stay short
  and roughly constant-size however long the session runs, so latency stays flat.
- One call per participant action. Each returns one JSON object whose first field is
  the short `reaction`, so the UI can stream/show it before the rest parses.
- The harness (not the model) owns state: `apply()` merges each reply deterministically.

Call types: open · turn · shapes · scope · readback. Prompt builders return OpenAI-style
message lists; callers choose the model/transport (the bench injects streaming timers).
"""
import json
import re

from .build_plan import SEEDED_DATASETS
from .jsonx import loads_tolerant
from .scope import VOICE, WORKSHOP_SCOPE

DIMS = ["problem", "user_moment", "objective", "decision", "data", "scope", "risk"]
DIM_LABEL = {"problem": "Problem", "user_moment": "User & moment", "objective": "Objective",
             "decision": "Decision it drives", "data": "Data reality", "scope": "Scope for a day",
             "risk": "Biggest risk"}
GRADES = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"]
STAGES = ["problem", "user_moment", "objective", "shapes", "scope", "readback"]
RUBRIC_HINT = {
    "problem": "what goes wrong, for whom, how often, and roughly how big (ask for THEIR number; if unsure, offer sizing cards)",
    "user_moment": "the exact role (confirm it if they mention several sites or a team), when, where and on what device (ask, never assume)",
    "objective": "a baseline today, a target and a timeframe, anchored on THEIR numbers; propose one only if they have none",
    "decision": "the one action they take right after looking, and what happens next (log it, assign it, call someone)",
    "data": "first ask what they look at today (Excel, CRM notes, logs, reports); only then map to seeded tables, and only if they fit",
    "scope": "fits one day: one screen, one job",
    "risk": "ask what worries THEM most first; capture that as the headline risk, then add a guard",
}
# Rough UI sketches the SA may attach to a build shape. The model PICKS one key (or "none");
# the frontend owns the actual lo-fi wireframe drawing, so the model never draws pixels.
SKETCHES = {
    "triage_list": "a ranked shortlist of what needs attention, click one to act",
    "dashboard": "tiles and a chart giving the whole picture at a glance",
    "ask_answer": "a plain-English question box with the answer below it",
    "explore_table": "filters over a table you drill through in your own direction",
    "approve_queue": "cards an agent drafted, each with approve or override and its reasoning",
    "none": "no preset sketch fits this one",
}
# Scope is rule-based, not model-priced. The model only maps features onto these known
# building blocks; we own the effort of each block, so packages are consistent every time.
EFFORT = {"quick": 1, "half": 2, "big": 3}          # units of a workshop day
DAY_CAPACITY = 6                                     # a comfortable one-day build
BLOCKS = {
    "synthetic_table": ("quick", "a small generated table in your own schema"),
    "genie_space": ("quick", "plain-English questions over the data"),
    "dashboard": ("quick", "a dashboard of the key numbers"),
    "decision_log": ("quick", "a Lakebase table recording each approve or change"),
    "app_screen": ("half", "one screen in the app people open"),
    "knowledge_assistant": ("half", "answers from documents"),
    "agent": ("big", "an agent that does a repeatable judge-and-draft job"),
    "not_today": (None, "needs a trained model, image recognition, or a live system connection"),
}
BUDGET = DAY_CAPACITY  # legacy name kept for the bench
OPEN_CAP = "B-"

RUBRIC = """RUBRIC (grade the IDEA, never the person; letter grades F to A+):
- problem: what is wrong today, for whom, how often, what it costs. A = specific pain with a rough size.
- user_moment: a named role and the exact moment they use it (time, place, device). A = you can picture it.
- objective: what it moves, with a metric and a baseline or target. A = measurable in weeks.
- decision: the concrete action the user takes because of it. A = one clear accept/change/act step.
- data: which real tables it reads, what must be generated. A = every input is named and exists or is planned.
- scope: fits one workshop day on the happy path. A = one screen, one job, clear v2 list.
- risk: the biggest reason it fails, with a mitigation. A = named risk plus a concrete guard.
Calibrate honestly: a one-line idea is usually D to C overall. A dimension the participant has not
addressed at all is D or lower, whatever you imagine they meant. Do not inflate. Raise a grade in the
same turn the answer earns it. Every grade below B
must come with the single next move that would raise it."""

PERSONA = """You are a senior Databricks Solutions Architect sitting down with a workshop participant to
sharpen their build idea before they build it in one day. You are warm, direct and a little
challenging, like a good SA across the table. You build on everything already decided and never
re-ask it. You keep the participant's own idea at the center: sharpen it, do not replace it.
Use the participant's own context (company, industry, currency, wording) given below or evident in their
idea. Never assume their team, company, store counts, devices, times or numbers: use what THEY say, and
ask when you need a fact.
If they are unsure or ask what you would suggest, make one concrete recommendation grounded in their
idea and the data, then let them accept or change it. Never invent their numbers: offer a target as a
suggestion to confirm, not as fact. In the brief, write what THEY said as plain fact, in
their terms. Only a value YOU propose that they have not confirmed gets "(suggested)" right after it; once
they accept it, drop the tag. Never add specifics they did not give. If they correct something you never
proposed, say so in a few words and move on; do not pretend you had suggested it."""


DEFAULT_CONTEXT = {"org": "Costa Coffee", "industry": "coffee retail", "currency": "£", "locale": "UK"}


def context_block(ctx: dict | None) -> str:
    c = ctx or {}
    if not c.get("org") and not c.get("industry"):
        return ("PARTICIPANT CONTEXT: infer it from their idea. If it gives none, assume the workshop host, "
                f"{DEFAULT_CONTEXT['org']} ({DEFAULT_CONTEXT['locale']}, {DEFAULT_CONTEXT['currency']}).")
    return (f"PARTICIPANT CONTEXT: {c.get('org') or 'their organisation'} · {c.get('industry', '')} · "
            f"currency {c.get('currency', '')} · {c.get('locale', '')} wording. Speak in their terms.")


# Columns verified against the live workshop catalog (schema dump, 2026-09-28). Only these may be
# named at column level; everything else is referred to by table, so the model can't invent columns.
SEEDED_COLUMNS = {
    "workshop.finance_ap": {
        "fact_invoices": "invoice_id, po_id, supplier_id, invoice_date, due_date, paid_date, amount, status, "
                         "days_late, is_overdue, is_duplicate"},
    "workshop.retail_commercial": {
        "fact_store_daily": "store_id, date, region, tier, format, season, is_weekend, is_holiday, transactions, "
                            "units_sold, avg_basket_value, net_sales, gross_sales, discount_rate, footfall, "
                            "conversion_rate, labour_hours, sales_per_labour_hour, competitor_active"},
}


def match_dataset(text: str) -> dict | None:
    from .build_plan import match_text
    return match_text(text or "")


def data_block(ds: dict | None) -> str:
    if not ds:
        return ("DATA: no seeded dataset matches this idea. Everything will be realistic synthetic data "
                "generated in the participant's own schema. Name the few tables it would need.")
    cols = SEEDED_COLUMNS.get(ds["schema"], {})
    col_txt = ("\nVERIFIED COLUMNS: " + "; ".join(f"{t}({c})" for t, c in cols.items()) +
               ". Name a column only if it is listed here; otherwise refer to the table.") if cols else \
              "\nColumn names are not listed: refer to tables, never invent column names."
    return (f"SEEDED DATA (read only, already exists): {ds['schema']}: {ds['tables']}.{col_txt}\n"
            "Only these tables exist. Read the list carefully before calling anything missing, and name "
            "the specific table (and column where given) the build would use. If the idea needs something "
            "not listed, say plainly that it is missing and will be generated as a small synthetic table in "
            "the participant's own schema. Never claim a table exists that is not listed, and never plan to "
            "generate data that is already seeded.")


def system_prompt(ds: dict | None) -> str:
    return "\n\n".join([PERSONA, WORKSHOP_SCOPE, VOICE, RUBRIC, data_block(ds)])


def new_state(idea: str) -> dict:
    return {"idea": idea.strip(), "north_star": idea.strip(), "stage": "problem",
            "brief": {}, "grades": {}, "decisions": [], "parked": [], "risks": [],
            "shape": None, "features": [], "last": None, "version": 1, "history": []}


def compact(state: dict) -> str:
    """What the model sees each turn. Small and stable-size on purpose."""
    view = {k: state[k] for k in ("north_star", "stage", "brief", "grades", "decisions",
                                  "parked", "shape", "pushbacks_asked") if state.get(k)}
    view["original_idea"] = state["idea"]
    if state.get("last"):
        view["last_exchange"] = state["last"]
    return json.dumps(view, ensure_ascii=False)


QUESTION_SHAPE = """{"title": "<the question, plain, <=14 words>",
   "instruction": "Pick one, or say it your way",
   "options": [{"label": "<=8 words", "sub": "<=14 words"}, ...exactly 3, grounded in THEIR idea]}"""

STAGE_GOAL = {
    "problem": "pin down the real problem: what goes wrong, where, how often, what it costs",
    "user_moment": "pin down who uses it and the exact moment (time, place, device)",
    "objective": "pin down what it moves, as a metric with a baseline or target",
}


def open_messages(state: dict, ds: dict | None) -> list:
    user = f"""The participant just shared their idea (v1):
"{state['idea']}"

Give an honest opening read. Reply with ONLY this JSON object:
{{"reaction": "<1-2 sentences: what is promising, then the one thing most missing>",
  "north_star": "<their idea restated in <=25 words, their words where possible>",
  "grades": {{<all 7 dims: "problem","user_moment","objective","decision","data","scope","risk"> : "<letter>"}},
  "next_move": "<<=15 words: the single most useful thing to sharpen first>",
  "next_question": {QUESTION_SHAPE}}}
The next_question must be about the PROBLEM ({STAGE_GOAL['problem']})."""
    return [{"role": "system", "content": system_prompt(ds)}, {"role": "user", "content": user}]


def turn_messages(state: dict, ds: dict | None, answer: dict, require_pushback: bool = False) -> list:
    """answer = {"kind": "card"|"free"|"pushback_reply"|"correction", "text": str}"""
    stage = state["stage"]
    nxt = STAGES[STAGES.index(stage) + 1] if stage in STAGES[:-1] else None
    ask_next = nxt in STAGE_GOAL
    push = ("This turn you MUST include a pushback: the sharpest question a real stakeholder "
            "(name their role) would ask about this answer, with 3 reply options."
            if require_pushback else
            "pushback is null by default. Only include one if this answer has a hole that would sink the "
            "build; a question you could simply ask next is NOT a pushback.")
    if answer["kind"] == "correction":
        framing = ("The participant says your last suggestion or pushback missed. Take their correction as "
                   "the truth, adjust, and say briefly what you changed.")
    elif answer["kind"] == "pushback_reply":
        framing = "The participant is replying to the stakeholder pushback. Judge whether it answers it."
    if answer["kind"] in ("correction", "pushback_reply"):
        framing += (f" The {DIM_LABEL.get(stage, stage)} question is still open: settle it now if what they have "
                    f"said is enough (for Objective you may suggest a target for them to confirm); otherwise "
                    f"re-ask it a different way.")
    else:
        framing = f"The participant answered the {DIM_LABEL.get(stage, stage)} question."
    cur_goal = STAGE_GOAL.get(stage, "")
    if ask_next:
        nq = (f'"next_question": {QUESTION_SHAPE}  (if this answer settles {DIM_LABEL[stage]}, ask about '
              f'{DIM_LABEL[nxt]}: {STAGE_GOAL[nxt]}. If it does NOT settle it (drift, off-topic, still vague), '
              f're-ask {DIM_LABEL[stage]} a different way: {cur_goal})')
    elif stage in STAGE_GOAL:
        nq = (f'"next_question": null if this answer settles {DIM_LABEL[stage]}; otherwise {QUESTION_SHAPE} '
              f're-asking {DIM_LABEL[stage]} a different way')
    else:
        nq = '"next_question": null'
    user = f"""SESSION STATE: {compact(state)}

{framing}
Their answer ({answer['kind']}): "{answer['text']}"

Check alignment against north_star: "on_track" if it sharpens the same idea, "reframed" if it
legitimately narrows or re-centres the same goal, "drifting" if it pulls toward a different problem.
A metric, target, sub-part or timing for the SAME problem is never drift. Drifting means a different
problem, a different user, or a different job to be done than the north_star (e.g. waste becoming staffing).
If drifting: do NOT write the new direction into the brief (section = null), name the drift kindly in
the reaction, and use the pushback to ask which one is the build.
{push}
Reply with ONLY this JSON object:
{{"reaction": "<1-2 sentences, specific to what they said>",
  "tightened": "<their answer tightened to <=15 words; '' if it was a card pick>",
  "section": {{"dim": "<one of {DIMS}>", "text": "<the brief line for that section, <=32 words>"}} | null,
    (write the {DIM_LABEL.get(stage, stage)} section whenever their answer gives you something real to
    capture, even if partial; refine it further next turn. Only leave section null if the answer added
    nothing, e.g. pure drift or 'I don't know'. Never invent detail they did not give.)
  "grades": {{<only dims whose grade changed>: "<letter>"}},
  "sharper": "<<=12 words on what got sharper, or ''>",
  "alignment": "on_track" | "reframed" | "drifting",
  "drift_note": "<if drifting: 'moving from X toward Y' <=14 words, else ''>",
  "north_star": "<ONLY if the participant chose to switch or reframe the idea: the new idea <=25 words; else ''>",
  "pushback": {{"role": "<stakeholder role>", "line": "<their question, <=25 words>",
               "options": [{{"label": "<=8 words", "sub": "<=14 words"}}, ...3]}} | null,
  {nq}}}"""
    return [{"role": "system", "content": system_prompt(ds)}, {"role": "user", "content": user}]


def shapes_messages(state: dict, ds: dict | None) -> list:
    user = f"""SESSION STATE: {compact(state)}

Offer three genuinely different ways to build THIS idea in one day (e.g. a narrow tool, an
agent that does the work for approval, a monitoring view), each true to the north_star.
For each, pick the rough UI sketch that best fits its first screen, from these keys ONLY:
{{sketch_list}}
Pick "none" if no sketch genuinely fits; do not force one.
Reply with ONLY this JSON object:
{{"reaction": "<1 sentence setting up the choice; remind them they can refine one, combine two, or describe their own>",
  "shapes": [{{"key": "<slug>", "name": "<=4 words", "one_liner": "<=18 words",
              "first_screen": "<=18 words: what they see when it opens",
              "interaction_model": "browse_act"|"monitor"|"ask"|"explore"|"agent_actions",
              "sketch": "<one sketch key above, or none>",
              "tradeoff": "<=16 words"}}, ...exactly 3],
  "recommended": "<key>", "why": "<=20 words"}}"""
    user = user.replace("{sketch_list}", "\n".join(f"- {k}: {v}" for k, v in SKETCHES.items()))
    return [{"role": "system", "content": system_prompt(ds)}, {"role": "user", "content": user}]


def refine_shape_messages(state: dict, ds: dict | None, mode: str, base: list, note: str) -> list:
    """mode: refine (adjust one) | combine (merge picks) | custom (none fit, from their words)."""
    opts = {s.get("key"): s for s in (state.get("shape_options") or [])}
    picked = [opts[k] for k in (base or []) if k in opts]
    if mode == "combine":
        intent = f"Combine these into ONE coherent one-day build: {json.dumps(picked, ensure_ascii=False)}."
    elif mode == "refine":
        intent = f"Take this build and adjust it exactly as the participant asks: {json.dumps(picked[:1], ensure_ascii=False)}."
    else:
        intent = "The offered options did not fit. Build a single shape from the participant's own description."
    sketch_keys = ", ".join(SKETCHES)
    user = f"""SESSION STATE: {compact(state)}

{intent}
Participant's words: "{note}"
Keep it true to the north_star and doable in one day. Reply with ONLY this JSON object (one shape):
{{"reaction": "<1 warm sentence reflecting what you shaped for them>",
  "shape": {{"key": "custom", "name": "<=4 words", "one_liner": "<=18 words",
            "first_screen": "<=18 words", "interaction_model": "browse_act"|"monitor"|"ask"|"explore"|"agent_actions",
            "sketch": "<one of: {sketch_keys}>", "tradeoff": "<=16 words"}}}}"""
    return [{"role": "system", "content": system_prompt(ds)}, {"role": "user", "content": user}]


def scope_messages(state: dict, ds: dict | None, custom_feature: str = "") -> list:
    extra = (f'The participant also wants their own feature: "{custom_feature}". Include it with '
             '"custom": true and classify it honestly.') if custom_feature else ""
    blocks = "\n".join(f"- {k}: {v[1]}" for k, v in BLOCKS.items())
    user = f"""SESSION STATE: {compact(state)}

List 5-7 features the chosen build shape could include, in the participant's own words. For each,
pick the ONE building block it mainly needs from this list (do not estimate effort, we know it):
{blocks}
Anything needing a trained model, image recognition, or a live connection to another system is
"not_today"; give it a one-day stand-in in "why" if one exists.
Rank them: rank 1 is the heart of the build (without it there is no build), higher ranks are nicer
to have. At least one feature must be an app_screen or dashboard people actually open. {extra}
Reply with ONLY this JSON object:
{{"reaction": "<1 sentence>",
  "features": [{{"name": "<=6 words", "block": "<block key>", "rank": <int>, "custom": true|false,
                "why": "<=14 words"}}, ...]}}"""
    return [{"role": "system", "content": system_prompt(ds)}, {"role": "user", "content": user}]


def readback_messages(state: dict, ds: dict | None) -> list:
    user = f"""SESSION STATE: {compact(state)}

Read it back before they build. Keep the user and moment exactly as decided in the brief. List every
seeded table the build reads. Grades must reflect the whole brief as it now stands.
Reply with ONLY this JSON object (reaction FIRST so it can show while the rest loads):
{{"reaction": "<1 warm sentence handing it back: what got sharpest since v1>",
  "who": "<=16 words", "what": "<=20 words", "worked_if": "<=16 words, measurable",
  "north_star": "<updated idea statement <=25 words, still their idea>",
  "grades": {{<all 7 dims>: "<letter>"}},
  "risks": [{{"risk": "<=14 words", "mitigation": "<=16 words"}}, ...1-3],
  "parked": ["<=8 words", ...],
  "data_plan": {{"seeded": ["<table>", ...], "generate": ["<table: purpose>", ...]}},
  "fits": {{"Genie": "<=14 words: what Genie does in THIS build",
           "Supervisor agent": "<=14 words: the one repeatable job it does here",
           "Lakebase": "<=14 words: what it records here",
           "Databricks Apps": "<=14 words: the screen people open"}}}}"""
    return [{"role": "system", "content": system_prompt(ds)}, {"role": "user", "content": user}]


# ── harness guards: fix the model's known failure modes in code, not prose ─────

def _toks(t: str) -> set:
    return set(re.findall(r"[a-z]{4,}", (t or "").lower()))


def _strip_dashes(o):
    if isinstance(o, str):
        return o.replace(" \u2014 ", ", ").replace("\u2014", ", ")
    if isinstance(o, list):
        return [_strip_dashes(x) for x in o]
    if isinstance(o, dict):
        return {k: _strip_dashes(v) for k, v in o.items()}
    return o


def guard(state: dict, kind: str, out: dict | None, answer: dict | None = None,
          require_pushback: bool = False) -> dict | None:
    """Run on every reply before the UI or state sees it."""
    if not isinstance(out, dict):
        return out
    out = _strip_dashes(out)
    if kind == "turn":
        # A card the participant picked was OFFERED by us, so it cannot be drift.
        if (answer or {}).get("kind") == "card" and out.get("alignment") == "drifting":
            out["alignment"], out["drift_note"] = "on_track", ""
        # Never repeat a pushback (unless this turn requires one and it's the only one we have).
        pb = out.get("pushback")
        if isinstance(pb, dict) and pb.get("line") and not require_pushback:
            new = _toks(pb["line"])
            for old in state.get("pushbacks_asked", []):
                prev = _toks(old)
                if new and prev and len(new & prev) / len(new | prev) > 0.45:
                    out["pushback"] = None
                    break
    return out


# ── parsing + deterministic state updates ─────────────────────────────────────

def parse(text: str) -> dict | None:
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    s, e = t.find("{"), t.rfind("}")
    if s == -1 or e <= s:
        return None
    try:
        return loads_tolerant(t[s:e + 1])
    except Exception:
        return None


def _grades(state, g):
    for k, v in (g or {}).items():
        if k in DIMS and v in GRADES:
            state["grades"][k] = v


def apply(state: dict, kind: str, out: dict, answer: dict | None = None) -> dict:
    """Merge one model reply into state. Harness-owned, so a sloppy reply can't corrupt it."""
    if not out:
        return state
    _grades(state, out.get("grades"))
    if kind == "open":
        state["north_star"] = out.get("north_star") or state["north_star"]
        cap = GRADES.index(OPEN_CAP)   # a v1 idea has headroom everywhere; the climb is the point
        state["grades"] = {k: (v if GRADES.index(v) <= cap else OPEN_CAP) for k, v in state["grades"].items()}
        out["grades"] = dict(state["grades"])
    elif kind == "turn":
        sec = out.get("section") or {}
        if out.get("alignment") != "drifting" and sec.get("dim") in DIMS and sec.get("text"):
            state["brief"][sec["dim"]] = sec["text"]
        if out.get("alignment") == "drifting" and out.get("drift_note"):
            state["parked"].append(out["drift_note"])
        if (out.get("north_star") or "").strip() and out.get("alignment") != "drifting":
            state["north_star"] = out["north_star"].strip()
        state["last"] = {"answer": (answer or {}).get("text", ""), "reaction": out.get("reaction", ""),
                         "pushback": (out.get("pushback") or {}).get("line", "")}
        pending_push = bool(out.get("pushback"))
        if pending_push and (out["pushback"] or {}).get("line"):
            state.setdefault("pushbacks_asked", []).append(out["pushback"]["line"])
        # Advance only when this stage's section is actually settled; otherwise the SA re-asks it.
        settled = state["stage"] not in STAGE_GOAL or bool(state["brief"].get(state["stage"]))
        if settled and not pending_push and state["stage"] in STAGES[:-1]:
            state["stage"] = STAGES[STAGES.index(state["stage"]) + 1]
        state["version"] += 1
    elif kind == "shapes":
        state["shape_options"] = out.get("shapes") or []
        choose_shape(state, out.get("recommended"))
    elif kind == "scope":
        feats = [f for f in (out.get("features") or []) if isinstance(f, dict) and f.get("name")]
        for f in feats:
            if f.get("block") not in BLOCKS:
                f["block"] = "app_screen"
        state["features"] = feats
        out.update(build_packages(feats))
        apply_package(state, "recommended")
        out["features"] = state["features"]
    elif kind == "readback":
        state["north_star"] = out.get("north_star") or state["north_star"]
    if "history" in state:
        state["history"].append({"kind": kind, "answer": answer, "out": out})
    return state


def _set_decision(state: dict, prefix: str, text: str):
    state["decisions"] = [d for d in state["decisions"] if not d.startswith(prefix)] + [prefix + text]


def choose_shape(state: dict, key: str | None) -> dict:
    opts = state.get("shape_options") or []
    pick = next((s for s in opts if s.get("key") == key), opts[0] if opts else None)
    return set_shape(state, pick)


def set_shape(state: dict, shape: dict | None) -> dict:
    """Set the chosen build shape (a picked, refined, combined or custom one) and advance."""
    state["shape"] = shape
    _set_decision(state, "Build shape: ", (shape or {}).get("name", "?"))
    state["stage"] = "scope"
    return state


def _effort(f: dict) -> int:
    tier = BLOCKS.get(f.get("block"), ("half",))[0]
    return EFFORT.get(tier, 0) if tier else 0


def fit_label(units: int) -> str:
    return "Comfortable" if units <= DAY_CAPACITY - 1 else "Tight" if units <= DAY_CAPACITY else "Won't fit today"


def build_packages(features: list) -> dict:
    """Lean / Recommended / Bold from ranked features. Pure code, same answer every time.
    Bold never refuses: it keeps the core in Today and moves the rest to Stretch, in order."""
    doable = sorted([f for f in features if BLOCKS.get(f.get("block"), (1,))[0]],
                    key=lambda f: (not f.get("essential"), f.get("rank", 99)))   # essentials first, always in today
    later = [f["name"] for f in features if f not in doable]

    def fill(cap):
        today, used = [], 0
        for f in doable:                       # strict rank order: core first, stop at the first misfit
            if today and used + _effort(f) > cap and not f.get("essential"):
                break
            today.append(f["name"]); used += _effort(f)
        return today, used

    lean, lu = fill(3)
    rec, ru = fill(DAY_CAPACITY)
    names = [f["name"] for f in doable]
    pk = lambda key, label, blurb, today, stretch: {
        "key": key, "label": label, "blurb": blurb, "today": today, "stretch": stretch,
        "later": [n for n in names if n not in today and n not in stretch] + later,
        "units": sum(_effort(f) for f in doable if f["name"] in today),
        "fit": fit_label(sum(_effort(f) for f in doable if f["name"] in today))}
    return {"recommended": "recommended", "packages": [
        pk("lean", "Lean", "Just the heart of it. Done with time to spare.", lean, []),
        pk("recommended", "Recommended", "A full, finished day.", rec, []),
        pk("bold", "Bold", "Everything doable, core first, then stretch.", rec,
           [n for n in names if n not in rec]),
    ]}


def set_features(state: dict, features: list) -> dict:
    """Lanes are the truth: each feature has lane today | stretch | later. Idempotent."""
    old = {f.get("name") for f in state.get("features") or []}
    for f in features:
        if not BLOCKS.get(f.get("block"), (1,))[0]:
            f["lane"] = "later"                       # not doable in a day, whatever was dragged
        f.setdefault("lane", "later")
        f["effort"] = BLOCKS.get(f.get("block"), ("half",))[0]
    state["features"] = features
    today = [f for f in features if f["lane"] == "today"]
    state["day_units"] = sum(_effort(f) for f in today)
    state["fit"] = fit_label(state["day_units"])
    if today:
        state.setdefault("brief", {})["scope"] = ("Today: " + ", ".join(f["name"] for f in sorted(today, key=lambda f: f.get("rank", 99)))
                                               + (". Stretch after the core." if any(f["lane"] == "stretch" for f in features) else "."))
        state.setdefault("grades", {})["scope"] = {"Comfortable": "A-", "Tight": "B", "Won't fit today": "C"}[state["fit"]]
    rank = lambda f: f.get("rank", 99)
    _set_decision(state, "Build today: ", ", ".join(f["name"] for f in sorted(today, key=rank)))
    stretch = [f["name"] for f in sorted(features, key=rank) if f["lane"] == "stretch"]
    state["decisions"] = [d for d in state["decisions"] if not d.startswith("Stretch, after the core: ")]
    if stretch:
        state["decisions"].append("Stretch, after the core: " + ", ".join(stretch))
    state["parked"] = [p for p in state["parked"] if p not in old] + [f["name"] for f in features if f["lane"] == "later"]
    state["stage"] = "readback"
    return state


def apply_package(state: dict, key: str) -> dict:
    pkgs = {p["key"]: p for p in build_packages(state.get("features") or [])["packages"]}
    p = pkgs.get(key) or pkgs["recommended"]
    feats = [dict(f) for f in state.get("features") or []]
    for f in feats:
        f["lane"] = "today" if f["name"] in p["today"] else "stretch" if f["name"] in p["stretch"] else "later"
    state["package"] = p["key"]
    return set_features(state, feats)


# ── handoff into the existing Build Studio flow (lands on its Learn step) ─────

def to_studio(state: dict, rb: dict) -> dict:
    """Translate a finished Sit-Down into Build Studio state. Everything downstream (Learn,
    Blueprint, Build, PROJECT.md) already reads idea + design_answers + plan.capabilities, so
    we speak that language instead of adding a parallel path."""
    rb = rb or {}
    brief = state.get("brief") or {}
    shape = state.get("shape") or {}
    feats = state.get("features") or []
    lane = lambda l: [f["name"] for f in sorted(feats, key=lambda f: f.get("rank", 99)) if f.get("lane") == l]
    north = rb.get("north_star") or state.get("north_star") or state.get("idea", "")
    idea = "\n\n".join(x for x in [
        north,
        f"Who: {rb['who']}" if rb.get("who") else "",
        f"What: {rb['what']}" if rb.get("what") else "",
        f"It worked if: {rb['worked_if']}" if rb.get("worked_if") else "",
    ] if x)
    dp = rb.get("data_plan") or {}
    answers = {
        "interaction_model": shape.get("interaction_model", ""),
        "build_shape": f"{shape.get('name', '')}: {shape.get('one_liner', '')} First screen: {shape.get('first_screen', '')}".strip(": "),
        **{f"brief_{k}": v for k, v in brief.items() if v},
        "build_today (core first, in order)": "; ".join(lane("today")),
        "stretch (only after the core works)": "; ".join(lane("stretch")),
        "saved_for_later (do NOT build today)": "; ".join(lane("later") + [p for p in state.get("parked") or [] if p not in lane("later")]),
        "data_seeded (read only)": ", ".join(dp.get("seeded") or []),
        "data_to_generate (own schema)": "; ".join(dp.get("generate") or []),
        "risks": "; ".join(f"{r.get('risk')} (guard: {r.get('mitigation')})" for r in rb.get("risks") or [] if isinstance(r, dict)),
        "facts the participant stated (honour exactly)": "; ".join(state.get("facts") or []),
        "watch-outs (plan around these)": "; ".join(rb.get("gaps") or []),
    }
    answers = {k: v for k, v in answers.items() if v}
    fits = rb.get("fits") or {}
    caps = [{"name": n, "selected": True, "fits": fits.get(n, "")} for n in
            ("Genie", "Supervisor agent", "Lakebase", "Databricks Apps")]
    if any(f.get("block") == "knowledge_assistant" and f.get("lane") == "today" for f in feats):
        caps.append({"name": "Knowledge Assistant", "selected": True, "fits": "answers from your documents"})
    return {
        "phase": "learn",
        "idea": idea,
        "projectName": shape.get("name", ""),
        "answers": answers,
        "answersOther": {},
        "plan": {"read_back": rb.get("reaction", ""), "questions": [], "capabilities": caps},
        "planRequested": True,
        "sitdown": {"grades": rb.get("grades") or state.get("grades"), "decisions": state.get("decisions"),
                    "version": state.get("version")},
    }
