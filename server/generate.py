"""M1 — the generation harness (the real AI moment).

Given the user's idea + persona + design answers + selected capabilities, produce a
Blueprint: a PRD (markdown), a flow, and decisions/tradeoffs from FMAPI — plus a
deterministically-computed diagram spec (nodes + edges) from the capabilities.

Split of responsibility:
  - The DIAGRAM SPEC is pure code (capability -> node/band + wiring). Reliable,
    testable, identical every time. This is the prototype's CAP_TO_NODE idea.
  - The PRD / flow / decisions come from the LLM, JSON-guardrailed and validated
    against the Blueprint model, with one retry on malformed output.
"""
from . import llm
from .jsonx import loads_tolerant
from .scope import WORKSHOP_SCOPE, VOICE, strip_em_dashes, clamp_idea
from .models import Blueprint, DiagramSpec, Node, FlowStep, Decision, GenerateRequest

# --- capability -> diagram node (the spine mapping) ---
# The Publix data-engineering-to-app journey, laid out left-to-right across the four bands:
# Data (Zerobus ingest) -> Capabilities (the medallion pipeline + Lakebase) -> Agent (Genie
# over the gold data) -> Delivery (the app). Bands are chosen so every wired edge crosses
# columns forward, never within a column.
CAP_TO_NODE = {
    "Zerobus":             {"band": "data", "label": "Zerobus", "sub": "real-time ingest"},
    "SDP medallion":       {"band": "capability", "label": "SDP medallion", "sub": "bronze · silver · gold"},
    "Lakebase":            {"band": "capability", "label": "Lakebase", "sub": "record decisions"},
    "Genie":               {"band": "agent", "label": "Genie", "sub": "ask the gold data"},
    "Databricks Apps":     {"band": "delivery", "label": "Databricks App", "sub": "the front door"},
}
CAP_IDS = {cap: cap.lower().replace(" ", "_") for cap in CAP_TO_NODE}

# The data node label/sub per workshop-realistic data path. Plain language — these
# render in the diagram for newcomers, so no product jargon (no "UC").
DATA_NODE = {
    "synthetic": {"label": "Sample data", "sub": "tables we create for you"},
    "upload":    {"label": "Your file", "sub": "your spreadsheet, as a table"},
    "existing":  {"label": "Existing table", "sub": "a table you already have"},
}


def compute_spec(capabilities: list[str], data_mode: str = "synthetic") -> DiagramSpec:
    """Deterministic: capabilities -> nodes + edges laid out as the Publix data-engineering-to-app
    journey (Zerobus -> SDP medallion -> Genie -> App, with Lakebase feeding the app). Every wired
    edge crosses bands forward, so the diagram reads cleanly left-to-right with no back-arrows."""
    nodes: list[Node] = []
    ids: dict[str, str] = {}
    for cap in capabilities:
        m = CAP_TO_NODE.get(cap)
        if m:
            nid = CAP_IDS[cap]
            ids[cap] = nid
            nodes.append(Node(id=nid, band=m["band"], label=m["label"], sub=m["sub"]))

    # If nothing landed in the Data band (e.g. a refine removed the ingest piece), fall back
    # to a generic source node so the downstream pieces still have something to read from.
    if not any(n.band == "data" for n in nodes):
        meta = DATA_NODE.get(data_mode, DATA_NODE["synthetic"])
        nodes.insert(0, Node(id="data", band="data", label=meta["label"], sub=meta["sub"]))
        ids["__source__"] = "data"

    edges: list[tuple[str, str]] = []

    def link(a: str | None, b: str | None) -> None:
        if a and b and a != b:
            edges.append((a, b))

    source_id = ids.get("Zerobus") or ids.get("__source__")   # where the raw data enters
    gold_id = ids.get("SDP medallion") or source_id           # the analytics-ready shape
    delivery_id = ids.get("Databricks Apps")
    intelligence_id = ids.get("Genie")                        # asks the gold data

    link(source_id, ids.get("SDP medallion"))                 # ingest -> medallion
    link(gold_id, intelligence_id)                            # gold   -> Genie
    link(intelligence_id or gold_id, delivery_id)             # Genie (or gold) -> app
    link(ids.get("Lakebase"), delivery_id)                    # Lakebase -> app (app state)

    return DiagramSpec(nodes=nodes, edges=edges)


