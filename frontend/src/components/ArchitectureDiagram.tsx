import type { DiagramSpec } from "../lib/types";
import { layoutDiagram } from "../lib/diagram";
import { BAND_LABELS, BAND_ORDER, NODE_COLORS } from "../lib/constants";

export function ArchitectureDiagram({ spec }: { spec: DiagramSpec }) {
  const L = layoutDiagram(spec);
  const byId = Object.fromEntries(L.placed.map((p) => [p.id, p]));

  return (
    <svg viewBox={`0 0 ${L.width} ${L.height}`} width="100%" style={{ display: "block" }} fontFamily="DM Sans, sans-serif">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#c3ccc9" />
        </marker>
      </defs>

      {/* band labels */}
      {BAND_ORDER.map((b) => (
        <text key={b} x={L.colX(b) + L.colWidth / 2} y={L.bandLabelY} textAnchor="middle"
          fontSize="10.5" fontWeight="700" letterSpacing="1.2" fill="#9aa8a4">
          {BAND_LABELS[b].toUpperCase()}
        </text>
      ))}

      {/* connectors (behind nodes) */}
      {L.connectors.map((c, i) => {
        const a = byId[c.from], b = byId[c.to];
        if (!a || !b) return null;
        const x1 = a.x + a.w, y1 = a.cy, x2 = b.x, y2 = b.cy;
        return (
          <path key={i} d={`M${x1},${y1} C${x1 + 22},${y1} ${x2 - 22},${y2} ${x2},${y2}`}
            fill="none" stroke="#d3dbd7" strokeWidth="1.6" markerEnd="url(#arrowhead)" />
        );
      })}

      {/* nodes */}
      {L.placed.map((n) => {
        const c = NODE_COLORS[n.band];
        return (
          <g key={n.id} className="rise">
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="11" fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
            <text x={n.cx} y={n.y + 23} textAnchor="middle" fontSize="13.5" fontWeight="700" fill={c.text}>{n.label}</text>
            {n.sub && <text x={n.cx} y={n.y + 39} textAnchor="middle" fontSize="11" fill={c.text} opacity="0.7">{n.sub}</text>}
          </g>
        );
      })}
    </svg>
  );
}
