import { useState, useEffect } from "react";
import { Check, Copy, Send, Sparkles, Lightbulb, GraduationCap, ExternalLink, BookOpen, X, PartyPopper, ArrowRight } from "lucide-react";
import type { BuildPlan, BuildStep } from "../lib/types";
import { CONCEPTS } from "../lib/learn";
import { GeneratingPanel } from "./GeneratingPanel";
import { VideoEmbed } from "./VideoEmbed";

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
  // Confirm gate: "I did this" opens a check tied to the step's verify condition, so
  // people actually look at whether it worked instead of clicking straight through.
  const [confirming, setConfirming] = useState(false);
  // After everything's done we show a real completion screen; "review" drops back in.
  const [reviewing, setReviewing] = useState(false);
  // Whether the user has chosen to leave the intro and start step 1. We never auto-advance
  // into the steps — that used to cut off the Genie Code video the moment the plan was ready.
  // Skip the gate for someone already mid-build (returning to this screen).
  const [entered, setEntered] = useState(() => done.length > 0);
  useEffect(() => { setConfirming(false); }, [stepIdx]);  // reset the gate when the step changes

  // Intro phase: the build is still generating OR it's ready and waiting for the user.
  // The video sits BELOW the status and stays mounted across both, so it keeps playing
  // until the user themselves clicks "Start building" — their decision, not ours.
  if (!entered) {
    const ready = !loading && !!plan;
    return (
      <div className="rise max-w-[680px]">
        <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Build</div>
        <h2 className="mb-5 text-[29px] font-extrabold leading-tight text-navy">
          {ready ? "Your build is ready when you are." : "Planning your build…"}
        </h2>
        {ready ? (
          <div className="rounded-2xl border-[1.5px] border-green bg-green-soft px-6 py-5">
            <div className="flex items-center gap-2 text-[15.5px] font-bold text-navy">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green text-white text-[11px]">✓</span>
              Your step-by-step build plan is ready.
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-navy-2">
              No rush — finish the video below if you're mid-watch. Start step 1 whenever you're ready.
            </p>
            <button onClick={() => setEntered(true)}
              className="tl-glow mt-4 inline-flex items-center gap-2 rounded-xl bg-green px-7 py-3.5 text-[15.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l">
              Start building — go to step 1 →
            </button>
          </div>
        ) : (
          <GeneratingPanel
            intervalMs={11000}
            steps={["Reading your approved plan",
                    "Ordering the build into safe steps",
                    "Writing what to paste into Genie Code",
                    "Still working — hang tight, almost there"]}
            note="Breaking your blueprint into bite-sized steps you can follow one at a time. This can take up to a minute." />
        )}
        <div className="mt-4">
          <VideoEmbed id="heouBA5U1bE" title="Intro to Genie Code"
            sub="The tool you'll build with in a moment. Worth a watch while you wait." />
        </div>
      </div>
    );
  }

  if (!plan) return null;  // safety: entered is only reachable with a plan present
  const steps = plan.steps;
  const step = steps[stepIdx];
  const allDone = done.length >= steps.length;

  // Everything built — a real finish, not an inline emoji.
  if (allDone && !reviewing) {
    return <CompletionScreen steps={steps}
      onReview={() => { setReviewing(true); onStep(0); }} onBack={onBack} />;
  }

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

        {stepIdx === 0 && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-line bg-oat/60 px-4 py-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-green" />
            <div className="text-[13.5px] leading-snug text-navy-2">
              <b className="text-navy">How this works:</b> each step gives you one thing to paste into Genie Code
              (the assistant in your workspace, on the right). It does the technical part; you read the result and
              confirm it worked before moving on. You don't need to write any code.
            </div>
          </div>
        )}

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

        {/* Learning-during-waits: this step runs in Genie Code for minutes — fill
            the wait with the durable concept + a quick check, keyed to the step. */}
        <WhileItRuns key={step.n} capability={step.capability} />

        {/* Confirm gate — clicking "I did this" asks them to actually check the verify
            condition before it counts, instead of clicking straight through. */}
        {confirming && !done.includes(step.n) && (
          <div className="mt-6 rounded-2xl border-[1.5px] border-green bg-green-soft px-5 py-4">
            <div className="text-[14px] font-bold text-navy">Before you move on — did it work?</div>
            <div className="mt-1.5 flex items-start gap-2 text-[13.5px] leading-snug text-navy-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green" />{step.verify}
            </div>
            <div className="mt-3.5 flex items-center gap-2.5">
              <button onClick={() => { onComplete(step.n); setConfirming(false); if (stepIdx < steps.length - 1) onStep(stepIdx + 1); }}
                className="rounded-xl bg-green px-5 py-2.5 text-[14px] font-bold text-white hover:bg-green-l">Yes, that worked →</button>
              <button onClick={() => setConfirming(false)}
                className="rounded-xl border border-line bg-white px-4 py-2.5 text-[14px] font-semibold text-navy-2 hover:border-navy-3">Not yet — still working on it</button>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button onClick={stepIdx === 0 ? onBack : () => onStep(stepIdx - 1)}
            className="text-[14px] font-semibold text-navy-3 hover:text-navy">← {stepIdx === 0 ? "Blueprint" : "Previous"}</button>
          <div className="flex items-center gap-3">
            {!done.includes(step.n) && !confirming && (
              <button onClick={() => setConfirming(true)}
                className="rounded-xl bg-green px-6 py-3 text-[15px] font-bold text-white hover:bg-green-l">I did this →</button>
            )}
            {done.includes(step.n) && (
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-green-ink"><Check className="h-4 w-4" /> Done</span>
            )}
            {done.includes(step.n) && stepIdx < steps.length - 1 && (
              <button onClick={() => onStep(stepIdx + 1)}
                className="rounded-xl bg-green px-6 py-3 text-[15px] font-bold text-white hover:bg-green-l">Next step →</button>
            )}
          </div>
        </div>
      </div>

      {/* right: simulated Genie Code panel */}
      <GeniePanel step={step} />
    </div>
  );
}