# --- LLM generation of PRD + flow + decisions ---
SYSTEM_PROMPT = f"""You are a senior Databricks Solutions Architect sitting with a workshop
participant, turning their idea into a concrete plan they can actually finish in the workshop.
You are given their idea, who they are, their design answers, and the Databricks capabilities
they have chosen to build with.

{WORKSHOP_SCOPE}

{VOICE}

PRD discipline (borrowed from the real Databricks workshop, follow it strictly):
- Do NOT write code, SQL, table schemas/definitions, table names, or API endpoints. This is a
  plan, not an implementation — those come later, in the build steps.
- Do NOT invent capabilities they did not choose. Work only with the given list.
- The design answers are the user's EXPLICIT choices — honor them over any default assumption.
  In particular, how they want to interact is their call: if an answer says they want a dashboard,
  a report, or "just charts" (i.e. NOT a conversational / chat / question-box experience), do NOT put
  a chat box, "ask a question" step, or Q&A flow in the flow or PRD, even if Genie is a chosen
  capability. Genie can power the numbers behind a dashboard without any chat UI. Only include a
  question box when the user actually wants to ask questions.
- The "interaction_model" design answer sets the app's SHAPE, so honor it: browse_act -> open on a
  ranked shortlist of what needs attention, click in to act; monitor -> open on a dashboard/overview;
  ask -> open on a plain-English question box; explore -> open on a flexible view they drill through;
  agent_actions -> open on the list of actions an AGENT has already worked through and PROPOSES (each
  item showing what it read, its judgement, and the action it drafted, most consequential first); the
  person reviews and APPROVES or OVERRIDES each, and every decision is recorded as an audit trail. For
  agent_actions the app is a supervise-the-agent console, NOT a passive briefing: the Primary action is
  "approve or override the agent's proposed action", and the agent does the deciding, not the person.
  The "First screen" and "Primary action" sections below MUST match the chosen interaction model.
- WRITE-BOUNDARY HONESTY: the build's pieces (Genie, an agent, Lakebase, the app) can read data and
  RECORD decisions/actions in Lakebase, but they cannot perform side effects in EXTERNAL systems (send an
  email, push to a ticketing/case system, change a source of record). If the idea implies an external
  action, say plainly in the PRD that the app records the decided action and its audit trail, and put
  "wire it to <the real system>" in Scope (save for later). Never imply the app performs an external
  side effect it cannot.
- Keep it simple. High-value workflows only, happy path only. Do not over-engineer.
- 1-2 personas maximum. Ground everything in THEIR idea and words. No generic filler, no hype.
- Design like a briefing, not a dashboard: the app should open on ONE clear finding or action, then
  let the person go to evidence, then detail. Never a blank canvas or a bare query box with nothing on it.

You also decide, like an experienced SA would, what is realistically IN scope for the workshop
day versus what to honestly flag as a follow-up ("save for later") — so the person knows what
they'll walk out with. Base "save for later" on their idea specifically (e.g. connecting their
real production source, a trained model, auth/roles, scale) — only include items that genuinely
apply to their idea.

Return ONLY a single JSON object (no markdown fence, no prose around it) with this exact shape:
{{
  "prd_markdown": "<a concise PRD in markdown: ## Summary, ## Who it's for (1-2 personas),
                    ## What it does, ## First screen (what the user sees on open and the ONE dominant
                    element, matching their interaction model), ## Primary action (the single thing they
                    do most, which the first screen should make obvious), ## Scope (in / out),
                    ## How someone uses it (happy path), ## Data (which of sample/uploaded/existing, in
                    plain terms). No code, no schemas.>",
  "flow": [ {{"n": 1, "title": "<verb>", "sub": "<short>"}}, ... 3 to 4 steps of how a person uses it ],
  "decisions": [ {{"tag": "<capability name>", "text": "<why it's in the build, one line>",
                  "tradeoff": "<the cost/con, one line>"}}, ... one per chosen capability ],
  "scope_in": [ "<a specific thing they'll get working today>", ... 3 to 4, grounded in their idea ],
  "scope_later": [ "<an honest follow-up beyond a workshop day>", ... 2 to 3, grounded in their idea ],
  "change_note": "<ONLY when the user asked for a change (a refine note is present above): one plain
                   sentence saying what you changed in response. If their request could not be fully
                   honored — e.g. it needs something outside the workshop toolset, or contradicts the
                   pieces chosen — say so plainly and what you did instead. Empty string when there was
                   no change request.>"
}}
"""


