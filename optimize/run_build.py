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

# Small, cheap-to-run cases first; scale up once the pipeline is proven.
CASES = {
    "genie_minimal": dict(
        idea="Let a store manager ask plain-English questions about daily sales by store, "
             "like which stores are trending down this week.",
        expertise="New to it", capabilities=["Genie"],
        design_answers={"data_mode": "synthetic"}),
    "genie_app": dict(
        idea="Let a store manager see which stores are slipping on daily sales and ask why.",
        expertise="New to it", capabilities=["Genie", "Databricks Apps"],
        design_answers={"data_mode": "synthetic"}),
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
    for s in steps:
        prompt = PREAMBLE.format(profile=EVAL_PROFILE, schema=schema, n=s.n,
                                 title=s.title, move=s.move, verify=s.verify)
        print(f"\n  --- move {s.n}: {s.title} (session={'new' if not sid else sid[:8]}) ---")
        t0 = time.time()
        r = gr.run_move(prompt, workdir, session_id=sid, timeout=600)
        sid = r["session_id"] or sid
        tables_after = list_tables(schema)
        print(f"      ok={r['ok']} timed_out={r['timed_out']} {time.time()-t0:.0f}s "
              f"tables={tables_after}")
        print(f"      genie: {r['final'][:200]}")
        results.append({"n": s.n, "title": s.title, "capability": s.capability,
                        "move": s.move, "verify": s.verify, "ok": r["ok"],
                        "timed_out": r["timed_out"], "final": r["final"],
                        "tables_after": tables_after, "events_path": r["events_path"]})

    report = {"case": case_key, "idea": case["idea"], "capabilities": case["capabilities"],
              "schema": schema, "workdir": workdir, "n_moves": len(steps),
              "tables_final": list_tables(schema), "moves": results}
    report_path = os.path.join(workdir, "report.json")
    json.dump(report, open(report_path, "w"), indent=2)
    print(f"\n=== report: {report_path} ===")
    print(f"  tables built: {report['tables_final']}")

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
