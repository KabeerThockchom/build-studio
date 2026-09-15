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

# Canonical dependency order for the steps we know how to guide. No Lakeflow —
# a workshop day never stands up a live ingestion source.
STEP_ORDER = ["data", "Genie", "Knowledge Assistant", "Lakebase", "Supervisor agent", "Databricks Apps"]

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
}

# The distilled, must-preserve guardrails per capability (fed to the model).
# Per-capability build rigor cross-checked against Databricks Solution Builder's
# recipes (2026-09; /tmp/sb_build_recipes.md) — the generalizable correctness
# patterns only. Its demo-narrative framing (a planted anomaly / "smoking gun") is
# deliberately excluded: a participant builds their own real app, not a scripted demo.
GUARDRAILS = {
    "data": (
        "Data comes first. Notebook cells need the '# Databricks notebook source' header and "
        "'# COMMAND ----------' separators or cells silently merge."),
    "Genie": (
        "A Genie space is the natural-language layer over the tables, and creating the asset is NOT "
        "enough — its accuracy comes from how you ground it. Point it at a few query-ready tables (not "
        "many raw ones). Give each important column a short description with its units and allowed values "
        "— this is the single biggest driver of answer accuracy. Write the space instructions in the "
        "idea's real terms: what the key numbers mean, the business synonyms people use for them, how to "
        "format them, and any grain or caveats — not generic text. Then make it genuinely GOOD, not just "
        "present: write a handful (about 5 to 8) of benchmark questions phrased the way this app's real "
        "users would ask, each with the answer you expect; ask them in the space, and wherever Genie is "
        "wrong or picks the wrong table, tighten the column descriptions and instructions (often just "
        "adding a synonym) and re-ask until it answers them correctly and repeatably. Push a little past "
        "the obvious too — try a follow-up question and a differently-worded version of the same ask — "
        "since that is how people actually use it. Keep this lightweight: a short benchmark set you can "
        "eyeball, not a formal eval harness. Optional, only once it is answering well: you can export a "
        "good answer's query from Genie as a Metric View to lock that definition in — do that AFTER Genie "
        "is good, never as a prerequisite. An empty or unconfigured space looks created but is useless. "
        "The app surfaces this space as a live FREE-TEXT ask box that calls the Genie Conversation API for "
        "arbitrary questions — it must actually call Genie, never re-implement the answer as a fixed SQL query."),
    "Knowledge Assistant": (
        "Knowledge Assistant lets the app answer from documents/notes with no embedding pipeline to build. "
        "Point it at the text source (a table column or docs) and kick off indexing. If the idea has no "
        "obvious document source, GENERATE a small, focused set of realistic documents for it (roughly 6 to "
        "12 short documents, e.g. SOPs, policies, past notes/tickets, product or FAQ pages) — name the "
        "specific document types and how many in the prompt, and make their names, IDs and dates match the "
        "tables exactly, so a document answer lines up with the data. This build includes a "
        "document-answering piece. Keep the set focused rather than dumping everything in. "
        "IMPORTANT: indexing runs "
        "in the background and takes several minutes to tens of minutes; do NOT sit and poll waiting for it to "
        "finish, and do NOT block the rest of the build on it. Kick it off, tell the user it's indexing in the "
        "background (they can move on and check back), and treat 'a query returns a relevant passage' as a "
        "later verification once indexing is READY, not a same-step confirm."),
    "Lakebase": (
        "Lakebase is managed Postgres for the app's writes/state (e.g. recording a decision). Keep it to a "
        "few small operational tables for what the app records at runtime — it is not a place to copy the "
        "analytical tables. Create the table you need; the app authenticates with a short-lived token "
        "minted per connection (no password). Autoscaling Lakebase sleeps when idle, so the FIRST request "
        "after a quiet period (like the morning of a demo) waits while it wakes: open the connection with a "
        "generous timeout and retry the first attempt (e.g. a psycopg pool opened with wait=True and "
        "timeout~30s, or a small retry loop), so a cold start shows briefly instead of erroring."),
    "Supervisor agent": (
        "The supervisor agent is a small tool-calling loop (not a framework, and NOT the OpenAI Agents SDK): "
        "it calls the Foundation Model API and routes to the tools you built (for example Genie for data "
        "questions and Lakebase to record something, plus any others in the plan). Keep it to a small number "
        "of tools (two or three); each tool is a plain Python function whose DOCSTRING is its description — "
        "write a clear, distinct one-line docstring per tool, because that text is what the model routes on, "
        "so it picks by the intent of the question without guessing. Instrument it with MLflow tracing so "
        "every question is observable: call the model through the OpenAI-compatible Databricks client (the "
        "`openai`/`databricks-openai` client pointed at the FM endpoint, still a plain loop) and turn on "
        "`mlflow.openai.autolog()`, which captures the model and tool-calling calls automatically; also "
        "decorate the loop's entry function and each tool with `@mlflow.trace` so the full span tree — the "
        "question, the routing decision, which tool ran, its latency and result, the final answer — is "
        "recorded. Tracing needs a Databricks MLflow experiment the app can write to: create one and grant "
        "the app's service principal CAN_EDIT on it (same pattern as the data/warehouse grants; the app-level "
        "env wiring is in the Databricks Apps step). Confirm it works by asking one question that should go to "
        "each tool, checking it picked the right one, AND opening the experiment's traces to see each call as "
        "a span (a faked tool shows up as a missing span — this is how you catch a piece that was skipped). "
        "Omit the temperature param (some models reject it)."),
    "Databricks Apps": (
        "The app hosts the UI. Build it as a React + Tailwind CSS front end with a FastAPI (Python) backend — "
        "this exact stack, not Streamlit/Gradio/Dash. Hold a high design bar (see APP QUALITY below): it should "
        "look like a product a team would use, and it should visibly use the pieces in the plan (an in-app "
        "Genie ask box, the person's actions saved to Lakebase, and any other pieces the plan includes). "
        "Hard-won truths: (1) a green/SUCCEEDED deploy is NOT a working app — "
        "always open it in the browser and confirm it RENDERS and lays out correctly AND that its data "
        "calls return real rows (not an empty or misaligned screen), watch /logz for startup errors. "
        "(2) the built index.html MUST be a complete HTML5 document: a <!DOCTYPE html>, an <html> with a "
        "<head> containing charset and viewport meta tags, and a <body> wrapping the root div. A bare "
        "script+div with no doctype renders in quirks mode with a broken layout — confirm the built "
        "index.html has the full shell. "
        "(3) Deploy ONLY the built dist plus the backend, and do it with an ALLOWLIST, never a denylist. In "
        "databricks.yml set `sync.include: [\"dist/**\", \"main.py\", \"requirements.txt\", \"app.yaml\"]`. When "
        "include is set, ONLY those paths deploy — so dist/index.html always ships (it is under dist/**), while a "
        "root-level index.html, the src/ sources, node_modules, package.json and the configs all stay out "
        "automatically, with no list of things to remember to exclude. Do NOT instead reach for "
        "`sync.exclude: [\"index.html\", ...]`: a bare index.html glob ALSO matches dist/index.html, so the built "
        "page never ships and the app 500s on every page load — this is a real, repeated failure. `git init` the "
        "app folder too (bundle deploy only honors .gitignore in a real git tree). A healthy deploy is ~15 files. "
        "The allowlist also prevents the two classic crashes: node_modules shipping (deploy uploads thousands of "
        "files and times out) and package.json shipping (the runtime runs `npm install` on compute and crashes). "
        "Use requirements.txt (never a uv.lock — it can leak internal proxy URLs). "
        "(4) The app.yaml command MUST use a LITERAL port 8000, e.g. [\"uvicorn\", \"main:app\", \"--host\", "
        "\"0.0.0.0\", \"--port\", \"8000\"]. Databricks Apps execs the command directly with NO shell expansion, "
        "so \"${DATABRICKS_APP_PORT}\" is passed verbatim and crashes the app ('not a valid integer'). Never put "
        "a ${VAR} in the command args. "
        "(5) The app runs as a SERVICE PRINCIPAL, not you — so anything it queries needs grants to THAT SP: "
        "USE CATALOG + USE SCHEMA + SELECT on the data, and CAN USE on the SQL warehouse the Genie space runs "
        "on. Without them a Genie/SQL call fails at runtime (the app deploys fine, then /api calls 500/502 with "
        "a permissions/'FAILED' error). Grant the app's SP access to the data and warehouse, and verify a query "
        "actually returns rows as the app, not just as you. "
        "(6) If the app runs the supervisor agent, wire its MLflow tracing at the app level: add `mlflow` to "
        "requirements.txt and set `MLFLOW_TRACKING_URI=databricks` and `MLFLOW_EXPERIMENT_ID=<experiment id>` as "
        "env in app.yaml (an env value, not in the command args — never a ${VAR} in the command). Make trace "
        "init resilient: a tracing or missing-experiment failure must degrade to untraced, never 500 a request. "
        "The experiment itself and the SP grant on it are set up in the supervisor agent step."),
}