DATA_MODE_DESC = {
    "synthetic": "sample data we generate in-workshop to fit the idea",
    "upload": "a spreadsheet/file the user has, turned into a Unity Catalog table",
    "existing": "an existing Unity Catalog table we read from (may be read-only)",
}


def _build_user_prompt(req: GenerateRequest) -> str:
    answers = "\n".join(f"  - {k}: {v}" for k, v in req.design_answers.items()) or "  (none)"
    caps = ", ".join(req.capabilities) or "(none chosen)"
    dm = req.design_answers.get("data_mode", "synthetic")
    data_line = f"Data path: {DATA_MODE_DESC.get(dm, DATA_MODE_DESC['synthetic'])}\n"
    adjust = ""
    if req.adjust.strip():
        adjust = (f"\nThe user reviewed a previous version and asked for this change — honor it:\n"
                  f"  \"{req.adjust.strip()}\"\n")
    return (
        f"Idea (their words):\n\"\"\"\n{req.idea.strip()}\n\"\"\"\n\n"
        f"Who they are: {req.persona or 'unspecified'} · Databricks familiarity: {req.expertise}\n"
        f"Interests: {', '.join(req.interests) or 'unspecified'}\n"
        f"{data_line}"
        f"Design answers:\n{answers}\n\n"
        f"Chosen capabilities: {caps}\n"
        f"{adjust}\n"
        "Write the plan JSON now."
    )


