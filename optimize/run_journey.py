"""End-to-end WORKSHOP JOURNEY eval: sample idea -> design Q&A -> PRD -> build plan ->
the exact PROJECT.md a participant gets -> hand it to Genie Code and have it AUTONOMOUSLY
BUILD AND DEPLOY a real Databricks App.

This is the honest confirmation test. `run_build.py` fed moves one-at-a-time into a
schema-scoped session (no real deploy). Here we reproduce a participant picking a gallery
sample and letting Genie Code build the whole thing from PROJECT.md — so we can judge
whether our embedded rigor (design spec, interaction model, deploy guardrails) actually
produces a robust, deployed, briefing-style app first pass.

Flow per sample:
  1. plan_design(idea, industry)                 -> design questions (SA brain)
  2. auto-answer them like a participant          -> interaction_model + data_mode + tailored
  3. generate_blueprint(caps=LOCKED)              -> PRD markdown + decisions
  4. build_plan(caps=LOCKED, prd)                 -> ordered build steps
  5. publish._project_md(...)                     -> the SINGLE execute-me doc
  6. one Genie Code session: read PROJECT.md, build + DEPLOY into a scratch schema
  7. verify the app is ACTIVE and its URL renders

Usage:
  python3 optimize/run_journey.py --sample store-slip     # one sample, foreground
  python3 optimize/run_journey.py --list                  # show sample keys
Runs against build-studio (tool ops) + ai_devtools (genie's model), same as run_build.py.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server.design_plan import plan_design                      # noqa: E402
from server.generate import generate_blueprint                  # noqa: E402
from server.build_plan import build_plan                        # noqa: E402
from server import publish                                      # noqa: E402
from server.models import PlanRequest, GenerateRequest, BuildRequest  # noqa: E402
from optimize import genie_runner as gr                          # noqa: E402

DBX = gr.DBX
EVAL_PROFILE = gr.PROFILE                     # build-studio (tool ops)
EVAL_CATALOG = os.environ.get("GENIE_EVAL_CATALOG", "build_studio")
EVAL_HOST = gr.HOST

# The architecture is LOCKED in the product to these four pieces. A faithful journey
# builds every sample with the locked set (KA is parked/optional), regardless of the
# sample card's legacy `components`.
LOCKED_CAPS = ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"]

# Five gallery samples spanning verticals + the two RICH interaction models (browse_act,
# monitor) — deliberately NOT the bare `ask` archetype, so we test exploratory,
# action-oriented briefings. `idea` is the exact card starter; `industry` is the vertical
# context carried silently into the SA prompt; `im` is the interaction model a participant
# would pick for this idea; `app` is the deployed app name; `short` keys the workdir.
SAMPLES = {
    "store-slip": dict(
        short="store-slip", app="eval-j-store-slip", im="browse_act",
        industry="retail (stores + e-commerce)",
        idea="Our store managers only find out a location is underperforming after the monthly "
             "report. Each morning, I want to check our daily sales against targets and see which "
             "stores are trending down so we can catch problems early. The tool reads our transaction "
             "data and sales targets for each store, and flags stores that are underperforming "
             "relative to their goals."),
    "revenue-mgr": dict(
        short="revenue-mgr", app="eval-j-revenue-mgr", im="browse_act",
        industry="travel and hospitality (hotels, resorts, tour operators)",
        idea="Our revenue manager adjusts room rates manually each day based on occupancy and "
             "intuition. Each morning, the tool reads current occupancy, historical rates, forward "
             "bookings, and competitor pricing, and shows rate recommendations for each room type so "
             "the manager can maximize nightly revenue with data-driven adjustments."),
    "crew-sched": dict(
        short="crew-sched", app="eval-j-crew-sched", im="monitor",
        industry="quick-service restaurants (QSR, limited-service chains)",
        idea="We manually schedule crew based on guesses about how busy we'll be, often over-staffing "
             "slow shifts or under-staffing peaks. Weekly, the tool reads our historical transaction "
             "and labor data and predicts traffic by time of day and day of week, so we can suggest "
             "optimal crew counts for each shift and reduce labor costs without hurting service."),
    "supplier": dict(
        short="supplier", app="eval-j-supplier", im="monitor",
        industry="retail (stores + e-commerce)",
        idea="We get shipments from many suppliers but I'm only looking at invoices to know how "
             "they're doing. Each week, the tool reads our purchase orders, receipt records, and "
             "invoice dates to track on-time delivery, quality issues, and lead times by supplier, so "
             "we can identify which partners are reliable and which need improvement or replacement."),
    "upsell": dict(
        short="upsell", app="eval-j-upsell", im="browse_act",
        industry="travel and hospitality (hotels, resorts, tour operators)",
        idea="We're leaving money on the table. When a guest books a room or arrives at check-in, we "
             "don't suggest relevant extras. The tool reads the reservation, guest history, prior "
             "stays, and current events, and recommends spa packages, dining experiences, or "
             "activities that match the guest profile, so we can increase ancillary revenue without "
             "feeling pushy."),
    # The new agent_actions lane: a delegate-and-supervise idea (agent works through items, decides,
    # drafts, records; person approves/overrides). Tests whether the lane produces a console, not a briefing.
    "escalations": dict(
        short="escalations", app="eval-j-escalations", im="agent_actions",
        industry="retail operations / loss prevention",
        idea="I want an agent that works through the day's flagged transactions for me. For each one it "
             "reads the account history and notes, decides whether it is truly suspicious, drafts an "
             "escalation note, and records the action it took, so I can approve or override its call "
             "instead of triaging every flag myself."),
    # --- Battle-test round 2: more agent_actions + open-ended ideas ---
    "reservation-agent": dict(
        short="reservation-agent", app="eval-j-reservation-agent", im="agent_actions",
        industry="travel and hospitality (hotels, resorts, tour operators)",
        idea="I want an agent that works through the guest booking-issue emails each morning. For each one "
             "it reads the reservation and the guest's history, decides whether it can be resolved with a "
             "standard response or needs a person, drafts the reply, and records what it did, so my team "
             "approves or overrides before anything goes out."),
    "tagging-agent": dict(
        short="tagging-agent", app="eval-j-tagging-agent", im="agent_actions",
        industry="retail (stores + e-commerce)",
        idea="When new products arrive, I want an agent to read each one's description, supplier category, "
             "and attributes, decide the right category tags and metadata, and propose them with its "
             "reasoning, so a merchandiser approves or edits instead of tagging every SKU from scratch."),
    # Open-ended: 'explore' is an interaction model we have never actually built an app for.
    "campaign-explorer": dict(
        short="campaign-explorer", app="eval-j-campaign-explorer", im="explore",
        industry="retail (stores + e-commerce)",
        idea="I want to explore which of our marketing campaigns actually drove repeat visits. Let me slice "
             "it however a question leads me, by region, by season, by customer type, by campaign, and drill "
             "in wherever something looks interesting, rather than being handed one fixed view."),
    # Open-ended and deliberately off-pattern: a what-if planning workspace (implies writes + recompute),
    # to see whether the pipeline degrades gracefully and honors the write boundary.
    "quarter-planner": dict(
        short="quarter-planner", app="eval-j-quarter-planner", im="explore",
        industry="quick-service restaurants (QSR, limited-service chains)",
        idea="Help our ops team plan next quarter's staffing budget. Pull in last year's numbers by month "
             "and store, let us jot our own assumptions about traffic growth and wage changes, and show how "
             "changing those assumptions moves the projected labor cost so we can settle on a plan."),
}

OUT_ROOT = "/tmp/build-journey"


def sh(args, timeout=120):
    import subprocess
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def make_scratch_schema(short: str) -> str:
    name = f"bs_j_{short.replace('-', '_')}_{uuid.uuid4().hex[:6]}"
    r = sh([DBX, "schemas", "create", name, EVAL_CATALOG, "--profile", EVAL_PROFILE,
            "--comment", "Build Studio journey eval — safe to drop"])
    if r.returncode != 0 and "already exists" not in (r.stderr + r.stdout):
        raise RuntimeError(f"could not create scratch schema: {r.stderr[:300]}")
    return f"{EVAL_CATALOG}.{name}"


def _answer_questions(plan, interaction_model: str) -> dict:
    """Auto-answer the SA's design questions the way a participant would: pick the chosen
    interaction model, synthetic data, and the first sensible option for anything tailored.
    Values are OPTION KEYS for the two required questions (the app keys off them) and
    labels for tailored questions (better signal to the PRD generator)."""
    answers: dict[str, str] = {}
    for q in plan.questions:
        keys = [o.key for o in q.options]
        if q.id == "interaction_model":
            answers[q.id] = interaction_model if interaction_model in keys else keys[0]
        elif q.id == "data_mode":
            answers[q.id] = "synthetic" if "synthetic" in keys else keys[0]
        else:
            # first option's label reads as a concrete choice to the generator
            answers[q.id] = q.options[0].label or q.options[0].key
    # guarantee the two the pipeline depends on exist even if the SA omitted them
    answers.setdefault("interaction_model", interaction_model)
    answers.setdefault("data_mode", "synthetic")
    return answers


def compose_journey(sample: dict) -> dict:
    """Run the full generation journey; return the PROJECT.md + intermediate artifacts."""
    idea, industry, im = sample["idea"], sample["industry"], sample["im"]

    plan = plan_design(PlanRequest(idea=idea, industry=industry, expertise="New to it"))
    answers = _answer_questions(plan, im)

    bp = generate_blueprint(GenerateRequest(
        idea=idea, expertise="New to it", interests=[], design_answers=answers,
        capabilities=list(LOCKED_CAPS)))

    plan_build = build_plan(BuildRequest(
        idea=idea, expertise="New to it", capabilities=list(LOCKED_CAPS),
        design_answers=answers, prd_markdown=bp.prd_markdown, project_name=sample["app"]))

    project_md = publish._project_md(
        idea=idea, prd_markdown=bp.prd_markdown, decisions=bp.decisions,
        steps=plan_build.steps, usable_assets="", data_mode=answers.get("data_mode", "synthetic"),
        doc_path="PROJECT.md")

    return {"answers": answers, "read_back": plan.read_back,
            "questions": [{"id": q.id, "title": q.title, "chosen": answers.get(q.id)} for q in plan.questions],
            "prd_markdown": bp.prd_markdown,
            "decisions": [{"tag": d.tag, "text": d.text} for d in bp.decisions],
            "steps": [{"n": s.n, "title": s.title, "capability": s.capability} for s in plan_build.steps],
            "project_md": project_md}


BUILD_PROMPT = """[Automated eval — headless. Do NOT ask questions; make reasonable assumptions and
proceed to a fully deployed, working app. This simulates a workshop participant handing you
their PROJECT.md and saying "build it."]

