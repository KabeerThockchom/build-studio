// Mirror of server/models.py — the shared Blueprint contract.
export type Band = "data" | "capability" | "agent" | "delivery";

export interface Node { id: string; band: Band; label: string; sub: string; }
export interface FlowStep { n: number; title: string; sub: string; }
export interface Decision { tag: string; text: string; tradeoff: string; }
export interface DiagramSpec { nodes: Node[]; edges: [string, string][]; }

export interface Blueprint {
  archetype: string;
  idea: string;
  persona: string;
  capabilities: string[];
  spec: DiagramSpec;
  flow: FlowStep[];
  prd_markdown: string;
  decisions: Decision[];
}

export interface GenerateRequest {
  idea: string;
  persona?: string;
  expertise?: string;
  interests?: string[];
  design_answers?: Record<string, string>;
  capabilities?: string[];
}

// --- Design plan (SA-authored) ---
export interface DesignOption { key: string; letter: string; label: string; sub: string; preview: string[]; }
export interface DesignQuestion {
  id: string; eyebrow: string; title: string; lead: string;
  options: DesignOption[]; other_placeholder: string; other_preview: string[];
}
export interface CapabilityPick { name: string; selected: boolean; fits: string; }
export interface DesignPlan {
  read_back: string;
  questions: DesignQuestion[];
  capabilities: CapabilityPick[];
}

