"""The Sit-Down as a real conversational agent.

One agent, one conversation. The SA replies in plain chat prose (streams natively) and drives
all UI through tool calls: option cards, brief updates, grades, pushback, drift, shapes, scope,
read-back. The participant can pick cards or just type, at any point.

Context management (small, effective agent):
- STATE IS WORKING MEMORY. The harness owns a compact state (north star, brief, grades,
  decisions, parked, stage). It is injected fresh every turn, never accumulated in the transcript.
- TINY TOOL RESULTS. Tools only render UI / update state; the harness applies them. No second
  round-trip, so every participant message is exactly one model call.
- ROLLING WINDOW. Only the last WINDOW exchanges go verbatim; older ones are covered by the brief.
- STABLE PREFIX. The system prompt is static per dataset (cache-friendly); state comes after.
- CODE GUARDS. Stage gating, no repeated pushbacks, card picks are never drift, em-dash
  stripping, open-grade cap, deterministic scope packages: all enforced here, not in prose.
"""
import json
import re

from . import sitdown as sd
from .scope import CHAT_VOICE, VOICE, WORKSHOP_SCOPE

WINDOW = 12         # verbatim messages kept (user + assistant); older facts live in the ledger
SHAPE_KEYS = ["browse_act", "monitor", "ask", "explore", "agent_actions"]

# The conversation keeps going until every rubric dimension is covered (scope is filled by the
# scope step itself). Focus = first missing dim, else the weakest one still under the bar.
CONVO_DIMS = ["problem", "user_moment", "objective", "decision", "data", "risk"]
COVER_BAR = "C+"
FLOW = CONVO_DIMS + ["shapes", "scope", "readback"]
FLOW_LABEL = {**sd.DIM_LABEL, "shapes": "Ways to build it", "scope": "Fit it in a day", "readback": "Your plan"}

# A rotating cast. The harness decides who appears and when; the model writes their line.
# Six fixed character DRAWINGS (avatars). Who they are is generated per idea (see cast.py);
# this generic cast is only the fallback when generation hasn't landed or failed.
AVATARS = ["data_engineer", "finance", "store_manager", "governance", "platform", "regional_ops"]
DEFAULT_CAST = {
    "data_lead": {"avatar": "data_engineer", "name": "Arjun", "role": "Data engineer",
                  "voice": "precise; asks where data lives, how it joins and how fresh it is", "dims": ["data", "risk", "decision"]},
    "finance": {"avatar": "finance", "name": "Marcus", "role": "Finance lead",
                "voice": "blunt about money; wants the cost figure and how it's measured", "dims": ["objective", "problem"]},
    "frontline": {"avatar": "store_manager", "name": "Jo", "role": "Frontline user",
                  "voice": "practical and time-pressed; how does this fit my day?", "dims": ["user_moment", "decision", "problem"]},
    "governance": {"avatar": "governance", "name": "Amara", "role": "Governance lead",
                   "voice": "careful; who can see what, and what goes wrong if it's wrong", "dims": ["risk", "data"]},
    "platform": {"avatar": "platform", "name": "Tom", "role": "IT and platform owner",
                 "voice": "thinks about who owns and maintains it after the workshop", "dims": ["risk", "data"]},
    "ops_leader": {"avatar": "regional_ops", "name": "Sam", "role": "Operations leader",
                   "voice": "thinks about rollout across teams and how leaders will use it", "dims": ["objective", "decision", "user_moment"]},
}
CAST = DEFAULT_CAST   # legacy alias


def cast_of(st: dict) -> dict:
    return st.get("cast") or DEFAULT_CAST
TONES = {"challenge": "pokes the weakest assumption in their answer",
         "curious": "likes it but asks how it would actually work",
         "excited": "loves it and asks the one thing that would make it land"}