// A real finish line — a recap of what they stood up and honest next steps, instead
// of an inline emoji you could hit without doing anything.
function CompletionScreen({ steps, onReview, onBack }: { steps: BuildStep[]; onReview: () => void; onBack: () => void }) {
  const NEXT = [
    "Open your app and use it the way the people it's for would.",
    "Show it to a colleague — the fastest way to find what to improve.",
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
        <button onClick={onBack} className="text-[14px] font-semibold text-navy-3 hover:text-navy">← Back to blueprint</button>
        <button onClick={onReview}
          className="rounded-xl border border-line bg-white px-6 py-3 text-[15px] font-bold text-navy-2 hover:border-green hover:text-green-ink">Review the steps</button>
      </div>
    </div>
  );
}

// While a step runs in Genie Code (minutes), offer the durable concept behind it +
// a quick check + docs to go deeper. Collapsed by default so it doesn't crowd the
// action; expand while you wait.
function WhileItRuns({ capability }: { capability: string }) {
  const card = CONCEPTS[capability];
  const [open, setOpen] = useState(false);
  if (!card) return null;
  return (
    <div className="mt-4 rounded-2xl border border-line bg-white overflow-hidden">
      <button onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-oat/50">
        <GraduationCap className="h-4 w-4 shrink-0 text-green" />
        <span className="text-[13.5px] font-bold text-navy">While this runs — {card.title}</span>
        <span className="ml-auto text-[12px] font-semibold text-green-ink">{open ? "Hide" : "Learn"}</span>
      </button>
      {open && (
        <div className="border-t border-line px-4 py-4">
          <p className="text-[14px] leading-relaxed text-navy-2">{card.deeper}</p>
          <MiniQuiz card={card} />
          {card.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {card.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-navy-2 hover:border-green hover:text-green-ink">
                  {l.kind === "watch" ? <ExternalLink className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniQuiz({ card }: { card: (typeof CONCEPTS)[string] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  return (
    <div className="mt-3.5 rounded-xl bg-oat px-4 py-3.5">
      <div className="mb-2.5 text-[13.5px] font-semibold text-navy">{card.quiz.q}</div>
      <div className="flex flex-col gap-2">
        {card.quiz.options.map((opt, i) => {
          const isCorrect = i === card.quiz.answer;
          const show = answered && (picked === i || isCorrect);
          return (
            <button key={i} disabled={answered} onClick={() => setPicked(i)}
              className={`flex items-center gap-2 rounded-lg border-[1.5px] px-3 py-2 text-left text-[13px] transition-colors
                ${!answered ? "border-line bg-white hover:border-green text-navy"
                  : show && isCorrect ? "border-green bg-green-soft text-navy"
                  : picked === i ? "border-lava/40 bg-[#fdecef] text-navy" : "border-line bg-white text-navy-3 opacity-60"}`}>
              {answered && show && (isCorrect ? <Check className="h-3.5 w-3.5 shrink-0 text-green" /> : <X className="h-3.5 w-3.5 shrink-0 text-lava" />)}
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-2.5 flex items-start gap-2 text-[12.5px] leading-snug text-navy-2">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green" />{card.quiz.why}
        </div>
      )}
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
        Genie Code is the assistant built into your Databricks workspace. Open it in a new
        Agent chat and paste the step below. It runs the work for you, already signed in.
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
      {/* An illustrative preview of the real Genie Code composer — deliberately inert
          (a tester tried to type here). Labeled so it doesn't read as a live input. */}
      <div className="m-4 mt-1 flex items-center justify-between gap-2.5 rounded-xl border border-dashed border-white/10 bg-white/5 px-3.5 py-2.5 opacity-60">
        <span className="text-[12.5px] italic text-[#5a7079]">You'll type here in the real Genie Code</span>
        <span className="grid h-6 w-6 place-items-center rounded-md bg-white/10"><Send className="h-3 w-3 text-[#5a7079]" /></span>
      </div>
      <div className="flex items-center gap-1.5 border-t border-white/10 px-4 py-2.5 text-[11px] text-[#5a7079]">
        <Sparkles className="h-3 w-3" /> This panel is a preview. You'll do this in Genie Code, in your workspace — already signed in.
      </div>
    </aside>
  );
}
