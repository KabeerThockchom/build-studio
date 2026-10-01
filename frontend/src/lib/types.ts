// Mirror of the server contracts (server/models.py, server/plan.py, server/components.py).

// Diagram bands, left to right: where the data comes from, how it is shaped,
// how it is served, and where people use it.
export type Band = "data" | "pipeline" | "serve" | "delivery";

export interface Node { id: string; band: Band; label: string; sub: string; }
export interface FlowStep { n: number; title: string; sub: string; }
export interface Decision { tag: string; text: string; tradeoff: string; }
export interface DiagramSpec { nodes: Node[]; edges: [string, string][]; }

export interface Blueprint {
  archetype: string;
  idea: string;
  persona?: string;
  capabilities: string[];
  spec: DiagramSpec;
  flow: FlowStep[];
  prd_markdown: string;
  decisions: Decision[];
  scope_in: string[];      // what gets done today
  scope_later: string[];   // honest "save for later"
  app_screens?: string[];  // when the build has an app: one line per screen
  refine_note: string;     // after a refine: what changed
  components_changed?: { added: string[]; removed: string[]; notes: string[] };  // when refining: which pieces changed
}

// What each piece does in THIS build, written by the Sit-Down handoff.
export interface CapabilityPick { name: string; selected: boolean; fits: string; }
export interface SitDownPlan { read_back: string; questions: unknown[]; capabilities: CapabilityPick[]; }

// The background plan job (POST /api/plan/start, GET /api/plan/{id}).
export type PlanStage = "drafting" | "checking" | "refining" | "done";
export interface PlanJob {
  id: string;
  status: "running" | "done" | "error";
  stage: PlanStage;
  error?: string;
}

// --- Build phase ---
export type BuildTool = "genie_code" | "app_builder";
export interface BuildStep {
  n: number; title: string; capability: string;
  concept: string; move: string; verify: string; teach: string;
  tool?: BuildTool;
}
export interface BuildPlan { steps: BuildStep[]; }

// The finished Sit-Down, as handed to Build Studio (server/sitdown.py to_studio).
export interface StudioHandoff {
  phase?: string;
  idea: string;
  projectName: string;
  answers: Record<string, string>;
  answersOther?: Record<string, string>;
  capabilities: string[];
  plan: SitDownPlan;
  planRequested?: boolean;
  sitdown?: Record<string, unknown>;
  spec?: DiagramSpec;          // the server-computed architecture (same as the plan's blueprint.spec)
}
