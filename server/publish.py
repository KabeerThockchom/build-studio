"""M1/M2 — persist the settled plan into the participant's workspace as ONE technical
project doc Genie Code can build from autonomously.

Two audiences, one source of truth split by where it lives:
  - IN-APP the participant sees a friendly, short PRD (the Blueprint screen).
  - IN THE WORKSPACE Genie Code gets PROJECT.md — the full, prescriptive spec: the plan,
    the architecture, the hard-won build practices (# COMMAND headers, requirements.txt,
    Genie-space config, etc.), and the ordered steps. It is written to be executed, not
    skimmed, so a single "read PROJECT.md and build it" is enough.

Identity (the important bit): deployed, the app is a SERVICE PRINCIPAL. To land the doc in
the PARTICIPANT'S own workspace home — where their Genie Code runs — we must act on behalf
of the user with the token Databricks Apps forwards in the `x-forwarded-access-token`
header (requires the app's `files` user-authorization scope). Locally there is no such
header, so we fall back to the CLI-profile identity. Best-effort throughout: a failure
never blocks the build — the step-by-step backup still works — so the route returns
ok:false with a reason rather than raising.
"""
import io
import os
import re
from . import config
from .models import BuildStep, Decision

DOC_NAME = "PROJECT.md"


def _slug(text: str, fallback: str = "my-build") -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return (s[:48].rstrip("-") or fallback)


def _client_and_home(user_token: str | None, user_email: str) -> tuple[object, str, str]:
    """(workspace client, the user's workspace home dir, whose identity). With a forwarded
    user token we act AS the user, so the project lands in THEIR home. Otherwise the
    CLI-profile identity (local dev)."""
    email = (user_email or "").strip()
    if user_token:  # deployed on-behalf-of-user
        from databricks.sdk import WorkspaceClient
        # The app runtime env also holds the SP's OAuth creds, so we MUST force PAT auth —
        # otherwise the SDK errors with "more than one authorization method configured".
        w = WorkspaceClient(host=config.get_workspace_host(), token=user_token, auth_type="pat")
        if not email:
            email = w.current_user.me().user_name
        return w, f"/Workspace/Users/{email}", email
    w = config.get_workspace_client()          # local profile (or SP if no token)
    email = email or w.current_user.me().user_name
    return w, f"/Workspace/Users/{email}", email


def _deep_link(target: str) -> str:
    """A clickable workspace URL to the project doc. The workspace browser fragment wants
    the path WITHOUT the /Workspace mount prefix."""
    host = config.get_workspace_host().rstrip("/")
    ws_path = target[len("/Workspace"):] if target.startswith("/Workspace") else target
    return f"{host}/#workspace{ws_path}/{DOC_NAME}"


def _build_practices(steps: list[BuildStep], data_mode: str) -> list[str]:
    """The hard-won, must-follow build rules, pulled from the same distilled guardrails the
    step generator uses — but stated as a standing checklist so Genie Code has the
    prescriptive knowledge in one place (this is what makes autonomous building safe)."""
    from .build_plan import GUARDRAILS, DATA_GUARDRAIL
    caps = [s.capability for s in steps]
    out: list[str] = []
    if any(c == "data" for c in caps) or not caps:
        d = f"{GUARDRAILS['data']} {DATA_GUARDRAIL.get(data_mode, DATA_GUARDRAIL['synthetic'])}"
        out.append(f"**Data** — {d}")
    for cap in ["Genie", "Knowledge Assistant", "Lakebase", "Supervisor agent", "Databricks Apps"]:
        if cap in caps and cap in GUARDRAILS:
            out.append(f"**{cap}** — {GUARDRAILS[cap].strip()}")
    return out


