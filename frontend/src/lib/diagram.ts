// Pure layout: DiagramSpec -> positioned geometry for SVG. Tested by vitest.
import type { DiagramSpec, Node, Band } from "./types";
import { BAND_ORDER } from "./constants";

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

  const byBand: Record<Band, Node[]> = { data: [], capability: [], agent: [], delivery: [] };
  for (const n of spec.nodes) byBand[n.band].push(n);
  const maxRows = Math.max(1, ...BAND_ORDER.map((b) => byBand[b].length));
  const height = topPad + maxRows * (nodeH + gap) + 8;

  const colIndex = (b: Band) => BAND_ORDER.indexOf(b);
  const colX = (b: Band) => colIndex(b) * colWidth;

  const placed: PlacedNode[] = [];
  for (const band of BAND_ORDER) {
    const nodes = byBand[band];
    nodes.forEach((n, i) => {
      const w = colWidth - padX * 2;
      const x = colX(band) + padX;
      const y = topPad + i * (nodeH + gap);
      placed.push({ ...n, x, y, w, h: nodeH, cx: x + w / 2, cy: y + nodeH / 2 });
    });
  }

  const connectors: Connector[] = spec.edges
    .filter(([f, t]) => placed.some((p) => p.id === f) && placed.some((p) => p.id === t))
    .map(([from, to]) => ({ from, to }));

  return { width, height, bandLabelY: 18, colWidth, placed, connectors, colX };
}
