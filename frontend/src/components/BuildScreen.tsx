import type { Blueprint } from "../lib/types";

// M2 placeholder — the full build loop + Genie Code panel land in M3.
export function BuildScreen({ blueprint, onBack }: { blueprint: Blueprint | null; onBack: () => void }) {
  const first = blueprint?.spec.nodes.find((n) => n.band === "capability" || n.band === "data");
  return (
    <div className="rise max-w-[640px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Build · coming next</div>
      <h2 className="mb-3 text-[29px] font-extrabold leading-[1.1] tracking-[-0.022em] text-navy">Time to build it.</h2>
      <p className="mb-6 text-[16.5px] leading-relaxed text-navy-2">
        This is where Build Studio walks you through the build one move at a time, with Genie Code beside you.
        {first && <> First up: <b className="text-navy">{first.label}</b>.</>}
      </p>
      <div className="rounded-2xl border border-dashed border-line-2 bg-oat px-6 py-8 text-[14px] text-navy-3">
        The step-by-step build phase (concept → the move for Genie Code → verify) is the next milestone.
        For now, your blueprint and plan are ready above.
      </div>
      <div className="mt-9">
        <button onClick={onBack} className="text-[14px] font-semibold text-navy-3 hover:text-navy">← Back to blueprint</button>
      </div>
    </div>
  );
}
