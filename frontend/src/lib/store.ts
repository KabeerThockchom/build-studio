import { useReducer } from "react";
import type { Blueprint, DesignPlan, DesignQuestion, CapabilityPick } from "./types";
import { FIRST_QUESTION } from "./constants";

// Phases. Design is variable-length (Q1 hard-coded + SA follow-ups), so we track
// a design index rather than a fixed screen number. No separate "planning" phase —
// Q1 shows instantly while the SA plan loads in the background.
export type Phase = "shape" | "design" | "assemble" | "blueprint" | "build";

export interface StudioState {
  phase: Phase;
  designIdx: number;                       // which design question we're on
  idea: string;
  expertise: string;
  interests: string[];
  plan: DesignPlan | null;                 // SA-authored questions + cap preselection
  planning: boolean;
  planError: string | null;
  answers: Record<string, string>;         // question id -> option key ("other" allowed)
  answersOther: Record<string, string>;
  capabilities: string[];                  // selected capability names
  blueprint: Blueprint | null;
  generating: boolean;
  error: string | null;
}

// The full ordered question list = hard-coded Q1 + SA follow-ups (once loaded).
export function mergedQuestions(s: StudioState): DesignQuestion[] {
  return [FIRST_QUESTION, ...(s.plan?.questions ?? [])];
}
// Capabilities to show in Assemble: SA picks once loaded, else a sensible default set.
const DEFAULT_PICKS: CapabilityPick[] = [
  { name: "Genie", selected: true, fits: "ask your data in plain English" },
  { name: "Knowledge Assistant", selected: true, fits: "understand notes & docs" },
  { name: "Supervisor agent", selected: true, fits: "tie the pieces together" },
  { name: "Lakebase", selected: true, fits: "record decisions" },
  { name: "Databricks Apps", selected: true, fits: "the front door" },
  { name: "Lakeflow", selected: false, fits: "bring in live data" },
];
export function shownPicks(s: StudioState): CapabilityPick[] {
  return s.plan?.capabilities ?? DEFAULT_PICKS;
}

const initial: StudioState = {
  phase: "shape",
  designIdx: 0,
  idea: "",
  expertise: "New to it",
  interests: ["AI agents"],
  plan: null,
  planning: false,
  planError: null,
  answers: {},
  answersOther: {},
  capabilities: [],
  blueprint: null,
  generating: false,
  error: null,
};

type Action =
  | { t: "phase"; phase: Phase }
  | { t: "designIdx"; i: number }
  | { t: "idea"; v: string }
  | { t: "expertise"; v: string }
  | { t: "toggleInterest"; v: string }
  | { t: "planStart" }
  | { t: "planOk"; plan: DesignPlan }
  | { t: "planErr"; e: string }
  | { t: "answer"; q: string; key: string }
  | { t: "answerOther"; q: string; v: string }
  | { t: "toggleCap"; v: string }
  | { t: "genStart" }
  | { t: "genOk"; bp: Blueprint }
  | { t: "genErr"; e: string }
  | { t: "hydrate"; s: Partial<StudioState> };

// The slice of state worth persisting (not transient flags like generating).
export function persistable(s: StudioState) {
  return {
    phase: s.phase, designIdx: s.designIdx, idea: s.idea, expertise: s.expertise,
    interests: s.interests, plan: s.plan, answers: s.answers, answersOther: s.answersOther,
    capabilities: s.capabilities, blueprint: s.blueprint,
  };
}

function reducer(s: StudioState, a: Action): StudioState {
  switch (a.t) {
    case "phase": return { ...s, phase: a.phase };
    case "designIdx": return { ...s, designIdx: a.i };
    case "idea": return { ...s, idea: a.v };
    case "expertise": return { ...s, expertise: a.v };
    case "toggleInterest":
      return { ...s, interests: s.interests.includes(a.v)
        ? s.interests.filter((x) => x !== a.v) : [...s.interests, a.v] };
    case "planStart": return { ...s, planning: true, planError: null };
    case "planOk":
      return { ...s, planning: false, plan: a.plan,
        capabilities: a.plan.capabilities.filter((c) => c.selected).map((c) => c.name) };
    case "planErr": return { ...s, planning: false, planError: a.e };
    case "answer": return { ...s, answers: { ...s.answers, [a.q]: a.key } };
    case "answerOther":
      return { ...s, answersOther: { ...s.answersOther, [a.q]: a.v }, answers: { ...s.answers, [a.q]: "other" } };
    case "toggleCap":
      return { ...s, capabilities: s.capabilities.includes(a.v)
        ? s.capabilities.filter((x) => x !== a.v) : [...s.capabilities, a.v] };
    case "genStart": return { ...s, generating: true, error: null };
    case "genOk": return { ...s, generating: false, blueprint: a.bp };
    case "genErr": return { ...s, generating: false, error: a.e };
    case "hydrate": return { ...s, ...a.s, generating: false, planning: false, error: null, planError: null };
    default: return s;
  }
}

export function useStudio() {
  const [state, dispatch] = useReducer(reducer, initial);
  return { state, dispatch };
}
