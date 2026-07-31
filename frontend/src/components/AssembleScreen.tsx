import { CAPABILITIES } from "../lib/constants";

interface Props {
  selected: string[];
  onToggle: (name: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function AssembleScreen({ selected, onToggle, onBack, onNext }: Props) {
  return (
    <div className="rise max-w-[1080px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Assemble</div>
      <h2 className="mb-3 text-[29px] font-extrabold leading-[1.1] tracking-[-0.022em] text-navy">Here's what fits. Yours to change.</h2>
      <p className="mb-7 max-w-[56ch] text-[16.5px] leading-relaxed text-navy-2">
        Based on what you described, we pre-selected the pieces that fit. Toggle anything on or off — this is your design, not ours.
      </p>

      <div className="grid grid-cols-3 gap-3.5">
        {CAPABILITIES.map((c) => {
          const on = selected.includes(c.name);
          return (
            <button key={c.name} onClick={() => onToggle(c.name)}
              className={`relative rounded-[15px] border-[1.5px] px-[18px] py-[17px] text-left transition-all
                ${on ? "border-green bg-green-soft shadow-[0_6px_22px_rgba(0,168,112,0.1)]" : "border-line bg-white hover:border-navy-3"}`}>
              <span className={`absolute right-[14px] top-[15px] grid h-[22px] w-[22px] place-items-center rounded-[7px] border-2 text-[12px] font-bold text-white
                ${on ? "border-green bg-green" : "border-line-2"}`}>{on ? "✓" : ""}</span>
              <div className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] text-green-ink">{c.name}</div>
              <p className="min-h-[38px] pr-6 text-[13px] leading-snug text-navy-2">{c.blurb}</p>
              {c.preselected
                ? <span className="mt-2.5 inline-block rounded-md border border-[#c7ebda] bg-white px-2 py-0.5 text-[11px] font-bold text-green-ink">Fits: {c.fits}</span>
                : <span className="mt-2.5 inline-block text-[11px] font-semibold text-navy-3">Optional — {c.fits}</span>}
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
