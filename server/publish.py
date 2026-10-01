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
    for cap in ["Declarative Pipelines", "Lakebase", "Genie", "Databricks Apps"]:
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
        "You are Genie Code, the coding agent in this Databricks workspace. Build the data and "
        "serving pieces specified below, working through the steps in order and confirming each one "
        "before moving on. If the plan includes an app, it is built in Genie App Builder from the "
        "prompt in its step, not by you. This document is the source of truth: the plan, the "
        "architecture, the build practices to follow, and the concrete steps.")
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
        out += ["- **Medallion, gold-first**: Declarative Pipelines take data bronze (raw) -> silver (cleaned, joined) "
                "-> gold (ready to use). Genie and the app read ONLY gold tables. Scores, flags, rankings and "
                "drafted suggestions are explainable rule columns in gold (a score, a flag, a reason). There are no AI agents "
                "in this build.",
                "- **Genie Code builds everything except the app**: the data, the pipeline, the Genie space and "
                "the Lakebase tables. The app is built in **Genie App Builder** (Apps > Build tab), from the prompt in "
                "its step. When you reach that step, stop and hand the prompt to the person; do not hand-build an app.",
                "- **Notebooks**: the first line must be `# Databricks notebook source`, and separate every cell with a "
                "line reading `# COMMAND ----------`, or the cells silently merge into one.",
                "- **Verify as you go**: after each step, run the 'Done when' check before continuing. A pipeline that "
                "succeeded with empty gold tables, or a Genie space with no instructions, looks done but isn't.", ""]

    if steps:
        out += ["## Build steps (in order)", ""]
        for s in steps:
            head = f"### Step {s.n}. {s.title}"
            if s.capability:
                head += f"  · _{s.capability}_"
            out.append(head)
            if s.concept:
                out.append(s.concept.strip())
            if getattr(s, "tool", "genie_code") == "app_builder":
                out += ["", "**Build in Genie App Builder** (Apps > Build tab, choose your App Space). Paste this prompt:",
                        "", "> " + s.move.strip().replace("\n", "\n> ")]
            else:
                out += ["", f"**Build:** {s.move.strip().replace('__PROJECT_MD__', prd_ref)}"]
            if s.verify:
                out.append(f"**Done when:** {s.verify.strip()}")
            if s.teach:
                out.append(f"> Tip: {s.teach.strip()}")
            out.append("")

    return "\n".join(out).rstrip() + "\n"


# ── Brand / design spec ─────────────────────────────────────────────────────
# Costa brand foundation + three reference "flavors" (from design/mockups). Goal: every
# participant's app looks on-brand but NOT identical. We hand Genie Code the palette + logo,
# three worked directions, recommend the one that fits their app, and tell it to ADAPT (not
# clone). Lives in its own design.md so PROJECT.md stays lean.
LOGO_NAME = "costa.png"
_FLAVORS = {
    "A": ("Warm Editorial",
          "Young Serif (display) + Hanken Grotesk (body), both Google Fonts. Conversational and human — reads "
          "like a morning briefing that talks to you. Warm cream paper, maroon headings, terracotta accents. "
          "Best for advisor/briefing apps that explain and recommend."),
    "B": ("Crisp Operational",
          "Schibsted Grotesk (display) + Public Sans (body), both Google Fonts. Clean, functional console "
          "clarity — dense but calm. Whiter surfaces on cream, maroon + green, a tight grid. Best for review "
          "queues, supervise-the-agent consoles, and monitoring/ops screens."),
    "C": ("Bold Heritage",
          "Zilla Slab (display) + Figtree (body), both Google Fonts. Confident and premium — deep maroon with "
          "gold, richer contrast, more editorial weight. Best for exec/leadership views and brand-forward "
          "storytelling."),
}


def _recommend_flavor(interaction_model: str) -> str:
    """Pick a starting flavor from how people use the app, so different builds skew different."""
    return {"agent_actions": "B", "browse_act": "B", "monitor": "B",
            "ask": "A", "explore": "C"}.get((interaction_model or "").strip(), "B")


