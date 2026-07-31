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
from .models import BuildPlan, BuildStep, BuildRequest

# Canonical dependency order for the steps we know how to guide.
STEP_ORDER = ["data", "Genie", "Knowledge Assistant", "Lakebase", "Supervisor agent", "Databricks Apps"]

# The distilled, must-preserve guardrails per capability (fed to the model).
GUARDRAILS = {
    "data": (
        "Data comes first. If synthetic: generate a small, realistic sample matching the idea and "
        "write it to Unity Catalog tables. If existing: confirm the exact catalog.schema.table names. "
        "Notebook cells need the '# Databricks notebook source' header and '# COMMAND ----------' "
        "separators or cells silently merge."),
    "Genie": (
        "A Genie space is the semantic layer over the tables. Creating the asset is NOT enough — you "
        "must configure it with the tables, the joins, and 1-2 example questions, and confirm it "
        "actually answers one with a real number. An empty/unconfigured space looks created but is useless."),
    "Knowledge Assistant": (
        "Knowledge Assistant is Databricks' managed RAG — no embedding pipeline to build. Point it at the "
        "text source (a table column or docs), let it index, and confirm it returns a relevant passage. "
        "It needs at least one source before it's ready; wait for indexing."),
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

SYSTEM_PROMPT = """You are a senior Databricks Solutions Architect turning a designed blueprint into a
short, confidence-building build plan for someone NEW to Databricks, working in Genie Code (the
in-workspace AI coding agent). For each capability they chose, write ONE bite-sized step.

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
{ "steps": [ { "capability": "<name or 'data'>", "title": "<short imperative>",
              "concept": "...", "move": "...", "verify": "...", "teach": "..." }, ... ] }
Order the steps exactly as given in the ORDER list.
"""


def _ordered_targets(req: BuildRequest) -> list[str]:
    targets = ["data"] + [c for c in STEP_ORDER if c != "data" and c in req.capabilities]
    return targets


def _user_prompt(req: BuildRequest) -> str:
    targets = _ordered_targets(req)
    data_mode = req.design_answers.get("data_mode", "synthetic")
    gl = "\n".join(f"- {t}: {GUARDRAILS.get(t, '')}" for t in targets)
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