PLAYBOOK = """HOW THE SIT-DOWN RUNS (you steer, the participant can always type freely):
Sharpen first, then build. Sharpening covers every rubric dimension in turn: problem, user_moment,
objective, decision, data, risk. The harness tells you the current FOCUS each turn; work on it,
and each time you learn something, call update_brief to write or sharpen that section (even partly).
Then: shapes (offer_shapes), scope (propose_scope, you never estimate effort), readback (read_back).
WHAT A BUILD CAN USE: Declarative Pipelines (bronze/silver/gold tables, including rules that score, flag or
draft a suggestion per item), Genie, AI/BI Dashboards, Lakebase (records decisions) and a Databricks App.
No AI agents, no document Q&A, no trained ML models: if the idea needs one, find the one-day version with
these pieces (rules in the pipeline instead of an agent) and park the rest.
Every reply: 1-3 short sentences of plain chat FIRST (no lists, no headings, no markdown), then tools.
While sharpening, end every reply with EITHER present_options (your next question, exactly 3 options
grounded in THEIR idea; they may pick several or type) OR, when the harness asks, a stakeholder moment.
OPTIONS ARE ANSWERS, NOT WAYS TO ANSWER. Every option is a concrete, specific answer they could give
(never meta-choices like "use a rough figure", "skip this for now", "estimate it", "generate a table").
For any number (baseline, target, size, cost, time), offer three realistic ranges for THEIR industry,
e.g. "30 to 45 minutes today", "$50 to $150 per delay minute". It is fine to assume; they can type the
exact figure. When they pick an option, take it as their answer and move on: never ask a follow-up just
to refine an option they picked.
For options that genuinely shape the build, add a short 'consider' line (the key tradeoff); leave it
empty for simple factual questions.
If they type something that combines or reframes your options, work with it; that is the point.
If they say "not sure", trail off, or a message cuts off mid-number, follow up on the SAME point with
concrete cards (or ask for the missing value) before moving on. Never re-ask something already settled.
If they mention a different team, role or domain than the brief assumes, check which they mean at once.
If they say they want to skip ahead or move on, stop asking: fill any gaps as (suggested) and offer_shapes.
Seeded tables are a resource, not the answer: if their domain doesn't fit them, ignore them and plan
generated data that mirrors what they use today.
If what they say pulls toward a different problem, user or job than the north star, call flag_drift
and ask which is the build. A new metric, target or detail of the SAME problem is not drift.
Grades: call set_grades whenever a dimension's grade genuinely changes (only changed dims), with a
short 'sharper' line naming what improved. On the very first reply, grade all seven honestly."""

