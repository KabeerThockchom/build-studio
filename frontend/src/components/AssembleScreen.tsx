import type { CapabilityPick } from "../lib/types";

// Short, stable description per capability, in plain outcome language — no product
// jargon (a nervous newcomer stalled on "Postgres" here). The SA supplies the
// idea-specific "fits"; this is the "what it does for you" the decision needs.
const BLURB: Record<string, string> = {
  "Genie": "Ask your data questions in plain English and get real answers back.",
  "Knowledge Assistant": "Point it at your notes and documents and it can answer from them.",
  "Supervisor agent": "Ties the pieces together — picks the right one for each request and replies.",
  "Lakebase": "A place for your app to save things, like the decisions people make, so they stick.",
  "Databricks Apps": "The interface people actually open and use.",
};

interface Props {
  picks: CapabilityPick[];        // SA-authored, ordered; carries the "fits" rationale
  selected: string[];             // current selection (user can toggle)
  fromSample?: boolean;           // components were pre-selected by a picked example
  onToggle: (name: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function AssembleScreen({ picks, selected, fromSample, onToggle, onBack, onNext }: Props) {
  return (
    <div className="rise max-w-[1080px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Assemble</div>
      <h2 className="mb-3 text-[29px] font-extrabold leading-[1.1] tracking-[-0.022em] text-navy">Here's what fits. Yours to change.</h2>
      <p className="mb-7 max-w-[56ch] text-[16.5px] leading-relaxed text-navy-2">
        {fromSample
          ? "We started from the pieces your example usually needs. Toggle anything on or off. This is your design, not ours."
          : "Based on what you described, we pre-selected the pieces that fit. Toggle anything on or off. This is your design, not ours."}
      </p>

      <div className="grid grid-cols-3 gap-3.5">
        {picks.map((c) => {
          const on = selected.includes(c.name);
          const wasPreselected = c.selected;
          return (
            <button key={c.name} onClick={() => onToggle(c.name)}
              className={`relative flex min-h-[168px] flex-col rounded-[15px] border-[1.5px] px-[18px] py-[17px] text-left transition-all
                ${on ? "border-green bg-green-soft shadow-[0_6px_22px_rgba(0,168,112,0.1)]" : "border-line bg-white hover:border-navy-3"}`}>
              <span className={`absolute right-[14px] top-[15px] grid h-[22px] w-[22px] place-items-center rounded-[7px] border-2 text-[12px] font-bold text-white
                ${on ? "border-green bg-green" : "border-line-2"}`}>{on ? "✓" : ""}</span>
              <div className="mb-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] text-green-ink">{c.name}</div>
              <p className="text-[13px] leading-snug text-navy-2 pr-6">{BLURB[c.name] || ""}</p>
              {c.fits && (wasPreselected
                ? <span className="mt-auto inline-block self-start rounded-md border border-[#c7ebda] bg-white px-2 py-0.5 text-[11px] font-bold text-green-ink">Fits: {c.fits}</span>
                : <span className="mt-auto inline-block text-[11px] font-semibold text-navy-3">Optional · {c.fits}</span>)}
            </button>
          );
        })}
      </div>

      <div className="mt-9 flex items-center justify-between">
        <button onClick={onBack} className="text-[14px] font-semibold text-navy-3 hover:text-navy">← Back</button>
        <button onClick={onNext} disabled={selected.length === 0}
          className="rounded-xl bg-green px-7 py-3.5 text-[15.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l disabled:opacity-40">
          Build the blueprint →
        </button>
      </div>
    </div>
  );
}
