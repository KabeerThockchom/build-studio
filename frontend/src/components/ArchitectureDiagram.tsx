import type { DiagramSpec } from "../lib/types";
import { layoutDiagram } from "../lib/diagram";
import { BAND_LABELS, BAND_ORDER, NODE_COLORS } from "../lib/constants";

// Four bands left to right: Your data -> Shape it -> Serve it -> Use it.
// reveal: nodes appear one band at a time, then the connections draw in.
export function ArchitectureDiagram({ spec, reveal = false }: { spec: DiagramSpec; reveal?: boolean }) {
  const L = layoutDiagram(spec);
  const byId = Object.fromEntries(L.placed.map((p) => [p.id, p]));

  return (
    <svg viewBox={`0 0 ${L.width} ${L.height}`} width="100%" style={{ display: "block" }} fontFamily="DM Sans, sans-serif"
      role="img" aria-label={`Architecture: ${L.placed.map((p) => p.label).join(", ")}`}>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#c3ccc9" />
        </marker>
      </defs>

      {BAND_ORDER.map((b) => (
        <text key={b} x={L.colX(b) + L.colWidth / 2} y={L.bandLabelY} textAnchor="middle"
          fontSize="11" fontWeight="600" fill="#5A8A9A">
          {BAND_LABELS[b]}
        </text>
      ))}

      {L.connectors.map((c, i) => {
        const a = byId[c.from], b = byId[c.to];
        if (!a || !b) return null;
        // left-to-right beziers; a backward edge (the app writing to Lakebase) runs from the
        // source's left side to the target's right side; same-column edges curve round the side
        const back = b.x < a.x, same = a.x === b.x;
        const y1 = a.cy, y2 = b.cy;
        let d: string;
        if (same) { const x1 = a.x + a.w, x2 = b.x + b.w; d = `M${x1},${y1} C${x1 + 26},${y1} ${x2 + 26},${y2} ${x2},${y2}`; }
        else if (back) { const x1 = a.x, x2 = b.x + b.w; d = `M${x1},${y1} C${x1 - 22},${y1} ${x2 + 22},${y2} ${x2},${y2}`; }
        else { const x1 = a.x + a.w, x2 = b.x; d = `M${x1},${y1} C${x1 + 22},${y1} ${x2 - 22},${y2} ${x2},${y2}`; }
        return <path key={i} d={d} fill="none" stroke="#d3dbd7" strokeWidth="1.6" markerEnd="url(#arrowhead)"
          style={reveal ? { animation: `fadein .5s ${BAND_ORDER.length * 220 + 120}ms both` } : undefined} />;
      })}

      {L.placed.map((n) => {
        const c = NODE_COLORS[n.band];
        const delay = BAND_ORDER.indexOf(n.band) * 220;
        return (
          <g key={n.id} className="rise" style={reveal ? { animationDelay: `${delay}ms` } : undefined}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="11" fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
            <text x={n.cx} y={n.y + 23} textAnchor="middle" fontSize="13.5" fontWeight="700" fill={c.text}>{n.label}</text>
            {n.sub && <text x={n.cx} y={n.y + 39} textAnchor="middle" fontSize="11" fill={c.text} opacity="0.75">{n.sub}</text>}
          </g>
        );
      })}
    </svg>
  );
}
