import { useReducer } from "react";
import type { Blueprint, DesignPlan, DesignQuestion, CapabilityPick, BuildPlan, IdeaCheck } from "./types";

// Phases. "teach" is the interactive scrollytelling loader that plays while the
// SA authors ALL design questions in the background — every design question is
// tailored, so there's no instant hard-coded Q1 anymore. Design is variable-length,
// so we track a design index rather than a fixed screen number.
export type Phase = "overview" | "shape" | "teach" | "design" | "learn" | "blueprint" | "build";

export interface StudioState {
  phase: Phase;
  designIdx: number;                       // which design question we're on
  idea: string;
  projectName: string;                     // user's name for the project → workspace folder name
  industry: string;                        // implied from a gallery sample; silent
  sampleStarter: string;                   // exact starter text of the picked sample (for edit detection)
  expertise: string;
  interests: string[];
  ideaChecking: boolean;                   // stress-test running (during early teaching beats)
  ideaCheck: IdeaCheck | null;             // advisory read of the idea; null until checked
  planRequested: boolean;                  // design-question generation kicked off (after criteria)
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
  publishedDir: string | null;       // workspace folder the project doc was written to
  publishedHost: string | null;      // workspace host
  publishedDeepLink: string | null;  // clickable URL straight to PROJECT.md in the workspace
}

// The full ordered question list — every question is SA-authored (tailored to the idea).
export function mergedQuestions(s: StudioState): DesignQuestion[] {
  return s.plan?.questions ?? [];
}
// The architecture is prescribed (Akil, 2026-09-09): every app uses the SAME pieces.
// Assemble is "meet your stack," not a selector — nothing toggles off.
// Knowledge Assistant was moved OUT of the locked set (2026-09-09): three eval passes
// couldn't cleanly verify its answer path in a workshop-realistic flow (opaque endpoints,
// async indexing, no build-time check), so it's too fragile to be mandatory. It stays a
// defined capability (concept + guardrails) so it can be re-enabled as an optional add-on.
export const LOCKED_CAPABILITIES = ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"];
const DEFAULT_PICKS: CapabilityPick[] = [
  { name: "Genie", selected: true, fits: "ask your data in plain English" },
  { name: "Supervisor agent", selected: true, fits: "tie the pieces together" },
  { name: "Lakebase", selected: true, fits: "record decisions" },
  { name: "Databricks Apps", selected: true, fits: "the front door" },
];
// Always the full locked set; fold in the SA's per-idea "fits" rationale when it's loaded.
// Only adopt the SA's fits for a piece it actually SELECTED: the architecture is locked (all
// four are always built), so a piece the SA left unselected carries a "not needed / you'd add
// it later" rationale — wrong to paint on the architecture node as that piece's role. Fall back
// to the generic positive role there. (Belt-and-suspenders with the SA prompt, which now tells
// it to always select the four and write positive fits.)
export function shownPicks(s: StudioState): CapabilityPick[] {
  const saFits = new Map(
    (s.plan?.capabilities ?? [])
      .filter((c) => c.selected && (c.fits || "").trim())
      .map((c) => [c.name, c.fits] as const));
  return DEFAULT_PICKS.map((p) => ({ ...p, selected: true, fits: saFits.get(p.name) || p.fits }));
}

export const initialState: StudioState = {
  phase: "overview",
  designIdx: 0,
  idea: "",
  projectName: "",
  industry: "",
  sampleStarter: "",
  expertise: "New to it",
  interests: [],   // no default — a pre-checked interest fabricated capability picks the user never chose
  ideaChecking: false,
  ideaCheck: null,
  planRequested: false,
  plan: null,
  planning: false,
  planError: null,
  answers: {},
  answersOther: {},
  capabilities: [...LOCKED_CAPABILITIES],   // fully prescribed; never toggled
  capsPinned: false,
  blueprint: null,
  generating: false,
  error: null,
  buildPlan: null,
  buildLoading: false,
  buildStepIdx: 0,
  buildDone: [],
  publishedDir: null,
  publishedHost: null,
  publishedDeepLink: null,
};

