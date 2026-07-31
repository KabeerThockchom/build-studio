import type { Phase, StudioState } from "../lib/store";

interface RailStep { label: string; phase: Phase; designIdx?: number; }

// Build the rail from current state so Design expands to the SA's question count.
function buildSteps(s: StudioState): { group: string; steps: RailStep[] }[] {
  const design: RailStep[] = (s.plan?.questions ?? []).map((q, i) => ({
    label: q.title.length > 26 ? q.title.slice(0, 24) + "…" : q.title,
    phase: "design" as Phase, designIdx: i,
  }));
  if (design.length === 0) design.push({ label: "Questions", phase: "design", designIdx: 0 });
  return [
    { group: "Shape", steps: [{ label: "Your idea", phase: "shape" }] },
    { group: "Design", steps: design },
    { group: "Assemble", steps: [{ label: "Pick capabilities", phase: "assemble" }] },
    { group: "Blueprint", steps: [{ label: "Architecture & plan", phase: "blueprint" }] },
    { group: "Build", steps: [{ label: "First step", phase: "build" }] },
  ];
}

const ORDER: Phase[] = ["shape", "planning", "design", "assemble", "blueprint", "build"];

export function LeftRail({ state, go }: { state: StudioState; go: (p: Phase, i?: number) => void }) {
  const groups = buildSteps(state);
  const curRank = ORDER.indexOf(state.phase === "planning" ? "design" : state.phase);

  return (
    <aside className="w-[250px] shrink-0 border-r border-line bg-white px-4 py-5 flex flex-col overflow-y-auto">
      <div className="flex items-center gap-2 px-1.5 mb-1">
        <div className="h-4 w-4 rounded-[5px] bg-green" />
        <b className="text-[13px] font-bold text-navy">Build Studio</b>
      </div>
      <div className="px-1.5 text-[11px] text-navy-3 mb-5">Your idea to something real, on Databricks</div>

      {groups.map((g) => {
        const gRank = ORDER.indexOf(g.steps[0].phase);
        return (
          <div key={g.group}>
            <div className="px-2 pt-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-navy-3">{g.group}</div>
            {g.steps.map((st, idx) => {
              const isDesign = st.phase === "design";
              const cur = state.phase === st.phase && (!isDesign || state.designIdx === st.designIdx);
              const done = gRank < curRank || (isDesign && state.phase === "design" && (st.designIdx ?? 0) < state.designIdx)
                || (gRank === curRank && !cur && gRank < curRank);
              const reachable = gRank <= curRank;
              return (
                <button key={idx} disabled={!reachable}
                  onClick={() => reachable && go(st.phase, st.designIdx)}
                  className={`flex w-full items-center gap-3 rounded-[9px] px-2 py-2 text-[13.5px] font-medium transition-colors text-left
                    ${cur ? "bg-green-soft text-navy font-bold" : done ? "text-navy-3 hover:bg-oat" : "text-navy-2"} ${reachable ? "hover:bg-oat cursor-pointer" : "opacity-45 cursor-default"}`}>
                  <span className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold
                    ${done ? "border-green bg-green text-white" : cur ? "border-green" : "border-line-2"}`}>
                    {done ? "✓" : ""}
                  </span>
                  <span className="truncate">{st.label}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}
