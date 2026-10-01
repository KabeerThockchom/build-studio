import { useState, useEffect } from "react";
import { Check, Copy, Sparkles, Lightbulb, ExternalLink, PartyPopper, ArrowRight, FolderCheck, HelpCircle, AppWindow } from "lucide-react";
import type { BuildPlan, BuildStep } from "../lib/types";
import { APPS } from "../lib/constants";

// Which tool builds a step: Genie App Builder for the app, Genie Code for everything else.
export const stepTool = (s: BuildStep) => s.tool || (s.capability === APPS ? "app_builder" : "genie_code");
import { GeneratingPanel } from "./GeneratingPanel";
import { VideoEmbed } from "./VideoEmbed";

interface Props {
  plan: BuildPlan | null;
  loading: boolean;
  stepIdx: number;
  done: number[];
  publishedDir?: string | null;        // workspace folder the project doc was written to
  publishedDeepLink?: string | null;   // clickable URL straight to PROJECT.md
  entered: boolean;                    // left the overview for step 1 (lifted so the rail can follow)
  onEnter: () => void;
  onStep: (i: number) => void;
  onComplete: (n: number) => void;
  onBack: () => void;
}

// First sentence of a step's concept, for the one-line roadmap summaries on the overview.
const firstSentence = (t: string) => (t || "").match(/^.*?[.!?](\s|$)/)?.[0].trim() || (t || "");

