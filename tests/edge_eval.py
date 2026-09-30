"""Edge / adversarial eval — the paths beyond the happy path, run against real FMAPI.

quality_eval covers well-formed ideas going straight through. This probes what a
workshop participant might ACTUALLY do that we didn't design for, and asserts the app
behaves:
  1. Refine loop — does "remove Lakebase" actually drop it from the architecture?
     (the exact bug that motivated this: the diagram used to be frozen to the
     Assemble selection and ignored refine notes.)
  2. Capability combos — sparse/odd selections (Lakebase-only, no-app, single-cap).
  3. Vague / contradictory ideas — thin input, or an idea that fights the capabilities.
  4. Config constraints — a workshop that restricts the palette actually constrains.

Opt-in (hits real FMAPI):
  DATABRICKS_PROFILE=build-studio uv run --with-requirements requirements-dev.txt \
    python tests/edge_eval.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server.generate import generate_blueprint, compute_spec  # noqa: E402
from server.build_plan import build_plan  # noqa: E402
from server.design_plan import plan_design  # noqa: E402
from server.models import GenerateRequest, BuildRequest, PlanRequest  # noqa: E402

RESULTS = []


def case(name, fn):
    try:
        ok, detail = fn()
    except Exception as e:
        ok, detail = False, f"EXCEPTION: {e}"
    RESULTS.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name} — {detail}")


def _caps(bp):
    return set(bp.capabilities)


def _node_labels(bp):
    return {n.label for n in bp.spec.nodes}


# --- 1. Refine loop: the headline bug -----------------------------------------
def refine_removes_lakebase():
    base = GenerateRequest(idea="Let ops review flagged transactions and record what they investigated.",
                           capabilities=["Genie", "Lakebase", "Databricks Apps"],
                           design_answers={"data_mode": "synthetic"})
    bp0 = generate_blueprint(base)
    if "Lakebase" not in _caps(bp0):
        return False, "setup: Lakebase not in baseline caps"
    ref = GenerateRequest(idea=base.idea, capabilities=["Genie", "Lakebase", "Databricks Apps"],
                          design_answers={"data_mode": "synthetic"},
                          adjust="Actually remove Lakebase from the architecture entirely.")
    bp1 = generate_blueprint(ref)
    lakebase_gone = "Lakebase" not in _caps(bp1) and not any("Lakebase" in l for l in _node_labels(bp1))
    ripple = bool(bp1.refine_note)
    return lakebase_gone, (f"caps now {sorted(_caps(bp1))}; refine_note={bp1.refine_note!r}"
                           if lakebase_gone else f"Lakebase STILL present: caps={sorted(_caps(bp1))}")


def refine_nonstructural_is_noop_on_caps():
    # A note that isn't about capabilities must NOT change the capability set.
    req = GenerateRequest(idea="Flag stores whose sales are slipping.",
                          capabilities=["Genie", "Databricks Apps"],
                          design_answers={"data_mode": "synthetic"},
                          adjust="Make the plan simpler and focus on the store manager view.")
    bp = generate_blueprint(req)
    same = _caps(bp) == {"Genie", "Databricks Apps"}
    return same, f"caps={sorted(_caps(bp))} (expected unchanged)"


def refine_adds_capability():
    req = GenerateRequest(idea="Ask questions about sales, and I also want to understand our policy docs.",
                          capabilities=["Genie", "Databricks Apps"],
                          design_answers={"data_mode": "synthetic"},
                          adjust="Add the ability to answer from our documents too.")
    bp = generate_blueprint(req)
    added = "Knowledge Assistant" in _caps(bp)
    return added, f"caps={sorted(_caps(bp))}"


# --- 2. Capability combos ------------------------------------------------------
def lakebase_only():
    # A single non-app capability: spec must still be well-formed (no dangling edges).
    bp = generate_blueprint(GenerateRequest(idea="Keep a running log of decisions the team makes.",
                                            capabilities=["Lakebase"],
                                            design_answers={"data_mode": "synthetic"}))
    ids = {n.id for n in bp.spec.nodes}
    edges_ok = all(f in ids and t in ids for f, t in bp.spec.edges)
    return edges_ok and len(bp.spec.nodes) >= 2, f"nodes={sorted(ids)} edges={bp.spec.edges}"


def no_app_genie_only():
    bp = generate_blueprint(GenerateRequest(idea="Just let me ask my data questions, no app.",
                                            capabilities=["Genie"],
                                            design_answers={"data_mode": "existing"}))
    ids = {n.id for n in bp.spec.nodes}
    return "data" in ids and "genie" in ids and len(bp.prd_markdown) > 150, f"nodes={sorted(ids)}"


# --- 3. Vague / contradictory --------------------------------------------------
def thin_idea():
    bp = generate_blueprint(GenerateRequest(idea="something with my data",
                                            capabilities=["Genie", "Databricks Apps"],
                                            design_answers={"data_mode": "synthetic"}))
    return len(bp.prd_markdown) > 150 and len(bp.flow) >= 3, f"prd_len={len(bp.prd_markdown)} flow={len(bp.flow)}"


def contradictory():
    # Idea implies documents/agents but only Genie chosen — should still produce a
    # coherent plan grounded in what WAS chosen, not invent capabilities.
    bp = generate_blueprint(GenerateRequest(
        idea="Build an autonomous agent that reads all our PDFs and emails customers.",
        capabilities=["Genie"], design_answers={"data_mode": "synthetic"}))
    no_invented = _caps(bp) == {"Genie"}
    return no_invented and len(bp.prd_markdown) > 150, f"caps={sorted(_caps(bp))}"


# --- 3b. Refine acknowledgement + build follows the refined plan ---------------
def refine_note_fires_on_intent_change():
    # Rosa's bug: a refine that changes the INTENT but keeps the same pieces used to
    # come back with an empty refine_note and no signal anything changed.
    base = GenerateRequest(idea="Track when our washing machines break down.",
                           capabilities=["Genie", "Databricks Apps"],
                           design_answers={"data_mode": "synthetic"})
    bp0 = generate_blueprint(base)
    ref = GenerateRequest(idea=base.idea, capabilities=["Genie", "Databricks Apps"],
                          design_answers={"data_mode": "synthetic"},
                          adjust="Actually forget breakdowns — just show revenue by location instead.")
    bp1 = generate_blueprint(ref)
    # caps legitimately unchanged (still Genie + App), but the user MUST get an acknowledgement.
    return bool(bp1.refine_note.strip()), f"refine_note={bp1.refine_note!r}"


def build_follows_refined_prd():
    # Rosa's core failure: build_plan built the ORIGINAL idea after a pivot. Now the PRD
    # is authoritative — a build built from a revenue PRD must not be about machines.
    prd = ("## Summary\nShow revenue by store location and highlight the slowest store.\n"
           "## What it does\nRanks locations by revenue and flags the lowest performer.\n")
    bp = build_plan(BuildRequest(idea="Track when our washing machines break down.",
                                 capabilities=["Genie", "Databricks Apps"],
                                 design_answers={"data_mode": "synthetic"},
                                 prd_markdown=prd))
    blob = " ".join(f"{s.title} {s.concept} {s.move}" for s in bp.steps).lower()
    machiney = any(w in blob for w in ["breakdown", "break down", "machine", "maintenance"])
    revenuey = any(w in blob for w in ["revenue", "location", "store", "sales"])
    return (not machiney) and revenuey, f"machiney={machiney} revenuey={revenuey}"


# --- 3c. Design answers are honored: dashboard means no chat box ---------------
def dashboard_answer_suppresses_chat():
    # Kenji's bug: answering "just a dashboard, no chat" still produced a Genie question box.
    bp = generate_blueprint(GenerateRequest(
        idea="A dashboard showing which schools are missing attendance data and trending down.",
        capabilities=["Genie", "Databricks Apps"],
        design_answers={"data_mode": "existing",
                        "delivery": "A visual dashboard only — charts and a report, NOT a chat or question box."}))
    flow_blob = " ".join(f"{f.title} {f.sub}" for f in bp.flow).lower()
    prd = bp.prd_markdown.lower()
    chatty = any(w in flow_blob for w in ["question box", "ask a question", "chat", "type a question", "ask genie"])
    return not chatty, f"chatty_flow={chatty}; flow={[f.title for f in bp.flow]}"


# --- 3d. Conservative preselection: don't accumulate uninvited pieces ----------
def plan_does_not_overselect():
    # Priya/Ashley: Lakebase + Supervisor agent arrived pre-selected without being asked for.
    # A plain "look at my data" idea should not pre-select persistence or an orchestrator.
    plan = plan_design(PlanRequest(idea="I just want to look at my monthly sales numbers.",
                                   expertise="New to it", interests=[]))
    sel = {c.name for c in plan.capabilities if c.selected}
    # neither of the two "accumulated without consent" pieces should be auto-on here
    return ("Lakebase" not in sel and "Supervisor agent" not in sel), f"selected={sorted(sel)}"


# --- 4. Config constraint (deterministic, no LLM needed) -----------------------
def spec_respects_restricted_palette():
    # If a workshop only allows Genie+Apps, a spec built from that must not contain others.
    spec = compute_spec(["Genie", "Databricks Apps"], "synthetic")
    labels = {n.label for n in spec.nodes}
    return "Lakebase" not in labels and "Supervisor agent" not in labels, f"labels={sorted(labels)}"


def main():
    print("=== Edge / adversarial eval (real FMAPI) ===\n")
    print("1. Refine loop")
    case("refine removes Lakebase from architecture", refine_removes_lakebase)
    case("non-structural refine doesn't change caps", refine_nonstructural_is_noop_on_caps)
    case("refine can add a capability", refine_adds_capability)
    print("1b. Refine acknowledgement + build follows refined plan")
    case("refine_note fires on intent change (no cap change)", refine_note_fires_on_intent_change)
    case("build follows refined PRD, not stale idea", build_follows_refined_prd)
    case("dashboard answer suppresses chat box", dashboard_answer_suppresses_chat)
    case("plan does not over-select uninvited pieces", plan_does_not_overselect)
    print("2. Capability combos")
    case("Lakebase-only spec is well-formed", lakebase_only)
    case("Genie-only (no app) is coherent", no_app_genie_only)
    print("3. Vague / contradictory")
    case("thin idea still yields a plan", thin_idea)
    case("contradictory idea invents no capabilities", contradictory)
    print("4. Config constraint")
    case("restricted palette spec excludes others", spec_respects_restricted_palette)

    n = len(RESULTS)
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    print(f"\n{'='*54}\n{passed}/{n} edge cases passed")
    fails = [name for name, ok, _ in RESULTS if not ok]
    if fails:
        print("FAILED:", ", ".join(fails))
    sys.exit(0 if passed == n else 1)


if __name__ == "__main__":
    main()
