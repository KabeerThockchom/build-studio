"""M3 — the Build phase. Generates bite-sized, teach-first Genie Code "moves"
(concept -> the move -> verify) for the capabilities in the blueprint.

Design notes:
- Ordered by Publix data-engineering-to-app journey: data -> Zerobus (real-time ingest) ->
  SDP medallion (bronze/silver/gold) -> Genie -> Lakebase -> Databricks App (done in
  Genie App Builder, not Genie Code).
- The guardrails are the load-bearing, hard-won lessons distilled from V2V (see
  the research): they go in the SYSTEM prompt so every generated move carries the
  rigor without the ceremony. We are NOT AppKit, so AppKit-specific import
  guardrails are excluded; the Databricks-primitive ones are kept.
- Prompt QUALITY here cannot be closed-loop tested (moves run in a real Genie
  Code session). Best-effort from the V2V reference + first principles; treat as
  the known-soft area to refine with real runs.
"""
import os
import re
from . import llm, config
from .jsonx import loads_tolerant
from .scope import WORKSHOP_SCOPE, VOICE, strip_em_dashes, clamp_idea
from .models import BuildPlan, BuildStep, BuildRequest


def _schema_name(text: str) -> str:
    """A safe Unity Catalog schema identifier derived from the project name/idea:
    lowercase, underscores, no leading digit. Used to isolate each participant's build."""
    s = re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")
    if s and s[0].isdigit():
        s = "p_" + s
    return (s[:40].rstrip("_") or "my_build")

# Canonical dependency order for the steps we know how to guide. Publix stack: stream events in
# with Zerobus, shape them through an SDP medallion (bronze/silver/gold), then serve with Genie,
# Lakebase, and a Databricks App.
STEP_ORDER = ["data", "Zerobus", "SDP medallion", "Genie", "Lakebase", "Databricks Apps"]

# The data step is one of three workshop-realistic paths, keyed by data_mode.
DATA_GUARDRAIL = {
    "synthetic": (
        "Generate a small, realistic sample dataset matching the idea and write it to Unity Catalog "
        "tables. Make the rows believable, not uniform — vary categories by realistic weight, spread "
        "amounts realistically, and include a little time movement (a trend or seasonality) so the "
        "charts and questions later have something real to show. Every reference between tables (an "
        "order's customer, a store's region) must point at a row that actually exists, or the joins "
        "break later. A few well-related tables with enough rows to look real beats many empty ones."),
    "upload": (
        "The user has a spreadsheet/CSV. Walk them through loading it into a Unity Catalog table: "
        "in the workspace use the 'Create table' / upload-file UI (or read the file in a notebook and "
        "write a managed table). Confirm the table exists and has their rows before moving on. This is "
        "many newcomers' first real Databricks table — keep it concrete and encouraging."),
    "existing": (
        "The user is pointing at a table that already exists. Confirm the exact catalog.schema.table "
        "name and that they can read it — do NOT create or alter it (assume read-only access). Verify a "
        "simple SELECT returns rows before building on it."),
    "seeded": (
        "A governed, workshop-ready dataset for this exact theme ALREADY EXISTS in Unity Catalog and the "
        "participant has read access to it via their workshop group — do NOT regenerate it and do NOT copy it "
        "into another schema. Point the build straight at the named tables: confirm a simple SELECT returns "
        "rows, and skim the columns so every later step uses the REAL column names (they are given below). The "
        "participant MAY still create their own schema (named below) to add a FEW supplementary synthetic tables "
        "— but ONLY for something their specific use case needs that the seeded tables genuinely don't cover; "
        "keep those few, realistic, and joined by real keys to the seeded data. A ready-made benchmark question "
        "set for this theme also exists (named below) — use it to check Genie in the next step rather than "
        "inventing your own. Any supplementary table you create goes ONLY in the participant's own schema "
        "(named in the prompt), never inside the shared seeded schema; keep the two straight and always "
        "fully-qualify each table with its correct schema when you reference it in a later step."),
}