export function BuildScreen({ plan, loading, stepIdx, done, publishedDir, publishedDeepLink, entered, onEnter, onStep, onComplete, onBack }: Props) {
  // After everything's done we show a real completion screen; "review" drops back in.
  const [reviewing, setReviewing] = useState(false);

  // Intro phase: the build is still generating OR it's ready and waiting for the user.
  // The video sits BELOW the status and stays mounted across both, so it keeps playing
  // until the user themselves clicks "Start building" — their decision, not ours.
  if (!entered) {
    const ready = !loading && !!plan;
    const hasApp = !!plan?.steps.some((s) => stepTool(s) === "app_builder");
    return (
      <div className="rise max-w-[760px]">
        <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Build · overview</div>
        <h2 className="mb-4 text-[29px] font-extrabold leading-tight text-navy">
          {ready ? "Here's your build, step by step." : "Planning your build…"}
        </h2>
        {!ready && (
          <GeneratingPanel
            intervalMs={11000}
            steps={["Reading your approved plan",
                    "Writing your project spec for Genie Code",
                    "Baking in the build practices",
                    "Still working, hang tight, almost there"]}
            note="Writing the full project spec Genie Code will build from: the plan, the steps, and the practices to follow. This can take up to a minute."
            quiz={{ q: "Where does the actual building happen?",
                    options: ["Inside this setup app", "On your local laptop", "In Genie Code, in your Databricks workspace"],
                    answer: 2, why: "This app writes the plan and the prompts. Genie Code, in your Databricks workspace, does the building." }} />
        )}
        {ready && plan && (
          <>
            <p className="mb-5 max-w-[62ch] text-[16px] leading-relaxed text-navy-2">
              You'll build it one step at a time{hasApp ? ": the data and pieces in Genie Code, then the app in Genie App Builder" : " in Genie Code"}.
              Here's the whole path, and what to set up before step 1.
            </p>

            {/* One-time setup: open the plan + open Genie Code. This used to nag every step. */}
            <div className="mb-5 rounded-2xl border-[1.5px] border-green bg-green-soft px-5 py-4">
              <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-green-ink">Set up first (once)</div>
              <ol className="flex flex-col gap-3">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green text-white text-[11px] font-bold">1</span>
                  <div className="text-[14px] leading-snug text-navy">
                    <b>Open your plan and skim it</b>, so you know what you're building. It's the full spec Genie Code will follow.
                    {publishedDeepLink && (
                      <a href={publishedDeepLink} target="_blank" rel="noreferrer"
                        className="ml-1 inline-flex items-center gap-1 font-semibold text-green-ink underline decoration-green/40 hover:decoration-green">
                        <ExternalLink className="h-3.5 w-3.5" /> Open PROJECT.md
                      </a>
                    )}
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green text-white text-[11px] font-bold">2</span>
                  <div className="text-[14px] leading-snug text-navy">
                    <b>Open Genie Code in your workspace</b> and start one chat. Keep it open the whole way. You'll send each step there in order.
                  </div>
                </li>
                {hasApp && (
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green text-white text-[11px] font-bold">3</span>
                    <div className="text-[14px] leading-snug text-navy">
                      <b>Check Genie App Builder is on.</b> The app step uses it (Apps, then the Build tab). It's in Beta, so the workspace preview needs to be enabled; ask your facilitator if you don't see the Build tab.
                    </div>
                  </li>
                )}
              </ol>
            </div>

            {/* Roadmap: the steps + what each accomplishes. */}
            <div className="mb-6 rounded-2xl border border-line bg-white px-5 py-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-navy-3">The {plan.steps.length} steps</div>
              <ol className="flex flex-col gap-3">
                {plan.steps.map((s) => (
                  <li key={s.n} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-oat-2 text-[11px] font-bold text-navy-2">{s.n}</span>
                    <div>
                      <div className="text-[14.5px] font-bold text-navy">{s.title}
                        <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-[10.5px] font-bold ${stepTool(s) === "app_builder" ? "bg-[#e6f2f6] text-[#1f6480]" : "bg-oat text-navy-3"}`}>
                          {stepTool(s) === "app_builder" ? "Genie App Builder" : "Genie Code"}
                        </span>
                      </div>
                      <div className="text-[13px] leading-snug text-navy-3">{firstSentence(s.concept)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <button onClick={onEnter}
              className="tl-glow inline-flex items-center gap-2 rounded-xl bg-green px-7 py-3.5 text-[15.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l">
              Start building. Go to step 1 →
            </button>
          </>
        )}

        {/* Meet Genie Code — sits below the status and stays MOUNTED across both the
            planning and ready states, so it keeps playing until the user starts step 1. */}
        <div className="mt-8 max-w-[640px] border-t border-line pt-6">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-navy-3">Meet Genie Code</div>
          <VideoEmbed id="heouBA5U1bE" title="Intro to Genie Code"
            sub="The AI coding agent you'll build with. You describe what you want in plain words; it writes and runs the work in your workspace." />
        </div>
      </div>
    );
  }

  if (!plan) return null;  // safety: entered is only reachable with a plan present
  const steps = plan.steps;
  const step = steps[stepIdx];
  if (!step) return null;  // defensive: guards against a transient stepIdx/plan desync
  const allDone = done.length >= steps.length;

  // Everything built — a real finish, not an inline emoji.
  if (allDone && !reviewing) {
    return <CompletionScreen steps={steps}
      onReview={() => { setReviewing(true); onStep(0); }} onBack={onBack} />;
  }

  const isDone = done.includes(step.n);
  const isData = step.capability === "data" || step.n === 1;
  const completeStep = () => { onComplete(step.n); if (stepIdx < steps.length - 1) onStep(stepIdx + 1); };

  return (
    <div className="rise mx-auto max-w-[760px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">
        Build · step {stepIdx + 1} of {steps.length}
      </div>

      {/* step pills */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {steps.map((s, i) => {
          const d = done.includes(s.n), cur = i === stepIdx;
          return (
            <button key={s.n} onClick={() => onStep(i)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors
                ${cur ? "bg-navy text-white" : d ? "bg-green-soft text-green-ink" : "bg-white text-navy-2 border border-line"}`}>
              <span className="grid h-4 w-4 place-items-center rounded-full text-[9px]"
                style={{ background: d ? "#00A870" : cur ? "rgba(255,255,255,.2)" : "#EEEDE9", color: d || cur ? "#fff" : "#5A8A9A" }}>
                {d ? "✓" : s.n}
              </span>
              {s.title.length > 22 ? s.title.slice(0, 20) + "…" : s.title}
            </button>
          );
        })}
      </div>

      {publishedDir && <ProjectSavedNote dir={publishedDir} deepLink={publishedDeepLink} compact />}

      {stepIdx === 0 && stepTool(step) === "genie_code" && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-line bg-oat/60 px-4 py-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-green" />
          <div className="text-[13.5px] leading-snug text-navy-2">
            <b className="text-navy">How this works:</b> with your plan open and one Genie Code chat going, each
            step is the same rhythm: prompt Genie Code in your own words, then confirm the result before the
            next one. Genie Code does the technical part. You don't write any code.
          </div>
        </div>
      )}

      <div className="mb-1 flex items-center gap-2 text-[12px] font-bold text-navy-3">
        {stepTool(step) === "app_builder" ? <><AppWindow className="h-4 w-4 text-[#1f6480]" /> Built with Genie App Builder</> : <><Sparkles className="h-4 w-4 text-green" /> Built with Genie Code</>}
      </div>
      <h2 className="mb-1.5 text-[27px] font-extrabold leading-[1.12] tracking-[-0.02em] text-navy">{step.title}</h2>

      <section className="mt-4 rounded-2xl border border-line bg-white px-6 py-5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-navy-3">What you're doing &amp; why</div>
        <p className="text-[15.5px] leading-relaxed text-navy-2">{step.concept}</p>
        {step.teach && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-amber/40 bg-[#fffdf7] px-3.5 py-2.5">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
            <div className="text-[13px] leading-snug text-navy-2">{step.teach}</div>
          </div>
        )}
      </section>

      {/* The sub-step walker: open the plan -> prompt in your own words -> (explore, for the
          data step) -> confirm. One sub-step at a time (progressive disclosure). */}
      <StepWalker key={step.n} step={step} isData={isData} isDone={isDone}
        publishedDir={publishedDir} onCompleteStep={completeStep} />

      <div className="mt-8 flex items-center justify-between">
        <button onClick={stepIdx === 0 ? onBack : () => onStep(stepIdx - 1)}
          className="text-[14px] font-semibold text-navy-3 hover:text-navy">← {stepIdx === 0 ? "Your plan" : "Previous"}</button>
        {isDone && stepIdx < steps.length - 1 && (
          <button onClick={() => onStep(stepIdx + 1)}
            className="rounded-xl bg-green px-6 py-3 text-[15px] font-bold text-white hover:bg-green-l">Next step →</button>
        )}
      </div>
    </div>
  );
}

