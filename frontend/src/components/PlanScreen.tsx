import { useState } from "react";
import Markdown from "react-markdown";
import { RefreshCw, Check, Clock, Monitor, ArrowRight } from "lucide-react";
import type { Blueprint, PlanJob } from "../lib/types";
import { ArchitectureDiagram } from "./ArchitectureDiagram";

/* Your plan: the architecture + the PRD, drafted by a background job that started the moment
   the Sit-Down handed off (so it mostly runs while they learn). If they arrive before it is
   done, they see a calm progress state naming the stage. Refine starts a new job. */

interface Props {
  blueprint: Blueprint | null;
  job: PlanJob | null;
  error: string | null;
  onRefine: (note: string) => void;
  onRetry: () => void;
  onBack: () => void;
  onNext: () => void;
}

const STAGES: { k: string; label: string; sub: string }[] = [
  { k: "drafting", label: "Drafting your plan", sub: "Turning your Sit-Down into a PRD and an architecture." },
  { k: "checking", label: "Checking it against your Sit-Down", sub: "Making sure your facts, scope and data are honoured exactly." },
  { k: "refining", label: "Tightening it up", sub: "Fixing anything the check found." },
];

function Progress({ job, refining }: { job: PlanJob | null; refining: boolean }) {
  const at = Math.max(0, STAGES.findIndex((s) => s.k === job?.stage));
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-3">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green" />
        {refining ? "Reworking your plan" : "Your plan is on its way"}
      </div>
      <ol className="flex flex-col gap-3">
        {STAGES.map((s, i) => {
          const done = i < at, cur = i === at;
          return (
            <li key={s.k} className={`flex items-start gap-3 transition-opacity ${i > at ? "opacity-45" : ""}`}>
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold
                ${done ? "bg-green text-white" : cur ? "border-2 border-green text-green-ink" : "border-2 border-line-2 text-navy-3"}`}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <div>
                <div className={`text-[14.5px] ${cur ? "font-bold text-navy" : "font-semibold text-navy-2"}`}>{s.label}{cur && <span className="ml-1 animate-pulse">…</span>}</div>
                <div className="text-[13px] leading-snug text-navy-3">{s.sub}</div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-[12.5px] leading-snug text-navy-3">This usually takes a minute or two. It's a real plan built from your Sit-Down, not a template.</p>
    </div>
  );
}

function RefineBar({ onRefine, disabled }: { onRefine: (n: string) => void; disabled: boolean }) {
  const [note, setNote] = useState("");
  const go = () => { const v = note.trim(); if (v && !disabled) { onRefine(v); setNote(""); } };
  return (
    <div className="mt-8 rounded-2xl border border-line bg-white px-5 py-4">
      <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-3">
        <RefreshCw className="h-3.5 w-3.5" /> Not quite right? Tell your SA what to change
      </div>
      <div className="flex items-end gap-2">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} disabled={disabled}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } }}
          placeholder="Like: keep the first screen simpler, or move the dashboard to stretch"
          className="min-h-[46px] flex-1 resize-none rounded-xl border-[1.5px] border-line px-4 py-2.5 text-[14px] text-navy outline-none focus:border-green focus:ring-[3px] focus:ring-green-soft disabled:opacity-50" />
        <button onClick={go} disabled={disabled || !note.trim()}
          className="h-[46px] rounded-xl bg-navy px-5 text-[14px] font-bold text-white hover:bg-navy-2 disabled:opacity-40">Rework it</button>
      </div>
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 mt-8 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-3">{children}</div>
);

export function PlanScreen({ blueprint, job, error, onRefine, onRetry, onBack, onNext }: Props) {
  const running = job?.status === "running";
  return (
    <div className="rise max-w-[1040px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Your plan</div>
      <h2 className="mb-3 text-[29px] font-extrabold leading-[1.1] tracking-[-0.022em] text-navy">Architecture and PRD, on one page.</h2>
      <p className="mb-6 max-w-[62ch] text-[16px] leading-relaxed text-navy-2">
        Everything from your Sit-Down, written up as the plan you'll build from. Read it and steer anything that's off before you start.
      </p>

      {running && <Progress job={job} refining={!!blueprint} />}
      {error && !running && (
        <div className="rounded-2xl bg-[#fdecef] px-5 py-4">
          <p className="text-[14px] font-bold text-lava">The plan didn't come through</p>
          <p className="mt-1 text-[13px] text-navy-2">{error}</p>
          <button onClick={onRetry} className="mt-2 text-[13px] font-bold text-lava underline">Try again</button>
        </div>
      )}
      {!blueprint && !running && !error && <Progress job={job} refining={false} />}

      {blueprint && (
        <div className={running ? "pointer-events-none mt-6 opacity-50 transition-opacity" : "transition-opacity"}>
          {blueprint.refine_note && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border-[1.5px] border-green bg-green-soft px-4 py-3">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-green" />
              <div className="text-[14px] leading-snug text-navy"><b>Updated.</b> {blueprint.refine_note}</div>
            </div>
          )}

          <H>How it's put together</H>
          <div className="rounded-2xl border border-line bg-white px-3 py-4">
            <ArchitectureDiagram spec={blueprint.spec} />
          </div>

          {blueprint.flow?.length > 0 && (
            <>
              <H>How someone uses it</H>
              <div className="flex items-center gap-2 overflow-x-auto rounded-[13px] border border-line bg-white px-5 py-4">
                {blueprint.flow.map((f, i) => (
                  <div key={f.n} className="flex shrink-0 items-center gap-2.5">
                    <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-green-soft text-[11px] font-bold text-green-ink">{f.n}</span>
                    <span className="text-[13.5px] font-semibold text-navy">{f.title}<small className="block text-[11.5px] font-normal text-navy-3">{f.sub}</small></span>
                    {i < blueprint.flow.length - 1 && <ArrowRight className="h-4 w-4 text-line-2" />}
                  </div>
                ))}
              </div>
            </>
          )}

          {(blueprint.scope_in.length > 0 || blueprint.scope_later.length > 0) && (
            <>
              <H>Today, and later</H>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div className="rounded-2xl border-[1.5px] border-green bg-green-soft px-5 py-4">
                  <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-green-ink"><Check className="h-4 w-4" /> In scope today</div>
                  <ul className="flex flex-col gap-2">{blueprint.scope_in.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13.5px] leading-snug text-navy"><span className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-green" />{s}</li>
                  ))}</ul>
                </div>
                <div className="rounded-2xl border border-line bg-white px-5 py-4">
                  <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-navy-3"><Clock className="h-4 w-4" /> Saved for later</div>
                  <ul className="flex flex-col gap-2">{blueprint.scope_later.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13.5px] leading-snug text-navy-2"><span className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-line-2" />{s}</li>
                  ))}</ul>
                </div>
              </div>
            </>
          )}

          <H>The PRD</H>
          <p className="-mt-1 mb-3 max-w-[70ch] text-[13.5px] leading-relaxed text-navy-3">
            Your product requirements doc. It's what Genie Code and Genie App Builder build from, so a clear PRD is what makes the build come out right.
          </p>
          <article className="prd rounded-2xl border border-line bg-white px-8 py-7 text-navy">
            <Markdown>{blueprint.prd_markdown}</Markdown>
          </article>

          {(blueprint.app_screens?.length ?? 0) > 0 && (
            <>
              <H>The app's screens</H>
              <div className="rounded-2xl border border-line bg-white px-5 py-4">
                <ul className="flex flex-col gap-2.5">{blueprint.app_screens!.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[14px] leading-snug text-navy">
                    <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-navy-3" />{s}
                  </li>
                ))}</ul>
              </div>
            </>
          )}

          {blueprint.decisions.length > 0 && (
            <>
              <H>Decisions and tradeoffs</H>
              <div className="rounded-2xl border border-line bg-white px-5">
                {blueprint.decisions.map((d, i) => (
                  <div key={i} className={`grid grid-cols-[170px_1fr] gap-4 py-[15px] ${i > 0 ? "border-t border-line" : ""}`}>
                    <span className="text-[12.5px] font-semibold text-green-ink">{d.tag}</span>
                    <div>
                      <b className="text-[14.5px] font-semibold text-navy">{d.text}</b>
                      {d.tradeoff && <div className="mt-1 text-[13px] leading-snug text-navy-3"><span className="font-semibold text-amber">Cost:</span> {d.tradeoff}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <RefineBar onRefine={onRefine} disabled={running} />
        </div>
      )}

      <div className="mt-9 flex items-center justify-between">
        <button onClick={onBack} className="text-[14px] font-semibold text-navy-3 hover:text-navy">← Back to Learn</button>
        <button onClick={onNext} disabled={!blueprint || running}
          className="rounded-xl bg-green px-7 py-3.5 text-[15.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l disabled:opacity-40">
          Looks good, let's build →
        </button>
      </div>
    </div>
  );
}
