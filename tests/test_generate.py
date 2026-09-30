"""M1 tests — no network. compute_spec is pure; generation is tested with the LLM mocked."""
import json
from unittest.mock import patch
from server import generate, llm
from server.models import GenerateRequest, Blueprint

FULL = ["Zerobus", "SDP medallion", "Genie", "Lakebase", "Databricks Apps"]


# --- compute_spec: deterministic diagram spine ---
def test_spec_bands_and_ingest_node():
    spec = generate.compute_spec(FULL, data_mode="synthetic")
    ids = {n.id for n in spec.nodes}
    # Zerobus IS the data-band node, so no generic "data" source node is added.
    assert "zerobus" in ids and "data" not in ids
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


def test_spec_edges_follow_the_journey():
    spec = generate.compute_spec(FULL)
    edges = set(spec.edges)
    assert ("zerobus", "sdp_medallion") in edges         # ingest -> medallion
    assert ("sdp_medallion", "genie") in edges           # gold -> Genie
    assert ("genie", "databricks_apps") in edges         # Genie -> app
    assert ("lakebase", "databricks_apps") in edges      # app state -> app


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


def test_generate_filters_unknown_capabilities():
    # A direct API caller can send a junk capability the UI could never produce — it must
    # not survive into the blueprint's capability list, diagram, or prompt.
    req = GenerateRequest(idea="x", capabilities=["Genie", "NotARealCapability", "Databricks Apps"])
    with patch.object(llm, "complete", return_value=GOOD):
        bp = generate.generate_blueprint(req)
    assert "NotARealCapability" not in bp.capabilities
    assert set(bp.capabilities) == {"Genie", "Databricks Apps"}


def test_generate_raises_after_all_attempts_bad():
    # generate_blueprint retries several times (no fallback exists downstream), so it
    # only raises once every attempt has produced unparseable JSON.
    req = GenerateRequest(idea="x", capabilities=["Genie"])
    with patch.object(llm, "complete", side_effect=["nope"] * 4):
        try:
            generate.generate_blueprint(req)
            assert False, "should have raised"
        except ValueError:
            pass
