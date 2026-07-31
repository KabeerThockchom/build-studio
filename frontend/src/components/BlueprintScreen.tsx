import Markdown from "react-markdown";
import type { Blueprint } from "../lib/types";
import { ArchitectureDiagram } from "./ArchitectureDiagram";

interface Props {
  blueprint: Blueprint | null;
  generating: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
  onNext: () => void;
}

const SectionH = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 mt-6 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-3">{children}</div>
);

export function BlueprintScreen({ blueprint, generating, error, onRetry, onBack, onNext }: Props) {
  return (
    <div className="rise max-w-[1080px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Blueprint</div>
      <h2 className="mb-3 text-[29px] font-extrabold leading-[1.1] tracking-[-0.022em] text-navy">Your build, on one page.</h2>
      <p className="mb-6 max-w-[60ch] text-[16.5px] leading-relaxed text-navy-2">
        Built from what you described and the pieces you picked. The flow is how a person moves through it; the diagram is how the parts connect.
      </p>

      {generating && <GeneratingState />}
      {error && !generating && (
        <div className="rounded-2xl bg-[#fdecef] px-5 py-4">
          <p className="text-[14px] font-bold text-lava">Couldn't generate the blueprint</p>
          <p className="mt-1 text-[13px] text-navy-2">{error}</p>
          <button onClick={onRetry} className="mt-2 text-[13px] font-bold text-lava underline">Try again</button>
        </div>
      )}

      {blueprint && !generating && (
        <>
          <SectionH>How someone uses it</SectionH>
          <div className="flex items-center gap-2 overflow-x-auto rounded-[13px] border border-line bg-white px-5 py-4">
            {blueprint.flow.map((f, i) => (
              <div key={f.n} className="flex shrink-0 items-center gap-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-green-soft text-[11px] font-bold text-green-ink">{f.n}</span>
                  <span className="text-[13.5px] font-semibold text-navy">{f.title}<small className="block text-[11.5px] font-normal text-navy-3">{f.sub}</small></span>
                </div>
                {i < blueprint.flow.length - 1 && <span className="text-line-2">→</span>}
              </div>
            ))}
          </div>

          <SectionH>How it's put together</SectionH>
          <div className="rounded-2xl border border-line bg-white px-3 py-4">
            <ArchitectureDiagram spec={blueprint.spec} />
          </div>

          <SectionH>The plan</SectionH>
          <div className="rounded-2xl border border-line bg-white px-6 py-5 prose-tight text-[14.5px] text-navy">
            <Markdown>{blueprint.prd_markdown}</Markdown>
          </div>

          {blueprint.decisions.length > 0 && (
            <>
              <SectionH>Decisions &amp; tradeoffs</SectionH>
              <div className="rounded-2xl border border-line bg-white px-5">
                {blueprint.decisions.map((d, i) => (
                  <div key={i} className={`grid grid-cols-[150px_1fr] gap-4 py-[15px] ${i > 0 ? "border-t border-line" : ""}`}>
                    <span className="font-mono text-[12px] text-green-ink">{d.tag}</span>
                    <div>
                      <b className="text-[14.5px] font-semibold text-navy">{d.text}</b>
                      {d.tradeoff && <div className="mt-1 text-[13px] leading-snug text-navy-3"><span className="font-semibold text-amber">Cost:</span> {d.tradeoff}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="mt-9 flex items-center justify-between">
        <button onClick={onBack} className="text-[14px] font-semibold text-navy-3 hover:text-navy">← Adjust</button>
        <button onClick={onNext} disabled={!blueprint || generating}
          className="rounded-xl bg-green px-7 py-3.5 text-[15.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l disabled:opacity-40">
          Start building →
        </button>
      </div>
    </div>
  );
}

function GeneratingState() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-6 py-8 text-[15px] text-navy-2">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-green" style={{ animation: `dots 1.4s ${i * 0.16}s infinite ease-in-out` }} />
        ))}
      </span>
      Designing your architecture and writing the plan…
    </div>
  );
}
