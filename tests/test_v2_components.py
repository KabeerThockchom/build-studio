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
    # an app always reads gold tables, so it brings a pipeline; Lakebase always brings an app to write to it
    assert C.components_for([{"block": "decision_log"}, {"block": "app_screen"}]) == [C.PIPELINES, C.LAKEBASE, C.APPS]
    assert C.components_for([{"block": "decision_log"}, {"block": "rules_logic"}]) == [C.PIPELINES, C.LAKEBASE, C.APPS]
    # every build ships a surface, chosen from the shape when the scope has none
    assert C.components_for([{"block": "rules_logic"}], interaction_model="monitor") == [C.PIPELINES, C.DASHBOARDS]
    # Genie or dashboards read gold tables, so they imply a pipeline
    assert C.components_for([{"block": "genie_space"}]) == [C.PIPELINES, C.GENIE]
    assert C.components_for([{"block": "dashboard", "lane": "later"}]) == [C.PIPELINES, C.GENIE]  # surface fallback
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


def test_packages_realistic_for_v2_and_foundation_first():
    f = [{"name": "app", "block": "app_screen", "rank": 1, "essential": True},
         {"name": "rules", "block": "rules_logic", "rank": 2, "essential": True},
         {"name": "log", "block": "decision_log", "rank": 3}, {"name": "data", "block": "generated_data", "rank": 4},
         {"name": "pipe", "block": "pipeline_step", "rank": 5}, {"name": "genie", "block": "genie_space", "rank": 6},
         {"name": "dash", "block": "dashboard", "rank": 7}]
    P = {p["key"]: p for p in sd.build_packages(f)["packages"]}
    for p in P.values():
        assert {"data", "pipe", "app", "rules"} <= set(p["today"])       # foundation + essentials always ship
        assert p["fit"] != "Won't fit today"                               # a standard v2 build fits a day
    assert P["lean"]["fit"] == "Comfortable"


def test_handoff_never_sends_negative_fits_for_included_components():
    st = sd.new_state("idea")
    st["features"] = [{"name": "Queue", "block": "app_screen", "lane": "today", "rank": 1},
                      {"name": "Score", "block": "rules_logic", "lane": "today", "rank": 2}]
    out = sd.to_studio(st, {"fits": {C.APPS: "Not used today", C.PIPELINES: "scores each item"}})
    f = {c["name"]: c["fits"] for c in out["plan"]["capabilities"]}
    assert f[C.APPS] == C.COMPONENTS[C.APPS]["one_liner"]
    assert f[C.PIPELINES] == "scores each item"


def test_build_plan_drops_steps_outside_the_build(monkeypatch):
    from server import build_plan as bp
    from server.models import BuildRequest
    fake = ('{"steps": [{"capability": "data", "title": "Data", "concept": "c", "move": "m", "verify": "v"},'
            '{"capability": "Genie", "title": "Genie", "concept": "c", "move": "m", "verify": "v"},'
            '{"capability": "Databricks Apps", "title": "App", "concept": "c", "move": "m", "verify": "v"}]}')
    monkeypatch.setattr(bp.llm, "complete", lambda *a, **k: fake)
    monkeypatch.setattr(bp.config, "get_serving_endpoint", lambda: "x", raising=False)
    plan = bp.build_plan(BuildRequest(idea="i", capabilities=["Declarative Pipelines", "Genie"], design_answers={}))
    assert [s.capability for s in plan.steps] == ["data", "Genie"]
    assert [s.n for s in plan.steps] == [1, 2]


def test_learn_and_plan_render_the_same_architecture():
    from server import plan as P
    st = sd.new_state("idea")
    st["dataset_schema"] = None
    st["features"] = [{"name": "Queue", "block": "app_screen", "lane": "today", "rank": 1},
                      {"name": "Log", "block": "decision_log", "lane": "today", "rank": 2},
                      {"name": "Ask", "block": "genie_space", "lane": "stretch", "rank": 3}]
    studio = sd.to_studio(st, {})
    bp = P.to_blueprint({"idea": studio["idea"], "answers": studio["answers"]}, {"prd_markdown": "x"}, studio["capabilities"])
    assert studio["spec"] == bp["spec"]


