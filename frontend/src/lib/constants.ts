import type { Band } from "./types";

// Every design question is now SA-authored (tailored to the idea) — generated in
// the background while the teaching loader plays. No hard-coded first question.

export const EXPERTISE = ["New to it", "Familiar", "Advanced"] as const;
export const INTERESTS = ["Analytics & BI", "AI agents", "Data pipelines", "Apps", "Open to anything"] as const;

// --- capability palette (Assemble) ---
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

