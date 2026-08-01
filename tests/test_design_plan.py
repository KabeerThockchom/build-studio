"""M2.5 tests — no network. Planner coercion, capability constraint, fallback."""
import json
from unittest.mock import patch
from server import design_plan, llm
from server.models import PlanRequest, DesignPlan

GOOD = json.dumps({
    "read_back": "You want to catch slipping accounts early.",
    "questions": [
        {"id": "audience", "title": "Who opens this?", "lead": "shapes the lead",
         "options": [
             {"key": "rep", "label": "A rep", "sub": "acts fast", "preview": ["a", "b", "c"]},
             {"key": "mgr", "label": "A manager", "sub": "oversees", "preview": ["a", "b", "c"]}]},
        {"id": "fresh", "title": "How fresh?", "lead": "latency",
         "options": [
             {"key": "live", "label": "Live", "sub": "", "preview": ["a", "b", "c"]},
             {"key": "daily", "label": "Daily", "sub": "", "preview": ["a", "b", "c"]}]},
    ],
    "capabilities": [
        {"name": "Genie", "selected": True, "fits": "ask the data"},
        {"name": "Databricks Apps", "selected": True, "fits": "front door"},
        # deliberately omit some + include a bogus one to test constraint
        {"name": "Made Up Thing", "selected": True, "fits": "nope"},
    ],
})


def test_plan_happy_path_and_eyebrows():
    with patch.object(llm, "complete", return_value=GOOD):
        plan = design_plan.plan_design(PlanRequest(idea="catch slipping accounts"))
    assert isinstance(plan, DesignPlan)
    assert len(plan.questions) == 2
    assert plan.questions[0].eyebrow == "Design · 1 of 2"
    assert plan.questions[1].eyebrow == "Design · 2 of 2"
    assert plan.questions[0].options[0].letter == "A"


def test_capabilities_constrained_and_complete():
    with patch.object(llm, "complete", return_value=GOOD):
        plan = design_plan.plan_design(PlanRequest(idea="x"))
    names = [c.name for c in plan.capabilities]
    assert names == design_plan.CAPABILITIES          # all five, in order
    assert "Made Up Thing" not in names               # bogus dropped
    sel = {c.name for c in plan.capabilities if c.selected}
    assert sel == {"Genie", "Databricks Apps"}        # only the valid picks


def test_previews_padded_to_three():
    short = json.dumps({"read_back": "", "questions": [
        {"id": "q", "title": "t", "lead": "l", "options": [
            {"key": "a", "label": "A", "preview": ["only one"]}]}], "capabilities": []})
    with patch.object(llm, "complete", return_value=short):
        plan = design_plan.plan_design(PlanRequest(idea="x"))
    assert len(plan.questions[0].options[0].preview) == 3


def test_retries_then_raises():
    with patch.object(llm, "complete", side_effect=["garbage", "still garbage"]):
        try:
            design_plan.plan_design(PlanRequest(idea="x"))
            assert False
        except ValueError:
            pass


def test_fallback_is_valid():
    plan = design_plan.fallback_plan()
    assert len(plan.questions) == 2
    assert [c.name for c in plan.capabilities] == design_plan.CAPABILITIES
