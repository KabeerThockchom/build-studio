import { useState } from "react";
import Markdown from "react-markdown";
import { RefreshCw, Check, Clock } from "lucide-react";
import type { Blueprint } from "../lib/types";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { GeneratingPanel } from "./GeneratingPanel";

interface Props {
  blueprint: Blueprint | null;
  generating: boolean;
  error: string | null;
  onRetry: () => void;
  onRefine: (note: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const REFINE_CHIPS = ["Make it simpler", "More detail in the plan", "Focus on the manager view", "Assume less Databricks knowledge"];

function RefineBar({ onRefine, disabled }: { onRefine: (n: string) => void; disabled: boolean }) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-6 rounded-2xl border border-line bg-white px-5 py-4">
      <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-3">
        <RefreshCw className="h-3.5 w-3.5" /> Not quite right? Refine it
      </div>
      <div className="flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { onRefine(note); setNote(""); } }}
          placeholder="Tell the assistant what to change…"
          className="flex-1 rounded-xl border-[1.5px] border-line px-4 py-2.5 text-[14px] text-navy outline-none focus:border-green focus:ring-[3px] focus:ring-green-soft" />
        <button onClick={() => { if (note.trim()) { onRefine(note); setNote(""); } }} disabled={disabled || !note.trim()}
          className="rounded-xl bg-navy px-5 py-2.5 text-[14px] font-bold text-white hover:bg-navy-2 disabled:opacity-40">Regenerate</button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {REFINE_CHIPS.map((c) => (
          <button key={c} onClick={() => onRefine(c)} disabled={disabled}
            className="rounded-full border border-line px-3 py-1 text-[12.5px] font-medium text-navy-2 hover:border-green hover:text-green-ink disabled:opacity-40">{c}</button>
        ))}
      </div>
    </div>
  );
}

const SectionH = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 mt-6 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-3">{children}</div>
);

export function BlueprintScreen({ blueprint, generating, error, onRetry, onRefine, onBack, onNext }: Props) {
  return (
    <div className="rise max-w-[1080px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Blueprint</div>
      <h2 className="mb-3 text-[29px] font-extrabold leading-[1.1] tracking-[-0.022em] text-navy">Your build, on one page.</h2>
      <p className="mb-6 max-w-[60ch] text-[16.5px] leading-relaxed text-navy-2">
        Built from what you described and the pieces you picked. The flow is how a person moves through it; the diagram is how the parts connect.
      </p>

      {generating && (
        <GeneratingPanel
          intervalMs={13000}
          steps={["Reading your idea and design choices",
                  "Laying out how the pieces connect",
                  "Writing your plan and the tradeoffs",
                  "Still working — putting it on one page"]}
          note="This takes up to a minute or two. It's writing a real plan tailored to what you described, not a template." />
      )}
      {error && !generating && (
        <div className="rounded-2xl bg-[#fdecef] px-5 py-4">
          <p className="text-[14px] font-bold text-lava">Couldn't generate the blueprint</p>
          <p className="mt-1 text-[13px] text-navy-2">{error}</p>
          <button onClick={onRetry} className="mt-2 text-[13px] font-bold text-lava underline">Try again</button>
        </div>
      )}

      {blueprint && !generating && (
        <>
          {blueprint.refine_note && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border-[1.5px] border-green bg-green-soft px-4 py-3">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-green" />
              <div className="text-[14px] leading-snug text-navy"><b>Updated the architecture.</b> {blueprint.refine_note}</div>
            </div>
          )}
          {(blueprint.scope_in.length > 0 || blueprint.scope_later.length > 0) && (
            <ScopeCard scopeIn={blueprint.scope_in} scopeLater={blueprint.scope_later} />
          )}

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

          <SectionH>The plan — your PRD</SectionH>
          <p className="-mt-1 mb-3 max-w-[70ch] text-[13.5px] leading-relaxed text-navy-3">
            This is your PRD (product requirements doc): the first milestone of any build, and
            what you'll hand the agent to build from. Read it, and edit anything that's off below —
            a clear PRD is what makes the build come out right.
          </p>
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
          <RefineBar onRefine={onRefine} disabled={generating} />
        </>
      )}

      <div className="mt-9 flex items-center justify-between">
        <button onClick={onBack} className="text-[14px] font-semibold text-navy-3 hover:text-navy">← Change capabilities</button>
        <button onClick={onNext} disabled={!blueprint || generating}
          className="rounded-xl bg-green px-7 py-3.5 text-[15.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l disabled:opacity-40">
          Start building →
        </button>
      </div>
    </div>
  );
}

// The visible workshop-day scope contract — the SA telling you, plainly, what
// you'll walk out with today and what's honestly a follow-up.
function ScopeCard({ scopeIn, scopeLater }: { scopeIn: string[]; scopeLater: string[] }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-3.5">
      <div className="rounded-2xl border-[1.5px] border-green bg-green-soft px-5 py-4">
        <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-green-ink">
          <Check className="h-4 w-4" /> In scope today
        </div>
        <ul className="flex flex-col gap-2">
          {scopeIn.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[13.5px] leading-snug text-navy">
              <span className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-green" />{s}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-line bg-white px-5 py-4">
        <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-navy-3">
          <Clock className="h-4 w-4" /> Save for later
        </div>
        <ul className="flex flex-col gap-2">
          {scopeLater.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[13.5px] leading-snug text-navy-2">
              <span className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-line-2" />{s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

