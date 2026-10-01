import { useReducer } from "react";
import type { Blueprint, BuildPlan, PlanJob, SitDownPlan, StudioHandoff } from "./types";

// The journey: overview -> sitdown -> learn -> plan -> build.
//   sitdown: the conversational SA sharpens the idea (its own session, see components/sitdown)
//   learn:   the architecture of THIS build, one module per component, then a quick check
//   plan:    the architecture + PRD, drafted in the background by a plan job while they learn
//   build:   one step at a time, in Genie Code (and Genie App Builder for the app)
export type Phase = "overview" | "sitdown" | "learn" | "plan" | "build";
export const PHASES: Phase[] = ["overview", "sitdown", "learn", "plan", "build"];

// Where the Sit-Down is, reported by the Sit-Down itself so the rail stays accurate.
export interface SitDownProgress { stage: string; covered: number; started: boolean; done: boolean; }

export interface StudioState {
  phase: Phase;
  idea: string;
  projectName: string;
  answers: Record<string, string>;     // the Sit-Down's brief, scope lanes, data plan, risks (to_studio)
  capabilities: string[];              // the components this build uses, in order
  plan: SitDownPlan | null;            // per-component "fits" for THIS build
  sitdown: unknown | null;             // the saved Sit-Down session (turns, brief, server session)
  sdProgress: SitDownProgress;
  learnIdx: number;                    // current Learn beat
  learnMax: number;                    // furthest Learn beat seen (rail reachability)
  planJob: PlanJob | null;
  blueprint: Blueprint | null;
  planError: string | null;
  buildPlan: BuildPlan | null;
  buildLoading: boolean;
  buildEntered: boolean;               // left the build overview for step 1
  buildStepIdx: number;
  buildDone: number[];                 // completed step numbers
  publishedDir: string | null;
  publishedHost: string | null;
  publishedDeepLink: string | null;
}

export const initialState: StudioState = {
  phase: "overview",
  idea: "",
  projectName: "",
  answers: {},
  capabilities: [],
  plan: null,
  sitdown: null,
  sdProgress: { stage: "", covered: 0, started: false, done: false },
  learnIdx: 0,
  learnMax: 0,
  planJob: null,
  blueprint: null,
  planError: null,
  buildPlan: null,
  buildLoading: false,
  buildEntered: false,
  buildStepIdx: 0,
  buildDone: [],
  publishedDir: null,
  publishedHost: null,
  publishedDeepLink: null,
};

export type Action =
  | { t: "phase"; phase: Phase }
  | { t: "sitdownSave"; blob: unknown; progress: SitDownProgress }
  | { t: "handoff"; studio: StudioHandoff }
  | { t: "sitdownReset" }
  | { t: "learnIdx"; i: number }
  | { t: "planJob"; job: PlanJob | null }
  | { t: "planDone"; bp: Blueprint }
  | { t: "planErr"; e: string }
  | { t: "buildStart" }
  | { t: "buildOk"; plan: BuildPlan }
  | { t: "buildErr" }
  | { t: "buildEnter"; v: boolean }
  | { t: "buildStep"; i: number }
  | { t: "buildComplete"; n: number }
  | { t: "publishOk"; dir: string; host: string; deepLink: string }
  | { t: "hydrate"; s: Partial<StudioState> };

// The slice worth persisting server-side (not transient flags).
export function persistable(s: StudioState) {
  return {
    phase: s.phase, idea: s.idea, projectName: s.projectName, answers: s.answers,
    capabilities: s.capabilities, plan: s.plan, sitdown: s.sitdown, sdProgress: s.sdProgress,
    learnIdx: s.learnIdx, learnMax: s.learnMax, planJob: s.planJob, blueprint: s.blueprint,
    buildPlan: s.buildPlan, buildEntered: s.buildEntered, buildStepIdx: s.buildStepIdx, buildDone: s.buildDone,
    publishedDir: s.publishedDir, publishedHost: s.publishedHost, publishedDeepLink: s.publishedDeepLink,
  };
}

export function reducer(s: StudioState, a: Action): StudioState {
  switch (a.t) {
    case "phase": return { ...s, phase: a.phase };
    case "sitdownSave": return { ...s, sitdown: a.blob, sdProgress: a.progress };
    // The Sit-Down's "Let's build it": adopt its idea, brief and components, land on Learn.
    // A new handoff invalidates any plan or build made from an earlier version.
    case "handoff":
      return {
        ...s,
        phase: "learn",
        idea: a.studio.idea || s.idea,
        projectName: a.studio.projectName || s.projectName,
        answers: a.studio.answers || {},
        capabilities: Array.isArray(a.studio.capabilities) ? a.studio.capabilities : [],
        plan: a.studio.plan || null,
        sdProgress: { ...s.sdProgress, done: true },
        learnIdx: 0, learnMax: 0,
        planJob: null, blueprint: null, planError: null,
        buildPlan: null, buildEntered: false, buildStepIdx: 0, buildDone: [],
        publishedDir: null, publishedHost: null, publishedDeepLink: null,
      };
    case "sitdownReset":
      return { ...initialState, phase: "sitdown" };
    case "learnIdx": return { ...s, learnIdx: a.i, learnMax: Math.max(s.learnMax, a.i) };
    case "planJob": return { ...s, planJob: a.job, planError: null };
    // A finished (or refined) plan invalidates the build plan made from the previous one.
    case "planDone":
      return { ...s, blueprint: a.bp, planJob: s.planJob ? { ...s.planJob, status: "done", stage: "done" } : null,
        planError: null, buildPlan: null, buildEntered: false, buildStepIdx: 0, buildDone: [],
        publishedDir: null, publishedHost: null, publishedDeepLink: null };
    case "planErr":
      return { ...s, planError: a.e, planJob: s.planJob ? { ...s.planJob, status: "error", error: a.e } : null };
    case "buildStart": return { ...s, buildLoading: true };
    case "buildOk": return { ...s, buildLoading: false, buildPlan: a.plan, buildStepIdx: 0 };
    case "buildErr": return { ...s, buildLoading: false };
    case "buildEnter": return { ...s, buildEntered: a.v };
    case "buildStep": return { ...s, buildStepIdx: a.i, buildEntered: true };
    case "buildComplete":
      return { ...s, buildDone: s.buildDone.includes(a.n) ? s.buildDone : [...s.buildDone, a.n] };
    case "publishOk": return { ...s, publishedDir: a.dir, publishedHost: a.host, publishedDeepLink: a.deepLink };
    case "hydrate": {
      const phase = PHASES.includes(a.s.phase as Phase) ? (a.s.phase as Phase) : s.phase;
      return { ...s, ...a.s, phase, buildLoading: false };
    }
    default: return s;
  }
}

export function useStudio() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return { state, dispatch };
}