SYSTEM_PROMPT = f"""You are a senior Databricks Solutions Architect turning a designed blueprint into a
short, confidence-building build plan for someone NEW to Databricks, working in Genie Code (the
in-workspace AI coding agent). For each capability they chose, write ONE bite-sized step.

{WORKSHOP_SCOPE}

{VOICE}

Each step has four parts, kept SHORT and plain:
- concept: 2-3 sentences on what you're building and why it matters for THEIR idea. Teach, don't lecture.
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
  schema names given below. In a shared catalog, step 1 appends the person's own Databricks username to
  the schema name to keep it unique. Every table goes in that schema with a clear, descriptive name.
- Write the fully-qualified location (<catalog>.<schema>) in the move text so the person sees exactly
  where their data lives.

APP QUALITY & STACK (the finished app must impress, not look like a prototype):
- Stack is fixed: a React + Tailwind CSS front end with a FastAPI (Python) backend, deployed as a Databricks
  App. Prescribe exactly this in the app step. Do NOT use Streamlit, Gradio, or Dash. Compile Tailwind at
  BUILD time (Vite + the tailwindcss plugin, emitting a real CSS file into dist/) — do NOT load Tailwind from
  a browser/play CDN (@tailwindcss/browser, cdn.tailwindcss.com): that ships an in-browser compiler that is
  slow, flashes unstyled content, and can be blocked by the app's content-security policy.
- Build a BRIEFING, not a dashboard. The app opens on ONE clear finding or action — matching the plan's
  "First screen" and interaction_model — then lets the person go to evidence, then to detail (answer ->
  evidence -> detail). Never a blank canvas or a bare query box with nothing on it. Build it FOR the persona
  in the plan's "Who it's for", for their one job.
- IF the interaction_model is "agent_actions", build a SUPERVISE-THE-AGENT CONSOLE instead of a passive
  briefing: the app opens on the actions the agent has already worked through and PROPOSES — each item
  showing what the agent read, its judgement/confidence, and the drafted action — most consequential first.
  The primary action is APPROVE or OVERRIDE per item; approving records (and, where in scope, performs) the
  action, and every approve/override is written to Lakebase as a visible audit trail / activity log the
  person can scroll. Here the Supervisor agent must actually DO the per-item work (reason across the data and
  notes and propose an action), not merely answer ad-hoc questions, and Lakebase is the action ledger, not a
  single saved flag. Respect the write boundary: if an action targets an external system the build can't call,
  record the decided action and label it as recorded (not sent).
- Make the PRIMARY ACTION obvious. The plan's "Primary action" (the thing they do 80% of the time) dominates
  the entry screen — front and center, not buried behind a menu or a detail panel.
- Findings in plain language, not raw tables. State each insight as a one-sentence observation a non-technical
  person could say out loud ("Store 214 is trending behind similar stores this week"), with the numbers
  supporting the sentence. Don't dump an unfiltered table as the answer.
- Design bar (build to this, it is how the good apps look):
  * Typography: one strong display/number font and one clean body font; use tabular numerals everywhere numbers
    appear so they align as data (CSS font-variant-numeric: tabular-nums).
  * Color: at most THREE semantic colors, each meaning one thing (e.g. risk / good / watch) and ALWAYS paired
    with a label or icon, never color alone. No gradients, no "AI blue", no neon-on-dark.
  * Light theme, daylight/projector-safe. Generous whitespace, consistent spacing, real hierarchy.
  * Intentional states: loading is a skeleton that mirrors the final layout (not a spinner); empty states say
    what's missing and the next step (not a blank panel).
  * No AI slop: definitive language (no "may/might/could"), no fabricated ROI tiles, no ChatGPT-clone chat
    chrome, no emoji-as-icons, no clip-art.
- Fast base + responsive detail: render the main briefing from deterministic queries so it loads instantly;
  reserve the Genie/agent call for drill-down follow-ups, not the cold entry point.
- Integrate the pieces FOR REAL, not for show — this is the most common shortcut to avoid:
  * Every build runs a Genie flow — this is fixed architecture, not optional. The app MUST include a genuine
    FREE-TEXT ask box (the person types ANY question in their own words) wired to the Genie Conversation API:
    start a conversation against the space and return its answer. It MUST call Genie. Do NOT fake it with a
    hardcoded SQL string formatted into a sentence, and do NOT reduce it to one canned/templated question — a
    fixed question is exactly what gets hardcoded, and an instant answer is the tell that Genie was never
    called. If the app has only one fixed insight, that belongs in the deterministic briefing; the ask box is
    for the open-ended questions Genie exists to answer.
  * Anything the app records (a decision, a flag, a note, an approval) MUST persist to the Lakebase Postgres
    table via the attached database resource. Do NOT write it to a Unity Catalog table via the warehouse
    instead — that is not what Lakebase is for, and it means the piece was skipped.
  * The finished app must visibly use the whole architecture the plan lists, not just the one deterministic
    table behind the briefing.
- Use the idea as the SEED, not a cage. Build a complete, genuinely useful app around it: sensible supporting
  views, a couple of relevant metrics, thoughtful detail. Expand tastefully beyond the literal one-liner
  rather than shipping the thinnest possible interpretation. Hold the ARCHITECTURE fixed (the pieces above are
  all required), but let the app's features and polish breathe.

COMMON FIRST-PASS BUGS TO AVOID (hard-won from real builds — fold the fix into the move):
- A useEffect callback must return undefined or a cleanup FUNCTION, never a value. Writing
  `useEffect(() => el.scrollIntoView({{behavior:"smooth"}}), deps)` returns a Promise in some browsers,
  which React later tries to call as the cleanup -> "TypeError: n is not a function" and the UI crashes on
  the next render. Always use a block body: `useEffect(() => {{ el.scrollIntoView(...); }}, deps)`.
- With strict TypeScript (verbatimModuleSyntax / noUnusedLocals), use `import type` for type-only imports
  and remove unused imports, or the build fails.
- Serve the built SPA robustly: the backend must resolve dist/index.html relative to the app file (not the
  process working directory, which varies), and only error on a genuinely missing file.
- Parse responses defensively: an error response may not be JSON; guard `response.json()`.
- Wrap every backend call to a Databricks service (Genie, the SQL warehouse, Lakebase, the model) in
  try/except: on failure, log it and return a clean JSON error the UI can show (e.g. {{"error": "..."}}),
  never let it bubble up as a raw 500. One transient blip should degrade a panel, not crash the app.

VERIFY THE CORE ACTION BEFORE 'DONE' (the single most important check):
- TWO things must BOTH pass after deploy, not just one. (a) The ROOT page must render: open the deployed
  app's base URL and confirm it returns 200 with a full <!DOCTYPE html> document (a 500 or blank here means
  the built dist/index.html did not ship — the sync.include allowlist above prevents this). (b) The app's ONE
  primary action (ask a question, flag a store, record a decision) must be exercised end-to-end and return a
  real 200 with real data. An app whose API works but whose root page 500s is NOT done, and neither is one
  that renders but whose main action fails. Make BOTH the app step's verify condition.
- Also verify the pieces are wired FOR REAL, not faked: if there is an ask box, confirm it actually calls
  Genie (a real conversation with real latency, not an instant hardcoded string); if the plan records
  anything, confirm a real row lands in the Lakebase Postgres table (not a Unity Catalog table). A piece that
  only appears to be used does not count as done.

Honor the provided guardrails for each capability — they are hard-won and must be reflected in the
move or verify. Keep the whole thing readable by a beginner. No ceremony, no code.

WHO READS WHAT (critical — this is where plans lose beginners):
- The "move" is pasted straight into Genie Code, which is a coding agent and understands technical
  detail — so a guardrail's engineering specifics (packaging files, notebook cell headers, model
  parameters, log pages) belong ONLY inside the move, phrased as an instruction TO Genie Code, never
  as something the user must understand.
- The "concept", "verify", and "teach" are read by the PERSON, whose Databricks familiarity is
  stated in the request. If they are new to it: do NOT put raw jargon (uv.lock, "temperature",
  /logz, "# COMMAND", MLflow tracing internals like @mlflow.trace / autolog / experiment id, Unity
  Catalog internals) in concept/verify/teach — say what it means in plain
  words or leave it out. The person should never have to look up a term to follow a step.
- The first step's concept should briefly reassure a newcomer how this works: they paste the move
  into Genie Code, it does the technical work, they check the result. Don't assume they've used it.

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
    data_mode = req.design_answers.get("data_mode", "synthetic")
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
        f"Data mode: {data_mode}\n"
        f"Interaction model: {interaction or 'not specified — infer it from the plan'} "
        f"(this sets the app's first screen and primary action: browse_act=ranked shortlist to act; "
        f"monitor=dashboard/overview; ask=question box; explore=flexible drilling; "
        f"agent_actions=a supervise-the-agent console: opens on the actions the agent has proposed, "
        f"person approves/overrides each, every decision recorded to Lakebase as an audit trail).\n"
        f"The plan names who it's for, the first screen, and the primary action — the app step must build "
        f"an app that opens on that primary action for that person, not a generic dashboard.\n"
        f"Foundation Model API endpoint to use for the app's own LLM/agent calls (the supervisor agent, any "
        f"in-app model call): '{config.get_serving_endpoint()}'. Use this exact endpoint; do not hardcode a "
        f"different model, and omit the temperature param (some models reject it).\n"
        f"{catalog_line}"
        f"Dedicated schema for this participant (isolate ALL their work here; the data step creates it, "
        f"every later step references it): {schema}\n"
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
                steps.append(BuildStep(
                    n=i, title=strip_em_dashes(s.get("title", "")), capability=s.get("capability", ""),
                    concept=strip_em_dashes(s.get("concept", "")), move=strip_em_dashes(s.get("move", "")),
                    verify=strip_em_dashes(s.get("verify", "")), teach=strip_em_dashes(s.get("teach", ""))))
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