def test_refine_can_add_and_remove_pieces_coherently():
    base = [C.PIPELINES, C.DASHBOARDS]
    assert C.reconcile([C.PIPELINES, C.DASHBOARDS, C.GENIE], base) == ([C.PIPELINES, C.GENIE, C.DASHBOARDS], [])
    new, notes = C.reconcile([C.PIPELINES, C.DASHBOARDS, C.LAKEBASE], base)
    assert new == [C.PIPELINES, C.LAKEBASE, C.DASHBOARDS, C.APPS] and notes
    # dropping the app takes its decision log with it
    new, notes = C.reconcile([C.PIPELINES, C.LAKEBASE, C.GENIE], [C.PIPELINES, C.LAKEBASE, C.GENIE, C.APPS])
    assert new == [C.PIPELINES, C.GENIE] and notes
    # can't drop the only surface or the pipeline
    new, _ = C.reconcile([], [C.PIPELINES, C.DASHBOARDS])
    assert new == [C.PIPELINES, C.DASHBOARDS]


def test_refine_job_swaps_pieces_and_diagram(monkeypatch):
    from server import plan as P
    calls = []

    def fake(messages, max_tokens=8000):
        calls.append(messages)
        return {"prd_markdown": "x", "pieces": [C.PIPELINES, C.DASHBOARDS, C.GENIE], "change_note": "Added Genie for chat."}
    monkeypatch.setattr(P, "_call", fake)
    monkeypatch.setattr(P, "check", lambda sd, p: [])
    job = {}
    P.run_plan({"idea": "i", "answers": {}, "capabilities": [C.PIPELINES, C.DASHBOARDS]}, job,
               previous={"prd_markdown": "old"}, adjust="I want an agent they can chat with")
    bp = job["blueprint"]
    assert bp["capabilities"] == [C.PIPELINES, C.GENIE, C.DASHBOARDS]
    assert bp["components_changed"]["added"] == [C.GENIE]
    assert any(n["id"] == "genie" for n in bp["spec"]["nodes"])
    assert "pieces" in calls[0][-1]["content"]


def test_packages_are_three_different_builds_and_duplicates_drop():
    f = [{"name": "draft", "block": "rules_logic", "rank": 1, "essential": True},
         {"name": "accts", "block": "generated_data", "rank": 2}, {"name": "wins", "block": "generated_data", "rank": 3},
         {"name": "pos", "block": "generated_data", "rank": 4}, {"name": "join", "block": "pipeline_step", "rank": 5},
         {"name": "screen", "block": "app_screen", "rank": 6}, {"name": "log", "block": "decision_log", "rank": 7},
         {"name": "ahead", "block": "rules_logic", "rank": 8, "levelup": True},
         {"name": "ask", "block": "genie_space", "rank": 9, "levelup": True}]
    P = sd.build_packages(f)["packages"]
    sets = [frozenset(p["today"] + p["stretch"]) for p in P]
    assert len(P) == 3 and len(set(sets)) == 3
    assert P[1]["adds"] and P[2]["adds"] and not set(P[1]["adds"]) & set(P[2]["adds"])
    assert C.GENIE in P[1]["components"] or C.GENIE in P[2]["components"]
    assert P[0]["fit"] != "Won't fit today"                     # three small tables are one step, not three
    # a scope with nothing beyond the core shows fewer, real choices instead of copies
    small = [{"name": "accts", "block": "generated_data", "rank": 1}, {"name": "screen", "block": "app_screen", "rank": 2}]
    out = sd.build_packages(small)
    assert len(out["packages"]) == 1 and out["recommended"] == "lean"


def test_offer_label_matches_the_line():
    for line, want in [("What if the draft cited which win story it used?", "offers"),
                       ("What guest data goes into this, and who can see it?", "curious")]:
        st = sa.new_session("idea")
        ui, _ = sa.apply_tools(st, [{"name": "stakeholder", "args": {"persona": "data_lead", "tone": "offers", "line": line,
                                                                     "option_1": "a", "option_2": "b", "option_3": "c"}}], {})
        assert next(u for u in ui if u["type"] == "stakeholder")["tone"] == want
