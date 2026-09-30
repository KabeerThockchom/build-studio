"""M3 tests — the advisory idea stress-test + design concept coercion. LLM mocked."""
import json
from unittest.mock import patch
from server import idea_check, llm
from server.models import IdeaCheckRequest
from server.design_plan import _coerce_plan

GOOD = json.dumps({
    "strong": False,
    "summary": "Say who uses it and what you're trying to move.",
    "criteria": [
        {"key": "problem", "met": True, "hint": ""},
        {"key": "users", "met": False, "hint": "Who opens this?"},
        {"key": "objective", "met": False, "hint": "What are you trying to improve?"},
        {"key": "data", "met": True, "hint": ""},
    ],
})


def test_idea_check_parses_and_maps_criteria():
    req = IdeaCheckRequest(idea="A tool that flags underperforming stores each morning.")
    with patch.object(llm, "complete", return_value=GOOD):
        res = idea_check.check_idea(req)
    assert res.strong is False
    keys = {c.key for c in res.criteria}
    assert keys == {"problem", "users", "objective", "data"}
    users = next(c for c in res.criteria if c.key == "users")
    assert users.met is False and users.hint == "Who opens this?"
    # labels always filled from the canonical list, even if the model omits them
    assert all(c.label for c in res.criteria)


def test_idea_check_fails_open_on_bad_json():
    # Advisory: a model hiccup must never block or falsely flag a weak idea.
    req = IdeaCheckRequest(idea="A real idea long enough to be judged by the model.")
    with patch.object(llm, "complete", return_value="not json"):
        res = idea_check.check_idea(req)
    assert res.strong is True
    assert all(c.met for c in res.criteria) and len(res.criteria) == 4


def test_idea_check_short_idea_is_thin_not_strong_and_skips_model():
    # Too short to judge: don't call the model, and don't call it "strong" (that reads
    # backwards for an empty idea) — ask for more, with no scary per-item nags.
    with patch.object(llm, "complete", side_effect=AssertionError("should not call the model")):
        res = idea_check.check_idea(IdeaCheckRequest(idea="x"))
    assert res.strong is False and len(res.criteria) == 4
    assert all((not c.met) and c.hint == "" for c in res.criteria)
    assert res.summary


def test_design_plan_carries_concept_label():
    parsed = {
        "read_back": "Got it.",
        "questions": [{
            "id": "audience", "concept": "Audience", "title": "Who's it for?", "lead": "Shapes it.",
            "options": [{"key": "a", "label": "Ops", "sub": "", "preview": ["x", "y", "z"]},
                        {"key": "b", "label": "Execs", "sub": "", "preview": ["x", "y", "z"]}],
        }],
        "capabilities": [{"name": "Genie", "selected": True, "fits": "ask the data"}],
    }
    plan = _coerce_plan(parsed)
    assert plan.questions[0].concept == "Audience"
