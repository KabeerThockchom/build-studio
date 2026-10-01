import { describe, it, expect } from "vitest";
import { reducer, initialState, persistable, type StudioState } from "./store";
import type { StudioHandoff } from "./types";

const studio: StudioHandoff = {
  idea: "Help crew schedulers predict which crews will time out",
  projectName: "Crew Timeout Radar",
  answers: { brief_problem: "Crews time out after delays", "build_today (core first, in order)": "ranked list; decision log" },
  capabilities: ["Declarative Pipelines", "Lakebase", "Genie", "Databricks Apps"],
  plan: { read_back: "", questions: [], capabilities: [{ name: "Genie", selected: true, fits: "answers questions about crews" }] },
};

describe("the journey", () => {
  it("starts on the overview, then the Sit-Down", () => {
    expect(initialState.phase).toBe("overview");
    expect(reducer(initialState, { t: "phase", phase: "sitdown" }).phase).toBe("sitdown");
  });

  it("the Sit-Down handoff adopts the idea + components and lands on Learn", () => {
    const s = reducer({ ...initialState, phase: "sitdown" }, { t: "handoff", studio });
    expect(s.phase).toBe("learn");
    expect(s.idea).toBe(studio.idea);
    expect(s.projectName).toBe("Crew Timeout Radar");
    expect(s.capabilities).toEqual(studio.capabilities);
    expect(s.plan?.capabilities[0].fits).toMatch(/crews/);
    expect(s.sdProgress.done).toBe(true);
    expect(s.spec).toBeNull();
    const withSpec = reducer(initialState, { t: "handoff", studio: { ...studio, spec: { nodes: [{ id: "data", band: "data", label: "x", sub: "" }], edges: [] } } });
    expect(withSpec.spec?.nodes[0].id).toBe("data");
    expect(s.learnIdx).toBe(0);
  });

  it("a new handoff clears any plan or build made from an earlier version", () => {
    const old: StudioState = { ...initialState, blueprint: { prd_markdown: "x" } as any, buildPlan: { steps: [] }, buildDone: [1], planJob: { id: "j", status: "done", stage: "done" } };
    const s = reducer(old, { t: "handoff", studio });
    expect(s.blueprint).toBeNull();
    expect(s.buildPlan).toBeNull();
    expect(s.buildDone).toEqual([]);
    expect(s.planJob).toBeNull();
  });

  it("tracks the furthest Learn beat for rail reachability", () => {
    let s = reducer(initialState, { t: "learnIdx", i: 3 });
    s = reducer(s, { t: "learnIdx", i: 1 });
    expect(s.learnIdx).toBe(1);
    expect(s.learnMax).toBe(3);
  });

  it("a finished plan replaces the blueprint and invalidates the build plan", () => {
    const s0: StudioState = { ...initialState, planJob: { id: "j1", status: "running", stage: "checking" }, buildPlan: { steps: [] } };
    const s = reducer(s0, { t: "planDone", bp: { prd_markdown: "## Summary" } as any });
    expect(s.blueprint?.prd_markdown).toBe("## Summary");
    expect(s.planJob?.status).toBe("done");
    expect(s.buildPlan).toBeNull();
  });

  it("a refine plan updates capabilities and spec when the blueprint has refine_note", () => {
    const s0: StudioState = { ...initialState, capabilities: ["Genie"], plan: { read_back: "", questions: [], capabilities: [{ name: "Genie", selected: true, fits: "answers questions" }] }, spec: { nodes: [], edges: [] } };
    const newSpec = { nodes: [{ id: "new", band: "data" as const, label: "data", sub: "" }], edges: [] };
    const bp = { prd_markdown: "## Summary", refine_note: "Added Lakebase", capabilities: ["Genie", "Lakebase"], spec: newSpec } as any;
    const s = reducer(s0, { t: "planDone", bp });
    expect(s.blueprint?.refine_note).toBe("Added Lakebase");
    expect(s.capabilities).toEqual(["Genie", "Lakebase"]);
    expect(s.spec).toEqual(newSpec);
    expect(s.plan?.capabilities[1].name).toBe("Lakebase");
  });

  it("a plan error is recorded on the job", () => {
    const s = reducer({ ...initialState, planJob: { id: "j", status: "running", stage: "drafting" } }, { t: "planErr", e: "boom" });
    expect(s.planError).toBe("boom");
    expect(s.planJob?.status).toBe("error");
  });

  it("choosing a build step means the overview has been left", () => {
    const s = reducer(initialState, { t: "buildStep", i: 2 });
    expect(s.buildStepIdx).toBe(2);
    expect(s.buildEntered).toBe(true);
  });

  it("build completion is idempotent", () => {
    let s = reducer(initialState, { t: "buildComplete", n: 1 });
    s = reducer(s, { t: "buildComplete", n: 1 });
    expect(s.buildDone).toEqual([1]);
  });

  it("hydrate keeps unknown phases out and never restores a loading flag", () => {
    const s = reducer({ ...initialState, buildLoading: true }, { t: "hydrate", s: { phase: "teach" as any, idea: "x" } });
    expect(s.phase).toBe("overview");
    expect(s.idea).toBe("x");
    expect(s.buildLoading).toBe(false);
  });

  it("persists the Sit-Down session and the plan job with the rest of the journey", () => {
    const s = reducer(initialState, { t: "sitdownSave", blob: { SESSION: { stage: "scope" } }, progress: { stage: "scope", covered: 5, started: true, done: false } });
    const p = persistable({ ...s, planJob: { id: "j", status: "running", stage: "drafting" } });
    expect((p.sitdown as any).SESSION.stage).toBe("scope");
    expect(p.sdProgress.covered).toBe(5);
    expect(p.planJob?.id).toBe("j");
  });
});
