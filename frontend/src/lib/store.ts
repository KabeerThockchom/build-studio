import { useReducer } from "react";
import { CAPABILITIES } from "./constants";
import type { Blueprint } from "./types";

export type Screen = 0 | 1 | 2 | 3 | 4 | 5; // Shape, DesignQ1, DesignQ2, Assemble, Blueprint, Build

export interface StudioState {
  screen: Screen;
  idea: string;
  expertise: string;
  interests: string[];
  answers: Record<string, string>;         // question id -> option key ("other" allowed)
  answersOther: Record<string, string>;    // question id -> free text
  capabilities: string[];                  // selected capability names
  blueprint: Blueprint | null;
  generating: boolean;
  error: string | null;
}

const initial: StudioState = {
  screen: 0,
  idea: "",
  expertise: "New to it",
  interests: ["AI agents"],
  answers: {},
  answersOther: {},
  capabilities: CAPABILITIES.filter((c) => c.preselected).map((c) => c.name),
  blueprint: null,
  generating: false,
  error: null,
};

type Action =
  | { t: "go"; screen: Screen }
  | { t: "idea"; v: string }
  | { t: "expertise"; v: string }
  | { t: "toggleInterest"; v: string }
  | { t: "answer"; q: string; key: string }
  | { t: "answerOther"; q: string; v: string }
  | { t: "toggleCap"; v: string }
  | { t: "genStart" }
  | { t: "genOk"; bp: Blueprint }
  | { t: "genErr"; e: string };

function reducer(s: StudioState, a: Action): StudioState {
  switch (a.t) {
    case "go": return { ...s, screen: a.screen };
    case "idea": return { ...s, idea: a.v };
    case "expertise": return { ...s, expertise: a.v };
    case "toggleInterest":
      return { ...s, interests: s.interests.includes(a.v)
        ? s.interests.filter((x) => x !== a.v) : [...s.interests, a.v] };
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