TOOLS = [
    {"name": "present_options", "desc": "Show your next question as answer cards under your message.",
     "props": {"question": {"type": "string", "description": "<=14 words"},
               **{f"option_{i}": {"type": "string", "description": "card label, <=8 words"} for i in (1, 2, 3)},
               **{f"option_{i}_sub": {"type": "string", "description": "<=14 words"} for i in (1, 2, 3)},
               **{f"option_{i}_consider": {"type": "string", "description": "<=12 words: the key tradeoff of this "
                  "choice. Only when the choice shapes the build; else empty"} for i in (1, 2, 3)}},
     "req": ["question", "option_1", "option_2", "option_3"]},
    {"name": "ask_open", "desc": "Ask a question only THEY can answer (their number, target, worry) with no cards, so they type it in their words.",
     "props": {"question": {"type": "string", "description": "<=18 words, plain and specific"},
               "hint": {"type": "string", "description": "<=12 words: an example of the kind of answer, e.g. 'like: about 30 items a day'"}},
     "req": ["question"]},
    {"name": "update_brief", "desc": "Write or sharpen one brief section from what they have said. Never invent detail.",
     "props": {"dim": {"type": "string", "enum": sd.DIMS},
               "text": {"type": "string", "description": "<=40 words, their facts as plain fact; only YOUR unconfirmed proposals get '(suggested)'"},
               "facts": {"type": "array", "items": {"type": "string"},
                         "description": "new specific facts THEY stated this turn, each <=12 words in their terms "
                                        "(numbers, targets, deadlines, roles, devices, components they called essential, worries)"},
               "resolves": {"type": "array", "items": {"type": "integer"},
                            "description": "numbers of the key unknowns this turn answered (see key_unknowns)"}},
     "req": ["dim", "text"]},
    {"name": "set_grades", "desc": "Update letter grades for dimensions that changed.",
     "props": {"grades": {"type": "object", "description": "dim -> letter (F..A+)",
                          "additionalProperties": {"type": "string", "enum": sd.GRADES}},
               "sharper": {"type": "string", "description": "<=12 words on what got sharper"}},
     "req": ["grades"]},
    {"name": "plan_unknowns", "desc": "On your FIRST reply only: the 3-5 key unknowns specific to THIS idea that must be answered for it to be buildable (e.g. 'what counts as an early sign of slipping', 'how loyalty is defined').",
     "props": {**{f"unknown_{i}": {"type": "string", "description": "<=14 words, a question"} for i in range(1, 6)},
               **{f"unknown_{i}_dim": {"type": "string", "enum": CONVO_DIMS} for i in range(1, 6)}},
     "req": ["unknown_1", "unknown_1_dim", "unknown_2", "unknown_2_dim", "unknown_3", "unknown_3_dim"]},
    {"name": "update_north_star", "desc": "Restate the idea when it has been sharpened, reframed or switched.",
     "props": {"text": {"type": "string", "description": "<=25 words, their idea"}}, "req": ["text"]},
    {"name": "advance_stage", "desc": "Move to the next stage once the current one is settled.",
     "props": {"to": {"type": "string", "enum": sd.STAGES}}, "req": ["to"]},
    {"name": "stakeholder", "desc": "Bring a colleague into the conversation for one line, with 3 replies.",
     "props": {"persona": {"type": "string", "description": "the colleague key named in THIS TURN YOU MUST"},
               "tone": {"type": "string", "enum": list(TONES)},
               "line": {"type": "string", "description": "<=25 words, in their voice, about the current focus"},
               **{f"option_{i}": {"type": "string", "description": "reply card, <=8 words"} for i in (1, 2, 3)},
               **{f"option_{i}_sub": {"type": "string", "description": "<=14 words"} for i in (1, 2, 3)}},
     "req": ["persona", "tone", "line", "option_1", "option_2", "option_3"]},
    {"name": "flag_drift", "desc": "Their answer pulls toward a different problem, user or job.",
     "props": {"note": {"type": "string", "description": "'moving from X toward Y', <=14 words"}}, "req": ["note"]},
    {"name": "offer_shapes", "desc": "Three genuinely different ways to build it in one day (shapes a, b, c).",
     "props": {**{f"shape_{x}_{f}": spec for x in "abc" for f, spec in [
                   ("name", {"type": "string", "description": "<=4 words"}),
                   ("one_liner", {"type": "string", "description": "<=18 words"}),
                   ("first_screen", {"type": "string", "description": "<=18 words: what they see when it opens"}),
                   ("interaction_model", {"type": "string", "enum": SHAPE_KEYS}),
                   ("sketch", {"type": "string", "enum": list(sd.SKETCHES)}),
                   ("tradeoff", {"type": "string", "description": "<=16 words"})]},
               "recommended": {"type": "string", "enum": ["a", "b", "c"]},
               "why": {"type": "string", "description": "<=20 words"}},
     "req": [f"shape_{x}_{f}" for x in "abc" for f in ("name", "one_liner", "first_screen", "interaction_model", "sketch")]
            + ["recommended"]},
    {"name": "propose_scope", "desc": "Features for the chosen shape, mapped to building blocks and ranked.",
     "props": {"features": {"type": "array", "items": {"type": "string"},
                            "description": "5-7 lines, each exactly 'name | block | why' in rank order (first = heart of "
                                           "the build). name <=6 words in their words; block is one of: "
                                           + ", ".join(sd.BLOCKS) + "; why <=14 words. Start the name with '!' for a "
                                           "component they called essential or their top worry, '*' for a feature they asked for."}},
     "req": ["features"]},
    {"name": "read_back", "desc": "Hand the plan back before they build.",
     "props": {"who": {"type": "string"}, "what": {"type": "string"}, "worked_if": {"type": "string"},
               "north_star": {"type": "string"},
               "grades": {"type": "object", "additionalProperties": {"type": "string", "enum": sd.GRADES}},
               "risks": {"type": "array", "items": {"type": "object", "properties": {
                   "risk": {"type": "string"}, "mitigation": {"type": "string"}}}},
               "data_plan": {"type": "object", "properties": {
                   "seeded": {"type": "array", "items": {"type": "string"}},
                   "generate": {"type": "array", "items": {"type": "string"}}}},
               "gaps": {"type": "array", "items": {"type": "string"},
                        "description": "honest watch-outs: anything the plan depends on that is NOT in today's scope or the "
                                       "data (e.g. 'no budget source yet: generate a planned-hours table'). Empty if none."},
               "fits": {"type": "object", "description": "for each component this build uses (Declarative Pipelines, Genie, AI/BI Dashboards, Lakebase, Databricks Apps): <=14 words on its job here",
                        "additionalProperties": {"type": "string"}},
               **{f"brief_{d}": {"type": "string", "description": f"FINAL consolidated {d} section, <=40 words, consistent "
                                 "with every later decision, their facts verbatim, (suggested) only on unconfirmed proposals"}
                  for d in sd.DIMS}},
     "req": ["who", "what", "worked_if", "data_plan", "fits"] + [f"brief_{d}" for d in sd.DIMS]},
]


def tool_specs() -> list:
    return [{"type": "function", "function": {"name": t["name"], "description": t["desc"],
             "parameters": {"type": "object", "properties": t["props"], "required": t["req"]}}}
            for t in TOOLS]


def system_prompt(ds, st: dict | None = None) -> str:
    return "\n\n".join([sd.PERSONA, sd.context_block((st or {}).get("context")), WORKSHOP_SCOPE, VOICE, CHAT_VOICE, sd.RUBRIC, sd.data_block(ds), PLAYBOOK,
                        "Sketch keys for offer_shapes: " + "; ".join(f"{k} = {v}" for k, v in sd.SKETCHES.items()),
                        "Building blocks for propose_scope: " + "; ".join(f"{k} = {v[1]}" for k, v in sd.BLOCKS.items())])


def new_session(idea: str) -> dict:
    st = sd.new_state(idea)
    st.pop("history", None)
    st["messages"] = []
    st["pending"] = None     # what's on screen awaiting a reply: options | pushback | shapes | scope
    return st