# The facilitator (Akil) pre-seeded a governed, benchmark-ready dataset in the
# `workshop` catalog, aligned 1:1 to the Costa survey themes, granted read to the
# participant group. Most use cases map to one of these, so the harness points the
# build at the matching schema (real, realistic, already benchmarked) instead of
# having each person regenerate weaker data — and threads the matching evaluation.*
# set in as a ready-made Genie benchmark and docs_corpus as the Knowledge Assistant
# source. Participants keep CREATE_SCHEMA, so they can still add supplementary tables.
SEEDED_CATALOG = "workshop"
SEEDED_DATASETS = [
    {
        "label": "AP / finance operations",
        "keywords": ["invoice", "purchase order", "supplier", "vendor", "payment", "accounts payable",
                     "three-way", "duplicate invoice", "overdue", "procure", "supplier spend", "ap team",
                     "ap clerk", "po match"],
        "schema": "workshop.finance_ap",
        "tables": ("dim_supplier (500 suppliers), fact_purchase_orders (50k POs), fact_invoices "
                   "(80k invoices, with is_overdue / is_duplicate / days_late flags baked in), "
                   "fact_payments (68k), dim_project"),
        "eval": "workshop.evaluation.finance_ap_eval",
        "docs_domain": "finance_ap",
    },
    {
        "label": "commercial / revenue / store & machine performance",
        "keywords": ["price", "pricing", "elasticity", "store", "machine", "express", "tier",
                     "tiering", "revenue", "commercial", "basket", "footfall", "forecast",
                     "competitor", "promotion", "discount", "sales per", "category"],
        "schema": "workshop.retail_commercial",
        "tables": ("dim_store (400 stores, with tier/region/format), dim_product (174) + "
                   "product_elasticity (per-product elasticity), dim_costa_express_machine (1500), "
                   "fact_transactions (450k), fact_store_daily (292k daily rows: net_sales, footfall, "
                   "conversion_rate, labour_hours, sales_per_labour_hour), price_change_events, "
                   "sales_forecast, competitor_sites, customer_reviews, dim_date, dim_customer"),
        "eval": "workshop.evaluation.retail_commercial_eval",
        "docs_domain": "retail_commercial",
    },
    {
        "label": "HR / workforce analytics",
        "keywords": ["employee", "headcount", "attrition", "turnover", "workforce", "retention",
                     "hiring", "leaver", "staffing", "department", "people analytics"],
        "schema": "workshop.hr_people",
        "tables": ("dim_employee (5000), dim_department, fact_headcount_snapshot, "
                   "fact_attrition_events (1131 leavers)"),
        "eval": "workshop.evaluation.hr_people_eval",
        "docs_domain": None,  # no shared docs for this theme — KA (if added) generates its own
    },
    {
        "label": "AI adoption / ROI",
        "keywords": ["ai roi", "ai adoption", "tool usage", "productivity", "copilot usage",
                     "ai tool", "solution delivery", "seat utilization", "adoption rate"],
        "schema": "workshop.ai_productivity",
        "tables": ("dim_employee, dim_tool, fact_tool_usage (200k), fact_adoption_monthly, "
                   "fact_productivity_feedback"),
        "eval": "workshop.evaluation.ai_productivity_eval",
        "docs_domain": None,  # no shared docs for this theme — KA (if added) generates its own
    },
]
# The seeded catalog only exists in workspaces where a facilitator loaded it. Off unless SEEDED_DATA=on,
# so a workspace without it never gets told to read tables that aren't there (it generates data instead).
if os.environ.get("SEEDED_DATA", "off").lower() not in ("on", "1", "true"):
    SEEDED_DATASETS = []
# The shared document corpus (real PDFs in a Volume) that the Knowledge Assistant indexes.
SEEDED_DOCS_VOLUME = "workshop.docs_corpus (a Volume of real PDFs at /Volumes/workshop/docs_corpus/raw_data/pdf/, with a doc_metadata table; filter by domain)"


