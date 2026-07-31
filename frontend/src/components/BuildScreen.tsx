import { useState } from "react";
import { Check, Copy, Send, Sparkles, Lightbulb } from "lucide-react";
import type { BuildPlan, BuildStep } from "../lib/types";

interface Props {
  plan: BuildPlan | null;
  loading: boolean;
  stepIdx: number;
  done: number[];
  onStep: (i: number) => void;
  onComplete: (n: number) => void;
  onBack: () => void;
}

export function BuildScreen({ plan, loading, stepIdx, done, onStep, onComplete, onBack }: Props) {
  if (loading || !plan) {
    return (
      <div className="rise max-w-[680px]">
        <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Build</div>
        <h2 className="mb-4 text-[29px] font-extrabold leading-tight text-navy">Planning your build…</h2>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-6 py-7 text-[15px] text-navy-2">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-green" style={{ animation: `dots 1.4s ${i * 0.16}s infinite ease-in-out` }} />)}
          </span>
          Breaking your blueprint into bite-sized steps for Genie Code…
        </div>
      </div>
    );
  }

  const steps = plan.steps;
  const step = steps[stepIdx];
  const allDone = done.length >= steps.length;

  return (
    <div className="rise flex gap-7 max-w-[1180px]">
      {/* left: step list + current step */}
      <div className="flex-1 min-w-0">
        <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">
          Build · step {stepIdx + 1} of {steps.length}
        </div>

        {/* step pills */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {steps.map((s, i) => {
            const isDone = done.includes(s.n), cur = i === stepIdx;
            return (
              <button key={s.n} onClick={() => onStep(i)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors
                  ${cur ? "bg-navy text-white" : isDone ? "bg-green-soft text-green-ink" : "bg-white text-navy-2 border border-line"}`}>
                <span className="grid h-4 w-4 place-items-center rounded-full text-[9px]"
                  style={{ background: isDone ? "#00A870" : cur ? "rgba(255,255,255,.2)" : "#EEEDE9", color: isDone || cur ? "#fff" : "#5A8A9A" }}>
                  {isDone ? "✓" : s.n}
                </span>
                {s.title.length > 22 ? s.title.slice(0, 20) + "…" : s.title}
              </button>
            );
          })}
        </div>

        <h2 className="mb-1.5 text-[27px] font-extrabold leading-[1.12] tracking-[-0.02em] text-navy">{step.title}</h2>

        <section className="mt-5 rounded-2xl border border-line bg-white px-6 py-5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-navy-3">What you're doing &amp; why</div>
          <p className="text-[15.5px] leading-relaxed text-navy-2">{step.concept}</p>
        </section>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-green-soft/70 px-4 py-3">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green" />
          <div className="text-[14px] leading-snug text-navy"><b>You'll know it worked when:</b> {step.verify}</div>
        </div>

        {step.teach && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-dashed border-amber/40 bg-[#fffdf7] px-4 py-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
            <div className="text-[13.5px] leading-snug text-navy-2">{step.teach}</div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button onClick={stepIdx === 0 ? onBack : () => onStep(stepIdx - 1)}
            className="text-[14px] font-semibold text-navy-3 hover:text-navy">← {stepIdx === 0 ? "Blueprint" : "Previous"}</button>
          <div className="flex items-center gap-3">
            {!done.includes(step.n) && (
              <button onClick={() => { onComplete(step.n); if (stepIdx < steps.length - 1) onStep(stepIdx + 1); }}
                className="rounded-xl bg-green px-6 py-3 text-[15px] font-bold text-white hover:bg-green-l">I did this →</button>
            )}
            {done.includes(step.n) && stepIdx < steps.length - 1 && (
              <button onClick={() => onStep(stepIdx + 1)}
                className="rounded-xl bg-green px-6 py-3 text-[15px] font-bold text-white hover:bg-green-l">Next step →</button>
            )}
            {allDone && stepIdx === steps.length - 1 && (
              <span className="rounded-xl bg-green-soft px-5 py-3 text-[15px] font-bold text-green-ink">🎉 You built it</span>
            )}
          </div>
        </div>
      </div>

      {/* right: simulated Genie Code panel */}
      <GeniePanel step={step} />
    </div>
  );
}

function GeniePanel({ step }: { step: BuildStep }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(step.move); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  return (
    <aside className="w-[380px] shrink-0 self-start rounded-2xl border border-line overflow-hidden" style={{ background: "#132029" }}>
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
        <span className="grid h-6 w-6 place-items-center rounded-md text-[13px] text-white" style={{ background: "linear-gradient(135deg,#00A870,#2BC48A)" }}>◆</span>
        <div><b className="text-[13.5px] font-bold text-white">Genie Code</b>
          <small className="block text-[11px] text-[#6f8b93]">in your Databricks workspace</small></div>
      </div>
      <div className="border-b border-white/10 px-4 py-2.5 text-[11.5px] leading-snug text-[#8aa2a8]">
        Genie Code is Databricks' AI assistant, built into your workspace. Open it in a new
        Agent chat and paste the step below — it runs the work for you, already signed in.
      </div>
      <div className="flex flex-col gap-3.5 px-4 py-4">
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#5a7079]">Genie Code</div>
          <div className="rounded-xl rounded-tl-sm border border-white/10 bg-white/5 px-3.5 py-3 text-[13px] leading-relaxed text-[#c4d4d8]">
            Ready to help you build. What would you like to do?
          </div>
        </div>
        <div className="relative rounded-xl border-[1.5px] border-dashed border-green/60 bg-green/[0.07] px-3.5 py-3 pulse-border">
          <button onClick={copy} className="absolute right-3 top-2.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[#6f8b93] hover:text-green-l">
            {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
          </button>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-green-l">↓ Paste this into Genie Code</div>
          <div className="font-mono text-[12.5px] leading-relaxed text-[#eafaf3] whitespace-pre-wrap">{step.move}</div>
        </div>
      </div>
      <div className="m-4 mt-1 flex items-center justify-between gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
        <span className="text-[12.5px] text-[#5a7079]">Message Genie Code…</span>
        <span className="grid h-6 w-6 place-items-center rounded-md" style={{ background: "#00A870" }}><Send className="h-3 w-3 text-[#08221a]" /></span>
      </div>
      <div className="flex items-center gap-1.5 border-t border-white/10 px-4 py-2.5 text-[11px] text-[#5a7079]">
        <Sparkles className="h-3 w-3" /> Runs in your workspace — already signed in, no terminal needed.
      </div>
    </aside>
  );
}