// A real finish line — a recap of what they stood up and honest next steps, instead
// of an inline emoji you could hit without doing anything.
function CompletionScreen({ steps, onReview, onBack }: { steps: BuildStep[]; onReview: () => void; onBack: () => void }) {
  const NEXT = [
    "Open your app and use it the way the people it's for would.",
    "Show it to a colleague. It's the fastest way to find what to improve.",
    "Keep going in Genie Code: ask it for one change at a time, the same way you built it.",
    "When you're ready, swap the sample data for your real tables.",
  ];
  return (
    <div className="rise max-w-[760px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Build · complete</div>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-green-soft text-green"><PartyPopper className="h-6 w-6" /></span>
        <h2 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.025em] text-navy">You built it.</h2>
      </div>
      <p className="mt-4 max-w-[58ch] text-[16.5px] leading-relaxed text-navy-2">
        You went from an idea to a working build, one step at a time. Here's what you stood up today.
      </p>

      <div className="mt-6 rounded-2xl border border-line bg-white px-6 py-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-navy-3">What you built</div>
        <ul className="flex flex-col gap-2.5">
          {steps.map((s) => (
            <li key={s.n} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-navy">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-green text-white text-[10px]">✓</span>
              {s.title}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-oat/50 px-6 py-5">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-green-ink">
          <ArrowRight className="h-4 w-4" /> Where to go next
        </div>
        <ul className="flex flex-col gap-2">
          {NEXT.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-[14px] leading-snug text-navy-2">
              <span className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-green" />{n}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button onClick={onBack} className="text-[14px] font-semibold text-navy-3 hover:text-navy">← Back to your plan</button>
        <button onClick={onReview}
          className="rounded-xl border border-line bg-white px-6 py-3 text-[15px] font-bold text-navy-2 hover:border-green hover:text-green-ink">Review the steps</button>
      </div>
    </div>
  );
}

// The per-step sub-step walker (main column, no right pane). Progressive disclosure:
// open the plan -> prompt Genie Code in your own words (help reveal) -> explore (data step
// only) -> confirm it worked. One sub-step at a time. Learning already happened in the
// Learn phase, so there's no per-step learning module here anymore.
const SUB_LABELS: Record<string, string> = {
  prompt: "Prompt Genie Code", explore: "Explore what it made", confirm: "Confirm it worked",
  open: "Open Genie App Builder", describe: "Paste your app prompt", iterate: "Refine it in short cycles",
};

function StepWalker({ step, isData, isDone, publishedDir, onCompleteStep }:
  { step: BuildStep; isData: boolean; isDone: boolean;
    publishedDir?: string | null; onCompleteStep: () => void }) {
  const app = stepTool(step) === "app_builder";
  const subs = app ? ["open", "describe", "iterate", "confirm"] : ["prompt", ...(isData ? ["explore"] : []), "confirm"];
  const [idx, setIdx] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rows, setRows] = useState("");
  useEffect(() => { setIdx(0); setShowHelp(false); setCopied(false); setRows(""); }, [step.n]);

  const prdRef = publishedDir ? `${publishedDir}/PROJECT.md` : "PROJECT.md in your project folder";
  const pasteText = step.move.replace(/__PROJECT_MD__/g, prdRef);
  const copy = () => { navigator.clipboard?.writeText(pasteText); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  const goal = step.title.replace(/\.$/, "").toLowerCase();
  const advance = () => setIdx((i) => i + 1);

  // Revisiting an already-completed step: a calm summary, not the interactive walker.
  if (isDone) {
    return (
      <div className="mt-5 rounded-2xl border-[1.5px] border-green bg-green-soft px-5 py-4">
        <div className="flex items-center gap-2 text-[14px] font-bold text-navy">
          <Check className="h-4 w-4 text-green" /> You marked this step done.
        </div>
        <div className="mt-1.5 text-[13.5px] leading-snug text-navy-2"><b>It worked when:</b> {step.verify}</div>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-2.5">
      {subs.map((key, i) => {
        const done = i < idx;
        if (i > idx) {  // not revealed yet
          return (
            <div key={key} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-2.5 opacity-45">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-line-2 text-[10px] font-bold text-navy-3">{i + 1}</span>
              <span className="text-[13.5px] font-semibold text-navy-3">{SUB_LABELS[key]}</span>
            </div>
          );
        }
        return (
          <div key={key} className={`rounded-xl border-[1.5px] px-4 py-3.5 ${done ? "border-line bg-white" : "border-green bg-green-soft/60"}`}>
            <div className="flex items-center gap-2.5">
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${done ? "bg-green text-white" : "border-2 border-green text-green-ink"}`}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={`text-[13.5px] font-bold ${done ? "text-navy-3" : "text-navy"}`}>{SUB_LABELS[key]}</span>
            </div>
            {i === idx && (
              <div className="mt-2.5 pl-[30px]">
                {key === "prompt" && (
                  <>
                    <p className="text-[14px] leading-relaxed text-navy-2">
                      In your Genie Code chat, ask it in your own words to <b className="text-navy">{goal}</b>. Point it at your plan each step, open <b className="text-navy">PROJECT.md</b> or say "follow my plan in PROJECT.md", so it has the details. Your exact wording doesn't matter; the plan carries the specifics. Don't assume it remembers the plan from earlier, refer back to it every step.
                    </p>
                    {!showHelp ? (
                      <button onClick={() => setShowHelp(true)} className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-green-ink hover:text-green">
                        <HelpCircle className="h-3.5 w-3.5" /> I need help prompting Genie Code
                      </button>
                    ) : (
                      <div className="relative mt-2.5 rounded-xl border-[1.5px] border-dashed border-green/50 bg-white px-3.5 py-3">
                        <button onClick={copy} className="absolute right-3 top-2.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-navy-3 hover:text-green-ink">
                          {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                        </button>
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-green-ink">Example prompt (yours to reword)</div>
                        <div className="font-mono text-[12px] leading-relaxed text-navy whitespace-pre-wrap">{pasteText}</div>
                      </div>
                    )}
                    <div className="mt-3"><button onClick={advance} className="rounded-lg bg-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-navy-2">I prompted it →</button></div>
                  </>
                )}
                {key === "open" && (
                  <>
                    <p className="text-[14px] leading-relaxed text-navy-2">
                      In your workspace, open <b className="text-navy">Apps</b>, then the <b className="text-navy">Build</b> tab. That's Genie App Builder.
                      Choose your <b className="text-navy">App Space</b> (or create one) so the app lands next to your data.
                    </p>
                    <div className="mt-2.5 rounded-lg border border-dashed border-amber/50 bg-[#fffdf7] px-3 py-2 text-[12.5px] leading-snug text-navy-2">
                      Genie App Builder is in Beta, so the workspace preview needs to be enabled. No Build tab? Ask your facilitator to turn it on.
                    </div>
                    <div className="mt-3"><button onClick={advance} className="rounded-lg bg-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-navy-2">It's open →</button></div>
                  </>
                )}
                {key === "describe" && (
                  <>
                    <p className="text-[14px] leading-relaxed text-navy-2">Paste this prompt. It describes your screens in plain language, from your plan. Reword anything you like.</p>
                    <div className="relative mt-2.5 rounded-xl border-[1.5px] border-[#b6d6e2] bg-white px-3.5 py-3">
                      <button onClick={copy} className="absolute right-3 top-2.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-navy-3 hover:text-[#1f6480]">
                        {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                      </button>
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#1f6480]">Your app prompt</div>
                      <div className="text-[13px] leading-relaxed text-navy whitespace-pre-wrap">{pasteText}</div>
                    </div>
                    <div className="mt-3"><button onClick={advance} className="rounded-lg bg-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-navy-2">I pasted it →</button></div>
                  </>
                )}
                {key === "iterate" && (
                  <>
                    <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-navy-2">
                      <li className="flex items-start gap-2"><span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#2E7D9A]" />Short cycles: ask for one change at a time, check it, then the next.</li>
                      <li className="flex items-start gap-2"><span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#2E7D9A]" />Be specific about screens: what it opens on, what each row shows, what each button does.</li>
                      <li className="flex items-start gap-2"><span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#2E7D9A]" />Name the tables it should read and the Lakebase table it should save to, exactly as in your plan.</li>
                    </ul>
                    <div className="mt-3"><button onClick={advance} className="rounded-lg bg-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-navy-2">It's looking right →</button></div>
                  </>
                )}
                {key === "explore" && (
                  <>
                    <p className="text-[14px] leading-relaxed text-navy-2">
                      Go to the catalog in your workspace, find your schema, and look at what got created. See how the tables connect and what a single row means. It makes your next prompts sharper.
                    </p>
                    <label className="mt-3 block text-[13px] font-semibold text-navy">How many rows are in your data? <span className="font-normal text-navy-3">(just a quick look, we don't check it)</span></label>
                    <input value={rows} onChange={(e) => setRows(e.target.value)} inputMode="numeric" placeholder="e.g. 5,000"
                      className="mt-1.5 w-40 rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[14px] text-navy outline-none focus:border-green focus:ring-[3px] focus:ring-green-soft" />
                    <div className="mt-3"><button onClick={advance} className="rounded-lg bg-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-navy-2">Done exploring →</button></div>
                  </>
                )}
                {key === "confirm" && (
                  <>
                    <div className="flex items-start gap-2 text-[14px] leading-snug text-navy"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green" /><span><b>You'll know it worked when:</b> {step.verify}</span></div>
                    <div className="mt-3"><button onClick={onCompleteStep} className="rounded-lg bg-green px-5 py-2.5 text-[14px] font-bold text-white hover:bg-green-l">Yes, that worked ✓</button></div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// A quiet reference note: the full project spec is also saved to the workspace, so a
// participant can reopen it (and it survives if the app dies). This is NOT the build path —
// the steps are — so there's no "build it all" prompt here, just a link to the saved spec.
function ProjectSavedNote({ dir, deepLink, compact }: { dir: string; deepLink?: string | null; compact?: boolean }) {
  if (compact) {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-2.5">
        <FolderCheck className="h-4 w-4 shrink-0 text-green" />
        <div className="min-w-0 flex-1 text-[12.5px] text-navy-2">
          Your full project spec is saved: <code className="break-all text-[11.5px] text-navy-3">{dir}/PROJECT.md</code>
        </div>
        {deepLink && (
          <a href={deepLink} target="_blank" rel="noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-navy-2 hover:border-green hover:text-green-ink">
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-5 py-3.5">
      <FolderCheck className="h-4 w-4 shrink-0 text-green" />
      <div className="min-w-0 flex-1 text-[13px] leading-snug text-navy-2">
        Your full project spec is saved in your workspace, so you can reopen it any time.
        <code className="ml-1 break-all text-[11.5px] text-navy-3">{dir}/PROJECT.md</code>
      </div>
      {deepLink && (
        <a href={deepLink} target="_blank" rel="noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-navy-2 hover:border-green hover:text-green-ink">
          <ExternalLink className="h-3.5 w-3.5" /> Open your project
        </a>
      )}
    </div>
  );
}

