import type { DesignQuestion } from "../lib/types";

interface Props {
  q: DesignQuestion;
  readBack?: string;                 // shown on the first question only
  selected: string | undefined;      // option key or "other"
  otherText: string;
  onSelect: (key: string) => void;
  onOther: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextBusy?: boolean;
  planning?: boolean;        // SA still generating tailored follow-ups
  isFirst?: boolean;         // the hard-coded Q1
}

function Preview({ lines }: { lines: string[] }) {
  const [a, b, c] = [lines[0] ?? "", lines[1] ?? "", lines[2] ?? ""];
  return (
    <div className="sticky top-0 rounded-2xl bg-navy px-[22px] py-5 text-[#eaf1f2]">
      <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.1em] text-green-l">What this leads to</div>
      <div className="mb-[11px] text-[13.5px] leading-relaxed text-[#c4d4d8]">{a}</div>
      {b && <div className="mb-[11px] text-[13.5px] leading-relaxed text-[#c4d4d8]">{b}</div>}
      {c && (
        <div className="mt-3 border-t border-white/10 pt-3 text-[12.5px] leading-snug text-[#a9c0c6]">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em] text-amber">Tradeoff</span>{c}
        </div>
      )}
    </div>
  );
}

export function DesignScreen({ q, readBack, selected, otherText, onSelect, onOther, onBack, onNext, nextLabel, nextBusy, planning, isFirst }: Props) {
  const sel = q.options.find((o) => o.key === selected);
  const previewLines = selected === "other" ? q.other_preview : (sel?.preview ?? q.options[0].preview);

  return (
    <div className="rise max-w-[1080px]">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">{q.eyebrow}</span>
        {isFirst && planning && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-semibold text-green-ink">
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-green" style={{ animation: `dots 1.4s ${i * 0.16}s infinite ease-in-out` }} />)}
            </span>
            tailoring your next questions to this idea…
          </span>
        )}
      </div>
      {readBack && (
        <div className="mb-5 rounded-xl border border-green-soft bg-green-soft/60 px-4 py-3 text-[14px] leading-relaxed text-green-ink">
          {readBack}
        </div>
      )}
      <h2 className="mb-3 text-[28px] font-extrabold leading-[1.12] tracking-[-0.022em] text-navy">{q.title}</h2>
      {q.lead && <p className="mb-7 max-w-[56ch] text-[16px] leading-relaxed text-navy-2">{q.lead}</p>}

      <div className="grid grid-cols-[1fr_380px] gap-7 items-start">
        <div className="flex flex-col gap-2.5">
          {q.options.map((o) => {
            const on = selected === o.key;
            return (
              <button key={o.key} onClick={() => onSelect(o.key)}
                className={`flex items-start gap-3 rounded-[13px] border-[1.5px] px-[18px] py-4 text-left transition-colors
                  ${on ? "border-green bg-green-soft" : "border-line bg-white hover:border-green"}`}>
                <span className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-[13px] font-bold
                  ${on ? "bg-green text-white" : "bg-oat text-navy-2"}`}>{o.letter}</span>
                <span>
                  <b className="text-[15px] font-semibold text-navy">{o.label}</b>
                  {o.sub && <small className="mt-0.5 block text-[12.5px] leading-snug text-navy-3">{o.sub}</small>}
                </span>
              </button>
            );
          })}
          <textarea rows={2} value={otherText}
            onChange={(e) => onOther(e.target.value)}
            placeholder={q.other_placeholder}
            className={`mt-0.5 w-full resize-none rounded-xl border-[1.5px] border-dashed px-4 py-3 text-[14px] leading-snug text-navy outline-none focus:border-solid focus:border-green focus:ring-[3px] focus:ring-green-soft
              ${selected === "other" ? "border-green" : "border-line-2"}`} />
        </div>
        <Preview lines={previewLines} />
      </div>

      <div className="mt-9 flex items-center justify-between">
        <button onClick={onBack} className="text-[14px] font-semibold text-navy-3 hover:text-navy">← Back</button>
        <button onClick={onNext} disabled={!selected || nextBusy}
          className="rounded-xl bg-green px-7 py-3.5 text-[15.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l disabled:opacity-40">
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
