import { Check } from "lucide-react";
import type { CapabilityPick } from "../lib/types";

// Short, stable description per capability, in plain outcome language — no product
// jargon (a nervous newcomer stalled on "Postgres" here). The SA supplies the
// idea-specific "fits"; this is the "what it does for you" the person needs.
const BLURB: Record<string, string> = {
  "Genie": "Ask your data questions in plain English and get real answers back.",
  "Knowledge Assistant": "Point it at your notes and documents and it can answer from them.",
  "Supervisor agent": "The traffic cop: reads each question and sends it to the right piece.",
  "Lakebase": "A place for your app to save things, like the decisions people make, so they stick.",
  "Databricks Apps": "The interface people actually open and use.",
};

interface Props {
  picks: CapabilityPick[];        // the locked, prescribed set; carries the per-idea "fits"
  onBack: () => void;
  onNext: () => void;
}

// The architecture is prescribed: every app in the workshop uses the same pieces, so this
// is no longer a selector. It's "meet your stack" — the pieces, and how each one shows up
// in THEIR idea. The learning + a quick check come next, in their own phase.
export function AssembleScreen({ picks, onBack, onNext }: Props) {
  return (
    <div className="rise max-w-[1080px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Assemble</div>
      <h2 className="mb-3 text-[29px] font-extrabold leading-[1.1] tracking-[-0.022em] text-navy">The pieces your build uses.</h2>
      <p className="mb-7 max-w-[58ch] text-[16.5px] leading-relaxed text-navy-2">
        Every app you build here stands on the same core Databricks pieces working together. Here's each one,
        and how it shows up in your idea. Next, we'll spend a minute on what each does.
      </p>

      <div className="grid grid-cols-3 gap-3.5 items-start">
        {picks.map((c) => (
          <div key={c.name}
            className="relative flex min-h-[150px] flex-col rounded-[15px] border-[1.5px] border-green bg-green-soft px-[18px] py-[17px] shadow-[0_6px_22px_rgba(0,168,112,0.08)]">
            <span className="absolute right-[14px] top-[15px] grid h-[22px] w-[22px] place-items-center rounded-[7px] bg-green text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <div className="mb-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] text-green-ink pr-6">{c.name}</div>
            <p className="text-[13px] leading-snug text-navy-2 pr-2">{BLURB[c.name] || ""}</p>
            {c.fits && (
              <span className="mt-auto inline-block self-start rounded-md border border-[#c7ebda] bg-white px-2 py-0.5 text-[11px] font-bold text-green-ink">
                In your build: {c.fits}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-9 flex items-center justify-between">
        <button onClick={onBack} className="text-[14px] font-semibold text-navy-3 hover:text-navy">← Back</button>
        <button onClick={onNext}
          className="rounded-xl bg-green px-7 py-3.5 text-[15.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l">
          Learn the pieces →
        </button>
      </div>
    </div>
  );
}
