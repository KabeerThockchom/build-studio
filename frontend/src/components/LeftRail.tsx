import type { Screen } from "../lib/store";

const PHASES: { label: string; steps: { screen: Screen; name: string }[] }[] = [
  { label: "Shape", steps: [{ screen: 0, name: "Your idea" }] },
  { label: "Design", steps: [{ screen: 1, name: "Who it's for" }, { screen: 2, name: "Your data" }] },
  { label: "Assemble", steps: [{ screen: 3, name: "Pick capabilities" }] },
  { label: "Blueprint", steps: [{ screen: 4, name: "Architecture & plan" }] },
  { label: "Build", steps: [{ screen: 5, name: "First step" }] },
];
const TOTAL = 6;

export function LeftRail({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  return (
    <aside className="w-[250px] shrink-0 border-r border-line bg-white px-4 py-5 flex flex-col overflow-y-auto">
      <div className="flex items-center gap-2 px-1.5 mb-1">
        <div className="h-4 w-4 rounded-[5px] bg-green" />
        <b className="text-[13px] font-bold text-navy">Build Studio</b>
      </div>
      <div className="px-1.5 text-[11px] text-navy-3 mb-5">Your idea to something real, on Databricks</div>

      {PHASES.map((p) => (
        <div key={p.label}>
          <div className="px-2 pt-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-navy-3">{p.label}</div>
          {p.steps.map((st) => {
            const done = st.screen < screen, cur = st.screen === screen;
            return (
              <button key={st.screen} onClick={() => go(st.screen)}
                className={`flex w-full items-center gap-3 rounded-[9px] px-2 py-2 text-[13.5px] font-medium transition-colors text-left
                  ${cur ? "bg-green-soft text-navy font-bold" : done ? "text-navy-3 hover:bg-oat" : "text-navy-2 hover:bg-oat"}`}>
                <span className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold
                  ${done ? "border-green bg-green text-white" : cur ? "border-green" : "border-line-2"}`}>
                  {done ? "✓" : ""}
                </span>
                {st.name}
              </button>
            );
          })}
        </div>
      ))}
      <div className="mt-auto px-2 pt-3 text-[11px] text-navy-3">Step {screen + 1} of {TOTAL}</div>
    </aside>
  );
}
