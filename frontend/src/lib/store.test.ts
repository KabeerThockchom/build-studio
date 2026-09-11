import { describe, it, expect } from "vitest";
import { reducer, initialState, LOCKED_CAPABILITIES } from "./store";
import { interestsForComponents } from "./gallery";

// The architecture is fully prescribed (Akil, 2026-09-09): capabilities are always the
// locked set and never change. A gallery sample seeds the idea/vertical/name/interests
// only; it no longer sets components. Editing the idea still drops the vertical hint.
describe("gallery sample pick (architecture locked)", () => {
  const pick = () => reducer(initialState, {
    t: "pickSample", idea: "flag slipping stores", name: "Store Slip Detector", industry: "retail (stores + e-commerce)",
    components: ["Genie", "Databricks Apps"], interests: ["Analytics & BI", "Apps"],
  });

  it("seeds idea/starter/industry/name/interests; capabilities stay the locked set", () => {
    const s = pick();
    expect(s.idea).toBe("flag slipping stores");
    expect(s.sampleStarter).toBe("flag slipping stores");
    expect(s.industry).toBe("retail (stores + e-commerce)");
    expect(s.capabilities).toEqual(LOCKED_CAPABILITIES);   // sample no longer sets components
    expect(s.capsPinned).toBe(false);
    expect(s.interests).toEqual(["Analytics & BI", "Apps"]);
    expect(s.projectName).toBe("Store Slip Detector");   // sample seeds the project name
  });

  it("keeps the vertical hint while the idea text is unchanged", () => {
    const s = reducer(pick(), { t: "idea", v: "flag slipping stores" });
    expect(s.industry).toBe("retail (stores + e-commerce)");
    expect(s.capabilities).toEqual(LOCKED_CAPABILITIES);
  });

  it("clears the vertical hint when the idea is edited away from the starter", () => {
    const s = reducer(pick(), { t: "idea", v: "analyze our hotel guest reviews instead" });
    expect(s.industry).toBe("");            // no stale vertical hint
    expect(s.sampleStarter).toBe("");
    expect(s.capabilities).toEqual(LOCKED_CAPABILITIES); // still locked
  });

  it("the SA plan never changes the locked capabilities", () => {
    const plan = { read_back: "", questions: [],
      capabilities: [{ name: "Supervisor agent", selected: true, fits: "" },
                     { name: "Genie", selected: false, fits: "" }] };
    const fromPick = reducer(pick(), { t: "planOk", plan: plan as never });
    expect(fromPick.capabilities).toEqual(LOCKED_CAPABILITIES);
    const fromCustom = reducer(initialState, { t: "planOk", plan: plan as never });
    expect(fromCustom.capabilities).toEqual(LOCKED_CAPABILITIES);
  });
});

describe("interestsForComponents", () => {
  it("agent shape reads as AI agents", () => {
    expect(interestsForComponents(["Genie", "Supervisor agent", "Databricks Apps"]))
      .toEqual(["AI agents", "Apps"]);
  });
  it("pure data shape reads as Analytics & BI", () => {
    expect(interestsForComponents(["Genie", "Databricks Apps"]))
      .toEqual(["Analytics & BI", "Apps"]);
  });
  it("Knowledge Assistant counts as an agent shape", () => {
    expect(interestsForComponents(["Knowledge Assistant", "Databricks Apps"]))
      .toEqual(["AI agents", "Apps"]);
  });
});
