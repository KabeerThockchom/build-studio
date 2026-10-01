import type { Phase, StudioState } from "../lib/store";
import { CONCEPTS, learnComponents } from "../lib/learn";
import { SHARP } from "./sitdown/engine";

/* The journey rail, always visible (including during the Sit-Down). Four groups:
   1 Sit-Down (follows the session stage), 2 Learn (one step per component + Quick check),
   3 Plan (with a "drafting in background" state), 4 Build (one step per build step).
   Current step highlighted, done steps ticked, reachable steps clickable, the rest muted. */

export type RailTarget =
  | { phase: "sitdown"; stage: string }
  | { phase: "learn"; beat: number }
  | { phase: "plan" }
  | { phase: "build"; step: number | null };

interface Step { key: string; label: string; meta?: string; cur: boolean; done: boolean; reachable: boolean; busy?: boolean; target: RailTarget; }
interface Group { n: number; name: string; steps: Step[]; }

const RANK: Record<Phase, number> = { overview: 0, sitdown: 1, learn: 2, plan: 3, build: 4 };

export function buildRail(s: StudioState): Group[] {
  const rank = RANK[s.phase];
  const sd = s.sdProgress;
  const sdDone = sd.done || rank > 1;
  // --- 1 Sit-Down: sub-steps follow the session stage ---
  const sdIdx = (() => {
    if (sdDone) return 4;
    if (!sd.started) return 0;
    if (SHARP.includes(sd.stage) || !sd.stage) return 0;
    return { shapes: 1, scope: 2, readback: 3 }[sd.stage as "shapes" | "scope" | "readback"] ?? 0;
  })();
  const sdSteps: Step[] = [
    { key: "sharpen", label: "Sharpen the idea", meta: sd.started || sdDone ? `${sd.covered} of 7 covered` : undefined, stage: "problem" },
    { key: "shapes", label: "Ways to build it", stage: "shapes" },
    { key: "scope", label: "Fit it in a day", stage: "scope" },
    { key: "recap", label: "Your plan recap", stage: "readback" },
  ].map((x, i) => ({
    key: x.key, label: x.label, meta: x.meta,
    cur: s.phase === "sitdown" && i === sdIdx,
    done: i < sdIdx,
    reachable: rank >= 1 && (i <= sdIdx || sdDone) && (sd.started || i === 0),
    target: { phase: "sitdown" as const, stage: x.stage },
  }));

  // --- 2 Learn: the architecture, one per component, the quick check ---
  const caps = s.capabilities.length ? learnComponents(s.capabilities) : [];
  const learnLabels = caps.length
    ? ["Your architecture", ...caps.map((c) => CONCEPTS[c].short), "Quick check"]
    : ["The pieces you'll use"];
  const learnSteps: Step[] = learnLabels.map((label, i) => ({
    key: "l" + i, label,
    cur: s.phase === "learn" && i === s.learnIdx,
    done: rank > 2 || (s.phase === "learn" && i < s.learnIdx),
    reachable: caps.length > 0 && (rank > 2 || (rank === 2 && i <= Math.max(s.learnMax, s.learnIdx))),
    target: { phase: "learn" as const, beat: i },
  }));

  // --- 3 Plan ---
  const drafting = s.planJob?.status === "running";
  const planSteps: Step[] = [{
    key: "plan", label: "Architecture & PRD",
    meta: drafting ? "drafting in background…" : s.planJob?.status === "error" ? "needs a retry" : undefined,
    busy: drafting,
    cur: s.phase === "plan",
    done: rank > 3,
    reachable: rank >= 3 || (rank === 2 && !!(s.blueprint || s.planJob)),
    target: { phase: "plan" as const },
  }];

  // --- 4 Build: one per build step ---
  const steps = s.buildPlan?.steps || [];
  const buildSteps: Step[] = steps.length
    ? steps.map((st, i) => ({
        key: "b" + st.n, label: st.title,
        cur: s.phase === "build" && s.buildEntered && i === s.buildStepIdx,
        done: s.buildDone.includes(st.n),
        reachable: rank === 4,
        target: { phase: "build" as const, step: i },
      }))
    : [{ key: "b0", label: "Build steps", meta: rank === 4 && s.buildLoading ? "planning…" : undefined, cur: s.phase === "build", done: false, reachable: rank === 4, target: { phase: "build" as const, step: null } }];

  return [
    { n: 1, name: "Sit-Down", steps: sdSteps },
    { n: 2, name: "Learn", steps: learnSteps },
    { n: 3, name: "Plan", steps: planSteps },
    { n: 4, name: "Build", steps: buildSteps },
  ];
}

export function LeftRail({ state, go, onProctor }: { state: StudioState; go: (t: RailTarget) => void; onProctor?: () => void }) {
  const groups = buildRail(state);
  return (
    <aside className="flex w-[252px] shrink-0 flex-col overflow-y-auto border-r border-line bg-white px-4 py-5" aria-label="Your journey">
      <div className="mb-1 flex items-center gap-2 px-1.5">
        <span className="h-4 w-4 rounded-[5px] bg-green" />
        <b className="text-[13px] font-bold text-navy">Build Studio</b>
      </div>
      <div className="mb-3 px-1.5 text-[12px] text-navy-3">From an idea to something real, on Databricks</div>

      {groups.map((g) => {
        const active = g.steps.some((x) => x.cur);
        return (
          <div key={g.name} className="mb-1">
            <div className={`flex items-center gap-2 px-2 pb-1 pt-3.5 text-[12px] font-medium ${active ? "text-navy" : "text-navy-3"}`}>
              <span className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[11px] font-semibold ${active ? "bg-navy text-white" : "bg-oat-2 text-navy-2"}`}>{g.n}</span>{g.name}
            </div>
            {g.steps.map((st) => (
              <button key={st.key} disabled={!st.reachable}
                onClick={() => st.reachable && go(st.target)}
                aria-current={st.cur ? "step" : undefined}
                className={`group flex w-full items-start gap-2.5 rounded-[9px] px-2 py-[7px] text-left text-[13.5px] transition-colors
                  ${st.cur ? "bg-green-soft font-medium text-navy" : "text-navy-2"}
                  ${st.reachable ? (st.cur ? "" : "hover:bg-oat") : "cursor-default opacity-45"}`}>
                <span className={`mt-[2px] grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold transition-colors
                  ${st.done ? "border-green bg-green text-white" : st.cur ? "border-green bg-white" : "border-line-2"}`}>
                  {st.done ? "✓" : st.cur ? <span className="h-[7px] w-[7px] rounded-full bg-green" /> : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate leading-[1.35]">{st.label}</span>
                  {st.meta && (
                    <span className={`mt-0.5 flex items-center gap-1.5 text-[11.5px] font-medium ${st.busy ? "text-green-ink" : "text-navy-3"}`}>
                      {st.busy && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green" />}{st.meta}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        );
      })}
      {onProctor && (
        <button onClick={onProctor} className="mt-auto rounded-lg border border-line px-3 py-2 text-left text-[12.5px] font-medium text-navy-2 hover:border-navy-3 hover:text-navy">
          Proctor console →
        </button>
      )}
    </aside>
  );
}
