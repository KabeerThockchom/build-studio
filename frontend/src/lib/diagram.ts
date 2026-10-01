// Pure layout: DiagramSpec -> positioned geometry for SVG. Tested by vitest.
import type { DiagramSpec, Node, Band } from "./types";
import { BAND_ORDER, PIPELINES, GENIE, DASHBOARDS, LAKEBASE, APPS } from "./constants";

export interface PlacedNode extends Node { x: number; y: number; w: number; h: number; cx: number; cy: number; }
export interface Connector { from: string; to: string; }
export interface Layout {
  width: number; height: number;
  bandLabelY: number; colWidth: number;
  placed: PlacedNode[];
  connectors: Connector[];
  colX: (band: Band) => number;
}

export function layoutDiagram(spec: DiagramSpec, width = 940): Layout {
  const cols = BAND_ORDER.length;
  const colWidth = width / cols;
  const padX = 14, nodeH = 54, gap = 14, topPad = 34;

  const byBand: Record<Band, Node[]> = { data: [], pipeline: [], serve: [], delivery: [] };
  for (const n of spec.nodes) if (byBand[n.band]) byBand[n.band].push(n);
  const maxRows = Math.max(1, ...BAND_ORDER.map((b) => byBand[b].length));
  const height = topPad + maxRows * (nodeH + gap) + 8;

  const colIndex = (b: Band) => BAND_ORDER.indexOf(b);
  const colX = (b: Band) => colIndex(b) * colWidth;

  const placed: PlacedNode[] = [];
  for (const band of BAND_ORDER) {
    const nodes = byBand[band];
    // centre short columns vertically against the tallest one
    const offset = ((maxRows - nodes.length) * (nodeH + gap)) / 2;
    nodes.forEach((n, i) => {
      const w = colWidth - padX * 2;
      const x = colX(band) + padX;
      const y = topPad + offset + i * (nodeH + gap);
      placed.push({ ...n, x, y, w, h: nodeH, cx: x + w / 2, cy: y + nodeH / 2 });
    });
  }

  const connectors: Connector[] = spec.edges
    .filter(([f, t]) => placed.some((p) => p.id === f) && placed.some((p) => p.id === t))
    .map(([from, to]) => ({ from, to }));

  return { width, height, bandLabelY: 18, colWidth, placed, connectors, colX };
}

// The same deterministic wiring the server uses (components.spec_for), so Learn can show
// the architecture before the plan job has finished:
// data -> pipeline; pipeline -> Genie / Dashboards; the app writes to Lakebase;
// Genie (and the pipeline's gold tables) feed the app.
const META: Record<string, { band: Band; label: string; sub: string }> = {
  [PIPELINES]: { band: "pipeline", label: "Declarative Pipelines", sub: "bronze to silver to gold" },
  [GENIE]: { band: "serve", label: "Genie", sub: "plain-English questions" },
  [DASHBOARDS]: { band: "serve", label: "AI/BI Dashboard", sub: "the numbers at a glance" },
  [LAKEBASE]: { band: "serve", label: "Lakebase", sub: "records decisions" },
  [APPS]: { band: "delivery", label: "Databricks App", sub: "built with Genie App Builder" },
};
export const nodeId = (c: string) => c.toLowerCase().replace("/", "").replace(/ /g, "_");
export const componentBand = (c: string): Band => META[c]?.band || "serve";

export function specFor(components: string[], dataLabel = "Your data", dataSub = "tables your build reads"): DiagramSpec {
  const nodes: Node[] = [{ id: "data", band: "data", label: dataLabel, sub: dataSub }];
  const ids: Record<string, string> = {};
  for (const c of components) {
    const m = META[c];
    if (!m) continue;
    ids[c] = nodeId(c);
    nodes.push({ id: ids[c], ...m });
  }
  const edges: [string, string][] = [];
  const pipe = ids[PIPELINES], app = ids[APPS];
  const serve = [GENIE, DASHBOARDS, LAKEBASE].filter((c) => ids[c]).map((c) => ids[c]);
  if (pipe) edges.push(["data", pipe]);
  for (const s of serve) {
    if (s === ids[LAKEBASE]) edges.push(app ? [app, s] : [pipe || "data", s]);
    else edges.push([pipe || "data", s]);
  }
  if (app) {
    const reads = serve.filter((s) => s !== ids[LAKEBASE]);
    if (pipe) reads.push(pipe);
    for (const s of reads.length ? reads : ["data"]) edges.push([s, app]);
  }
  return { nodes, edges };
}