def _match_dataset(req: BuildRequest) -> dict | None:
    """Best-fit pre-seeded dataset for this idea/PRD. The Sit-Down pins one per session (or 'none' for an idea
    outside the workshop host's business); honour that. Otherwise fall back to keyword matching."""
    pinned = (req.design_answers or {}).get("seeded_schema")
    if pinned:
        return next((d for d in SEEDED_DATASETS if d["schema"] == pinned), None)
    return match_text(f"{req.idea} {req.prd_markdown} {req.project_name}")


def keyword_hits(ds: dict, text: str) -> int:
    """Whole-word/phrase hits only, so 'store' doesn't fire on 'restore' and 'spend' on 'spend time'."""
    t = text.lower()
    return sum(1 for kw in ds["keywords"] if re.search(r"(?<![a-z])" + re.escape(kw) + r"s?(?![a-z])", t))


def match_text(text: str) -> dict | None:
    best, best_score = None, 0
    for ds in SEEDED_DATASETS:
        score = keyword_hits(ds, text)
        if score > best_score:
            best, best_score = ds, score
    return best if best_score >= 1 else None

# The distilled, must-preserve guardrails per capability (fed to the model).
# Per-capability build rigor cross-checked against Databricks Solution Builder's
# recipes (2026-09; /tmp/sb_build_recipes.md) — the generalizable correctness
# patterns only. Its demo-narrative framing (a planted anomaly / "smoking gun") is
# deliberately excluded: a participant builds their own real app, not a scripted demo.
GUARDRAILS = {
    "data": (
        "Data comes first. Notebook cells need the '# Databricks notebook source' header and "
        "'# COMMAND ----------' separators or cells silently merge."),
    "Zerobus": (
        "Zerobus is a direct-write ingest API: producers push events straight into a governed Delta "
        "table. Create the table first with the exact schema the producer will send (columns and types). "
        "Grant the producer's service principal MODIFY on the table. The producer then opens Zerobus, "
        "points at your table, and starts pushing. Events land in seconds. Zerobus never changes the "
        "table's shape — if the producer's schema evolves, the table schema must evolve first (it is the "
        "contract). Verify the table has rows (SELECT * LIMIT 5) before the next step."),
    "SDP medallion": (
        "Build the data flow as an SDP (Spark Declarative Pipeline) with the medallion pattern: BRONZE "
        "tables land the raw Zerobus events as they are, SILVER tables clean, type and join them, GOLD "
        "tables are ready to use and are the ONLY tables Genie and the app read. Any scoring, flagging, "
        "ranking or drafted suggestion the plan describes is a rule computed in a gold table (a clear, "
        "explainable column such as a score, a flag and a reason), never an AI agent. Keep it small: two "
        "to four gold tables, named for what they mean. Add a short comment on each table saying what it "
        "holds, and data quality expectations on the key columns (e.g. ids not null). Run the pipeline and "
        "check each gold table has sensible rows before moving on; a pipeline that 'succeeded' with empty "
        "gold tables is not done."),
    "Genie": (
        "A Genie space is the natural-language layer over the GOLD tables, and creating the asset is NOT "
        "enough — its accuracy comes from how you ground it. Point it at the GOLD tables your SDP medallion "
        "produces (not the bronze or silver ones). Give each important column a short description with its "
        "units and allowed values — this is the single biggest driver of answer accuracy. Write the space "
        "instructions in the idea's real terms: what the key numbers mean, the business synonyms people "
        "use for them, how to format them, and any grain or caveats — not generic text. If the app leans "
        "on any DERIVED status that isn't a stored column (e.g. 'on hold', 'at risk', 'flagged', 'a "
        "mismatch'), spell it out in the space instructions as a computed rule over the real columns "
        "(e.g. \"'on hold' means the invoice amount differs from its matched PO by more than the 2% "
        "tolerance\") — otherwise Genie hunts for a literal status column and answers wrong. Then make it "
        "genuinely GOOD, not just present: write a handful (about 5 to 8) of benchmark questions phrased "
        "the way this app's real users would ask, each with the answer you expect; ask them in the space, "
        "and wherever Genie is wrong or picks the wrong table, tighten the column descriptions and "
        "instructions (often just adding a synonym) and re-ask until it answers them correctly and "
        "repeatably. Push a little past the obvious too — try a follow-up question and a differently-worded "
        "version of the same ask — since that is how people actually use it. Keep this lightweight: a short "
        "benchmark set you can eyeball, not a formal eval harness. Optional, only once it is answering well: "
        "you can export a good answer's query from Genie as a Metric View to lock that definition in — do "
        "that AFTER Genie is good, never as a prerequisite."),
    "Lakebase": (
        "Lakebase is managed Postgres for what people decide at runtime (an approval, a change, a note). Create your "
        "OWN Lakebase database/project for this build (named for your project) and provision it fresh; do NOT write to "
        "a shared or pre-existing project (you likely lack the Postgres role there and the connection fails auth). "
        "A new project auto-provisions a production branch with a ready primary endpoint. Create the one or two small "
        "tables the plan needs (e.g. a decision log with who, what, when, the item id, the decision and any note), "
        "keyed so they join back to the gold tables (same item ids), so the app can show each item's latest decision. "
        "It is not a place to copy the analytical tables. Insert one test "
        "row and read it back. The app (built next, in Genie App Builder) writes to these tables, so note the "
        "database and table names for that step. Autoscaling Lakebase sleeps when idle, so the first request after a "
        "quiet spell takes a few seconds."),
    "Databricks Apps": (
        "This step is NOT done in Genie Code. The app is built with Genie App Builder: in the workspace open Apps, "
        "then the Build tab, choose an App Space, name the app and paste a natural-language prompt. It generates an "
        "AppKit app with a live preview you refine with follow-up prompts, then deploy. (Genie App Builder is in Beta: "
        "a workspace admin must enable 'Governed agentic app-building' under Previews, and you need CAN CREATE APP on "
        "an App Space.) So the MOVE for this step is the prompt to paste into Genie App Builder, not into Genie Code. "
        "Write it as a clear description of the app, never code: who it is for and the moment they open it; the first "
        "screen and its ONE dominant element (matching the interaction model); each screen, what it shows and what "
        "each button does; exactly which data it reads (name the fully qualified gold tables, the Genie space if "
        "there is one) and what it writes (name the Lakebase database and table and the columns each "
        "action records). Start simple: one or two screens. The concept should tell them to iterate in short cycles, "
        "being specific about what to change. The verify is: the preview shows real rows from the gold tables, an "
        "action writes a row they can see in Lakebase, and the deployed app opens from its URL. Remember state must "
        "live in Lakebase or Unity Catalog, since the app scales to zero when idle."),
}

