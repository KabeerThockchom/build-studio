"""M1 tests — no network. compute_spec is pure; generation is tested with the LLM mocked."""
import json
from unittest.mock import patch
from server import generate, llm
from server.models import GenerateRequest, Blueprint

FULL = ["Genie", "Knowledge Assistant", "Supervisor agent", "Lakebase", "Databricks Apps"]


# --- compute_spec: deterministic diagram spine ---
def test_spec_bands_and_data_node():
    spec = generate.compute_spec(FULL, data_mode="synthetic")
    ids = {n.id for n in spec.nodes}
    assert "data" in ids  # synthetic -> generic data node
    assert {n.band for n in spec.nodes} >= {"data", "capability", "agent", "delivery"}


def test_spec_data_node_reflects_mode():
    # All three workshop-realistic paths share the "data" node id, with mode-specific labels.
    for mode, label in [("synthetic", "Sample data"), ("upload", "Your file"), ("existing", "Existing table")]:
        spec = generate.compute_spec(["Genie"], data_mode=mode)
        data = next(n for n in spec.nodes if n.id == "data")
        assert data.label == label


def test_spec_no_lakeflow_capability():
    # Lakeflow is gone from the palette; passing it produces no node for it.
    spec = generate.compute_spec(["Genie", "Lakeflow", "Databricks Apps"])
    ids = {n.id for n in spec.nodes}
    assert "lakeflow" not in ids and "data" in ids


def test_spec_edges_route_through_agent():
    spec = generate.compute_spec(["Genie", "Supervisor agent", "Databricks Apps"])
    edges = set(spec.edges)
    assert ("data", "genie") in edges           # data -> capability
    assert ("genie", "supervisor_agent") in edges  # capability -> agent
    assert ("supervisor_agent", "databricks_app".replace("app", "apps")) in edges or \
           ("supervisor_agent", "databricks_apps") in edges  # agent -> delivery


def test_spec_no_agent_wires_caps_to_delivery():
    spec = generate.compute_spec(["Genie", "Databricks Apps"])  # no agent
    edges = set(spec.edges)
    assert ("genie", "databricks_apps") in edges


# --- generate_blueprint: LLM mocked ---
GOOD = json.dumps({
    "prd_markdown": "## Summary\nA thing.",
    "flow": [{"n": 1, "title": "See", "sub": "x"}, {"n": 2, "title": "Act", "sub": "y"}],
    "decisions": [{"tag": "Genie", "text": "answers", "tradeoff": "needs a curated space"}],
})


def test_generate_happy_path():
    req = GenerateRequest(idea="flag slipping accounts", capabilities=["Genie", "Databricks Apps"])
    with patch.object(llm, "complete", return_value=GOOD):
        bp = generate.generate_blueprint(req)
    assert isinstance(bp, Blueprint)
    assert bp.prd_markdown.startswith("## Summary")
    assert len(bp.flow) == 2
    assert bp.spec.nodes  # spec computed regardless of LLM


def test_generate_tolerates_fenced_json():
    req = GenerateRequest(idea="x", capabilities=["Genie"])
    fenced = f"```json\n{GOOD}\n```"
    with patch.object(llm, "complete", return_value=fenced):
        bp = generate.generate_blueprint(req)
    assert bp.decisions[0].tag == "Genie"


def test_generate_retries_on_bad_json_then_succeeds():
    req = GenerateRequest(idea="x", capabilities=["Genie"])
    with patch.object(llm, "complete", side_effect=["not json at all", GOOD]) as m:
        bp = generate.generate_blueprint(req)
    assert m.call_count == 2
    assert bp.prd_markdown


def test_generate_raises_after_two_bad():
    req = GenerateRequest(idea="x", capabilities=["Genie"])
    with patch.object(llm, "complete", side_effect=["nope", "still nope"]):
        try:
            generate.generate_blueprint(req)
            assert False, "should have raised"
        except ValueError:
            pass
