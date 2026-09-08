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
from server.models import GenerateRequest  # noqa: E402

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
