import type { Band } from "./types";

// Every design question is now SA-authored (tailored to the idea) — generated in
// the background while the teaching loader plays. No hard-coded first question.

export const EXPERTISE = ["New to it", "Familiar", "Advanced"] as const;
export const INTERESTS = ["Analytics & BI", "AI agents", "Data pipelines", "Apps", "Open to anything"] as const;

// --- capability palette (Assemble) ---
export interface Capability {
  name: string;
  blurb: string;
  fits: string;      // rationale shown as the "Fits:" tag
  preselected: boolean;
}
export const CAPABILITIES: Capability[] = [
  { name: "Genie", blurb: "Turns plain-English questions into governed answers, no SQL.", fits: "catch what's slipping", preselected: true },
  { name: "Knowledge Assistant", blurb: "Managed RAG over your notes and docs. Nothing to wire.", fits: "the \"why\" behind it", preselected: true },
  { name: "Supervisor agent", blurb: "Picks the right piece per question and answers.", fits: "AI agents", preselected: true },
  { name: "Lakebase", blurb: "Fast Postgres beside your data. What you flag sticks.", fits: "tell them what to do", preselected: true },
  { name: "Databricks Apps", blurb: "Host the interface people actually open.", fits: "something they use daily", preselected: true },
  { name: "Lakeflow", blurb: "Managed ingestion and ETL from a source.", fits: "bring in live data", preselected: false },
];

// --- SVG node styling by band (mirrors prototype COLORS) ---
export const BAND_LABELS: Record<Band, string> = {
  data: "Data", capability: "Capabilities", agent: "Agent", delivery: "Delivery",
};
export const BAND_ORDER: Band[] = ["data", "capability", "agent", "delivery"];
export const NODE_COLORS: Record<Band, { fill: string; stroke: string; text: string }> = {
  data:       { fill: "#eef4f6", stroke: "#cddbe0", text: "#1B3139" },
  capability: { fill: "#e8f7f1", stroke: "#bfe6d4", text: "#046a48" },
  agent:      { fill: "#fff4e6", stroke: "#f5d9a8", text: "#8a5a00" },
  delivery:   { fill: "#1B3139", stroke: "#1B3139", text: "#ffffff" },
};