type Action =
  | { t: "phase"; phase: Phase }
  | { t: "designIdx"; i: number }
  | { t: "idea"; v: string }
  | { t: "projectName"; v: string }
  | { t: "pickSample"; idea: string; name: string; industry: string; components: string[]; interests: string[] }
  | { t: "expertise"; v: string }
  | { t: "toggleInterest"; v: string }
  | { t: "checkStart" }
  | { t: "checkOk"; check: IdeaCheck }
  | { t: "checkErr" }
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
  | { t: "publishOk"; dir: string; host: string; deepLink: string }
  | { t: "hydrate"; s: Partial<StudioState> };

// The slice of state worth persisting (not transient flags like generating).
export function persistable(s: StudioState) {
  return {
    phase: s.phase, designIdx: s.designIdx, idea: s.idea, projectName: s.projectName, industry: s.industry,
    sampleStarter: s.sampleStarter, expertise: s.expertise,
    interests: s.interests, plan: s.plan, answers: s.answers, answersOther: s.answersOther,
    capabilities: s.capabilities, capsPinned: s.capsPinned, blueprint: s.blueprint,
    buildPlan: s.buildPlan, buildStepIdx: s.buildStepIdx, buildDone: s.buildDone,
    publishedDir: s.publishedDir, publishedHost: s.publishedHost, publishedDeepLink: s.publishedDeepLink,
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
      // Architecture is locked, so a sample no longer sets components — it only seeds the
      // idea, project name, vertical, and interest chips. capabilities stays the full set.
      return { ...s, idea: a.idea, sampleStarter: a.idea, industry: a.industry,
        projectName: s.projectName.trim() ? s.projectName : a.name,  // seed the name from the sample
        interests: a.interests.length ? a.interests : s.interests };
    case "projectName": return { ...s, projectName: a.v };
    case "expertise": return { ...s, expertise: a.v };
    case "toggleInterest":
      return { ...s, interests: s.interests.includes(a.v)
        ? s.interests.filter((x) => x !== a.v) : [...s.interests, a.v] };
    case "checkStart": return { ...s, ideaChecking: true };
    case "checkOk": return { ...s, ideaChecking: false, ideaCheck: a.check };
    case "checkErr": return { ...s, ideaChecking: false };
    case "planStart": return { ...s, planning: true, planError: null, planRequested: true };
    case "planOk":
      // Keep the SA's questions and its per-idea "fits" rationale, but NOT its capability
      // selection — the architecture is locked, so capabilities never change here.
      return { ...s, planning: false, plan: a.plan };
    case "planErr": return { ...s, planning: false, planError: a.e };
    case "answer": return { ...s, answers: { ...s.answers, [a.q]: a.key } };
    case "answerOther":
      return { ...s, answersOther: { ...s.answersOther, [a.q]: a.v }, answers: { ...s.answers, [a.q]: "other" } };
    case "toggleCap":
      return { ...s, capabilities: s.capabilities.includes(a.v)
        ? s.capabilities.filter((x) => x !== a.v) : [...s.capabilities, a.v] };
    case "genStart": return { ...s, generating: true, error: null };
    // Capabilities are locked, so we do NOT adopt bp.capabilities — the full prescribed
    // set always stands. A refined blueprint still invalidates the build plan + the
    // persisted workspace guide: clear both so they regenerate + re-publish from the new plan.
    case "genOk": return { ...s, generating: false, blueprint: a.bp,
      buildPlan: null, buildStepIdx: 0, buildDone: [], publishedDir: null, publishedHost: null, publishedDeepLink: null };
    case "genErr": return { ...s, generating: false, error: a.e };
    case "buildStart": return { ...s, buildLoading: true };
    case "buildOk": return { ...s, buildLoading: false, buildPlan: a.plan, buildStepIdx: 0 };
    case "buildErr": return { ...s, buildLoading: false };
    case "buildStep": return { ...s, buildStepIdx: a.i };
    case "buildComplete":
      return { ...s, buildDone: s.buildDone.includes(a.n) ? s.buildDone : [...s.buildDone, a.n] };
    case "publishOk": return { ...s, publishedDir: a.dir, publishedHost: a.host, publishedDeepLink: a.deepLink };
    case "hydrate": return { ...s, ...a.s, capabilities: [...LOCKED_CAPABILITIES], generating: false, planning: false, ideaChecking: false, buildLoading: false, error: null, planError: null };
    default: return s;
  }
}

export function useStudio() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return { state, dispatch };
}
