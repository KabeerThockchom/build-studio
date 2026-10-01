"""Generate a full journey for one sample and publish PROJECT.md into the workspace,
so there's a real artifact to run the Genie Code 'cockpit' build against.

Run:  DATABRICKS_CONFIG_PROFILE=<profile> python3 optimize/publish_one.py
"""
import os
import sys

os.environ.setdefault("DATABRICKS_CONFIG_PROFILE", "build-studio")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import generate, build_plan, publish  # noqa: E402
from server.models import GenerateRequest, BuildRequest  # noqa: E402

LOCKED = ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"]
IDEA = ("Our accounts payable team keys in supplier invoices and manually matches them to purchase "
        "orders, which is slow and backs up at month end. I want an agent that reads each incoming "
        "invoice, matches it to the right PO and receipt, checks the amounts line up, and drafts the "
        "coding plus an approve-or-hold recommendation, so the AP clerk just reviews and approves. "
        "Every decision it makes should be recorded so we keep an audit trail.")
ANSWERS = {"interaction_model": "agent_actions"}
PROJECT = "AP Invoice Copilot"

print("generating blueprint...")
bp = generate.generate_blueprint(GenerateRequest(
    idea=IDEA, expertise="New to it", capabilities=LOCKED, design_answers=ANSWERS))
print("generating build plan...")
plan = build_plan.build_plan(BuildRequest(
    idea=IDEA, expertise="New to it", capabilities=LOCKED, design_answers=ANSWERS,
    prd_markdown=bp.prd_markdown, project_name=PROJECT))
print("publishing PROJECT.md...")
res = publish.publish_assets(
    idea=IDEA, prd_markdown=bp.prd_markdown, capabilities=LOCKED, design_answers=ANSWERS,
    decisions=bp.decisions, steps=plan.steps, usable_assets="", project_name=PROJECT)
print("ok:", res.get("ok"))
print("dir:", res.get("dir"))
print("deep_link:", res.get("deep_link"))
print("wrote_as:", res.get("wrote_as"))
