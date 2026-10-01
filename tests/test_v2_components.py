"""Build Studio v2: component catalog, packages, handoff and plan wiring (no model calls)."""
from server import components as C
from server import sitdown as sd
from server import sitdown_agent as sa
from server.cast import _valid


def test_legacy_blocks_map_into_v2_catalog():
    assert C.block_of("agent") == "rules_logic"
    assert C.block_of("knowledge_assistant") == "not_today"
    assert C.block_of("synthetic_table") == "generated_data"
    assert C.block_of("nonsense") == "app_screen"


def test_components_are_dynamic_and_ordered():
    assert C.components_for([{"block": "decision_log"}, {"block": "app_screen"}]) == [C.LAKEBASE, C.APPS]
    # Genie or dashboards read gold tables, so they imply a pipeline
    assert C.components_for([{"block": "genie_space"}]) == [C.PIPELINES, C.GENIE]
    assert C.components_for([{"block": "dashboard", "lane": "later"}]) == [C.PIPELINES, C.GENIE]  # fallback
    full = C.components_for([{"block": b} for b in ("app_screen", "dashboard", "genie_space", "decision_log", "pipeline_step")])
    assert full == C.ORDER
    assert "Supervisor agent" not in full and "Knowledge Assistant" not in full


def test_spec_wiring():
    spec = C.spec_for([C.PIPELINES, C.LAKEBASE, C.GENIE, C.APPS])
    bands = {n["id"]: n["band"] for n in spec["nodes"]}
    assert set(bands.values()) <= set(C.BANDS)
    e = set(spec["edges"])
    assert ("data", "declarative_pipelines") in e and ("databricks_apps", "lakebase") in e
    assert ("declarative_pipelines", "databricks_apps") in e and ("genie", "databricks_apps") in e


def test_packages_keep_essentials_in_today():
    f = [{"name": "list", "block": "app_screen", "rank": 1}, {"name": "rules", "block": "rules_logic", "rank": 2},
         {"name": "ask", "block": "genie_space", "rank": 3}, {"name": "log", "block": "decision_log", "rank": 7, "essential": True}]
    for p in sd.build_packages(f)["packages"]:
        assert "log" in p["today"]


def test_handoff_components_from_scope():
    st = sd.new_state("idea")
    st["features"] = [{"name": "Queue", "block": "app_screen", "lane": "today", "rank": 1},
                      {"name": "Score", "block": "rules_logic", "lane": "today", "rank": 2},
                      {"name": "Log", "block": "decision_log", "lane": "today", "rank": 3},
                      {"name": "Photo", "block": "not_today", "lane": "later", "rank": 4}]
    out = sd.to_studio(st, {"fits": {C.LAKEBASE: "records approvals"}})
    assert out["phase"] == "learn"
    assert out["capabilities"] == [C.PIPELINES, C.LAKEBASE, C.APPS]
    assert {c["name"] for c in out["plan"]["capabilities"]} == set(out["capabilities"])
    assert next(c for c in out["plan"]["capabilities"] if c["name"] == C.LAKEBASE)["fits"] == "records approvals"


def test_cast_fixed_names_dynamic_roles_and_host_check():
    r = _valid({"org": "American Airlines", "industry": "airline", "currency": "$", "locale": "US", "host_business": True,
                "cast": [{"role": "Data Architect", "avatar": "data_engineer"}, {"role": "Revenue Manager", "avatar": "finance"},
                         {"role": "Crew Lead", "avatar": "store_manager"}, {"role": "FAA Compliance", "avatar": "governance"}]})
    assert r["host_business"] is False                      # decided in code, not by the model
    names = {c["avatar"]: c["name"] for c in r["cast"].values()}
    assert names["data_engineer"] == "Arjun" and names["finance"] == "Marcus"
    assert any(c["role"] == "Crew Lead" for c in r["cast"].values())


def test_normalize_flat_tools_and_markup():
    calls = sa.normalize([
        {"name": "present_options", "args": {"question": "q", "option_1": "A", "option_2": "B", "option_3": "C",
                                             "option_1_consider": "tradeoff"}},
        {"name": "propose_scope", "args": {"features": ['<parameter name="name">!Decision log | decision_log | records',
                                                        "*Photo | agent | asked"]}},
    ])
    assert [o["label"] for o in calls[0]["args"]["options"]] == ["A", "B", "C"]
    assert calls[0]["args"]["options"][0]["consider"] == "tradeoff"
    f = calls[1]["args"]["features"]
    assert f[0]["name"] == "Decision log" and f[0]["essential"] and f[0]["block"] == "decision_log"
    assert f[1]["custom"] and f[1]["block"] == "rules_logic"


def test_untag_only_values_they_said():
    st = {"said": ["we want it under 5 minutes"], "facts": []}
    assert sa.untag_said("Under 5 minutes (suggested).", st) == "Under 5 minutes."
    assert "(suggested)" in sa.untag_said("Reach 3 minutes (suggested).", st)
