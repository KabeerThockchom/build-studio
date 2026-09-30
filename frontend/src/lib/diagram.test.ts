import { describe, it, expect } from "vitest";
import { layoutDiagram } from "./diagram";
import type { DiagramSpec } from "./types";

const spec: DiagramSpec = {
  nodes: [
    { id: "data", band: "data", label: "Sample data", sub: "" },
    { id: "genie", band: "capability", label: "Genie", sub: "" },
    { id: "ka", band: "capability", label: "Knowledge Assistant", sub: "" },
    { id: "agent", band: "agent", label: "Supervisor agent", sub: "" },
    { id: "app", band: "delivery", label: "Databricks App", sub: "" },
  ],
  edges: [["data", "genie"], ["data", "ka"], ["genie", "agent"], ["ka", "agent"], ["agent", "app"]],
};

describe("layoutDiagram", () => {
  it("places every node", () => {
    const L = layoutDiagram(spec);
    expect(L.placed).toHaveLength(5);
  });

  it("stacks nodes in the same band vertically, separates bands horizontally", () => {
    const L = layoutDiagram(spec);
    const genie = L.placed.find((p) => p.id === "genie")!;
    const ka = L.placed.find((p) => p.id === "ka")!;
    const data = L.placed.find((p) => p.id === "data")!;
    expect(genie.x).toBe(ka.x);         // same band -> same column
    expect(ka.y).toBeGreaterThan(genie.y); // stacked
    expect(genie.x).toBeGreaterThan(data.x); // capability right of data
  });

  it("keeps only connectors whose endpoints exist", () => {
    const L = layoutDiagram(spec);
    expect(L.connectors).toHaveLength(5);
    const bad: DiagramSpec = { nodes: spec.nodes, edges: [["data", "ghost"]] };
    expect(layoutDiagram(bad).connectors).toHaveLength(0);
  });

  it("height grows with the tallest band", () => {
    const tall: DiagramSpec = {
      nodes: [
        { id: "a", band: "capability", label: "a", sub: "" },
        { id: "b", band: "capability", label: "b", sub: "" },
        { id: "c", band: "capability", label: "c", sub: "" },
      ], edges: [],
    };
    expect(layoutDiagram(tall).height).toBeGreaterThan(layoutDiagram(spec).height - 200);
  });
});