def _project_md(*, idea: str, prd_markdown: str, decisions: list[Decision], steps: list[BuildStep],
                usable_assets: str, data_mode: str, doc_path: str = "") -> str:
    """The single, technical, execute-me spec for Genie Code. `doc_path` is this file's own
    workspace path, swapped in for the __PROJECT_MD__ token the build prompts carry."""
    prd_ref = doc_path or "PROJECT.md in this project folder"
    title = idea.strip().split("\n")[0]
    title = (title[:70].rstrip() + "…") if len(title) > 70 else title
    out = [f"# {title or 'Your build'} — Build Studio project", ""]
    out.append(
        "You are Genie Code, the coding agent in this Databricks workspace. Build the app "
        "specified below, working through the steps in order and confirming each one before "
        "moving on. This document is the source of truth — the plan, the architecture, the "
        "build practices to follow, and the concrete steps. Everything you need is here.")
    out.append("")

    out += ["## What we're building", "", (prd_markdown.strip() or f"Build: {idea.strip()}"), ""]

    if decisions:
        out += ["## Architecture — the pieces and why", ""]
        for d in decisions:
            line = f"- **{d.tag}** — {d.text}"
            if d.tradeoff:
                line += f"  _(tradeoff: {d.tradeoff})_"
            out.append(line)
        out.append("")

    out += ["## Existing assets to use", ""]
    out.append(usable_assets.strip() if usable_assets.strip()
               else "None specified — generate the sample data described in the steps; don't assume existing tables.")
    out.append("")

    practices = _build_practices(steps, data_mode)
    if practices:
        out += ["## Build practices — follow these throughout", ""]
        out += [f"- {p}" for p in practices]
        out += ["- **App stack (fixed)**: build the app as a React + Tailwind CSS front end with a FastAPI "
                "(Python) backend, deployed as a Databricks App. Do NOT use Streamlit, Gradio, or Dash. Compile "
                "Tailwind at BUILD time (Vite + the tailwindcss plugin, emitting a CSS file into dist/); do NOT "
                "load Tailwind from a browser/play CDN (@tailwindcss/browser, cdn.tailwindcss.com) — it ships an "
                "in-browser compiler that is slow, flashes unstyled content, and can be CSP-blocked.",
                f"- **Foundation Model endpoint**: for any in-app LLM or agent call (the supervisor agent), use the "
                f"model serving endpoint `{config.get_serving_endpoint()}`. Do not hardcode a different model; omit "
                f"the temperature param (some models reject it).",
                "- **Complete HTML shell + verify it renders**: the built `index.html` must be a full HTML5 "
                "document (`<!DOCTYPE html>`, a `<head>` with charset and viewport meta, a `<body>` wrapping "
                "the root div) or the page renders in quirks mode with a broken layout. After deploy, open the "
                "URL and confirm it actually renders and lays out correctly — a green deploy is not proof.",
                "- **Deploy lean with an ALLOWLIST, not a denylist**: `git init` the app folder and set "
                "`sync.include: [\"dist/**\", \"main.py\", \"requirements.txt\", \"app.yaml\"]` in `databricks.yml`. "
                "With include set, ONLY those paths deploy, so `dist/index.html` always ships while a root-level "
                "index.html, `src/`, `node_modules`, `package.json` and configs stay out automatically. Do NOT use "
                "`sync.exclude: [\"index.html\", ...]` — a bare index.html glob also matches `dist/index.html`, so the "
                "built page never ships and the app 500s on every load. If node_modules ships the deploy times out; "
                "if `package.json` ships the runtime runs `npm install` and crashes — the allowlist prevents both.",
                "- **Literal port in app.yaml**: the command must hardcode port 8000 — "
                "`[\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]`. Databricks Apps execs "
                "the command with no shell expansion, so `${DATABRICKS_APP_PORT}` is passed literally and crashes the app.",
                "- **Grant the app's service principal**: the app runs as an SP, not you. Anything it queries "
                "needs grants to that SP — USE CATALOG + USE SCHEMA + SELECT on the data, and CAN USE on the "
                "Genie/SQL warehouse — or Genie/SQL calls fail at runtime (deploys fine, then /api calls 500/502). "
                "Verify a query returns rows as the app, not just as you.",
                "- **Frontend footguns**: a `useEffect` must return undefined or a cleanup function, never a value "
                "(e.g. `useEffect(() => el.scrollIntoView({behavior:\"smooth\"}), deps)` returns a Promise → React "
                "calls it as cleanup → 'TypeError: n is not a function'; use a block body). With strict TS, use "
                "`import type` and remove unused imports. Serve `dist/index.html` by a path relative to the app "
                "file, not the working directory. Guard `response.json()` (error responses may not be JSON).",
                "- **Wrap backend service calls**: every call to Genie, the SQL warehouse, Lakebase, or the model "
                "goes in a try/except that logs the error and returns a clean JSON error ({\"error\": \"...\"}) the "
                "UI can show. A transient failure should degrade one panel, never surface as a raw 500.",
                "- **Verify BOTH the root page and the core action before done**: after deploy, (a) open the base "
                "URL and confirm it returns 200 with a full `<!DOCTYPE html>` page (a 500 here means dist/index.html "
                "did not ship — check the sync.include allowlist), and (b) actually perform the app's ONE primary "
                "action (ask a question, flag an item) and confirm a real 200 with real data. An app whose API works "
                "but whose root page 500s is not done, and neither is one that renders but whose main action fails.",
                "- **Briefing, not dashboard**: open on ONE clear finding or action (matching the plan's First "
                "screen and interaction model), then evidence, then detail. Make the plan's Primary action "
                "obvious on the entry screen. Never a blank canvas or an empty query box. Build it for the "
                "persona in 'Who it's for'.",
                "- **Findings in plain language**: state insights as one-sentence observations a non-technical "
                "person could say aloud, with numbers supporting the sentence — not an unfiltered table dump.",
                "- **Design spec**: one strong display/number font + one clean body font, with tabular numerals "
                "everywhere numbers appear; at most three semantic colors, each paired with a label or icon "
                "(never color alone), no gradients or 'AI blue'; light theme, generous whitespace; loading is a "
                "skeleton mirroring the layout (not a spinner) and empty states name the next step; no AI slop "
                "(definitive language, no fabricated metrics, no ChatGPT-clone chrome).",
                "- **Fast base + responsive detail**: render the main briefing from deterministic queries so it "
                "loads instantly; reserve the Genie/agent call for drill-down follow-ups, not the cold entry.",
                "- **Integrate the pieces FOR REAL (not for show)**: the ask box MUST call the Genie "
                "Conversation API against the space (not a hardcoded SQL string formatted into a sentence — an "
                "instant canned answer is the tell); anything the app records MUST persist to the Lakebase "
                "Postgres table via the attached database resource (NOT a Unity Catalog table via the "
                "warehouse). Verify each: the ask makes a real Genie call, and a recorded action lands a real "
                "row in Lakebase. A piece that only appears to be used was skipped.",
                "- **Seed, not cage**: treat the idea as the seed. Build a complete, genuinely useful app "
                "around it with sensible supporting views and a couple of relevant metrics; expand tastefully "
                "beyond the literal one-liner. Hold the architecture fixed, but let features and polish breathe.",
                "- **Notebooks**: the first line must be `# Databricks notebook source`, and separate "
                "every cell with a line reading `# COMMAND ----------`, or the cells silently merge into one.",
                "- **Packaging**: use `requirements.txt`, never a `uv.lock` (it can leak internal proxy URLs).",
                "- **Verify as you go**: after each step, run the 'Done when' check before continuing — "
                "a created-but-unconfigured asset looks done but isn't.", ""]

    if steps:
        out += ["## Build steps (in order)", ""]
        for s in steps:
            head = f"### Step {s.n}. {s.title}"
            if s.capability:
                head += f"  · _{s.capability}_"
            out.append(head)
            if s.concept:
                out.append(s.concept.strip())
            out += ["", f"**Build:** {s.move.strip().replace('__PROJECT_MD__', prd_ref)}"]
            if s.verify:
                out.append(f"**Done when:** {s.verify.strip()}")
            if s.teach:
                out.append(f"> Tip: {s.teach.strip()}")
            out.append("")

    return "\n".join(out).rstrip() + "\n"


