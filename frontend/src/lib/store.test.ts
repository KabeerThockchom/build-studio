import { describe, it, expect } from "vitest";
import { reducer, initialState } from "./store";
import { interestsForComponents } from "./gallery";

// Picking a gallery sample and then editing it is the tricky flow: the sample's
// component/industry accelerator should hold while the idea is untouched, and
// quietly drop the moment the user makes it their own.
describe("gallery sample + edit behavior", () => {
  const pick = () => reducer(initialState, {
    t: "pickSample", idea: "flag slipping stores", industry: "retail (stores + e-commerce)",
    components: ["Genie", "Databricks Apps"], interests: ["Analytics & BI", "Apps"],
  });

  it("pins components, records industry + starter, lights interests on pick", () => {
    const s = pick();
    expect(s.idea).toBe("flag slipping stores");
    expect(s.sampleStarter).toBe("flag slipping stores");
    expect(s.industry).toBe("retail (stores + e-commerce)");
    expect(s.capabilities).toEqual(["Genie", "Databricks Apps"]);
    expect(s.capsPinned).toBe(true);
    expect(s.interests).toEqual(["Analytics & BI", "Apps"]);
  });

  it("keeps the accelerator when the idea text is unchanged", () => {
    const s = reducer(pick(), { t: "idea", v: "flag slipping stores" });
    expect(s.capsPinned).toBe(true);
    expect(s.industry).toBe("retail (stores + e-commerce)");
  });

  it("drops to a custom prompt when the idea is edited away from the starter", () => {
    const s = reducer(pick(), { t: "idea", v: "analyze our hotel guest reviews instead" });
    expect(s.capsPinned).toBe(false);      // SA will pick components now
    expect(s.industry).toBe("");            // no stale vertical hint
    expect(s.sampleStarter).toBe("");
    expect(s.capabilities).toEqual(["Genie", "Databricks Apps"]); // untouched until SA plan lands
  });

  it("a pinned selection survives the SA plan; an unpinned one adopts it", () => {
    const plan = { read_back: "", questions: [],
      capabilities: [{ name: "Supervisor agent", selected: true, fits: "" },
                     { name: "Genie", selected: false, fits: "" }] };
    const pinned = reducer(pick(), { t: "planOk", plan: plan as never });
    expect(pinned.capabilities).toEqual(["Genie", "Databricks Apps"]); // kept
    const custom = reducer(initialState, { t: "planOk", plan: plan as never });
    expect(custom.capabilities).toEqual(["Supervisor agent"]);         // adopted
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