def _state_view(st: dict) -> str:
    view = {k: st[k] for k in ("north_star", "stage", "brief", "grades", "decisions", "parked",
                                "pushbacks_asked") if st.get(k)}
    view["original_idea"] = st["idea"]
    if st.get("unknowns"):
        view["key_unknowns"] = [f"{i + 1}. [{'answered' if u['resolved'] else 'OPEN'}] {u['q']} ({u['dim']})"
                                for i, u in enumerate(st["unknowns"])]
    if st.get("facts"):
        view["facts_they_stated"] = st["facts"]      # never lose these; honour them in brief, scope and readback
    if st.get("shape"):
        view["chosen_shape"] = {k: st["shape"].get(k) for k in ("name", "one_liner", "interaction_model")}
    if st.get("features"):
        view["scope"] = [{"name": f["name"], "lane": f.get("lane")} for f in st["features"]]
    return json.dumps(view, ensure_ascii=False)


def focus(st: dict) -> str | None:
    """Next rubric dim to work on. Stay on the current one until it reaches the bar (max 3 turns, for
    momentum), then the first missing one, then the weakest under the bar. None = ready to build."""
    bar = sd.GRADES.index(COVER_BAR)
    cur = st.get("stage")
    open_here = any(u["dim"] == cur and not u["resolved"] for u in st.get("unknowns", []))
    if cur in CONVO_DIMS and st.get("dim_turns", {}).get(cur, 0) < 3 and (
            not st["brief"].get(cur) or sd.GRADES.index(st["grades"].get(cur, "F")) < bar or open_here):
        return cur
    for d in CONVO_DIMS:
        if not st["brief"].get(d):
            return d
    bar = sd.GRADES.index(COVER_BAR)
    weak = [(sd.GRADES.index(st["grades"].get(d, "F")), d) for d in CONVO_DIMS
            if sd.GRADES.index(st["grades"].get(d, "F")) < bar]
    return min(weak)[1] if weak else None


OPEN_PROMPT = {
    "objective": "ask, in plain words, what number would tell them this worked: where it is today and where they want it, by when.",
    "risk": "ask what worries THEM most about this working in real life.",
    "problem": "ask how often it happens and roughly how big it is, in their own numbers.",
}


def needs_open(st: dict, dim: str) -> bool:
    """Forced open questions are OFF by product decision (2026-09-30): concrete assumed ranges on cards keep
    the conversation moving, and the chat bar catches anyone who knows the exact figure. ask_open stays
    available for the model to use when no sensible ranges exist."""
    return False
    if dim not in OPEN_PROMPT or dim in st.get("open_asked", []):
        return False
    if dim == "problem":       # only if their problem still has no size after the first exchange
        return st.get("dim_turns", {}).get("problem", 0) >= 1 and not re.search(r"\d", st["brief"].get("problem", ""))
    return True


def pick_cast(st: dict, dim: str) -> tuple[str, str] | None:
    """Every ~2nd sharpening turn a colleague drops in, matched to the focus, never the same one twice
    running. Tone follows the moment: challenge the weak spots, curious on how-it-works, excited when it's strong."""
    turns = len(st["messages"]) // 2
    last_turn = st.get("cast_last_turn", -99)
    must = (dim in ("objective", "risk") and dim not in st.get("cast_dims", [])
            and st.get("dim_turns", {}).get(dim, 0) >= 1)
    if turns == 0 or (turns - last_turn < 2 and not must) or needs_open(st, dim):
        return None
    seen = st.get("cast_seen", [])
    cast = cast_of(st)
    fits = [k for k, c in cast.items() if dim in c.get("dims", [])] or list(cast)
    fresh = [k for k in fits if k not in seen[-1:]] or fits
    fresh.sort(key=lambda k: seen.count(k))                       # least-seen first
    who = fresh[0]
    tones_used = st.get("cast_tones", [])
    if dim in ("objective", "risk") and (dim, "challenge") not in st.get("cast_moments", []):
        tone = "challenge"                                         # the two places a real poke matters most
    else:
        grades = [sd.GRADES.index(v) for v in st["grades"].values()] or [0]
        strong = sum(grades) / len(grades) >= sd.GRADES.index("C+")
        allowed = ["curious", "challenge"] + (["excited"] if strong else [])
        tone = min(allowed, key=lambda t: (tones_used.count(t), allowed.index(t)))
    return who, tone