def publish_assets(*, idea: str, prd_markdown: str, capabilities: list[str],
                   design_answers: dict, decisions: list[Decision] | None = None,
                   steps: list[BuildStep] | None = None, usable_assets: str = "",
                   project_name: str = "", user_token: str | None = None,
                   user_email: str = "") -> dict:
    """Write PROJECT.md into the user's workspace, in a folder named for their project:
    /Workspace/Users/<user>/<project name>/PROJECT.md. Returns
    {ok, dir, doc, files, host, deep_link, wrote_as} or raises for the route to catch."""
    from databricks.sdk.service.workspace import ImportFormat

    decisions = decisions or []
    steps = steps or []
    data_mode = (design_answers or {}).get("data_mode", "synthetic")
    w, home, wrote_as = _client_and_home(user_token, user_email)
    # The user names their project (step 1); that's the folder. Fall back to the idea if blank.
    folder = _slug(project_name) if project_name.strip() else _slug(idea)
    target = f"{home}/{folder}"
    w.workspace.mkdirs(target)

    doc = _project_md(idea=idea, prd_markdown=prd_markdown, decisions=decisions, steps=steps,
                      doc_path=f"{target}/{DOC_NAME}",
                      usable_assets=usable_assets, data_mode=data_mode)
    w.workspace.upload(f"{target}/{DOC_NAME}", io.BytesIO(doc.encode("utf-8")),
                       format=ImportFormat.RAW, overwrite=True)

    return {"ok": True, "dir": target, "doc": f"{target}/{DOC_NAME}", "files": [DOC_NAME],
            "host": config.get_workspace_host(), "deep_link": _deep_link(target), "wrote_as": wrote_as}
