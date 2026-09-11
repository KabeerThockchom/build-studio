import { useState, useEffect } from "react";
import { Target, ShieldCheck, RefreshCw, ClipboardList, Check, X, Sparkles, ChevronRight, ChevronLeft, AlertTriangle, RotateCw } from "lucide-react";
import { VideoEmbed } from "./VideoEmbed";
import type { IdeaCheck } from "../lib/types";

/* The teaching sequence that plays while the SA authors the design questions in
   the background. Instead of a long scroll, it's a focused deck: ONE beat at a
   time, tap to advance. It opens by framing the moment — we're understanding
   your intent and will ask a few design questions; here's the path we'll take —
   then walks the mindset, the working habits, and the Databricks pieces. A
   persistent status strip shows when the questions are ready and lets the user
   jump straight in; the final beat's CTA lights up the moment they land. */

interface Props {
  idea: string;
  expertise: string;          // "New to it" | "Familiar" | "Advanced" — tunes the primer depth
  planning: boolean;          // SA still authoring the tailored questions
  ready: boolean;             // questions have landed
  ideaChecking: boolean;      // the stress-test is running
  ideaCheck: IdeaCheck | null;// advisory read of the idea (null until it lands)
  onReviseIdea: (v: string) => void;  // save an edited idea from the criteria beat
  onRecheck: (v: string) => void;     // re-run the stress-test on the edited idea
  onProceed: () => void;      // leaving the criteria beat: kick off design-question generation
  onEnter: () => void;        // go to the design questions
}

const ROADMAP = [
  { k: "Shape", t: "your idea", done: true },
  { k: "Design", t: "a few quick choices", done: false },
  { k: "Assemble", t: "pick the pieces", done: false },
  { k: "Blueprint", t: "your plan, one page", done: false },
  { k: "Build", t: "step by step", done: false },
];

const TIPS = [
  { icon: Target, tag: "Be specific",
    title: "Specific beats verbose.",
    body: "Name the real thing: the table, the metric, who looks at it. The clearer your intent, the closer the first result lands.",
    aside: '"Flag stores whose weekly sales dropped >15% vs last month" › "make it better"' },
  { icon: ShieldCheck, tag: "Trust, but verify",
    title: "Read what it built.",
    body: "It writes real code and runs it on real data, fast and usually right. But you're the one who ships it, so glance at each step and confirm the number makes sense.",
    aside: "You stay the reviewer. It does the typing." },
  { icon: RefreshCw, tag: "Iteration is the point",
    title: "The first pass is a draft.",
    body: "Nobody nails it in one prompt. Say what's off, like \"group by region, not store,\" and go again. Small corrections compound into what you pictured.",
    aside: "Steer in small nudges, not one giant prompt." },
  { icon: ClipboardList, tag: "Plan before you build",
    title: "Write the plan first.",
    body: "Before it builds, get the agent to lay out what it's going to do, a short plan you can read. That's exactly what the PRD is later, and it's the difference between a build that lands and one that wanders.",
    aside: '"Plan it out first, then build" › jumping straight to code' },
];