def _design_md(*, idea: str, interaction_model: str) -> str:
    rec = _recommend_flavor(interaction_model)
    rec_name = _FLAVORS[rec][0]
    out = [
        "# Design & brand spec — Costa", "",
        "This app is for Costa, so it must look like a Costa product. Below is the brand foundation to keep, "
        "then three worked **flavors** as reference directions. **Pick ONE flavor as your starting point, then "
        "adapt it to this app's real screens** — don't clone a mockup, and don't make every app identical; vary "
        "tastefully within the brand. Deviate only if the app truly calls for it, and stay on-brand.", "",
        "## Brand foundation (always)",
        f"- **Logo**: `{LOGO_NAME}` is in this project folder (512×512 PNG). Package it INTO the app — copy it "
        "into the frontend's static assets (e.g. Vite `public/`) so it ships inside `dist/`, and use it in the "
        "header and as the favicon. Do NOT hotlink an external URL (the app's CSP will block it).",
        "- **Primary brand color**: Costa maroon `#730723` (deep burgundy) — the anchor. Header, primary "
        "actions, key emphasis. Use `#59071c` for hover/depth.",
        "- **Page ground**: warm cream (`#faf4ea` / `#f6f3ee`), never pure `#ffffff` as the canvas. Cards sit "
        "on the cream as white/lighter-cream surfaces.",
        "- **Positive / approved**: green `#3f7d55`. **Secondary / heritage accent**: gold `#b57f36` (sparingly). "
        "**Text/ink**: warm near-black `#211318`.",
        "- Hold the product bar: at most three semantic colors, each ALWAYS paired with a label or icon (never "
        "color alone); tabular numerals for every figure (`font-variant-numeric: tabular-nums`); generous "
        "whitespace; light theme; no gradients, no 'AI blue', no neon.", "",
        "## The three flavors (reference — pick one, then adapt)",
    ]
    for k in ("A", "B", "C"):
        nm, desc = _FLAVORS[k]
        star = "  **← recommended for this app**" if k == rec else ""
        out.append(f"- **Flavor {k} — {nm}**{star}: {desc}")
    out += [
        "",
        f"**Recommended starting point: Flavor {rec} ({rec_name})** — it fits how people will use this app. "
        "Adapt its type and layout to your actual screens; keep the brand foundation above intact.", "",
        "## Fonts",
        "Every flavor's fonts are on Google Fonts — load the two for your chosen flavor with a `<link>` and give "
        "each a real fallback stack (e.g. `\"Public Sans\", system-ui, sans-serif`). One display face for "
        "headings/numbers, one body face for text. Compile CSS at build time (Vite + Tailwind), never a browser "
        "CDN.", "",
        "_This is the visual brief. The functional plan (what to build) is in PROJECT.md._", "",
    ]
    return "\n".join(out)


def _logo_path() -> str:
    """Absolute path to the bundled Costa logo (design/mockups/costa.png), repo-relative."""
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "design", "mockups", LOGO_NAME)


def _troubleshooting_path() -> str:
    """Bundled apps troubleshooting doc, dropped into each participant folder as troubleshooting.md.
    General 'my app isn't working' guidance for the Databricks Apps portion — kept separate from
    PROJECT.md (which stays lean) and editable on its own."""
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "docs", "troubleshooting-apps.md")


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

    # Brand/design spec + logo, in their own files so PROJECT.md stays lean. Best-effort:
    # a failure here never blocks the build (the plan still stands).
    files_written = [DOC_NAME]
    try:
        design = _design_md(idea=idea, interaction_model=(design_answers or {}).get("interaction_model", ""))
        w.workspace.upload(f"{target}/design.md", io.BytesIO(design.encode("utf-8")),
                           format=ImportFormat.RAW, overwrite=True)
        files_written.append("design.md")
        logo_src = _logo_path()
        if os.path.exists(logo_src):
            with open(logo_src, "rb") as fh:
                w.workspace.upload(f"{target}/{LOGO_NAME}", io.BytesIO(fh.read()),
                                   format=ImportFormat.RAW, overwrite=True)
            files_written.append(LOGO_NAME)
        ts_src = _troubleshooting_path()
        if os.path.exists(ts_src):
            with open(ts_src, "rb") as fh:
                w.workspace.upload(f"{target}/troubleshooting.md", io.BytesIO(fh.read()),
                                   format=ImportFormat.RAW, overwrite=True)
            files_written.append("troubleshooting.md")
    except Exception as e:
        print(f"design asset publish warning: {e}")

    return {"ok": True, "dir": target, "doc": f"{target}/{DOC_NAME}", "files": files_written,
            "host": config.get_workspace_host(), "deep_link": _deep_link(target), "wrote_as": wrote_as}
