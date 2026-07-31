import type { Band } from "./types";
import type { DesignQuestion } from "./types";

// Always-present first question — renders instantly while the SA generates the
// tailored follow-ups in the background. Universal to any idea.
export const FIRST_QUESTION: DesignQuestion = {
  id: "audience",
  eyebrow: "Design · getting started",
  title: "Who is this for, and how do they want it?",
  lead: "A human question, not a technical one. It shapes how the experience leads.",
  options: [
    { key: "act", letter: "A", label: "People who need to act quickly",
      sub: "Busy; want to be told what matters and what to do next.",
      preview: ["It opens on a ranked shortlist of what needs attention.",
                "Detail sits one layer in, when they want more.",
                "More upfront ranking logic, far less asked of the user."] },
    { key: "oversee", letter: "B", label: "People overseeing a lot at once",
      sub: "Want the big picture and where to focus.",
      preview: ["It opens on a grouped overview so patterns jump out.",
                "Drill into any group to dig deeper.",
                "Great for oversight; less immediate for a single next action."] },
    { key: "explore", letter: "C", label: "People who want to explore",
      sub: "Prefer to ask their own questions.",
      preview: ["It opens on an open question box, exploration first.",
                "No ranking imposed; the person drives.",
                "Most flexible, but assumes they know what to ask."] },
  ],
  other_placeholder: "None of these fit? Describe who it's for in your words…",
  other_preview: ["We'll adapt to the audience you describe.",
                  "The rest of the design flexes to match.", "Most tailored."],
};

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