// ── The beats (one idea per view) ──────────────────────────────────────────
function BeatOrient({ idea }: { idea: string }) {
  const idea1 = idea.trim().length > 0 && idea.trim().length <= 80 ? idea.trim() : "";
  return (
    <div>
      <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">While your questions load</div>
      <h1 className="text-[38px] font-extrabold leading-[1.08] tracking-[-0.03em] text-navy">
        We're reading your idea and tailoring a few design questions.
      </h1>
      <p className="mt-5 max-w-[54ch] text-[17px] leading-relaxed text-navy-2">
        {idea1
          ? <>Give us a few seconds with <span className="font-semibold text-navy">"{idea1}"</span>. While we do, here's the path we'll take together, and a couple of things worth knowing first.</>
          : <>Give us a few seconds. While we do, here's the path we'll take together, and a couple of things worth knowing first.</>}
      </p>
      {/* the workshop path */}
      <div className="mt-8 flex flex-wrap items-stretch gap-2">
        {ROADMAP.map((r, i) => (
          <div key={r.k} className="flex items-center gap-2">
            <div className={`rounded-xl border px-3.5 py-2.5 ${r.done ? "border-green bg-green-soft" : "border-line bg-white"}`}>
              <div className="flex items-center gap-1.5">
                {r.done && <span className="grid h-4 w-4 place-items-center rounded-full bg-green text-white"><Check className="h-2.5 w-2.5" /></span>}
                <b className={`text-[13.5px] font-bold ${r.done ? "text-green-ink" : "text-navy"}`}>{r.k}</b>
              </div>
              <div className="mt-0.5 text-[11.5px] text-navy-3">{r.t}</div>
            </div>
            {i < ROADMAP.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-line-2" />}
          </div>
        ))}
      </div>
      {/* Optional orientation while the questions come back — new to Databricks? 3 min. */}
      <div className="mt-8">
        <VideoEmbed id="jBy-qUsU1sw" title="Databricks in 3 minutes"
          sub="New to Databricks? The whole platform, quickly." short eyebrow="New here? Watch this" />
      </div>
    </div>
  );
}

function BeatMindset() {
  return (
    <div>
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">The shift</div>
      <h1 className="text-[38px] font-extrabold leading-[1.06] tracking-[-0.03em] text-navy">
        You're the architect,<br />not the bricklayer.
      </h1>
      <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-navy-2">
        The agent handles the syntax and plumbing now. Your job is the part only you can do:
        deciding <span className="font-semibold text-navy">what</span> is worth building.
      </p>
      <div className="mt-7 grid grid-cols-2 gap-3.5">
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-navy-3">The old bottleneck</div>
          <div className="text-[16px] font-bold text-navy-2 line-through decoration-line-2 decoration-2">How do I build it?</div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-navy-3">Which library, what schema, why won't this join run. Hours on plumbing before you learn anything.</p>
        </div>
        <div className="rounded-2xl border-[1.5px] border-green bg-green-soft p-5">
          <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-green-ink">The new one</div>
          <div className="text-[16px] font-extrabold text-navy">What should I build?</div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-navy-2">Who's it for, what decision it drives, the one thing it must get right. Clarity of vision is the work now.</p>
        </div>
      </div>
    </div>
  );
}

function BeatHabits() {
  return (
    <div>
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">How to work with it</div>
      <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-[-0.025em] text-navy">Four habits that make the difference.</h1>
      <div className="mt-6 flex flex-col gap-3">
        {TIPS.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.tag} className="flex gap-4 rounded-2xl border border-line bg-white p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green-soft text-green">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-green-ink">{t.tag}</div>
                <h3 className="mt-0.5 text-[16.5px] font-extrabold tracking-[-0.01em] text-navy">{t.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-navy-2">{t.body}</p>
                <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-oat px-3 py-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green" />
                  <span className="font-mono text-[12px] leading-snug text-navy-2">{t.aside}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The stress-test beat: an advisory read of the idea against what a good build
// description needs. The check ran in the background during the earlier beats, so it's
// usually ready by the time you land here. Weak ideas get a visible nudge + an inline
// place to tighten them — but you can always continue (Next). Passing this beat is what
// kicks off design-question generation, which the quiz beat then covers.
function BeatCriteria({ idea, checking, check, onReviseIdea, onRecheck }:
  { idea: string; checking: boolean; check: IdeaCheck | null;
    onReviseIdea: (v: string) => void; onRecheck: (v: string) => void }) {
  const [draft, setDraft] = useState(idea);
  const weak = !!check && !check.strong;
  return (
    <div>
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Sharpen your idea</div>
      <h1 className="text-[34px] font-extrabold leading-[1.08] tracking-[-0.025em] text-navy">Let's pressure-test your idea.</h1>
      <p className="mt-4 max-w-[54ch] text-[16.5px] leading-relaxed text-navy-2">
        A clear idea builds better. Here's a quick read on yours. Tighten anything thin, or continue as it is.
      </p>

      {checking && !check ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-5 text-[14.5px] text-navy-2">
          <span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-green" style={{ animation: `dots 1.4s ${i * 0.16}s infinite ease-in-out` }} />)}</span>
          Reading your idea…
        </div>
      ) : check ? (
        <>
          <div className={`mt-6 rounded-2xl border-[1.5px] px-5 py-4 ${weak ? "border-amber/50 bg-[#fffdf7]" : "border-green bg-green-soft"}`}>
            <div className="flex items-center gap-2 text-[14px] font-bold text-navy">
              {weak ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber" /> : <Check className="h-4 w-4 shrink-0 text-green" />}
              {check.summary || (weak ? "A bit more detail will help this build land." : "Looks like a solid, buildable idea.")}
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {check.criteria.map((c) => (
                <li key={c.key} className="flex items-start gap-2.5 text-[13.5px] leading-snug">
                  {c.met
                    ? <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-green text-white text-[9px]">✓</span>
                    : <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber/20 text-amber"><AlertTriangle className="h-2.5 w-2.5" /></span>}
                  <span className={c.met ? "text-navy-2" : "text-navy"}>
                    <b className="font-semibold">{c.label}</b>
                    {!c.met && c.hint && <span className="text-navy-3">: {c.hint}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-white px-5 py-4">
            <div className="mb-2 text-[12.5px] font-bold text-navy">{weak ? "Tighten it up" : "Tweak it (optional)"}</div>
            <textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)}
              className="w-full resize-none rounded-xl border-[1.5px] border-line px-4 py-3 text-[14.5px] leading-relaxed text-navy outline-none focus:border-green focus:ring-[3px] focus:ring-green-soft" />
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => { onReviseIdea(draft); onRecheck(draft); }}
                disabled={checking || draft.trim().length < 12 || draft.trim() === idea.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-5 py-2.5 text-[14px] font-bold text-white hover:bg-navy-2 disabled:opacity-40">
                <RotateCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} /> Save &amp; re-check
              </button>
              <span className="text-[12.5px] text-navy-3">{weak ? "Or continue anyway with Next →" : "Happy with it? Continue with Next →"}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-white px-5 py-5 text-[14px] text-navy-3">
          We'll read your idea in a moment. Continue whenever you're ready.
        </div>
      )}
    </div>
  );
}

function BeatGenieCode() {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">
        What you'll build with today
      </div>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#00A870,#2BC48A)" }}>◆</span>
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.025em] text-navy">Meet Genie Code.</h1>
      </div>
      <p className="mt-4 max-w-[54ch] text-[17px] leading-relaxed text-navy-2">
        Genie Code is the AI coding agent built into your Databricks workspace. You describe what you
        want in plain words, and it writes and runs the work for you, right where your data lives. A
        table, a dashboard, an app. It's what you'll use to build your idea today.
      </p>

      {/* Real screen recording: how to open Genie Code from the workspace UI. Behaves like a
          gif (autoplay, muted, looped) so it plays inline without controls getting in the way. */}
      <figure className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        <video src="/genie-code.mp4" autoPlay loop muted playsInline
          className="block w-full" aria-label="Opening Genie Code from the Databricks workspace" />
        <figcaption className="border-t border-line px-4 py-2.5 text-[12.5px] text-navy-3">
          Opening Genie Code from your workspace. It lives right where your data and tables are.
        </figcaption>
      </figure>

      <p className="mt-4 text-[14px] leading-relaxed text-navy-3">
        Who it's for: anyone building something. You steer in plain language; it does the typing.
      </p>
    </div>
  );
}

// A quick check-your-understanding on what the previous beats taught. Not graded —
// just makes the learner wrestle with the material (Akil's ask) and reinforces the ideas.
// This quiz sits at the end of the primer and reinforces what the beats taught: one easy
// warm-up from the Databricks intro, then the working ideas (your role, specificity, verify,
// plan first). Genie is taught in Assemble now, so there's no Genie question here. Answers
// are mixed across positions on purpose, and a couple of the distractors are plausible so
// the questions actually make you think.
const QUIZ = [
  { q: "In the Databricks intro, what does the platform do first for a company?",
    options: ["Brings data from many separate systems into one governed place", "Replaces the company's email system", "Designs the company's website"],
    answer: 0, why: "Companies start with data spread across many systems. Databricks brings it into one governed place, and everything else builds on that." },
  { q: "You're building with a coding agent. Where does most of your value come from?",
    options: ["Writing the code faster than the agent can", "Memorizing the Databricks interface", "Deciding what's worth building and checking each result is right"],
    answer: 2, why: "The agent writes the code. Your job is choosing what to build and judging whether each result is actually right." },
  { q: "Which prompt gives the agent the best shot at building the right thing on the first try?",
    options: ["Build me a great analytics dashboard for the business", "Show weekly sales against target per store, and flag any store more than 15% under target", "Use all our data to find something useful"],
    answer: 1, why: "The first one sounds concrete but leaves what and who open. The second names the metric, the comparison, and the rule, so there's little left to guess." },
  { q: "Genie Code says it finished a step. What should you do before building on top of it?",
    options: ["Nothing. If it ran without an error, it's correct", "Re-run the same prompt to be safe", "Look at what it produced and check the result makes sense"],
    answer: 2, why: "It runs real code on real data and is usually right, but you're the one who ships it. Read the result before you build on it." },
  { q: "Why write a short plan (a PRD) before you start building?",
    options: ["So the agent builds the right thing instead of guessing, and you both agree on it first", "Because Databricks won't let you create tables without one", "So the work can be billed to the right team"],
    answer: 0, why: "A PRD is a short plan you write first. It's what you hand the agent, and it's the difference between a build that lands and one that wanders." },
];

function BeatQuiz() {
  const [picked, setPicked] = useState<Record<number, number>>({});
  return (
    <div>
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Quick check</div>
      <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.025em] text-navy">A few quick ones before we design.</h1>
      <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-navy-2">No grade. Just to make the ideas stick.</p>
      <div className="mt-6 flex flex-col gap-5">
        {QUIZ.map((item, qi) => {
          const chosen = picked[qi];
          const answered = chosen !== undefined;
          return (
            <div key={qi} className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-3 text-[15px] font-bold text-navy">{qi + 1}. {item.q}</div>
              <div className="flex flex-col gap-2">
                {item.options.map((opt, oi) => {
                  const isChosen = chosen === oi;
                  const isCorrect = oi === item.answer;
                  const show = answered && (isChosen || isCorrect);
                  return (
                    <button key={oi} disabled={answered}
                      onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                      className={`flex items-center gap-2.5 rounded-xl border-[1.5px] px-4 py-2.5 text-left text-[14px] transition-colors
                        ${!answered ? "border-line bg-white hover:border-green text-navy"
                          : show && isCorrect ? "border-green bg-green-soft text-navy"
                          : isChosen ? "border-lava/40 bg-[#fdecef] text-navy"
                          : "border-line bg-white text-navy-3 opacity-60"}`}>
                      {answered && show && (isCorrect
                        ? <Check className="h-4 w-4 shrink-0 text-green" />
                        : <X className="h-4 w-4 shrink-0 text-lava" />)}
                      {opt}
                    </button>
                  );
                })}
              </div>
              {answered && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-oat px-3.5 py-2.5 text-[13px] leading-snug text-navy-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green" />{item.why}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BeatReady({ idea, ready, onEnter }: { idea: string; ready: boolean; onEnter: () => void }) {
  const idea1 = idea.trim().length > 0 && idea.trim().length <= 70 ? idea.trim() : "";
  return (
    <div className="flex flex-col items-center text-center">
      <div className={`mb-5 flex items-center gap-2 text-[12.5px] font-semibold ${ready ? "text-green-ink" : "text-navy-3"}`}>
        {ready ? (
          <><span className="grid h-5 w-5 place-items-center rounded-full bg-green text-white"><Check className="h-3 w-3" /></span> Your tailored questions are ready</>
        ) : (
          <><span className="flex gap-0.5">
            {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-green" style={{ animation: `dots 1.4s ${i * 0.16}s infinite ease-in-out` }} />)}
          </span> Still tailoring your questions…</>
        )}
      </div>
      <h1 className="max-w-[18ch] text-[34px] font-extrabold leading-[1.1] tracking-[-0.025em] text-navy">
        {ready ? "That's the idea. Now let's design yours." : "That's the idea. Yours is almost ready."}
      </h1>
      {idea1 && (
        <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-navy-3">
          A few quick choices, shaped around <span className="font-semibold text-navy-2">"{idea1}"</span>.
        </p>
      )}
      <button onClick={onEnter} disabled={!ready}
        className={`mt-8 flex items-center gap-2 rounded-2xl px-9 py-4 text-[16.5px] font-bold transition-all
          ${ready ? "tl-glow bg-green text-white hover:-translate-y-px hover:bg-green-l" : "cursor-default bg-oat-2 text-navy-3"}`}>
        {ready ? <>Design my build <ChevronRight className="h-5 w-5" /></> : "Preparing your questions…"}
      </button>
      {!ready && <p className="mt-4 text-[12.5px] text-navy-3">Still tailoring the questions to your idea. This can take up to a minute, and it lights up the moment they're ready.</p>}
    </div>
  );
}

export function TeachingLoader({ idea, expertise, planning, ready, ideaChecking, ideaCheck, onReviseIdea, onRecheck, onProceed, onEnter }: Props) {
  // Expertise-aware primer (persona finding: the full primer read as gatekeeping for
  // people who'd told us they already know Databricks, and we were ignoring that answer).
  // "New to it" gets the full, dwell-gated, non-skippable primer. Anyone else gets a lean
  // path — the tool + the idea check + ready — with no per-beat dwell and a visible skip.
  // Both still pass through the criteria beat (starts question generation) and the ready
  // beat (gates entry), so nobody outruns the generation.
  const lean = expertise !== "New to it";
  const [beat, setBeat] = useState(0);
  // Newcomers step through in order (dots only go back to seen beats) with a short dwell
  // so nobody sprints past the teaching into dead air. Experienced users skip the dwell.
  const [maxSeen, setMaxSeen] = useState(0);
  const [dwelling, setDwelling] = useState(!lean);
  // Soft gate on the criteria beat: if the idea didn't pass the rubric, the first Next click
  // warns instead of advancing. Reset when the beat changes.
  const [weakAck, setWeakAck] = useState(false);
  useEffect(() => {
    setWeakAck(false);
    if (lean) { setDwelling(false); return; }
    setDwelling(true);
    const t = setTimeout(() => setDwelling(false), 1200);
    return () => clearTimeout(t);
  }, [beat, lean]);
  const goTo = (i: number) => setBeat((b) => { const n = Math.max(0, Math.min(beats.length - 1, i)); setMaxSeen((m) => Math.max(m, n)); return n; });

  // Full order (Akil's sequencing) for newcomers: idea → Databricks overview → mindset →
  // habits → Genie Code intro → stress-test the idea → quiz → ready. Genie's own intro
  // moved to Assemble (learn-as-you-pick). Experienced users get the lean set: the tool
  // they'll use + the idea check + ready. Both keep the criteria beat (starts question
  // generation) and the ready beat (gates entry).
  const criteria = (
    <BeatCriteria key="criteria" idea={idea} checking={ideaChecking} check={ideaCheck}
      onReviseIdea={onReviseIdea} onRecheck={onRecheck} />
  );
  const ready_ = <BeatReady key="ready" idea={idea} ready={ready} onEnter={onEnter} />;
  const beats = lean
    ? [<BeatOrient key="orient" idea={idea} />, <BeatGenieCode key="genie-code" />, criteria, ready_]
    : [
        <BeatOrient key="orient" idea={idea} />,
        <BeatMindset key="mindset" />,
        <BeatHabits key="habits" />,
        <BeatGenieCode key="genie-code" />,
        criteria,
        <BeatQuiz key="quiz" />,
        ready_,
      ];
  const CRITERIA_BEAT = beats.findIndex((b) => b.key === "criteria");
  const last = beats.length - 1;
  const onLast = beat === last;
  // The idea didn't clear the rubric: soft-gate leaving the criteria beat. Not a hard block
  // (our rubric can be wrong) — just a smaller button and a one-time warning so they slow down.
  const weakGate = beat === CRITERIA_BEAT && !!ideaCheck && !ideaCheck.strong && !ideaChecking;
  // Advancing past the criteria beat is what kicks off design-question generation
  // (idempotent in the parent). Don't allow it while the stress-test is still running.
  const next = () => {
    if (weakGate && !weakAck) { setWeakAck(true); return; }  // first click warns, doesn't advance
    if (beat === CRITERIA_BEAT) onProceed();
    goTo(beat + 1);
  };
  const nextBlocked = dwelling || (beat === CRITERIA_BEAT && ideaChecking);
  // Lean-path skip: jump straight to the ready screen. Question generation already started
  // at "Start designing", and onProceed is idempotent, so this fires it (harmless if already
  // running) and lands them on ready, which gates on the questions actually being done.
  const canSkip = lean && beat < last;
  const skipAhead = () => { onProceed(); goTo(last); };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-[760px] flex-col">
      {/* persistent status strip — always clear about what's happening */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-navy-3">
          {ready ? (
            <><span className="grid h-4 w-4 place-items-center rounded-full bg-green text-white"><Check className="h-2.5 w-2.5" /></span>
              <span className="text-green-ink">Design questions ready</span></>
          ) : (
            <><span className="flex gap-0.5">
              {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-green" style={{ animation: `dots 1.4s ${i * 0.16}s infinite ease-in-out` }} />)}
            </span> {planning ? "Tailoring your design questions…" : "A quick primer while we get set…"}</>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canSkip && (
            <button onClick={skipAhead}
              className="text-[12px] font-bold text-green-ink hover:text-green">Skip to the questions →</button>
          )}
          <span className="text-[12px] font-medium text-navy-3">{lean ? "Quick primer" : "A quick primer while we work"} · {beat + 1} of {beats.length}</span>
        </div>
      </div>

      {/* the current beat, centered, re-animated on change */}
      <div className="flex flex-1 items-center py-8">
        <div key={beat} className="rise w-full">{beats[beat]}</div>
      </div>

      {/* soft-gate warning when they try to leave the criteria beat with a thin idea */}
      {weakGate && weakAck && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber/50 bg-[#fffdf7] px-4 py-2.5 text-[13px] leading-snug text-navy-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
          <span>Your idea is still a bit thin. A clearer idea builds a better app, so it's worth tightening it above. You can continue anyway if you'd like.</span>
        </div>
      )}

      {/* footer nav: Back · progress dots · Next */}
      <div className="flex items-center justify-between border-t border-line pt-4">
        <button onClick={() => setBeat((b) => Math.max(0, b - 1))} disabled={beat === 0}
          className="flex items-center gap-1 text-[14px] font-semibold text-navy-3 hover:text-navy disabled:opacity-0">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex items-center gap-2">
          {beats.map((_, i) => {
            const seen = i <= maxSeen;
            return (
              <button key={i} onClick={() => seen && goTo(i)} disabled={!seen}
                aria-label={seen ? `Go to beat ${i + 1}` : `Beat ${i + 1}, unlocks as you go`}
                title={seen ? `Beat ${i + 1}` : "Unlocks as you go. Hit Next"}
                className={`h-2 rounded-full transition-all ${i === beat ? "w-6 bg-green" : seen ? "w-2 bg-line-2 hover:bg-navy-3" : "w-2 bg-line cursor-default"}`} />
            );
          })}
        </div>

        {!onLast ? (
          weakGate ? (
            // De-emphasized escape hatch: smaller, secondary, and it warns before it advances.
            <button onClick={next} disabled={nextBlocked}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2 text-[13px] font-semibold text-navy-3 transition-colors hover:border-navy-3 hover:text-navy disabled:opacity-40">
              {weakAck ? "Continue anyway" : "Continue without tightening"} <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button onClick={next} disabled={nextBlocked}
              className="flex items-center gap-1.5 rounded-xl bg-navy px-5 py-2.5 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-navy-2 disabled:opacity-40 disabled:hover:translate-y-0">
              {beat === CRITERIA_BEAT && ideaChecking ? "Reading your idea…" : "Next"} <ChevronRight className="h-4 w-4" />
            </button>
          )
        ) : (
          <span className="w-[72px]" /> // keep the dots centered; the beat holds the primary CTA
        )}
      </div>
    </div>
  );
}
