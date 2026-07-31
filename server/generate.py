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
import json
from . import llm
from .models import Blueprint, DiagramSpec, Node, FlowStep, Decision, GenerateRequest

# --- capability -> diagram node (the spine mapping) ---
CAP_TO_NODE = {
    "Genie":               {"band": "capability", "label": "Genie", "sub": "ask the data"},
    "Knowledge Assistant": {"band": "capability", "label": "Knowledge Assistant", "sub": "understand text"},
    "Lakebase":            {"band": "capability", "label": "Lakebase", "sub": "record decisions"},
    "Supervisor agent":    {"band": "agent", "label": "Supervisor agent", "sub": "routes the tools"},
    "Databricks Apps":     {"band": "delivery", "label": "Databricks App", "sub": "the front door"},
    "Lakeflow":            {"band": "data", "label": "Lakeflow", "sub": "ingest + ETL"},
}
CAP_IDS = {cap: cap.lower().replace(" ", "_") for cap in CAP_TO_NODE}


def compute_spec(capabilities: list[str], data_mode: str = "synthetic") -> DiagramSpec:
    """Deterministic: capabilities -> nodes + edges across Data/Capability/Agent/Delivery."""
    nodes: list[Node] = []
    # Data node: Lakeflow if chosen, else a generic source reflecting the data mode.
    if "Lakeflow" in capabilities:
        nodes.append(Node(id="lakeflow", band="data", label="Lakeflow", sub="ingest + ETL"))
        data_id = "lakeflow"
    else:
        label = "Your tables" if data_mode == "existing" else "Sample data"
        sub = "existing UC tables" if data_mode == "existing" else "synthetic tables in UC"
        nodes.append(Node(id="data", band="data", label=label, sub=sub))
        data_id = "data"

    for cap in capabilities:
        if cap == "Lakeflow":
            continue
        meta = CAP_TO_NODE.get(cap)
        if meta:
            nodes.append(Node(id=CAP_IDS[cap], band=meta["band"], label=meta["label"], sub=meta["sub"]))

    edges: list[tuple[str, str]] = []
    cap_ids = [CAP_IDS[c] for c in capabilities if CAP_TO_NODE.get(c, {}).get("band") == "capability"]
    agent_id = CAP_IDS.get("Supervisor agent") if "Supervisor agent" in capabilities else None
    delivery_id = CAP_IDS.get("Databricks Apps") if "Databricks Apps" in capabilities else None

    for cid in cap_ids:
        edges.append((data_id, cid))          # data -> each capability
        if agent_id:
            edges.append((cid, agent_id))      # capability -> agent
    if agent_id and delivery_id:
        edges.append((agent_id, delivery_id))  # agent -> delivery
    elif delivery_id:                          # no agent: capabilities -> delivery
        for cid in cap_ids:
            edges.append((cid, delivery_id))

    return DiagramSpec(nodes=nodes, edges=edges)


# --- LLM generation of PRD + flow + decisions ---
SYSTEM_PROMPT = """You are a Databricks solutions architect helping a workshop participant
turn their idea into a concrete plan. You are given their idea, who they are, their design
answers, and the Databricks capabilities they have chosen to build with.

Produce a focused plan. Constraints (important):
- Do NOT invent capabilities they did not choose. Work only with the given list.
- Do NOT write code, SQL, table schemas, or API definitions. This is a plan, not an implementation.
- Keep it concrete and grounded in THEIR idea and words. No generic filler, no hype.
- Happy path only. Prioritize clarity.

Return ONLY a single JSON object (no markdown fence, no prose around it) with this exact shape:
{
  "prd_markdown": "<a concise PRD in markdown: ## Summary, ## Who it's for, ## What it does,
                    ## Scope (in / out), ## How someone uses it (happy path), ## Data. No code.>",
  "flow": [ {"n": 1, "title": "<verb>", "sub": "<short>"}, ... 3 to 4 steps of how a person uses it ],
  "decisions": [ {"tag": "<capability name>", "text": "<why it's in the build, one line>",
                  "tradeoff": "<the cost/con, one line>"}, ... one per chosen capability ]
}
"""


def _build_user_prompt(req: GenerateRequest) -> str:
    answers = "\n".join(f"  - {k}: {v}" for k, v in req.design_answers.items()) or "  (none)"
    caps = ", ".join(req.capabilities) or "(none chosen)"
    return (
        f"Idea (their words):\n\"\"\"\n{req.idea.strip()}\n\"\"\"\n\n"
        f"Who they are: {req.persona or 'unspecified'} · Databricks familiarity: {req.expertise}\n"
        f"Interests: {', '.join(req.interests) or 'unspecified'}\n"
        f"Design answers:\n{answers}\n\n"
        f"Chosen capabilities: {caps}\n\n"
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
    return json.loads(t)


def generate_blueprint(req: GenerateRequest) -> Blueprint:
    spec = compute_spec(req.capabilities, req.design_answers.get("data_mode", "synthetic"))
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_prompt(req)},
    ]

    parsed = None
    last_err = None
    for attempt in range(2):
        raw = llm.complete(messages, max_tokens=2200)
        try:
            parsed = _extract_json(raw)
            break
        except Exception as e:
            last_err = e
            messages.append({"role": "assistant", "content": raw[:500]})
            messages.append({"role": "user", "content":
                             "That was not valid JSON. Return ONLY the JSON object, no fences, no prose."})
    if parsed is None:
        raise ValueError(f"LLM did not return valid JSON after retry: {last_err}")

    return Blueprint(
        archetype=req.design_answers.get("archetype", "agentic_app"),
        idea=req.idea,
        persona=req.persona,
        capabilities=req.capabilities,
        spec=spec,
        flow=[FlowStep(**f) for f in parsed.get("flow", [])],
        prd_markdown=parsed.get("prd_markdown", ""),
        decisions=[Decision(**d) for d in parsed.get("decisions", [])],
    )
