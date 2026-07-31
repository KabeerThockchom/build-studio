"""Broad quality eval against real FMAPI — hardening the generation harness for v1.

Covers diverse personas + edge cases and asserts quality, not just parseability:
  - PRD is on-topic (mentions domain terms from the idea)
  - no capability invented that wasn't chosen; a decision for each chosen capability
  - no code / SQL / schema leakage in the PRD
  - spec is well-formed (bands present, edges reference real nodes)
  - flow has 3-4 steps
  - non-agentic builds (no Supervisor agent) still produce a sane blueprint

  uv run --with-requirements requirements-dev.txt python tests/quality_eval.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server.generate import generate_blueprint
from server.models import GenerateRequest

CODE_SMELL = re.compile(r"```|\bCREATE TABLE\b|\bSELECT \b|def \w+\(|\bAPI endpoint\b|/api/", re.IGNORECASE)

CASES = [
    # (label, request kwargs, expected domain terms)
    ("retail · account rep (full agentic)", dict(
        idea="Field reps manage 80 accounts and only notice one slipping once orders drop. Catch the early signs, explain why, tell them what to do.",
        persona="account rep", expertise="New to it",
        capabilities=["Genie", "Knowledge Assistant", "Supervisor agent", "Lakebase", "Databricks Apps"],
        design_answers={"audience": "act", "data_mode": "synthetic"}),
        ["account", "rep", "slip"]),
    ("retail · store ops (dashboard, NO agent)", dict(
        idea="Let store managers see labor efficiency across their stores and get alerted when a store misses break compliance or goes over budget.",
        persona="store operations manager", expertise="New to it",
        capabilities=["Genie", "Databricks Apps"],
        design_answers={"audience": "oversee", "data_mode": "existing"}),
        ["labor", "store", "compliance"]),
    ("FSI · fraud analyst", dict(
        idea="Flag risky transactions closer to real time instead of the nightly batch, and give the ops team a place to review and mark what they investigated.",
        persona="fraud analyst", expertise="Familiar",
        capabilities=["Genie", "Lakebase", "Databricks Apps"],
        design_answers={"audience": "act", "data_mode": "existing"}),
        ["transaction", "fraud", "review"]),
    ("healthcare · document RAG (KA-heavy)", dict(
        idea="Help care coordinators quickly find the right clinical guideline and prior notes for a patient so they spend less time digging through documents.",
        persona="care coordinator", expertise="New to it",
        capabilities=["Knowledge Assistant", "Supervisor agent", "Databricks Apps"],
        design_answers={"audience": "explore", "data_mode": "existing"}),
        ["clinical", "guideline", "patient"]),
    ("manufacturing · Genie-space only (no app)", dict(
        idea="Let a plant supervisor ask questions about downtime and output in plain English instead of waiting on a report.",
        persona="plant supervisor", expertise="New to it",
        capabilities=["Genie"],
        design_answers={"audience": "explore", "data_mode": "existing"}),
        ["downtime", "output", "plant"]),
    ("edge · very thin idea", dict(
        idea="I want to build something with my sales data.",
        persona="", expertise="New to it",
        capabilities=["Genie", "Databricks Apps"],
        design_answers={"audience": "explore", "data_mode": "synthetic"}),
        ["sales"]),
    ("edge · exec, no technical framing", dict(
        idea="I want to understand what drives customer loyalty — which products, regions, and times of year — so my team can act on it faster.",
        persona="VP of marketing", expertise="New to it",
        capabilities=["Genie", "Databricks Apps"],
        design_answers={"audience": "oversee", "data_mode": "existing"}),
        ["loyalty", "customer"]),
]


def check(label, kw, terms):
    req = GenerateRequest(**kw)
    try:
        bp = generate_blueprint(req)
    except Exception as e:
        return {"label": label, "fatal": str(e)}
    prd = bp.prd_markdown
    node_ids = {n.id for n in bp.spec.nodes}
    chosen = set(kw["capabilities"])
    checks = {
        "prd_len": len(prd) > 150,
        "on_topic": any(t.lower() in prd.lower() for t in terms),
        "no_code": not CODE_SMELL.search(prd),
        "flow_3_4": 3 <= len(bp.flow) <= 4,
        "decisions_cover_caps": {d.tag for d in bp.decisions} and {d.tag for d in bp.decisions}.issubset(chosen | {"Data"}),
        "decision_per_cap": all(any(d.tag == c for d in bp.decisions) for c in chosen),
        "spec_bands_ok": {n.band for n in bp.spec.nodes} >= ({"capability"} if chosen - {"Databricks Apps", "Lakeflow"} else set()),
        "edges_valid": all(f in node_ids and t in node_ids for f, t in bp.spec.edges),
        "no_invented_caps": all(
            n.label in {"Sample data", "Your tables", "Lakeflow"} or
            any(n.label.startswith(c.split()[0]) or c.startswith(n.label.split()[0]) for c in chosen)
            for n in bp.spec.nodes),
    }
    return {"label": label, "checks": checks, "bp": bp}


def main():
    total_fail = 0
    for label, kw, terms in CASES:
        r = check(label, kw, terms)
        print(f"\n=== {label} ===")
        if r.get("fatal"):
            print(f"  FATAL: {r['fatal']}"); total_fail += 1; continue
        fails = [k for k, v in r["checks"].items() if not v]
        for k, v in r["checks"].items():
            print(f"  [{'PASS' if v else 'FAIL'}] {k}")
        bp = r["bp"]
        print(f"  flow: {[f.title for f in bp.flow]}")
        print(f"  decisions: {[d.tag for d in bp.decisions]}")
        print(f"  PRD head: {bp.prd_markdown[:150].strip()!r}")
        if fails:
            total_fail += 1
    print(f"\n{'='*50}\n{len(CASES) - total_fail}/{len(CASES)} cases fully clean")
    sys.exit(0 if total_fail == 0 else 1)


if __name__ == "__main__":
    main()