def turn_contract(st: dict, meta: dict | None = None) -> str:
    """What this turn MUST do, stated right before their message (models follow recent instructions best)."""
    meta = meta or {}
    stg = st["stage"]
    first = not st["messages"]
    if stg in CONVO_DIMS:
        if meta.get("wrap_up"):
            missing = [sd.DIM_LABEL[d] for d in CONVO_DIMS if not st["brief"].get(d)]
            return ("THE PARTICIPANT WANTS TO MOVE ON. THIS TURN YOU MUST: one sentence of chat; update_brief for "
                    f"every missing section ({', '.join(missing) or 'none'}) with a sensible line marked 'suggested:'; "
                    "set_grades for those; then offer_shapes. Call the tools in the same reply as your chat.")
        f = focus(st) or stg
        need = ["1-3 sentences of chat first",
                "update_brief for any section their words let you write or sharpen",
                "set_grades for EVERY dimension whose grade changed" + (" (first reply: grade all seven)" if first else "")]
        if first:
            need.insert(1, "update_north_star with their idea restated in <=25 words")
            # (the key unknowns are planned in the background with the cast, so the opening reply stays light)
        open_u = [f"{i + 1}. {u['q']}" for i, u in enumerate(st.get("unknowns", [])) if not u["resolved"] and u["dim"] == f]
        if open_u:
            need.append(f"aim your question at this open key unknown: {open_u[0]} (mark it in update_brief.resolves once answered)")
        cast = pick_cast(st, f)
        if needs_open(st, f):
            need.append(f"ask_open: {OPEN_PROMPT[f]} No present_options this turn")
            cast = None
        elif cast:
            who, tone = cast
            c = cast_of(st)[who]
            need.append(f"stakeholder: bring in {c['name']}, the {c['role']} (persona '{who}', tone '{tone}': "
                        f"{TONES[tone]}; their voice: {c['voice']}), one line about {sd.DIM_LABEL[f]} "
                        f"({sd.RUBRIC_HINT.get(f, '')}), with 3 reply options. No present_options this turn")
            st["_cast_planned"] = [who, f]
        if not cast and not needs_open(st, f):
            need.append(f"present_options: your next question with exactly 3 CONCRETE answer options, realistic ranges for numbers (FOCUS: {sd.DIM_LABEL[f]}: "
                        f"{sd.RUBRIC_HINT.get(f, '')})")
        covered = [sd.DIM_LABEL[d] for d in CONVO_DIMS if st["brief"].get(d)]
        return ("THIS TURN YOU MUST: " + "; ".join(need) + ". Call the tools in the same reply as your chat.\n"
                f"Covered so far: {', '.join(covered) or 'nothing yet'}. Still to cover or strengthen: "
                f"{', '.join(sd.DIM_LABEL[d] for d in CONVO_DIMS if d not in [x for x in CONVO_DIMS if st['brief'].get(x)]) or 'only weak grades'}.")
    if stg == "shapes":
        need = ["one sentence of chat", "offer_shapes (three genuinely different one-day builds)"]
    elif stg == "scope":
        dec = st["brief"].get("decision", "(not set)")
        obj = st["brief"].get("objective", "(not set)")
        need = ["one sentence of chat", "propose_scope (5-7 features mapped to blocks, ranked): rank 1 and marked '!' "
                f"is the feature that delivers their Decision ({dec}); anything needed to measure their Objective ({obj}) "
                "is marked '!' too; include every component they called essential (see facts_they_stated); keep the core "
                "logic (detection, ranking, matching) in, never park the thing that makes it work; any feature they never "
                "discussed must have a why starting 'Suggested:'; never claim a column exists unless it is listed"]
    else:
        need = ["one or two warm sentences marking the moment",
                "read_back with a CONSOLIDATED brief_* for all seven sections (rewrite each so it matches every later "
                "decision: descoped items removed, agreed items present; the risk section names the risk, the mitigation "
                "goes in risks; data names both seeded tables used and what is generated). Also honour facts_they_stated exactly (roles, numbers, targets, deadlines); worked_if must use the "
                "Objective section's own metric and target; risks must start with the Biggest risk section and every risk "
                "needs a real mitigation; 'what' must keep every component they called essential; never invent roles; the participant is NOT any of the colleague characters, so never call them by a colleague's name"]
    return "THIS TURN YOU MUST: " + "; ".join(need) + ". Call the tools in the same reply as your chat."


def messages(st: dict, ds, user_text: str, meta: dict | None = None) -> list:
    ctx = f"CURRENT SESSION STATE (source of truth, harness-owned): {_state_view(st)}\n{turn_contract(st, meta)}"
    if st["stage"] == "readback":
        ctx += ("\nEVERYTHING THE PARTICIPANT SAID, in order (the ground truth for the consolidated brief):\n"
                + "\n".join(f"- {x}" for x in st.get("said", [])))
    return ([{"role": "system", "content": system_prompt(ds, st)}]
            + st["messages"][-WINDOW:]
            + [{"role": "user", "content": f"{ctx}\n\nPARTICIPANT: {user_text}"}])


_NUM = re.compile(r"[£$€]?\d[\d,.]*\s*(?:%|k|m|minutes?|mins?|hours?|days?|weeks?|months?|pm|am)?", re.I)


def untag_said(text: str, st: dict) -> str:
    """Drop a '(suggested)' / 'suggested:' tag when every number it qualifies was actually said by the
    participant (or is in their facts). The model over-applies the tag to their own figures."""
    said = " ".join(st.get("said", []) + st.get("facts", [])).lower()

    def ok(seg):
        nums = [n.strip().lower() for n in _NUM.findall(seg) if n.strip()]
        return nums and all(n.rstrip(".,") in said for n in nums)

    out = re.sub(r"([^.;()]{0,60}?)\s*\((?:suggested|suggest|to confirm|tbc|confirm)\)", lambda m: m.group(1) if ok(m.group(1)) else m.group(0), text, flags=re.I)
    out = re.sub(r"([^.;()]{0,60}?),?\s+to confirm\b", lambda m: m.group(1) if ok(m.group(1)) else m.group(0), out, flags=re.I)
    out = re.sub(r"(?i)suggested:\s*([^.;]{0,80})", lambda m: m.group(1) if ok(m.group(1)) else m.group(0), out)
    return out


