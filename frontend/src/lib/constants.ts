import type { Band } from "./types";

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

// --- design questions (curated middle) ---
export interface DesignOption { key: string; letter: string; label: string; sub: string; preview: [string, string, string]; }
export interface DesignQuestion {
  id: string;               // stored in design_answers under this key
  eyebrow: string;
  title: string;
  lead: string;
  options: DesignOption[];
  otherPlaceholder: string;
  otherPreview: [string, string, string];
}

export const DESIGN_QUESTIONS: DesignQuestion[] = [
  {
    id: "audience",
    eyebrow: "Design · 1 of 2",
    title: "Who is this for, and how do they want it?",
    lead: "This shapes how the experience leads: whether it tells people what to do, gives them the big picture, or lets them explore.",
    options: [
      { key: "act", letter: "A", label: "People who need to act quickly",
        sub: "Busy, want to be told what matters and what to do next.",
        preview: ["It opens on a <b>ranked shortlist</b> of what needs attention, most pressing first.",
                  "Detail and follow-up questions sit one layer in, when they want more.",
                  "More logic upfront to rank things well, in exchange for far less thinking asked of the person using it."] },
      { key: "oversee", letter: "B", label: "People overseeing a lot at once",
        sub: "Want the big picture and where to focus.",
        preview: ["It opens on a <b>portfolio overview</b>, grouped so patterns jump out.",
                  "Drill into any group to dig deeper or compare.",
                  "Great for oversight and spotting trends; less immediate for one person deciding a single next action."] },
      { key: "explore", letter: "C", label: "People who want to explore",
        sub: "Curious, prefer to ask their own questions.",
        preview: ["It opens on an <b>open question box</b>, exploration first.",
                  "No ranking imposed; the person drives every path.",
                  "Most flexible, but it assumes the user already knows what to ask."] },
    ],
    otherPlaceholder: "None of these fit? Describe who it's for in your words…",
    otherPreview: ["We'll read your description and adapt the experience to the audience you describe.",
                   "The rest of the design flexes to match.",
                   "Most tailored — the reason we ask in your words rather than force a bucket."],
  },
  {
    id: "data_mode",
    eyebrow: "Design · 2 of 2",
    title: "Where does the data come from?",
    lead: "This sets your very first step, and whether we generate data or connect to what you already have.",
    options: [
      { key: "synthetic", letter: "A", label: "Make realistic sample data",
        sub: "We generate tables that fit your idea. Best for learning and demos.",
        preview: ["A <b>synthetic dataset</b> shaped to match your idea, written to Unity Catalog.",
                  "You skip data wrangling and get to the interesting parts fast.",
                  "No setup risk, but the data is made up. Swap in real tables whenever you're ready."] },
      { key: "existing", letter: "B", label: "Use data already in my workspace",
        sub: "Point at real Unity Catalog tables you can access.",
        preview: ["Your build reads <b>real tables</b> you already have in Unity Catalog.",
                  "Nothing to generate; it reflects your actual business from day one.",
                  "Most realistic, but depends on access and clean, joinable tables."] },
    ],
    otherPlaceholder: "Something else? e.g. upload a file, connect a source…",
    otherPreview: ["We'll adapt the first step to however your data arrives.",
                   "Upload, connect a source, or something else — we'll route it.",
                   "Flexible; we'll confirm the specifics before generating anything."],
  },
];