You are Genie Code in this Databricks workspace. Read PROJECT.md in this folder — it is the
complete, execute-me spec (plan, architecture, build practices, and ordered steps). Build the
ENTIRE app it describes and DEPLOY it, following the build practices in the doc exactly.

Hard automation constraints for this run:
- Use `--profile {profile}` on every databricks command (also set in your config).
- Do ALL Unity Catalog work inside the schema `{schema}` — create every table, volume, and
  Genie space there. Never create or modify anything outside `{schema}`.
- Name the Databricks App EXACTLY `{app}` (lowercase). If it already exists, update it.
- Generate realistic SYNTHETIC sample data that fits the idea (tens to hundreds of rows).
- Follow the doc's deploy practices precisely: React + Tailwind + FastAPI; complete HTML shell;
  ship only dist/ + backend (git init + sync.exclude, do NOT exclude dist/index.html); literal
  port 8000; grant the app's service principal USE CATALOG/SCHEMA + SELECT on `{schema}` and
  CAN USE on the warehouse/Genie space; verify the app actually renders and its ONE primary
  action returns real data before you call it done.

When you are completely finished, output ONE final line in exactly this form:
DEPLOYED: <app-url>"""


def probe_url(url: str, timeout: int = 20) -> dict:
    """Fetch the app root; report status + whether it looks like a real rendered HTML shell."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "build-studio-eval"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read(20000).decode("utf-8", "replace")
            has_root = ("<div id=\"root\"" in body or "<div id='root'" in body
                        or "<div id=\"app\"" in body)
            has_doctype = body.lstrip().lower().startswith("<!doctype html")
            return {"status": r.status, "bytes": len(body),
                    "html_shell": has_doctype and "<body" in body.lower(),
                    "has_root_div": has_root}
    except Exception as e:
        return {"status": None, "error": str(e)[:200]}


