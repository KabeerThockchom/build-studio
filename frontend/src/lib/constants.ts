import type { Band } from "./types";

// The five components a build can be made of (server/components.py is the source of truth).
export const PIPELINES = "Declarative Pipelines";
export const GENIE = "Genie";
export const DASHBOARDS = "AI/BI Dashboards";
export const LAKEBASE = "Lakebase";
export const APPS = "Databricks Apps";
// Build order: dependencies first.
export const COMPONENT_ORDER = [PIPELINES, LAKEBASE, GENIE, DASHBOARDS, APPS];

// --- Architecture diagram: band labels + per-band node styling ---
export const BAND_ORDER: Band[] = ["data", "pipeline", "serve", "delivery"];
export const BAND_LABELS: Record<Band, string> = {
  data: "Your data", pipeline: "Shape it", serve: "Serve it", delivery: "Use it",
};
export const NODE_COLORS: Record<Band, { fill: string; stroke: string; text: string }> = {
  data:     { fill: "#eef3f5", stroke: "#cfdbe0", text: "#1B3139" },   // slate: what you start with
  pipeline: { fill: "#e6f2f6", stroke: "#b6d6e2", text: "#1f6480" },   // teal: where it gets shaped
  serve:    { fill: "#e8f7f1", stroke: "#bfe6d4", text: "#046a48" },   // green: how it's served
  delivery: { fill: "#1B3139", stroke: "#1B3139", text: "#ffffff" },   // navy: where people use it
};
