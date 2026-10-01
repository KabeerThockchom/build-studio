"""Build Studio v2 component catalog: the single source of truth for what a build can be made of.

No prescribed architecture any more. Each build picks the components its Sit-Down scope needs,
from four: Declarative Pipelines (medallion), Lakebase, Genie, Databricks Apps. One surface: the app is the
only "use it" layer (charts and key numbers are app screens, so there is no separate AI/BI dashboard), and
Lakebase and Genie are the only "serve it" pieces. Genie only comes in when people genuinely need to ask
open questions the screens can't anticipate; it then sits in the app as a chat panel.
(No Supervisor agent, no Knowledge Assistant.) Genie Code builds everything except the app; if the
build has an app, that step hands off to Genie App Builder (Apps > Build).

Used by: the Sit-Down (building blocks + scope), the architecture diagram (bands + wiring), Learn
(which modules to teach), the PRD generator and the build plan.
"""

PIPELINES = "Declarative Pipelines"
GENIE = "Genie"
LAKEBASE = "Lakebase"
APPS = "Databricks Apps"
RETIRED = {"AI/BI Dashboards": APPS}                            # older plans: a dashboard is now an app screen
ORDER = [PIPELINES, LAKEBASE, GENIE, APPS]                      # build order (dependencies first)

# Diagram bands, left to right: where data comes from -> how it is shaped -> how it is served -> where people use it.
BANDS = ["data", "pipeline", "serve", "delivery"]
BAND_LABELS = {"data": "Your data", "pipeline": "Shape it", "serve": "Serve it", "delivery": "Use it"}

COMPONENTS = {
    PIPELINES: {"band": "pipeline", "label": "Declarative Pipelines", "sub": "bronze to silver to gold",
                "one_liner": "cleans, joins and scores the data into gold tables everything else reads",
                "builder": "genie_code"},
    GENIE: {"band": "serve", "label": "Genie", "sub": "open questions, in the app",
            "one_liner": "answers the open questions people ask in their own words, from a chat panel in the app",
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
    "genie_space": ("quick", "a Genie chat panel in the app, ONLY when people need to ask open questions the screens "
                             "can't answer in advance", GENIE),
    "decision_log": ("quick", "a Lakebase table recording each approve, change or note", LAKEBASE),
    "app_screen": ("half", "one screen in the app people open (a list to act on, a draft to edit, or charts of the "
                           "key numbers), built with Genie App Builder", APPS),
    "not_today": (None, "needs a trained ML model, image recognition, a live system connection, an AI agent, "
                        "or answers from documents", None),
}
# Older sessions / model slips map onto the current catalog.
LEGACY_BLOCKS = {"synthetic_table": "generated_data", "agent": "rules_logic", "knowledge_assistant": "not_today",
                 "dashboard": "app_screen"}


def block_of(key: str) -> str:
    k = (key or "").strip().lower()
    k = LEGACY_BLOCKS.get(k, k)
    return k if k in BLOCKS else "app_screen"


def components_for(features: list, lanes=("today", "stretch"), interaction_model: str = "") -> list[str]:
    """The components a build needs, from its scoped features, in build order. Every build has the pipeline
    (everything reads its gold tables) and the app (the one place people use it). Lakebase and Genie only
    when a feature in scope needs them. interaction_model is kept for older callers."""
    used = {PIPELINES, APPS}
    for f in features or []:
        if f.get("lane", "today") in lanes:
            comp = BLOCKS[block_of(f.get("block"))][2]
            if comp:
                used.add(comp)
    return [c for c in ORDER if c in used]


def reconcile(wanted: list[str], previous: list[str]) -> tuple[list[str], list[str]]:
    """Apply the same coherence rules to a list changed by a Plan refine. Returns (components, notes), where
    notes are plain sentences for anything the rules changed beyond what was asked."""
    notes = []
    if any(c in RETIRED for c in wanted):
        notes.append("Charts and key numbers go on a screen in the app, so there's no separate dashboard.")
    want = {RETIRED.get(c, c) for c in wanted} & set(COMPONENTS)
    prev = set(previous)
    if APPS not in want:
        notes.append("The app is where people use it, so the app stays." if APPS in prev else
                     "Every build has an app people open, so the app comes in.")
    if PIPELINES not in want and PIPELINES in prev:
        notes.append("Everything reads the gold tables the pipeline makes, so Declarative Pipelines stays.")
    want |= {PIPELINES, APPS}
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
    pipe, genie, lake, app = (ids.get(c) for c in (PIPELINES, GENIE, LAKEBASE, APPS))
    src = pipe or "data"
    if pipe:
        edges.append(("data", pipe))
    if genie:
        edges.append((src, genie))             # Genie answers from the gold tables
    if app:
        edges.append((src, app))               # the app reads the gold tables
        if genie:
            edges.append((genie, app))         # ...and hosts Genie as a chat panel
        if lake:
            edges.append((app, lake))          # the app writes decisions to Lakebase
    elif lake:
        edges.append((src, lake))
    return {"nodes": nodes, "edges": edges}
