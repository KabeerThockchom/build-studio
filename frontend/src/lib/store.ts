import { useReducer } from "react";
import type { Blueprint, DesignPlan } from "./types";

// Phases. Design is variable-length (0..N questions), so we track a design index
// rather than a fixed screen number.
export type Phase = "shape" | "planning" | "design" | "assemble" | "blueprint" | "build";

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
  | { t: "genErr"; e: string };

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
    default: return s;
  }
}

export function useStudio() {
  const [state, dispatch] = useReducer(reducer, initial);
  return { state, dispatch };
}
