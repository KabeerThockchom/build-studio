import type { DesignQuestion } from "../lib/constants";

interface Props {
  q: DesignQuestion;
  selected: string | undefined;      // option key or "other"
  otherText: string;
  onSelect: (key: string) => void;
  onOther: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

function Preview({ lines }: { lines: [string, string, string] }) {
  return (
    <div className="sticky top-0 rounded-2xl bg-navy px-[22px] py-5 text-[#eaf1f2]">
      <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.1em] text-green-l">What this leads to</div>
      <div className="mb-[11px] text-[13.5px] leading-relaxed text-[#c4d4d8]" dangerouslySetInnerHTML={{ __html: lines[0] }} />
      <div className="mb-[11px] text-[13.5px] leading-relaxed text-[#c4d4d8]" dangerouslySetInnerHTML={{ __html: lines[1] }} />
      <div className="mt-3 border-t border-white/10 pt-3 text-[12.5px] leading-snug text-[#a9c0c6]">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em] text-amber">Tradeoff</span>
        {lines[2]}
      </div>
    </div>
  );
}

export function DesignScreen({ q, selected, otherText, onSelect, onOther, onBack, onNext }: Props) {
  const sel = q.options.find((o) => o.key === selected);
  const previewLines = selected === "other" ? q.otherPreview : (sel?.preview ?? q.options[0].preview);

  return (
    <div className="rise max-w-[1080px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">{q.eyebrow}</div>
      <h2 className="mb-3 text-[29px] font-extrabold leading-[1.1] tracking-[-0.022em] text-navy">{q.title}</h2>
      <p className="mb-7 max-w-[56ch] text-[16.5px] leading-relaxed text-navy-2">{q.lead}</p>

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
                  <small className="mt-0.5 block text-[12.5px] leading-snug text-navy-3">{o.sub}</small>
                </span>
              </button>
            );
          })}
          <textarea rows={2} value={otherText}
            onChange={(e) => onOther(e.target.value)}
            onFocus={() => onOther(otherText)}
            placeholder={q.otherPlaceholder}
            className={`mt-0.5 w-full resize-none rounded-xl border-[1.5px] border-dashed px-4 py-3 text-[14px] leading-snug text-navy outline-none focus:border-solid focus:border-green focus:ring-[3px] focus:ring-green-soft
              ${selected === "other" ? "border-green" : "border-line-2"}`} />
        </div>
        <Preview lines={previewLines} />
      </div>

      <div className="mt-9 flex items-center justify-between">
        <button onClick={onBack} className="text-[14px] font-semibold text-navy-3 hover:text-navy">← Back</button>
        <button onClick={onNext} disabled={!selected}
          className="rounded-xl bg-green px-7 py-3.5 text-[15.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l disabled:opacity-40">
          Next →
        </button>
      </div>
    </div>
  );
}
