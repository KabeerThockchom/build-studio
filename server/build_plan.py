"""M3 — the Build phase. Generates bite-sized, teach-first Genie Code "moves"
(concept -> the move -> verify) for the capabilities in the blueprint.

Design notes:
- Ordered by dependency: data -> Genie -> Knowledge Assistant -> Lakebase ->
  Supervisor agent -> Databricks App.
- The guardrails are the load-bearing, hard-won lessons distilled from V2V (see
  the research): they go in the SYSTEM prompt so every generated move carries the
  rigor without the ceremony. We are NOT AppKit, so AppKit-specific import
  guardrails are excluded; the Databricks-primitive ones are kept.
- Prompt QUALITY here cannot be closed-loop tested (moves run in a real Genie
  Code session). Best-effort from the V2V reference + first principles; treat as
  the known-soft area to refine with real runs.
"""
import json
from . import llm
from .scope import WORKSHOP_SCOPE, VOICE
from .models import BuildPlan, BuildStep, BuildRequest

# Canonical dependency order for the steps we know how to guide. No Lakeflow —
# a workshop day never stands up a live ingestion source.
STEP_ORDER = ["data", "Genie", "Knowledge Assistant", "Lakebase", "Supervisor agent", "Databricks Apps"]

# The data step is one of three workshop-realistic paths, keyed by data_mode.
DATA_GUARDRAIL = {
    "synthetic": (
        "Generate a small, realistic sample dataset matching the idea and write it to Unity Catalog "
        "tables. Keep it to a few tables with believable rows — enough to make the build feel real."),
    "upload": (
        "The user has a spreadsheet/CSV. Walk them through loading it into a Unity Catalog table: "
        "in the workspace use the 'Create table' / upload-file UI (or read the file in a notebook and "
        "write a managed table). Confirm the table exists and has their rows before moving on. This is "
        "many newcomers' first real Databricks table — keep it concrete and encouraging."),
    "existing": (
        "The user is pointing at a table that already exists. Confirm the exact catalog.schema.table "
        "name and that they can read it — do NOT create or alter it (assume read-only access). Verify a "
        "simple SELECT returns rows before building on it."),
}

# The distilled, must-preserve guardrails per capability (fed to the model).
GUARDRAILS = {
    "data": (
        "Data comes first. Notebook cells need the '# Databricks notebook source' header and "
        "'# COMMAND ----------' separators or cells silently merge."),
    "Genie": (
        "A Genie space is the semantic layer over the tables. Creating the asset is NOT enough — you "
        "must configure it with the tables, the joins, and 1-2 example questions, and confirm it "
        "actually answers one with a real number. An empty/unconfigured space looks created but is useless."),
    "Knowledge Assistant": (
        "Knowledge Assistant lets the app answer from documents/notes with no embedding pipeline to build. "
        "Point it at the text source (a table column or docs) and kick off indexing. IMPORTANT: indexing runs "
        "in the background and takes several minutes to tens of minutes; do NOT sit and poll waiting for it to "
        "finish, and do NOT block the rest of the build on it. Kick it off, tell the user it's indexing in the "
        "background (they can move on and check back), and treat 'a query returns a relevant passage' as a "
        "later verification once indexing is READY, not a same-step confirm."),
    "Lakebase": (
        "Lakebase is managed Postgres for the app's writes/state (e.g. recording a decision). Create the "
        "table you need; the app authenticates with a short-lived token minted per connection (no password). "),
    "Supervisor agent": (
        "The supervisor agent is a small tool-calling loop (not a framework): it calls the Foundation "
        "Model API and routes to the tools you built (Genie, Knowledge Assistant, Lakebase). Keep it "
        "simple; give each tool a clear description. Omit the temperature param (Sonnet rejects it)."),
    "Databricks Apps": (
        "The app hosts the UI. Two hard-won truths: (1) a green/SUCCEEDED deploy is NOT a working app — "
        "always open it in the browser and confirm it renders, watch /logz for startup errors. "
        "(2) bundle deploy needs a real git working tree in the workspace, not a bare folder. "
        "Use requirements.txt (never a uv.lock — it can leak internal proxy URLs)."),
}