SYSTEM_PROMPT = f"""You are a senior Databricks Solutions Architect turning a designed blueprint into a
short, confidence-building build plan for someone NEW to Databricks. Every step is done in Genie Code (the
in-workspace AI coding agent) EXCEPT the Databricks Apps step, which is done in Genie App Builder (Apps >
Build tab): its move is the natural-language prompt they paste there. For each component in the build,
write ONE bite-sized step. There are no AI agents and no document Q&A in these builds.

{WORKSHOP_SCOPE}

{VOICE}

Each step has four parts, kept SHORT and plain:
- concept: 2-3 sentences on what you're building and why it matters for THEIR idea. Teach, don't lecture.
  The person asks the tool IN THEIR OWN WORDS; the move is only an example they can open if they need
  help. So never write "paste this prompt" or "paste the move" in concept, teach or verify: say "ask
  Genie Code to..." or "describe the app to Genie App Builder".
- move: the actual prompt the person pastes into Genie Code. This is the most important field. It is
  NOT an instruction to the person ("open the file and do step 1") — it is a real, well-formed prompt
  written TO Genie Code, the way a strong engineer would prompt a coding agent. It must:
    * State the goal in one line, grounded in their idea and real subject matter.
    * Give the specifics Genie Code needs to get it right the first time: which tables/columns, what
      the data should look like, the acceptance check to run at the end. Be concrete, not vague.
    * Fold the essential guardrail in as part of the ask (e.g. "…then confirm it answers an example
      question with a real number").
    * Do NOT write the SQL/Python yourself — tell Genie Code what to produce and to what standard.
    * Always name the schema (and, after step 1, the tables) explicitly, so the step still works even
      if the person lost the chat thread — but write it as part of the ongoing conversation (see below),
      not a cold standalone prompt.
  Keep it SHORT — 2 to 4 sentences, dense with the right specifics. In the app it is hidden behind a
  "help me prompt Genie Code" reveal (the person is encouraged to prompt in their own words first), so it
  is a tight, high-quality example prompt, never a wall of text and never a vague one-liner.
- verify: one concrete "you'll know it worked when…" check.
- teach: one optional sentence teaching a Genie Code or Databricks fact a newcomer wouldn't know.

HOW THESE PROMPTS ARE USED (this shapes how you write every move):
The person opens ONE Genie Code chat and works the steps in order as a single, continuing conversation,
checking each result before sending the next. A copy of the full plan (the PRD plus these steps) is
already saved in their workspace, where Genie Code can read it.
- STEP 1 (the data step) BOOTSTRAPS the conversation. Its move must, in order: (a) tell Genie Code to
  read the plan file first (refer to it with the EXACT literal token __PROJECT_MD__ — the app swaps in
  the real path; never write "PROJECT.md" yourself), so it has the whole picture and knows this is a
  step-by-step build it will check with the person as it goes; (b) create the dedicated schema in the
  catalog named below; (c) generate the sample data into that schema; (d) create the data-generation
  notebook and any files it writes INSIDE the project folder that holds __PROJECT_MD__ (the same folder as
  the plan) — NOT the workspace root or the user's home, so all the build's artifacts stay together.
  Include the key SHAPE of the data inline (the tables, the important columns, the realistic patterns,
  valid relationships) so it is buildable even if the file read is imperfect — do not rely on the file alone.
- EVERY step's move must RE-ANCHOR to the plan, not just step 1: open by pointing Genie Code at the plan
  with the exact token __PROJECT_MD__ (e.g. "Check your plan at __PROJECT_MD__ for this step, then …").
  Do NOT assume Genie Code still has the plan in context — the person may be in a fresh chat, and it does
  not carry the plan or the open file automatically. After re-anchoring, write the rest as a natural
  continuation ("… then, using the tables in <catalog>.<schema> …").
- Each step must ALSO stand on its own if pasted into a fresh chat: besides re-anchoring to __PROJECT_MD__,
  always name the catalog, the schema, and the specific tables the step depends on, so Genie Code can find
  the work even with no memory of earlier messages.

MULTI-USER ISOLATION (required — many people build in the same catalog at once):
- All of a participant's work lives in ONE dedicated schema so builds don't collide. Use the catalog and
  schema name given below EXACTLY, in every step, character for character (it is already unique to this
  build). Never add a username or any suffix in one step and not the others: one schema name, everywhere.
  If that schema already exists and belongs to someone else, step 1 stops and asks the person. Every table
  goes in that schema with a clear, descriptive name.
- Write the fully-qualified location (<catalog>.<schema>) in the move text so the person sees exactly
  where their data lives.

THE APP STEP (Genie App Builder, only when Databricks Apps is in the build). Its move is the prompt they paste
into Genie App Builder, and that prompt is what makes the app good, so write it to this bar:
- Build a BRIEFING, not a dashboard: the first screen opens on ONE clear finding or action matching the plan's
  "First screen" and interaction_model (browse_act = a ranked shortlist to act on; monitor = an overview; ask = a
  question box with a useful default answer already shown; explore = filters over a view; agent_actions = a
  review queue of suggestions the pipeline drafted, each with Approve / Change and the reason), then lets the
  person go to evidence, then detail. Never a blank canvas.
- Make the PRIMARY ACTION obvious and say exactly what it writes: which Lakebase table, which columns.
- ONLY IF Lakebase is in this build, CLOSE THE LOOP: when someone saves a decision, the app must show it. The
  list reads the gold table AND the Lakebase decisions (latest decision per item and date), so an approved item
  shows as approved or moves out of the to-do list. If Lakebase is NOT in the build, the app records nothing:
  never invent a Lakebase table or any write the plan doesn't include.
- Use only the pieces in this build. Never add a piece (Lakebase, Genie) in a step that the build doesn't list.
  There is no separate dashboard: key numbers and trends are charts on an app screen.
- Findings in plain language: each item gets a one-sentence observation a non-technical person could say out loud,
  with the supporting numbers beside it, not a raw table dump.
- Name the data precisely: the fully qualified gold tables to read, the Genie space to embed if the plan has one
  (as a chat panel for the open questions the plan names).
- Design: light theme, generous whitespace, one display font and one body font, tabular numerals for numbers,
  at most three meaning-coded colours always paired with a label, a loading skeleton and a helpful empty state.
  If the participant's organisation is the workshop host, ask for its brand colours; otherwise a clean neutral palette.
  Genie App Builder only sees the prompt, so name the look in it: the visual direction from design.md that fits the
  interaction model (Crisp Operational for lists to act on and monitoring, Warm Editorial for drafts and briefings,
  Bold Heritage for leadership views) and its two fonts.
- Keep it to one or two screens to start. The concept tells them to iterate in short cycles ("make the reason
  line bolder", "add a filter by region") rather than rewriting the prompt.
- Verify (the person checks in the preview, then after deploy): the first screen shows REAL rows from the gold
  tables; the primary action writes a row they can see in Lakebase; any ask panel returns a real Genie answer;
  the deployed app opens from its URL.

Honor the provided guardrails for each capability — they are hard-won and must be reflected in the
move or verify. Keep the whole thing readable by a beginner. No ceremony, no code.

WHO READS WHAT (critical — this is where plans lose beginners):
- The "move" is pasted straight into Genie Code (a coding agent that understands technical detail), or for
  the app step into Genie App Builder (which wants a plain description of screens and data, not code). So a
  guardrail's engineering specifics belong ONLY inside the move, never as something the user must understand.
- The "concept", "verify", and "teach" are read by the PERSON, whose Databricks familiarity is
  stated in the request. If they are new to it: do NOT put raw jargon (uv.lock, "temperature",
  /logz, "# COMMAND", MLflow tracing internals like @mlflow.trace / autolog / experiment id, Unity
  Catalog internals) in concept/verify/teach — say what it means in plain
  words or leave it out. The person should never have to look up a term to follow a step.
- The first step's concept should briefly reassure a newcomer how this works: they ask Genie Code in
  their own words, it does the technical work, they check the result. Don't assume they've used it.

Return ONLY one JSON object (no fence, no prose):
{{ "steps": [ {{ "capability": "<name or 'data'>", "title": "<short imperative>",
              "concept": "...", "move": "...", "verify": "...", "teach": "..." }}, ... ] }}
Order the steps exactly as given in the ORDER list.
"""


