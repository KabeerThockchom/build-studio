"""Opt-in live smoke eval: hits REAL FMAPI (not mocked). Like the North Star's agent_eval.

  uv run --with-requirements requirements-dev.txt python tests/smoke_eval.py

Requires a valid Databricks CLI profile (DATABRICKS_PROFILE or default in config.py).
Asserts each sample idea produces a parseable Blueprint whose PRD is on-topic.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server.generate import generate_blueprint
from server.models import GenerateRequest

CASES = [
    dict(idea="Flag accounts that are slipping before it shows up in orders, so a rep can act.",
         persona="account rep", expertise="New to it",
         capabilities=["Genie", "Knowledge Assistant", "Supervisor agent", "Lakebase", "Databricks Apps"],
         design_answers={"data_mode": "synthetic"}, expect_terms=["account", "rep"]),
    dict(idea="Help store managers see labor efficiency and get alerts on compliance gaps.",
         persona="store ops manager", expertise="New to it",
         capabilities=["Genie", "Databricks Apps"],
         design_answers={"data_mode": "existing"}, expect_terms=["labor", "store"]),
]


def main():
    passed = 0
    for i, c in enumerate(CASES, 1):
        req = GenerateRequest(idea=c["idea"], persona=c["persona"], expertise=c["expertise"],
                              capabilities=c["capabilities"], design_answers=c["design_answers"])
        print(f"\n=== case {i}: {c['persona']} ===")
        try:
            bp = generate_blueprint(req)
        except Exception as e:
            print(f"  FAIL — generation error: {e}")
            continue
        prd = bp.prd_markdown.lower()
        checks = {
            "prd non-empty": len(bp.prd_markdown) > 120,
            "has flow": len(bp.flow) >= 2,
            "decision per capability": len(bp.decisions) >= 1,
            "spec has nodes": len(bp.spec.nodes) >= 2,
            "on-topic": any(t.lower() in prd for t in c["expect_terms"]),
            "no code fences in PRD": "```" not in bp.prd_markdown,
        }
        for name, ok in checks.items():
            print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
        if all(checks.values()):
            passed += 1
        print(f"  flow: {[f.title for f in bp.flow]}")
        print(f"  decisions: {[d.tag for d in bp.decisions]}")
        print(f"  PRD head: {bp.prd_markdown[:160].strip()!r}")

    print(f"\n{passed}/{len(CASES)} cases fully passed")
    sys.exit(0 if passed == len(CASES) else 1)


if __name__ == "__main__":
    main()
