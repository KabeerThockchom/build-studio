import { useReducer } from "react";
import type { Blueprint, DesignPlan, DesignQuestion, CapabilityPick, BuildPlan } from "./types";

// Phases. "teach" is the interactive scrollytelling loader that plays while the
// SA authors ALL design questions in the background — every design question is
// tailored, so there's no instant hard-coded Q1 anymore. Design is variable-length,
// so we track a design index rather than a fixed screen number.
export type Phase = "shape" | "teach" | "design" | "assemble" | "blueprint" | "build";

export interface StudioState {
  phase: Phase;
  designIdx: number;                       // which design question we're on
  idea: string;
  industry: string;                        // implied from a gallery sample; silent
  sampleStarter: string;                   // exact starter text of the picked sample (for edit detection)
  expertise: string;
  interests: string[];
  plan: DesignPlan | null;                 // SA-authored questions + cap preselection
  planning: boolean;
  planError: string | null;
  answers: Record<string, string>;         // question id -> option key ("other" allowed)
  answersOther: Record<string, string>;
  capabilities: string[];                  // selected capability names
  capsPinned: boolean;                     // a picked sample set the components; SA plan won't overwrite
  blueprint: Blueprint | null;
  generating: boolean;
  error: string | null;
  buildPlan: BuildPlan | null;
  buildLoading: boolean;
  buildStepIdx: number;
  buildDone: number[];               // completed step numbers
}

// The full ordered question list — every question is SA-authored (tailored to the idea).
export function mergedQuestions(s: StudioState): DesignQuestion[] {
  return s.plan?.questions ?? [];
}
// Capabilities to show in Assemble: SA picks once loaded, else a sensible default set.
const DEFAULT_PICKS: CapabilityPick[] = [
  { name: "Genie", selected: true, fits: "ask your data in plain English" },
  { name: "Knowledge Assistant", selected: true, fits: "understand notes & docs" },
  { name: "Supervisor agent", selected: true, fits: "tie the pieces together" },
  { name: "Lakebase", selected: true, fits: "record decisions" },
  { name: "Databricks Apps", selected: true, fits: "the front door" },
];
export function shownPicks(s: StudioState): CapabilityPick[] {
  return s.plan?.capabilities ?? DEFAULT_PICKS;
}

export const initialState: StudioState = {
  phase: "shape",
  designIdx: 0,
  idea: "",
  industry: "",
  sampleStarter: "",
  expertise: "New to it",
  interests: ["AI agents"],
  plan: null,
  planning: false,
  planError: null,
  answers: {},
  answersOther: {},
  capabilities: [],
  capsPinned: false,
  blueprint: null,
  generating: false,
  error: null,
  buildPlan: null,
  buildLoading: false,
  buildStepIdx: 0,
  buildDone: [],
};

type Action =
  | { t: "phase"; phase: Phase }
  | { t: "designIdx"; i: number }
  | { t: "idea"; v: string }
  | { t: "pickSample"; idea: string; industry: string; components: string[]; interests: string[] }
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
  | { t: "buildStart" }
  | { t: "buildOk"; plan: BuildPlan }
  | { t: "buildErr" }
  | { t: "buildStep"; i: number }
  | { t: "buildComplete"; n: number }
  | { t: "hydrate"; s: Partial<StudioState> };

// The slice of state worth persisting (not transient flags like generating).
export function persistable(s: StudioState) {
  return {
    phase: s.phase, designIdx: s.designIdx, idea: s.idea, industry: s.industry,
    sampleStarter: s.sampleStarter, expertise: s.expertise,
    interests: s.interests, plan: s.plan, answers: s.answers, answersOther: s.answersOther,
    capabilities: s.capabilities, capsPinned: s.capsPinned, blueprint: s.blueprint,
    buildPlan: s.buildPlan, buildStepIdx: s.buildStepIdx, buildDone: s.buildDone,
  };
}

export function reducer(s: StudioState, a: Action): StudioState {
  switch (a.t) {
    case "phase": return { ...s, phase: a.phase };
    case "designIdx": return { ...s, designIdx: a.i };
    // Typing in the idea box. If they picked a sample and have now edited its starter
    // text, the accelerator drops away: it becomes a custom idea, so we unpin the
    // components (SA picks them) and clear the industry hint. No edit -> defaults hold.
    case "idea": {
      const edited = s.sampleStarter !== "" && a.v.trim() !== s.sampleStarter.trim();
      if (edited) return { ...s, idea: a.v, industry: "", sampleStarter: "", capsPinned: false };
      return { ...s, idea: a.v };
    }
    // Picking a gallery sample seeds the (editable) idea, silently records the vertical,
    // pre-selects the sample's default app components (pinned so the SA plan won't
    // overwrite them), and lights up the matching interest chips. All still tweakable;
    // editing the idea text afterward turns it back into a plain custom prompt (see "idea").
    case "pickSample":
      return { ...s, idea: a.idea, sampleStarter: a.idea, industry: a.industry,
        capabilities: a.components, capsPinned: a.components.length > 0,
        interests: a.interests.length ? a.interests : s.interests };
    case "expertise": return { ...s, expertise: a.v };
    case "toggleInterest":
      return { ...s, interests: s.interests.includes(a.v)
        ? s.interests.filter((x) => x !== a.v) : [...s.interests, a.v] };
    case "planStart": return { ...s, planning: true, planError: null };
    case "planOk":
      // Keep the SA's questions, but only adopt its capability picks if a sample
      // hasn't already pinned the components (the user's template choice wins).
      return { ...s, planning: false, plan: a.plan,
        capabilities: s.capsPinned ? s.capabilities
          : a.plan.capabilities.filter((c) => c.selected).map((c) => c.name) };
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
    case "buildStart": return { ...s, buildLoading: true };
    case "buildOk": return { ...s, buildLoading: false, buildPlan: a.plan, buildStepIdx: 0 };
    case "buildErr": return { ...s, buildLoading: false };
    case "buildStep": return { ...s, buildStepIdx: a.i };
    case "buildComplete":
      return { ...s, buildDone: s.buildDone.includes(a.n) ? s.buildDone : [...s.buildDone, a.n] };
    case "hydrate": return { ...s, ...a.s, generating: false, planning: false, buildLoading: false, error: null, planError: null };
    default: return s;
  }
}

export function useStudio() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return { state, dispatch };
}