SYSTEM_PROMPT = f"""You are a senior Databricks Solutions Architect turning a designed blueprint into a
short, confidence-building build plan for someone NEW to Databricks, working in Genie Code (the
in-workspace AI coding agent). For each capability they chose, write ONE bite-sized step.

{WORKSHOP_SCOPE}

{VOICE}

Each step has four parts, kept SHORT and plain:
- concept: 2-3 sentences — what you're building and why it matters for THEIR idea. Teach, don't lecture.
- move: a compact, ready-to-paste instruction they give Genie Code. One clear ask, grounded in their
  idea (use their real subject/tables where you can). NOT a giant prompt — a few sentences. Do NOT
  write code or SQL yourself; tell Genie Code what to produce. Fold in the essential guardrail as part
  of the instruction (e.g. "…then confirm it answers an example question with a real number").
- verify: one concrete "you'll know it worked when…" check.
- teach: one optional sentence teaching a Genie Code or Databricks fact a newcomer wouldn't know.

Honor the provided guardrails for each capability — they are hard-won and must be reflected in the
move or verify. Keep the whole thing readable by a beginner. No ceremony, no code.

Return ONLY one JSON object (no fence, no prose):
{{ "steps": [ {{ "capability": "<name or 'data'>", "title": "<short imperative>",
              "concept": "...", "move": "...", "verify": "...", "teach": "..." }}, ... ] }}
Order the steps exactly as given in the ORDER list.
"""


def _ordered_targets(req: BuildRequest) -> list[str]:
    # The first step is always the data step; the rest follow the dependency order.
    rest = [c for c in STEP_ORDER if c != "data" and c in req.capabilities]
    return ["data"] + rest


def _user_prompt(req: BuildRequest) -> str:
    targets = _ordered_targets(req)
    data_mode = req.design_answers.get("data_mode", "synthetic")
    # The generic data guardrail plus the path-specific one for this data_mode.
    guardrails = dict(GUARDRAILS)
    guardrails["data"] = f"{GUARDRAILS['data']} {DATA_GUARDRAIL.get(data_mode, DATA_GUARDRAIL['synthetic'])}"
    gl = "\n".join(f"- {t}: {guardrails.get(t, '')}" for t in targets)
    return (
        f"Idea:\n\"\"\"\n{req.idea.strip()}\n\"\"\"\n\n"
        f"Databricks familiarity: {req.expertise}\n"
        f"Data mode: {data_mode}\n"
        f"ORDER (produce exactly these steps, in this order): {targets}\n\n"
        f"Guardrails to honor per step:\n{gl}\n\n"
        "Write the build plan JSON now."
    )


def _extract_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1] if t.count("```") >= 2 else t.strip("`")
        if t.lstrip().lower().startswith("json"):
            t = t.lstrip()[4:]
    s, e = t.find("{"), t.rfind("}")
    if s != -1 and e != -1 and e > s:
        t = t[s:e + 1]
    return json.loads(t)


def build_plan(req: BuildRequest) -> BuildPlan:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _user_prompt(req)},
    ]
    last = None
    for _ in range(2):
        raw = llm.complete(messages, max_tokens=2600)
        try:
            parsed = _extract_json(raw)
            steps = []
            for i, s in enumerate(parsed.get("steps", []), 1):
                steps.append(BuildStep(
                    n=i, title=s.get("title", ""), capability=s.get("capability", ""),
                    concept=s.get("concept", ""), move=s.get("move", ""),
                    verify=s.get("verify", ""), teach=s.get("teach", "")))
            if steps:
                return BuildPlan(steps=steps)
            raise ValueError("no steps")
        except Exception as ex:
            last = ex
            messages.append({"role": "assistant", "content": raw[:400]})
            messages.append({"role": "user", "content": "Return ONLY the JSON object in the exact shape, no fences."})
    raise ValueError(f"build plan generation failed: {last}")
