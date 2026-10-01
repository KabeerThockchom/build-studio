"""Build Studio v2 component catalog: the single source of truth for what a build can be made of.

No prescribed architecture any more. Each build picks the components its Sit-Down scope needs,
from five: Declarative Pipelines (medallion), Genie, AI/BI Dashboards, Lakebase, Databricks Apps.
(No Supervisor agent, no Knowledge Assistant.) Genie Code builds everything except the app; if the
build has an app, that step hands off to Genie App Builder (Apps > Build).

Used by: the Sit-Down (building blocks + scope), the architecture diagram (bands + wiring), Learn
(which modules to teach), the PRD generator and the build plan.
"""

PIPELINES = "Declarative Pipelines"
GENIE = "Genie"
DASHBOARDS = "AI/BI Dashboards"
LAKEBASE = "Lakebase"
APPS = "Databricks Apps"
ORDER = [PIPELINES, LAKEBASE, GENIE, DASHBOARDS, APPS]          # build order (dependencies first)

# Diagram bands, left to right: where data comes from -> how it is shaped -> how it is served -> where people use it.
BANDS = ["data", "pipeline", "serve", "delivery"]
BAND_LABELS = {"data": "Your data", "pipeline": "Shape it", "serve": "Serve it", "delivery": "Use it"}

COMPONENTS = {
    PIPELINES: {"band": "pipeline", "label": "Declarative Pipelines", "sub": "bronze to silver to gold",
                "one_liner": "cleans, joins and scores the data into gold tables everything else reads",
                "builder": "genie_code"},
    GENIE: {"band": "serve", "label": "Genie", "sub": "plain-English questions",
            "one_liner": "lets people ask questions of the gold tables in plain English",
            "builder": "genie_code"},
    DASHBOARDS: {"band": "serve", "label": "AI/BI Dashboard", "sub": "the numbers at a glance",
                 "one_liner": "shows the key numbers and trends on one page",
                 "builder": "genie_code"},
    LAKEBASE: {"band": "serve", "label": "Lakebase", "sub": "records decisions",
               "one_liner": "a Postgres database that records what people decide or change",
               "builder": "genie_code"},
    APPS: {"band": "delivery", "label": "Databricks App", "sub": "built with Genie App Builder",
           "one_liner": "the screen people open, built with Genie App Builder",
           "builder": "app_builder"},
}

# Sit-Down building blocks (effort is ours, the model only classifies). Each maps to a component.
BLOCKS = {
    "generated_data": ("quick", "a small generated table in your own schema, mirroring what they use today", PIPELINES),
    "pipeline_step": ("half", "a pipeline step that cleans and joins data into a gold table (bronze, silver, gold)", PIPELINES),
    "rules_logic": ("half", "logic in the pipeline that scores, flags, ranks or drafts a suggestion for each item", PIPELINES),
    "genie_space": ("quick", "plain-English questions over the gold tables", GENIE),
    "dashboard": ("quick", "a dashboard of the key numbers and trends", DASHBOARDS),
    "decision_log": ("quick", "a Lakebase table recording each approve, change or note", LAKEBASE),
    "app_screen": ("half", "one screen in the app people open (built with Genie App Builder)", APPS),
    "not_today": (None, "needs a trained ML model, image recognition, a live system connection, an AI agent, "
                        "or answers from documents", None),
}
# Older sessions / model slips map onto the current catalog.
LEGACY_BLOCKS = {"synthetic_table": "generated_data", "agent": "rules_logic", "knowledge_assistant": "not_today"}


def block_of(key: str) -> str:
    k = (key or "").strip().lower()
    k = LEGACY_BLOCKS.get(k, k)
    return k if k in BLOCKS else "app_screen"


SURFACE_FOR = {"monitor": DASHBOARDS, "ask": GENIE, "explore": GENIE, "browse_act": APPS, "agent_actions": APPS}
SURFACES = {GENIE, DASHBOARDS, APPS}


def components_for(features: list, lanes=("today", "stretch"), interaction_model: str = "") -> list[str]:
    """The components a build needs, from its scoped features, in build order. Every build ships something
    people can use (a surface), and Lakebase only makes sense with an app writing to it."""
    used = set()
    for f in features or []:
        if f.get("lane", "today") in lanes:
            comp = BLOCKS[block_of(f.get("block"))][2]
            if comp:
                used.add(comp)
    # Genie, dashboards and apps read gold tables, so any of them implies a pipeline unless
    # the build only records decisions (Lakebase + app over existing data).
    if not used & SURFACES:
        used.add(SURFACE_FOR.get(interaction_model, APPS if LAKEBASE in used else GENIE))
    if LAKEBASE in used:
        used.add(APPS)                         # something has to write the decisions
    if used & {GENIE, DASHBOARDS, APPS} and PIPELINES not in used:
        used.add(PIPELINES)                    # surfaces read gold tables
    return [c for c in ORDER if c in used]


def reconcile(wanted: list[str], previous: list[str]) -> tuple[list[str], list[str]]:
    """Apply the same coherence rules to a list changed by a Plan refine. Returns (components, notes), where
    notes are plain sentences for anything the rules changed beyond what was asked."""
    want = {c for c in wanted if c in COMPONENTS}
    prev = set(previous)
    notes = []
    if LAKEBASE in want and APPS not in want:
        if APPS in prev:                       # they dropped the app: nothing left to write decisions
            want.discard(LAKEBASE)
            notes.append("Without the app nothing writes decisions, so Lakebase comes out too.")
        else:
            want.add(APPS)
            notes.append("Lakebase needs an app to write to it, so the app comes in too.")
    if not want & SURFACES:
        keep = [c for c in ORDER if c in prev & SURFACES][:1] or [GENIE]
        want.add(keep[0])
        notes.append(f"Every build needs something people use, so {COMPONENTS[keep[0]]['label']} stays.")
    if PIPELINES not in want:
        want.add(PIPELINES)
        if PIPELINES in prev:
            notes.append("Everything reads the gold tables the pipeline makes, so Declarative Pipelines stays.")
    return [c for c in ORDER if c in want], notes


def spec_for(components: list[str], data_label: str = "Sample data", data_sub: str = "tables we create for you") -> dict:
    """Deterministic architecture diagram: nodes per band + left-to-right wiring."""
    nodes = [{"id": "data", "band": "data", "label": data_label, "sub": data_sub}]
    ids = {}
    for c in components:
        m = COMPONENTS.get(c)
        if m:
            ids[c] = c.lower().replace("/", "").replace(" ", "_")
            nodes.append({"id": ids[c], "band": m["band"], "label": m["label"], "sub": m["sub"]})
    edges = []
    pipe = ids.get(PIPELINES)
    serve = [ids[c] for c in (GENIE, DASHBOARDS, LAKEBASE) if c in ids]
    app = ids.get(APPS)
    if pipe:
        edges.append(("data", pipe))
    for s in serve:
        if s == ids.get(LAKEBASE):
            edges.append(((pipe or "data"), s) if not app else (app, s))   # the app writes decisions to Lakebase
        else:
            edges.append(((pipe or "data"), s))
    if app:
        reads = [s for s in serve if s != ids.get(LAKEBASE)]
        if pipe:
            reads.append(pipe)                     # the app reads the gold tables directly too
        for s in reads or ["data"]:
            edges.append((s, app))
    return {"nodes": nodes, "edges": edges}
