"""One-off e2e sanity check of the generation pipeline with the real model.

Runs the full journey (plan -> blueprint -> build plan -> PROJECT.md) for an
agentic Costa sample and asserts the recent changes actually landed:
  - no data_mode question is asked (data is always synthetic now)
  - interaction_model is still asked
  - the Supervisor agent build step carries the MLflow tracing guidance
  - PROJECT.md's build practices include the MLflow tracing wiring

Run:  DATABRICKS_CONFIG_PROFILE=build-studio python3 optimize/e2e_check.py
"""
import os
import sys

os.environ.setdefault("DATABRICKS_CONFIG_PROFILE", "build-studio")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import design_plan, generate, build_plan, publish  # noqa: E402
from server.models import PlanRequest, GenerateRequest, BuildRequest  # noqa: E402

LOCKED = ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"]
IDEA = ("Our accounts payable team keys in supplier invoices and manually matches them to purchase "
        "orders, which is slow and backs up at month end. I want an agent that reads each incoming "
        "invoice, matches it to the right PO and receipt, checks the amounts line up, and drafts the "
        "coding plus an approve-or-hold recommendation, so the AP clerk just reviews and approves.")
INDUSTRY = "beverage bottling and distribution (a bottler: outlets, vending, DSD, back-office finance)"

ok = True
def check(label, cond, detail=""):
    global ok
    ok = ok and cond
    print(f"  [{'PASS' if cond else 'FAIL'}] {label}" + (f" — {detail}" if detail and not cond else ""))


print("== 1. plan_design ==")
plan = design_plan.plan_design(PlanRequest(idea=IDEA, industry=INDUSTRY))
qids = [q.id for q in plan.questions]
print(f"  question ids: {qids}")
check("no data_mode question", "data_mode" not in qids)
check("interaction_model asked", "interaction_model" in qids)
check("1-3 questions", 1 <= len(qids) <= 3, f"got {len(qids)}")
im = next((q for q in plan.questions if q.id == "interaction_model"), None)
if im:
    print(f"  interaction_model options: {[o.key for o in im.options]}")

print("== 2. generate_blueprint ==")
bp = generate.generate_blueprint(GenerateRequest(
    idea=IDEA, expertise="New to it", capabilities=LOCKED,
    design_answers={"interaction_model": "agent_actions"}))
prd = bp.prd_markdown or ""
check("PRD generated", len(prd) > 400, f"len={len(prd)}")
print(f"  PRD length: {len(prd)}  decisions: {len(bp.decisions)}")

print("== 3. build_plan ==")
plan2 = build_plan.build_plan(BuildRequest(
    idea=IDEA, expertise="New to it", capabilities=LOCKED,
    design_answers={"interaction_model": "agent_actions"},
    prd_markdown=prd, project_name="AP Invoice Copilot"))
steps = plan2.steps
caps = [s.capability for s in steps]
print(f"  step capabilities: {caps}")
sup = next((s for s in steps if s.capability == "Supervisor agent"), None)
check("supervisor agent step present", sup is not None)
if sup:
    blob = (sup.move + " " + sup.verify + " " + sup.concept).lower()
    check("supervisor step mentions MLflow tracing", ("mlflow" in blob or "trace" in blob), sup.move[:200])
    check("supervisor step mentions a span/trace observability", ("span" in blob or "trace" in blob))
    print(f"  supervisor move: {sup.move[:320]}...")

print("== 4. PROJECT.md build practices ==")
md = publish._project_md(idea=IDEA, prd_markdown=prd, decisions=bp.decisions, steps=steps,
                         usable_assets="", data_mode="synthetic", doc_path="/Workspace/Users/x/ap/PROJECT.md")
low = md.lower()
check("PROJECT.md has MLflow tracing practice", "mlflow" in low and "experiment" in low)
check("PROJECT.md mentions autolog or @mlflow.trace", ("autolog" in low or "@mlflow.trace" in low))
check("PROJECT.md still has allowlist practice", "sync.include" in low)
print(f"  PROJECT.md length: {len(md)}")

print("\n== RESULT ==", "ALL PASS" if ok else "FAILURES ABOVE")
sys.exit(0 if ok else 1)