def repair_messages(st: dict, ds, reply_text: str) -> list:
    f = st["stage"]
    return [{"role": "system", "content": system_prompt(ds, st)},
            {"role": "user", "content": f"CURRENT SESSION STATE: {_state_view(st)}\nYou just said: \"{reply_text}\"\n"
             f"Now call present_options with your next question on {sd.DIM_LABEL.get(f, f)} "
             f"({sd.RUBRIC_HINT.get(f, '')}), exactly 3 options grounded in their idea. Do not repeat a settled question."}]


def _toks(t):
    return sd._toks(t)


def _as_list(v) -> list:
    """Models sometimes send a nested list as a JSON string, a dict, or a bare string."""
    if isinstance(v, str):
        t = v.strip()
        if t[:1] in "[{":
            try:
                v = json.loads(t)
            except Exception:
                return [t]
        else:
            return [t] if t else []
    if isinstance(v, dict):
        return list(v.values()) if all(isinstance(x, (dict, str)) for x in v.values()) else [v]
    return v if isinstance(v, list) else []


def _as_dict(v) -> dict:
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except Exception:
            return {}
    return v if isinstance(v, dict) else {}


def _options(v) -> list:
    out = []
    for o in _as_list(v):
        if isinstance(o, str):
            o = {"label": o}
        if isinstance(o, dict) and str(o.get("label") or "").strip():
            out.append({"label": sd._strip_dashes(str(o["label"])), "sub": sd._strip_dashes(str(o.get("sub") or "")),
                        "consider": sd._strip_dashes(str(o.get("consider") or ""))})
    return out[:3]


_MARKUP = re.compile(r"</?[a-zA-Z_][^>]{0,80}>")


def _clean(v):
    if isinstance(v, str):
        return _MARKUP.sub("", v).strip()
    if isinstance(v, list):
        return [_clean(x) for x in v]
    if isinstance(v, dict):
        return {k: _clean(x) for k, x in v.items()}
    return v


def normalize(calls: list) -> list:
    """Coerce every tool's args into the exact shapes the UI renders. A call that can't be
    salvaged is dropped, never passed through half-formed. Leaked tool markup is stripped."""
    out = []
    for c in calls:
        n, a = c.get("name"), _clean(_as_dict(c.get("args")))
        if n == "plan_unknowns":
            a = {"unknowns": [{"q": a[f"unknown_{i}"], "dim": a.get(f"unknown_{i}_dim") if a.get(f"unknown_{i}_dim") in CONVO_DIMS else "problem"}
                              for i in range(1, 6) if str(a.get(f"unknown_{i}") or "").strip()]}
        if n in ("present_options", "stakeholder"):
            flat = [{"label": a.get(f"option_{i}"), "sub": a.get(f"option_{i}_sub", ""),
                     "consider": a.get(f"option_{i}_consider", "")}
                    for i in (1, 2, 3) if str(a.get(f"option_{i}") or "").strip()]
            a = {k: v for k, v in a.items() if not k.startswith("option_")}
            a["options"] = _options(flat or a.get("options"))
            if not a["options"]:
                continue
        elif n == "offer_shapes":
            flat = [{f: str(a.get(f"shape_{x}_{f}") or "") for f in ("name", "one_liner", "first_screen",
                                                                      "interaction_model", "sketch", "tradeoff")} | {"key": x}
                    for x in "abc" if a.get(f"shape_{x}_name")]
            rec = a.get("recommended")
            a = {"shapes": flat or [x for x in (_as_dict(x) if not isinstance(x, dict) else x
                                                for x in _as_list(a.get("shapes"))) if x.get("name")][:3],
                 "recommended": rec, "why": a.get("why", "")}
            for x in a["shapes"]:
                x.setdefault("key", re.sub(r"[^a-z0-9]+", "_", x["name"].lower()).strip("_"))
                if x.get("sketch") not in sd.SKETCHES:
                    x["sketch"] = "none"
            if not a["shapes"]:
                continue
        elif n == "propose_scope":
            feats = []
            for r, x in enumerate(_as_list(a.get("features")), 1):
                if isinstance(x, str):
                    parts = [p.strip() for p in x.split("|")]
                    name = parts[0].lstrip("*!").strip()
                    if not name:
                        continue
                    blk = (parts[1] if len(parts) > 1 else "").strip().lower()
                    feats.append({"name": name, "block": sd.block_of(blk), "rank": r,
                                  "custom": "*" in parts[0][:2], "essential": "!" in parts[0][:2],
                                  "why": parts[2] if len(parts) > 2 else ""})
                elif isinstance(x, dict) and x.get("name"):
                    feats.append({**x, "rank": r})
            # Essentials always ship, so keep them honest: at most the two highest-ranked stay essential.
            ess = [x for x in feats if x.get("essential")]
            for x in sorted(ess, key=lambda x: x.get("rank", 99))[2:]:
                x["essential"] = False
            a["features"] = feats
        elif n == "read_back":
            a["final_brief"] = {d: str(a.pop(f"brief_{d}")).strip() for d in sd.DIMS if str(a.get(f"brief_{d}") or "").strip()}
            a["risks"] = [x if isinstance(x, dict) else {"risk": str(x), "mitigation": ""} for x in _as_list(a.get("risks"))]
            a["risks"] = [r for r in a["risks"] if str(r.get("risk") or "").strip()]
            a["gaps"] = [str(x) for x in _as_list(a.get("gaps")) if str(x).strip()][:4]
            dp = _as_dict(a.get("data_plan"))
            a["data_plan"] = {"seeded": [str(x) for x in _as_list(dp.get("seeded"))],
                              "generate": [str(x) for x in _as_list(dp.get("generate"))]}
            a["fits"] = {k: str(v) for k, v in _as_dict(a.get("fits")).items()}
            a["grades"] = _as_dict(a.get("grades"))
        elif n == "set_grades":
            a["grades"] = _as_dict(a.get("grades"))
        out.append({"name": n, "args": a})
    return out


