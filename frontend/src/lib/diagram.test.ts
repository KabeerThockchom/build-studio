import { describe, it, expect } from "vitest";
import { layoutDiagram, specFor } from "./diagram";
import { BAND_ORDER, BAND_LABELS, PIPELINES, GENIE, DASHBOARDS, LAKEBASE, APPS } from "./constants";

describe("bands", () => {
  it("run left to right: your data, shape it, serve it, use it", () => {
    expect(BAND_ORDER).toEqual(["data", "pipeline", "serve", "delivery"]);
    expect(BAND_ORDER.map((b) => BAND_LABELS[b])).toEqual(["Your data", "Shape it", "Serve it", "Use it"]);
  });
});

describe("specFor (mirrors server components.spec_for)", () => {
  it("wires data -> pipeline -> Genie/Dashboards, the app writes to Lakebase and reads Genie + gold", () => {
    const s = specFor([PIPELINES, LAKEBASE, GENIE, DASHBOARDS, APPS]);
    const has = (a: string, b: string) => s.edges.some(([f, t]) => f === a && t === b);
    expect(s.nodes.map((n) => n.id)).toEqual(["data", "declarative_pipelines", "lakebase", "genie", "aibi_dashboards", "databricks_apps"]);
    expect(has("data", "declarative_pipelines")).toBe(true);
    expect(has("declarative_pipelines", "genie")).toBe(true);
    expect(has("declarative_pipelines", "aibi_dashboards")).toBe(true);
    expect(has("databricks_apps", "lakebase")).toBe(true);
    expect(has("genie", "databricks_apps")).toBe(true);
    expect(has("declarative_pipelines", "databricks_apps")).toBe(true);
  });

  it("without an app, Lakebase is fed from the pipeline", () => {
    const s = specFor([PIPELINES, LAKEBASE]);
    expect(s.edges).toContainEqual(["declarative_pipelines", "lakebase"]);
  });

  it("ignores components it does not know (no agents, no document Q&A)", () => {
    const s = specFor(["Supervisor agent", "Knowledge Assistant", GENIE]);
    expect(s.nodes.map((n) => n.label)).toEqual(["Your data", "Genie"]);
  });
});

describe("layoutDiagram", () => {
  const spec = specFor([PIPELINES, GENIE, DASHBOARDS, APPS]);
  it("places every node", () => {
    expect(layoutDiagram(spec).placed).toHaveLength(5);
  });
  it("stacks a band vertically and separates bands horizontally", () => {
    const L = layoutDiagram(spec);
    const by = (id: string) => L.placed.find((p) => p.id === id)!;
    expect(by("genie").x).toBe(by("aibi_dashboards").x);
    expect(by("aibi_dashboards").y).toBeGreaterThan(by("genie").y);
    expect(by("declarative_pipelines").x).toBeGreaterThan(by("data").x);
    expect(by("databricks_apps").x).toBeGreaterThan(by("genie").x);
  });
  it("only keeps connectors between placed nodes", () => {
    const L = layoutDiagram({ nodes: spec.nodes, edges: [...spec.edges, ["ghost", "genie"]] });
    expect(L.connectors.some((c) => c.from === "ghost")).toBe(false);
  });
});
