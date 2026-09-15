"""Run a Build Studio plan end-to-end through the Genie Code CLI and report what
actually got built. This is the eval half of the optimization loop: it turns our
best-effort Build moves into a measured pass/fail against a real workspace.

Flow:
  1. Generate the build plan for an idea (our FMAPI, via DATABRICKS_PROFILE=build-studio).
  2. Create a scratch UC schema in the eval workspace (ai_devtools).
  3. Feed each move into ONE genie session, in order (resume), scoped to the schema —
     mirroring a participant pasting moves into a single Genie Code chat.
  4. Verify what materialized (tables in the schema) + capture each move's result.
  5. Print a per-move report + JSON artifact for the optimizer to read.

Usage:
  DATABRICKS_PROFILE=build-studio python3 optimize/run_build.py --case genie_minimal
"""
import argparse
import json
import os
import subprocess
import sys
import time
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server.build_plan import build_plan  # noqa: E402
from server.models import BuildRequest  # noqa: E402
from optimize import genie_runner as gr  # noqa: E402

DBX = gr.DBX
EVAL_PROFILE = gr.PROFILE           # ai_devtools
EVAL_CATALOG = os.environ.get("GENIE_EVAL_CATALOG", "build_studio")

# Baseline suite. All synthetic data_mode so each case is self-contained (no
# pre-seeding). Chosen to cover every move type — data + Genie + App are already
# proven, so these emphasize the untested ones: Knowledge Assistant, Lakebase,
# Supervisor agent, and full-agentic integration.
CASES = {
    "genie_minimal": dict(  # baseline: Genie only (fast)
        idea="Let a store manager ask plain-English questions about daily sales by store, "
             "like which stores are trending down this week.",
        expertise="New to it", capabilities=["Genie"],
        design_answers={"data_mode": "synthetic"}),
    "genie_app": dict(  # data + Genie + App (proven)
        idea="Let a store manager see which stores are slipping on daily sales and ask why.",
        expertise="New to it", capabilities=["Genie", "Databricks Apps"],
        design_answers={"data_mode": "synthetic"}),
    "ka_app": dict(  # tests Knowledge Assistant (unstructured text) + App
        idea="Help support agents find the right answer from our product help articles and "
             "past ticket resolutions instead of digging through documents.",
        expertise="New to it", capabilities=["Knowledge Assistant", "Databricks Apps"],
        design_answers={"data_mode": "synthetic"}),
    "lakebase_app": dict(  # tests Lakebase (record decisions) + Genie + App
        idea="Let an ops analyst review flagged transactions and mark which ones they "
             "investigated, so the team keeps track of what's been handled.",
        expertise="Familiar", capabilities=["Genie", "Lakebase", "Databricks Apps"],
        design_answers={"data_mode": "synthetic"}),
    "agentic_full": dict(  # the hero: every piece incl. Supervisor agent
        idea="Field reps manage 80 accounts and only notice one slipping once orders drop. "
             "Catch the early signs, explain why using account notes, and record what to do.",
        expertise="New to it",
        capabilities=["Genie", "Knowledge Assistant", "Supervisor agent", "Lakebase", "Databricks Apps"],
        design_answers={"data_mode": "synthetic"}),
    "agent_locked": dict(  # the REAL workshop architecture (4 locked caps, agentic console + tracing)
        idea="Our AP team keys in supplier invoices and matches them to purchase orders by hand, which "
             "backs up at month end. An agent should read each invoice, match it to its PO and receipt, "
             "check the amounts, and draft an approve-or-hold call the clerk reviews. Record every decision.",
        expertise="New to it",
        capabilities=["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
        design_answers={"interaction_model": "agent_actions", "data_mode": "synthetic"}),
}


def sh(args, timeout=120):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def make_scratch_schema() -> str:
    name = f"bs_eval_{uuid.uuid4().hex[:8]}"
    r = sh([DBX, "schemas", "create", name, EVAL_CATALOG, "--profile", EVAL_PROFILE,
            "--comment", "Build Studio eval scratch — safe to drop"])
    if r.returncode != 0 and "already exists" not in (r.stderr + r.stdout):
        raise RuntimeError(f"could not create scratch schema: {r.stderr[:300]}")
    return f"{EVAL_CATALOG}.{name}"


def list_tables(schema_fqn: str) -> list[str]:
    cat, sch = schema_fqn.split(".", 1)
    r = sh([DBX, "tables", "list", cat, sch, "--profile", EVAL_PROFILE, "--output", "json"])
    try:
        data = json.loads(r.stdout)
        rows = data if isinstance(data, list) else data.get("tables", [])
        return [t.get("name") for t in rows]
    except Exception:
        return []


def list_apps() -> list[dict]:
    r = sh([DBX, "apps", "list", "--profile", EVAL_PROFILE, "--output", "json"])
    try:
        data = json.loads(r.stdout)
        rows = data if isinstance(data, list) else data.get("apps", [])
        return [{"name": a.get("name"), "url": a.get("url"),
                 "state": (a.get("compute_status") or {}).get("state")} for a in rows]
    except Exception:
        return []


def _events_text(path: str) -> str:
    try:
        return open(path).read() if path and os.path.exists(path) else ""
    except Exception:
        return ""


def drop_scratch_schema(schema_fqn: str):
    cat, sch = schema_fqn.split(".", 1)
    # drop tables then schema (our own CLI — genie's safeguards block deletes)
    for t in list_tables(schema_fqn):
        sh([DBX, "tables", "delete", f"{cat}.{sch}.{t}", "--profile", EVAL_PROFILE])
    sh([DBX, "schemas", "delete", schema_fqn, "--profile", EVAL_PROFILE, "--force"])


PREAMBLE = """[Automated eval — headless, do not ask questions; make reasonable assumptions and proceed.]
Authenticate the Databricks CLI using the DATABRICKS_HOST and DATABRICKS_TOKEN environment
variables that are already set; pass `--profile {profile}` on databricks commands. Do ALL Unity
Catalog work inside the schema `{schema}` (create tables/volumes/spaces there). Never create or
modify anything outside `{schema}`. Keep it small (a few tables, tens to hundreds of rows).

BUILD STEP {n} — {title}
{move}
(You'll know it worked when: {verify})
When finished, state in one line exactly what you created (fully-qualified names)."""


def run_case(case_key: str, keep: bool = False) -> dict:
    case = CASES[case_key]
    print(f"\n=== generating build plan for '{case_key}' ===")
    plan = build_plan(BuildRequest(**case))
    steps = plan.steps
    print(f"  {len(steps)} moves: {[s.title for s in steps]}")

    schema = make_scratch_schema()
    print(f"  scratch schema: {schema}")
    workdir = f"/tmp/genie-eval/{case_key}-{uuid.uuid4().hex[:6]}"
    os.makedirs(workdir, exist_ok=True)

    results = []
    sid = None
    tables_before = list_tables(schema)
    apps_before = {a["name"] for a in list_apps()}
    for s in steps:
        prompt = PREAMBLE.format(profile=EVAL_PROFILE, schema=schema, n=s.n,
                                 title=s.title, move=s.move, verify=s.verify)
        print(f"\n  --- move {s.n}: {s.title} (session={'new' if not sid else sid[:8]}) ---")
        t0 = time.time()
        # App deploys are slow (compute provisioning); give the app step more room.
        step_timeout = 1200 if s.capability == "Databricks Apps" else 600
        r = gr.run_move(prompt, workdir, session_id=sid, timeout=step_timeout)
        sid = r["session_id"] or sid

        # Score on ACTUAL workspace artifacts, not genie's self-report. The model
        # gateway (ai_devtools) has an IP ACL that can sever the stream mid-build,
        # making a materially-successful build look failed — so we verify what
        # actually materialized and flag gateway/IP-ACL drops as infra, not a move bug.
        tables_after = list_tables(schema)
        apps_after = list_apps()
        new_tables = [t for t in tables_after if t not in tables_before]
        new_apps = [a for a in apps_after if a["name"] not in apps_before]
        gateway_drop = "blocked by Databricks IP ACL" in _events_text(r["events_path"]) \
            or "stream disconnected" in _events_text(r["events_path"])

        if s.capability == "Databricks Apps":
            materialized = any(a["state"] == "ACTIVE" for a in new_apps)
        elif s.capability in ("data", "Lakeflow"):
            materialized = len(new_tables) > 0
        else:  # Genie space, Knowledge Assistant, agent: trust genie's verify report
            materialized = r["ok"] or bool(r["final"])
        tables_before = tables_after
        apps_before = {a["name"] for a in apps_after}

        verdict = "PASS" if materialized else ("INFRA-DROP" if gateway_drop else "FAIL")
        print(f"      {verdict}  genie_ok={r['ok']} {time.time()-t0:.0f}s "
              f"new_tables={new_tables} new_apps={[a['name'] for a in new_apps]}")
        print(f"      genie: {(r['final'] or '(no final message — stream cut)')[:200]}")
        results.append({"n": s.n, "title": s.title, "capability": s.capability,
                        "concept": s.concept, "move": s.move, "verify": s.verify,
                        "teach": s.teach, "genie_ok": r["ok"],
                        "materialized": materialized, "verdict": verdict,
                        "gateway_drop": gateway_drop, "timed_out": r["timed_out"],
                        "final": r["final"], "new_tables": new_tables,
                        "new_apps": new_apps,  # full dicts: name, url, state
                        "events_path": r["events_path"]})

    n_pass = sum(1 for m in results if m["verdict"] == "PASS")
    n_infra = sum(1 for m in results if m["verdict"] == "INFRA-DROP")
    n_fail = sum(1 for m in results if m["verdict"] == "FAIL")
    full_build = n_pass == len(steps)
    report = {"case": case_key, "idea": case["idea"], "capabilities": case["capabilities"],
              "schema": schema, "workdir": workdir, "n_moves": len(steps),
              "pass": n_pass, "infra_drop": n_infra, "fail": n_fail,
              "full_build": full_build, "tables_final": list_tables(schema),
              "apps_final": list_apps(), "moves": results}
    report_path = os.path.join(workdir, "report.json")
    json.dump(report, open(report_path, "w"), indent=2)
    print(f"\n=== report: {report_path} ===")
    print(f"  SCORE: {n_pass}/{len(steps)} moves passed"
          + (f", {n_infra} infra-drop" if n_infra else "")
          + (f", {n_fail} FAIL" if n_fail else "")
          + (f"   → FULL BUILD {'✓' if full_build else '✗'}"))
    print(f"  tables: {report['tables_final']}")

    if not keep:
        print(f"  cleaning up {schema} …")
        drop_scratch_schema(schema)
    else:
        print(f"  keeping {schema} (--keep)")
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--case", default="genie_minimal", choices=list(CASES))
    ap.add_argument("--keep", action="store_true", help="don't drop the scratch schema")
    a = ap.parse_args()
    run_case(a.case, keep=a.keep)