def find_app(app_name: str) -> dict | None:
    r = sh([DBX, "apps", "get", app_name, "--profile", EVAL_PROFILE, "--output", "json"])
    if r.returncode != 0:
        return None
    try:
        a = json.loads(r.stdout)
        return {"name": a.get("name"), "url": a.get("url"),
                "state": (a.get("compute_status") or {}).get("state"),
                "status": (a.get("app_status") or {}).get("state")}
    except Exception:
        return None


def run_sample(key: str, timeout: int = 3000, keep: bool = True) -> dict:
    sample = SAMPLES[key]
    short = sample["short"]
    workdir = f"{OUT_ROOT}/{short}"
    os.makedirs(workdir, exist_ok=True)
    log = lambda m: print(f"[{short}] {m}", flush=True)

    log("composing journey (design -> PRD -> build plan -> PROJECT.md) ...")
    journey = compose_journey(sample)
    with open(f"{workdir}/PROJECT.md", "w") as f:
        f.write(journey["project_md"])
    with open(f"{workdir}/journey.json", "w") as f:
        json.dump({k: v for k, v in journey.items() if k != "project_md"}, f, indent=2)
    log(f"PROJECT.md written ({len(journey['project_md'])} chars); "
        f"{len(journey['steps'])} build steps; interaction_model={journey['answers'].get('interaction_model')}")

    schema = make_scratch_schema(short)
    log(f"scratch schema: {schema}")

    prompt = BUILD_PROMPT.format(profile=EVAL_PROFILE, schema=schema, app=sample["app"])
    log(f"launching Genie Code build+deploy (timeout {timeout}s) ...")
    t0 = time.time()
    r = gr.run_move(prompt, workdir, timeout=timeout)
    elapsed = int(time.time() - t0)
    log(f"genie finished: ok={r['ok']} timed_out={r['timed_out']} in {elapsed}s")

    time.sleep(10)
    app = find_app(sample["app"])
    probe = None
    if app and app.get("url"):
        probe = probe_url(app["url"])
    active = bool(app and app.get("state") == "ACTIVE")
    log(f"app={app} probe={probe}")

    report = {
        "sample": key, "app_name": sample["app"], "interaction_model": sample["im"],
        "schema": schema, "workdir": workdir, "elapsed_s": elapsed,
        "genie_ok": r["ok"], "timed_out": r["timed_out"], "events_path": r["events_path"],
        "final": r["final"][-1000:] if r["final"] else "",
        "app": app, "active": active, "probe": probe,
        "n_steps": len(journey["steps"]),
    }
    with open(f"{workdir}/report.json", "w") as f:
        json.dump(report, f, indent=2)
    verdict = "DEPLOYED+RENDERS" if (active and probe and probe.get("status") == 200 and probe.get("html_shell")) \
        else "ACTIVE" if active else "NOT-DEPLOYED"
    log(f"VERDICT: {verdict}  ({sample['app']} -> {app.get('url') if app else 'n/a'})")
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", choices=list(SAMPLES))
    ap.add_argument("--timeout", type=int, default=3000)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--compose-only", action="store_true",
                    help="run the generation journey + write PROJECT.md, skip the genie build")
    a = ap.parse_args()
    if a.list:
        for k, v in SAMPLES.items():
            print(f"{k:14s} {v['im']:10s} {v['app']}")
        sys.exit(0)
    if not a.sample:
        ap.error("--sample is required (or --list)")
    if a.compose_only:
        s = SAMPLES[a.sample]
        wd = f"{OUT_ROOT}/{s['short']}"
        os.makedirs(wd, exist_ok=True)
        j = compose_journey(s)
        with open(f"{wd}/PROJECT.md", "w") as f:
            f.write(j["project_md"])
        with open(f"{wd}/journey.json", "w") as f:
            json.dump({k: v for k, v in j.items() if k != "project_md"}, f, indent=2)
        print(f"composed {a.sample}: {len(j['project_md'])} chars, {len(j['steps'])} steps -> {wd}/PROJECT.md")
    else:
        run_sample(a.sample, timeout=a.timeout)
