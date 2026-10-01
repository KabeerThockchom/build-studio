import { describe, it, expect } from "vitest";
import { CONCEPTS, learnComponents, learnBeatCount, quizFor, GENERAL_QUIZ } from "./learn";
import { COMPONENT_ORDER, APPS, GENIE, PIPELINES } from "./constants";
import { initialState, type StudioState } from "./store";
import { buildRail } from "../components/LeftRail";
import {
  dotsOf, letterOfMean, overallLetter, overallMean, freshDisp, optList, strList, arr, noDash,
} from "../components/sitdown/engine";

describe("learn content", () => {
  it("covers exactly the five components, each with a quiz and docs", () => {
    expect(Object.keys(CONCEPTS).sort()).toEqual([...COMPONENT_ORDER].sort());
    for (const c of COMPONENT_ORDER) {
      const k = CONCEPTS[c];
      expect(k.quiz.options[k.quiz.answer]).toBeTruthy();
      expect(k.links.length).toBeGreaterThan(0);
      expect(k.links.every((l) => l.url.startsWith("https://docs.databricks.com/"))).toBe(true);
    }
  });
  it("restores the verified videos and invents none", () => {
    expect(CONCEPTS[GENIE].video?.id).toBe("7eSOvPsSjgU");
    expect(CONCEPTS["Lakebase"].video?.id).toBe("ed2WJ5YayQ4");
    expect(CONCEPTS[APPS].video?.id).toBe("_nMgCvsCcns");
    expect(CONCEPTS[PIPELINES].video).toBeUndefined();
    expect(CONCEPTS["AI/BI Dashboards"]).toBeUndefined();          // retired: charts are app screens
  });
  it("teaches Genie App Builder in the Apps module", () => {
    expect(CONCEPTS[APPS].deeper).toMatch(/Genie App Builder/);
    expect(CONCEPTS[APPS].links.some((l) => /genie-app-builder/.test(l.url))).toBe(true);
  });
  it("teaches only the components a build uses, in the order given", () => {
    expect(learnComponents([GENIE, "Supervisor agent", APPS])).toEqual([GENIE, APPS]);
    expect(learnBeatCount([GENIE, APPS])).toBe(4);   // architecture + 2 + quick check
  });
  it("never mentions retired pieces or a currency", () => {
    const text = JSON.stringify(CONCEPTS);
    expect(text).not.toMatch(/Supervisor agent|Knowledge Assistant|£|Costa|costa|\u2014/i);
  });
});

describe("the quick check", () => {
  const all = [...Object.values(CONCEPTS).flatMap((c) => [c.quiz, ...c.more]), ...GENERAL_QUIZ];
  it("is always five questions, covering every component in the build first", () => {
    for (const caps of [[GENIE], [PIPELINES, GENIE, APPS], [...COMPONENT_ORDER]]) {
      const q = quizFor(caps);
      expect(q).toHaveLength(5);
      expect(q.slice(0, caps.length).map((x) => x.cap)).toEqual(learnComponents(caps));
      expect(new Set(q.map((x) => x.q)).size).toBe(5);   // no repeats
    }
  });
  it("uses the general questions after the components, then each piece's extras", () => {
    const q = quizFor([GENIE]);
    expect(q[1].cap).toBeNull();
    expect(q.filter((x) => x.cap === GENIE).length).toBeGreaterThan(1);
  });
  it("every question has a valid answer and varied answer positions", () => {
    expect(all.every((x) => x.options[x.answer] !== undefined && x.why.length > 20)).toBe(true);
    expect(new Set(all.map((x) => x.answer)).size).toBe(3);
  });
});

describe("Sit-Down grading", () => {
  it("rates sections out of five", () => {
    expect([dotsOf("F"), dotsOf("D+"), dotsOf("C"), dotsOf("B-"), dotsOf("B+"), dotsOf("A")]).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("grades the idea across all seven sections, so one perfect section is still a D-", () => {
    const d = { ...freshDisp(), brief: { problem: "x" }, grades: { problem: "A" } };
    expect(overallMean(d)).toBeCloseTo(5 / 7);
    expect(overallLetter(d)).toBe("D-");
    expect(letterOfMean(5)).toBe("A+");
    expect(overallLetter(freshDisp())).toBeNull();
  });
});

describe("defensive parsing", () => {
  it("lists are lists or nothing; strings become option labels", () => {
    expect(arr("[1,2]")).toEqual([]);
    expect(optList(["a", { label: "b" }, null, { sub: "no label" }])).toEqual([{ label: "a" }, { label: "b" }]);
    expect(strList(["a", 2, {}, null])).toEqual(["a", "2"]);
    expect(noDash("before \u2014 after")).toBe("before, after");
  });
});

describe("rail accuracy", () => {
  const base: StudioState = { ...initialState };
  const at = (s: StudioState, group: string) => buildRail(s).find((g) => g.name === group)!.steps;
  it("follows the Sit-Down stage", () => {
    const s = { ...base, phase: "sitdown" as const, sdProgress: { stage: "scope", covered: 6, started: true, done: false } };
    const sd = at(s, "Sit-Down");
    expect(sd.map((x) => x.cur)).toEqual([false, false, true, false]);
    expect(sd[0].done && sd[1].done).toBe(true);
    expect(sd[0].meta).toBe("6 of 7 covered");
    expect(at(s, "Learn")[0].reachable).toBe(false);
  });
  it("lists one Learn step per component, plus the architecture and the quick check", () => {
    const s = { ...base, phase: "learn" as const, capabilities: [PIPELINES, GENIE, APPS], learnIdx: 2, learnMax: 2 };
    const l = at(s, "Learn");
    expect(l.map((x) => x.label)).toEqual(["Your architecture", "Declarative Pipelines", "Genie", "Databricks Apps", "Quick check"]);
    expect(l[2].cur).toBe(true);
    expect(l[1].done).toBe(true);
    expect(l[3].reachable).toBe(false);
    expect(at(s, "Sit-Down").every((x) => x.done)).toBe(true);
  });
  it("shows the plan drafting in the background", () => {
    const s = { ...base, phase: "learn" as const, capabilities: [GENIE], planJob: { id: "j", status: "running" as const, stage: "checking" as const } };
    expect(at(s, "Plan")[0].meta).toMatch(/drafting in background/);
  });
  it("lists one Build step per build step and ticks done ones", () => {
    const steps = [1, 2, 3].map((n) => ({ n, title: `Step ${n}`, capability: "", concept: "", move: "", verify: "", teach: "" }));
    const s = { ...base, phase: "build" as const, buildPlan: { steps }, buildEntered: true, buildStepIdx: 1, buildDone: [1] };
    const b = at(s, "Build");
    expect(b.map((x) => x.label)).toEqual(["Step 1", "Step 2", "Step 3"]);
    expect(b[0].done).toBe(true);
    expect(b[1].cur).toBe(true);
  });
});