def _extract_json(text: str) -> dict:
    """Tolerant JSON extraction — strips accidental fences / prose around the object."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1] if t.count("```") >= 2 else t.strip("`")
        if t.lstrip().startswith("json"):
            t = t.lstrip()[4:]
    start, end = t.find("{"), t.rfind("}")
    if start != -1 and end != -1 and end > start:
        t = t[start:end + 1]
    return loads_tolerant(t)


# What each capability provides — used so a refine can explain the ripple of removing one.
_CAP_PROVIDES = {
    "Zerobus": "real-time ingest of events into the lakehouse",
    "SDP medallion": "a bronze/silver/gold pipeline that produces clean gold tables",
    "Genie": "asking your gold data questions in plain English",
    "Lakebase": "recording decisions / app state that persists",
    "Databricks Apps": "the app people open",
}
_REFINE_SYS = """You adjust the capability list of a Databricks build based on a user's refine note.
You are given the current capabilities and the note. Decide if the note asks to add or remove
capabilities. Return ONLY JSON: {"capabilities": [<the new full list>], "changed": true|false,
"note": "<one plain sentence: what changed and any ripple, e.g. 'Removed Lakebase, so the app no
longer records decisions between sessions.' If nothing changed, empty string.>"}
Rules: capabilities MUST be a subset of this exact vocabulary (never invent): %s. If the note is
NOT about which pieces to use (e.g. 'make it simpler', 'focus on the manager'), return the list
unchanged with changed=false. Keep at least one capability."""


def _refine_capabilities(note: str, capabilities: list[str]) -> tuple[list[str], str]:
    """Interpret a refine note into a capability-list edit. Returns (new_caps, ripple_note).
    Deterministic spec is recomputed from the result, so the diagram truly reflects the change."""
    import json as _json
    from .design_plan import CAPABILITIES as VOCAB
    sys = _REFINE_SYS % VOCAB
    user = f"Current capabilities: {capabilities}\nRefine note: \"{note.strip()}\"\nReturn the JSON."
    try:
        raw = llm.complete([{"role": "system", "content": sys}, {"role": "user", "content": user}], max_tokens=400)
        parsed = _extract_json(raw)
        new = [c for c in parsed.get("capabilities", []) if c in VOCAB]
        if not new:
            return capabilities, ""
        if set(new) == set(capabilities):
            return capabilities, ""
        return new, (parsed.get("note") or "").strip()
    except Exception as e:
        print(f"refine capability interp failed ({e}); keeping capabilities")
        return capabilities, ""


def generate_blueprint(req: GenerateRequest) -> Blueprint:
    req.idea = clamp_idea(req.idea)   # a rambling pasted idea shouldn't bloat/truncate the PRD
    # A refine note may change WHICH capabilities are in play (e.g. "remove Lakebase").
    # Interpret it into a capability edit first, then the deterministic spec + PRD both
    # reflect the real change — the diagram is dynamic to iteration, not just to Assemble.
    capabilities = list(req.capabilities)
    # Drop anything outside the known palette. The UI can only submit valid capabilities,
    # but a direct API caller can send junk ("NotARealCapability") — don't let a nonsense
    # piece flow into the PRD/diagram/build. (compute_spec already ignores unknowns for the
    # diagram; this keeps them out of the prompt and the returned capability list too.)
    from .design_plan import CAPABILITIES as _VOCAB
    capabilities = [c for c in capabilities if c in _VOCAB]
    req.capabilities = capabilities
    cap_ripple = ""
    if req.adjust.strip() and capabilities:
        capabilities, cap_ripple = _refine_capabilities(req.adjust, capabilities)
        req.capabilities = capabilities  # so the PRD prompt sees the adjusted list too
    spec = compute_spec(capabilities, req.design_answers.get("data_mode", "synthetic"))
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_prompt(req)},
    ]

    # The model occasionally emits malformed JSON (a missing comma, a stray quote).
    # loads_tolerant handles control chars / trailing commas, but a genuine syntax slip
    # only clears on a fresh generation — and this endpoint has no fallback, so a 500
    # here dead-ends the participant. Give it several attempts (observed: the failure is
    # transient — a later attempt succeeds), correcting more firmly each round.
    parsed = None
    last_err = None
    # Escalate the token budget each retry so a long idea can't truncate the PRD JSON and
    # then re-truncate at the same budget on every retry (the build-plan failure mode).
    budgets = [2200, 4000, 6000, 8000]
    for attempt in range(4):
        raw = llm.complete(messages, max_tokens=budgets[attempt])
        try:
            parsed = _extract_json(raw)
            break
        except Exception as e:
            last_err = e
            messages.append({"role": "assistant", "content": raw[:500]})
            messages.append({"role": "user", "content":
                             "That was not valid JSON (parse error: %s). Return ONLY one valid JSON object — "
                             "check every string is closed and every field/array element is comma-separated. "
                             "No markdown fences, no prose." % e})
    if parsed is None:
        raise ValueError(f"LLM did not return valid JSON after {4} attempts: {last_err}")

    # What to tell the user about their refine. A capability change (structural) is the
    # most concrete, so it wins; otherwise use the model's own account of what it changed
    # in the plan. Either way a refine now always gets an acknowledgement (was: only when
    # the capability set changed, which left PRD-only refines silent).
    refine_note = ""
    if req.adjust.strip():
        refine_note = cap_ripple or (parsed.get("change_note") or "").strip()

    # Sanitize every user-facing string: the VOICE rule forbids em-dashes but the model
    # still slips them in, and the participant wants zero anywhere they read.
    return Blueprint(
        archetype=req.design_answers.get("archetype", "agentic_app"),
        idea=req.idea,
        persona=req.persona,
        capabilities=capabilities,
        spec=spec,
        flow=[FlowStep(n=f.get("n", i + 1), title=strip_em_dashes(f.get("title", "")), sub=strip_em_dashes(f.get("sub", "")))
              for i, f in enumerate(parsed.get("flow", [])) if isinstance(f, dict)],
        prd_markdown=strip_em_dashes(parsed.get("prd_markdown", "")),
        decisions=[Decision(tag=strip_em_dashes(d.get("tag", "")), text=strip_em_dashes(d.get("text", "")),
                            tradeoff=strip_em_dashes(d.get("tradeoff", "")))
                   for d in parsed.get("decisions", []) if isinstance(d, dict)],
        scope_in=[strip_em_dashes(s) for s in parsed.get("scope_in", []) if isinstance(s, str)][:4],
        scope_later=[strip_em_dashes(s) for s in parsed.get("scope_later", []) if isinstance(s, str)][:3],
        refine_note=strip_em_dashes(refine_note),
    )