def apply_tools(st: dict, calls: list, user_meta: dict) -> tuple[list, list]:
    calls = normalize(calls)
    """Apply tool calls to state. Returns (ui, events): ui = what to render under the message,
    events = right-pane changes to animate (brief added/updated, grades, north star, stage)."""
    ui, events = [], []
    names = [c["name"] for c in calls]
    for c in calls:
        n, a = c["name"], c.get("args") or {}
        if n == "plan_unknowns" and a.get("unknowns") and not st.get("unknowns"):
            st["unknowns"] = [{**u, "resolved": False} for u in a["unknowns"][:5]]
            continue
        if n == "update_brief" and a.get("dim") in sd.DIMS and a.get("text"):
            if "flag_drift" in names:
                continue                                   # never write the drifting direction
            for k in _as_list(a.get("resolves")):
                try:
                    st.get("unknowns", [])[int(k) - 1]["resolved"] = True
                except (ValueError, TypeError, IndexError):
                    pass
            for fct in _as_list(a.get("facts")):
                fct = sd._strip_dashes(str(fct)).strip()
                if fct and not any(len(_toks(fct) & _toks(x)) / max(1, len(_toks(fct) | _toks(x))) > 0.6
                                   for x in st.setdefault("facts", [])):
                    st["facts"].append(fct)
            st["facts"] = st.get("facts", [])[-30:]
            old = st["brief"].get(a["dim"])
            st["brief"][a["dim"]] = untag_said(sd._strip_dashes(a["text"]), st)
            events.append({"kind": "brief_updated" if old else "brief_added", "dim": a["dim"],
                           "old": old, "new": st["brief"][a["dim"]]})
        elif n == "set_grades":
            changes = {}
            for k, v in (a.get("grades") or {}).items():
                if k in sd.DIMS and v in sd.GRADES and st["grades"].get(k) != v:
                    changes[k] = {"old": st["grades"].get(k), "new": v}
                    st["grades"][k] = v
            if not st["messages"]:                          # opening read: cap, the climb is the point
                cap = sd.GRADES.index(sd.OPEN_CAP)
                for k, v in list(st["grades"].items()):
                    if sd.GRADES.index(v) > cap:
                        st["grades"][k] = sd.OPEN_CAP
                        changes.setdefault(k, {"old": None})["new"] = sd.OPEN_CAP
            if changes:
                events.append({"kind": "grades", "changes": changes, "sharper": a.get("sharper", "")})
        elif n == "update_north_star" and a.get("text"):
            st["north_star"] = sd._strip_dashes(a["text"])
            events.append({"kind": "north_star", "text": st["north_star"]})
        elif n == "flag_drift":
            if user_meta.get("picked"):
                continue                                   # a card WE offered can't be drift
            st["parked"].append(a.get("note", ""))
            ui.append({"type": "drift", "note": a.get("note", ""), "north_star": st["north_star"]})
        elif n == "stakeholder" and a.get("line"):
            new = _toks(a["line"])
            if any(new and _toks(o) and len(new & _toks(o)) / len(new | _toks(o)) > 0.45
                   for o in st.get("pushbacks_asked", [])):
                continue                                   # never repeat a line
            cast = cast_of(st)
            who = a.get("persona") if a.get("persona") in cast else (st.get("_cast_planned") or [next(iter(cast))])[0]
            if who not in cast:
                who = next(iter(cast))
            st.setdefault("pushbacks_asked", []).append(a["line"])
            st.setdefault("cast_seen", []).append(who)
            st.setdefault("cast_dims", []).append(st["stage"])
            tone = a.get("tone") if a.get("tone") in TONES else "curious"
            st.setdefault("cast_tones", []).append(tone)
            st.setdefault("cast_moments", []).append((st["stage"], tone))
            st["cast_last_turn"] = len(st["messages"]) // 2
            ui.append({"type": "stakeholder", "persona": who, "avatar": cast[who].get("avatar", "data_engineer"),
                       "name": cast[who]["name"], "role": cast[who]["role"],
                       "tone": tone,
                       "line": re.sub(rf"^\s*{re.escape(cast[who]['name'])}\s*[:,-]\s*", "", sd._strip_dashes(a["line"])),
                       "options": a.get("options") or []})
        elif n == "ask_open" and a.get("question"):
            st.setdefault("open_asked", []).append(st["stage"])
            ui.append({"type": "open", "question": sd._strip_dashes(a["question"]), "hint": sd._strip_dashes(a.get("hint", ""))})
        elif n == "present_options" and a.get("options"):
            ui.append({"type": "options", "question": a.get("question", ""), "options": a["options"][:3]})
        elif n == "offer_shapes" and a.get("shapes"):
            st["shape_options"] = a["shapes"]
            ui.append({"type": "shapes", **a})
        elif n == "propose_scope" and a.get("features"):
            feats = [f for f in a["features"] if isinstance(f, dict) and f.get("name")]
            for f in feats:
                f["block"] = sd.block_of(f.get("block"))
            st["features"] = feats
            sd.apply_package(st, "recommended")
            st["stage"] = "scope"                          # scope stays open until they continue
            ui.append({"type": "scope", "features": st["features"],
                       "packages": sd.build_packages(st["features"])["packages"]})
        elif n == "read_back":
            for d, txt in (a.get("final_brief") or {}).items():
                old = st["brief"].get(d)
                new = untag_said(sd._strip_dashes(txt), st)
                if new and new != old:
                    st["brief"][d] = new
                    events.append({"kind": "brief_updated" if old else "brief_added", "dim": d, "old": old, "new": new})
            br = st["brief"].get("risk")
            if br and not any(len(_toks(br) & _toks(r.get("risk", ""))) / max(1, len(_toks(br))) > 0.4
                              for r in a.get("risks", [])):
                a["risks"] = [{"risk": br, "mitigation": "", "from_brief": True}] + a.get("risks", [])
            a["brief"] = dict(st["brief"])
            dp = a.get("data_plan") or {}
            if not dp.get("seeded") and not dp.get("generate") and st["brief"].get("data"):
                a["data_plan"] = {"seeded": [], "generate": [st["brief"]["data"]]}
            st["readback"] = a
            if a.get("north_star"):
                st["north_star"] = sd._strip_dashes(a["north_star"])
            for k, v in (a.get("grades") or {}).items():
                if k in sd.DIMS and v in sd.GRADES:
                    st["grades"][k] = v
            ui.append({"type": "readback", **a})
        elif n == "advance_stage" and a.get("to") in sd.STAGES and st["stage"] not in CONVO_DIMS:
            cur, to = st["stage"], a["to"]
            # gate: can't leave a conversational stage before its section exists
            if cur in sd.STAGE_GOAL and not st["brief"].get(cur):
                continue
            if sd.STAGES.index(to) > sd.STAGES.index(cur):
                st["stage"] = sd.STAGES[sd.STAGES.index(cur) + 1]   # one step at a time
                events.append({"kind": "stage", "stage": st["stage"]})
    st.pop("_cast_planned", None)
    before = st["stage"]
    if before in CONVO_DIMS and not user_meta.get("repair"):
        st.setdefault("dim_turns", {})[before] = st.get("dim_turns", {}).get(before, 0) + 1
    if before in CONVO_DIMS:
        if user_meta.get("wrap_up") or any(u["type"] == "shapes" for u in ui):
            st["stage"] = "shapes"
        else:
            st["stage"] = focus(st) or "shapes"
    if st["stage"] != before:
        events.append({"kind": "stage", "stage": st["stage"], "label": FLOW_LABEL[st["stage"]],
                       "index": FLOW.index(st["stage"]) + 1, "total": len(FLOW)})
    st["version"] = st.get("version", 1) + (1 if events else 0)
    return ui, events


def remember(st: dict, user_text: str, reply_text: str, calls: list):
    """Store the exchange compactly: the prose plus a one-line note of what the tools did."""
    did = ", ".join(c["name"] for c in calls)
    st.setdefault("said", []).append(user_text[:400])
    st["said"] = st["said"][-40:]
    st["messages"].append({"role": "user", "content": user_text})
    st["messages"].append({"role": "assistant", "content": (reply_text.strip() + (f"\n[did: {did}]" if did else "")).strip()})
    st["messages"] = st["messages"][-(WINDOW * 2):]