def _ordered_targets(req: BuildRequest) -> list[str]:
    # The first step is always the data step; the rest follow the dependency order.
    rest = [c for c in STEP_ORDER if c != "data" and c in req.capabilities]
    return ["data"] + rest


def _user_prompt(req: BuildRequest, catalog: str = "") -> str:
    targets = _ordered_targets(req)
    # A pre-seeded, governed dataset for this theme usually exists (facilitator-built,
    # aligned to the survey). If the idea maps to one, point the build at it ("seeded"
    # path) instead of regenerating data; otherwise fall back to generate-your-own.
    ds = _match_dataset(req)
    data_mode = "seeded" if ds else req.design_answers.get("data_mode", "synthetic")
    interaction = req.design_answers.get("interaction_model", "")
    schema = _schema_name(req.project_name or req.idea)
    # The catalog comes from workshop config (facilitator-set). When unset, tell Genie Code
    # to use the workshop's default catalog rather than inventing a name.
    cat = catalog.strip()
    catalog_line = (
        f"Catalog to build in (workshop-provided — every schema and table lives here): {cat}\n"
        if cat else
        "Catalog: none pre-set — tell Genie Code to create the schema in the workshop's default catalog "
        "(or ask the user which catalog to use), and to use that same catalog in every step.\n")
    # The generic data guardrail plus the path-specific one for this data_mode.
    guardrails = dict(GUARDRAILS)
    guardrails["data"] = f"{GUARDRAILS['data']} {DATA_GUARDRAIL.get(data_mode, DATA_GUARDRAIL['synthetic'])}"
    # When a pre-seeded dataset matched, thread it through the dependent steps: the
    # ready-made benchmark set into Genie, the shared docs Volume into Knowledge
    # Assistant, and on-behalf-of-user (OBO) auth into the App (the app SP can't be
    # granted access to the shared catalog by a participant, but the logged-in user has it).
    if ds:
        if "Genie" in guardrails:
            guardrails["Genie"] += (
                f" A READY-MADE benchmark set for this theme lives in {ds['eval']} (columns: question, "
                f"expected_sql, expected_answer, expected_facts) — use THOSE questions as your benchmark "
                f"instead of inventing your own, and tighten the space's column descriptions and instructions "
                f"until Genie's answers match the expected ones repeatably.")
        if "Databricks Apps" in guardrails:
            guardrails["Databricks Apps"] += (
                f" The app reads the shared seeded tables in {ds['schema']} (read-only) plus the participant's own gold "
                f"tables; name both fully qualified in the App Builder prompt.")
    gl = "\n".join(f"- {t}: {guardrails.get(t, '')}" for t in targets)
    # The PRD is authoritative: the user may have refined the blueprint (changed the
    # whole idea) after describing it. Build from the plan they approved, not the first
    # thing they typed. Fall back to the raw idea only if no PRD was passed.
    if req.prd_markdown.strip():
        what = (f"The approved plan (PRD) — build EXACTLY this, it is what the user settled on:\n"
                f"\"\"\"\n{req.prd_markdown.strip()}\n\"\"\"\n")
        if req.idea.strip():
            what += f"\n(Their original one-liner, for tone only — the PRD wins if they differ: \"{req.idea.strip()}\")\n"
    else:
        what = f"Idea:\n\"\"\"\n{req.idea.strip()}\n\"\"\"\n"
    return (
        f"{what}\n"
        f"Databricks familiarity: {req.expertise}\n"
        + (f"Participant's organisation context: {req.design_answers['participant_context']} (use their terms and "
           f"currency; never assume the workshop host's company)\n" if req.design_answers.get("participant_context") else "")
        + f"Data mode: {data_mode}\n"
        f"Interaction model: {interaction or 'not specified — infer it from the plan'} "
        f"(this sets the app's first screen and primary action: browse_act=ranked shortlist to act; "
        f"monitor=an overview screen of key numbers with charts; ask=question box; explore=flexible drilling; "
        f"agent_actions=a review queue: opens on the suggestions the pipeline's rules drafted for each item, "
        f"the person approves or overrides each, every decision recorded to Lakebase as an audit trail).\n"
        f"The plan names who it's for, the first screen, and the primary action — the app step must build "
        f"an app that opens on that primary action for that person, not a generic dashboard.\n"
        f"{catalog_line}"
        + (
            f"PRE-SEEDED DATA — USE THIS, DO NOT REGENERATE: this use case maps to the workshop's ready-made "
            f"'{ds['label']}' dataset. Point step 1 (and every later step) at {ds['schema']}. Tables: "
            f"{ds['tables']}. The participant can SELECT these via their workshop group. Benchmark Genie against "
            f"{ds['eval']}. Only create SUPPLEMENTARY tables their use case needs beyond these — do not duplicate "
            f"the seeded tables.\n"
            f"TWO SCHEMAS, DO NOT CONFUSE THEM — this is a strict naming rule for EVERY step's move:\n"
            f"  1. SEEDED (shared, read-only): {ds['schema']} — always qualify seeded tables as "
            f"`{ds['schema']}.<table>` (e.g. {ds['schema']}.fact_invoices). NEVER create a table here.\n"
            f"  2. THE PARTICIPANT'S OWN (writable): {SEEDED_CATALOG}.{schema} — this is where step 1 creates any "
            f"supplementary tables AND where Lakebase-adjacent app state lives. Always qualify the participant's "
            f"own supplementary tables as `{SEEDED_CATALOG}.{schema}.<table>` (e.g. {SEEDED_CATALOG}.{schema}."
            f"fact_receipts). NEVER write a supplementary table under the seeded schema name ({ds['schema']}) — "
            f"a supplementary table lives ONLY in {SEEDED_CATALOG}.{schema}.\n"
            if ds else
            f"Dedicated schema for this participant (isolate ALL their work here; the data step creates it, "
            f"every later step references it): {schema}\n")
        +
        f"The full plan (this PRD plus the steps) is saved in the participant's workspace; step 1 must tell "
        f"Genie Code to read it first, referring to it with the exact literal token __PROJECT_MD__.\n"
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
    return loads_tolerant(t)


def build_plan(req: BuildRequest) -> BuildPlan:
    # Clamp pathologically long input so a rambling idea/PRD can't bloat the prompt and
    # push the JSON output past the token budget (that's what truncates it).
    req.idea = clamp_idea(req.idea)
    req.prd_markdown = clamp_idea(req.prd_markdown, 8000)
    try:
        from . import workshop
        catalog = workshop.build_catalog()
    except Exception:
        catalog = ""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _user_prompt(req, catalog)},
    ]
    last = None
    # Escalate the token budget each retry: the architecture is always 6 steps (data + the
    # 5 locked capabilities), and detailed moves can overrun a fixed budget — the JSON then
    # truncates mid-string (finish_reason=length) and a same-budget retry just truncates
    # again. Growing the budget gives an unusually large plan the room to finish.
    budgets = [5000, 8000, 11000]
    for attempt in range(3):
        raw = llm.complete(messages, max_tokens=budgets[attempt])
        try:
            parsed = _extract_json(raw)
            steps = []
            for i, s in enumerate(parsed.get("steps", []), 1):
                # Sanitize the person-facing fields (VOICE forbids em-dashes; the model
                # still leaks them). `move` is the paste-to-agent prompt, cleaned too.
                cap = s.get("capability", "")
                steps.append(BuildStep(
                    n=i, title=strip_em_dashes(s.get("title", "")), capability=cap,
                    tool="app_builder" if cap == "Databricks Apps" else "genie_code",
                    concept=strip_em_dashes(s.get("concept", "")), move=strip_em_dashes(s.get("move", "")),
                    verify=strip_em_dashes(s.get("verify", "")), teach=strip_em_dashes(s.get("teach", ""))))
            # Only the build's own pieces: a step for a component the build doesn't use is dropped, in code.
            allowed = set(_ordered_targets(req))
            steps = [st for st in steps if st.capability in allowed or not st.capability]
            for i, st in enumerate(steps, 1):
                st.n = i
            if steps:
                return BuildPlan(steps=steps)
            raise ValueError("no steps")
        except Exception as ex:
            last = ex
            messages.append({"role": "assistant", "content": raw[:400]})
            messages.append({"role": "user", "content":
                             "That was not valid JSON. Return ONLY one valid JSON object in the exact shape — "
                             "every string closed, every element comma-separated, no fences."})
    raise ValueError(f"build plan generation failed: {last}")
