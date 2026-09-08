import { useState, useEffect } from "react";
import { Target, ShieldCheck, RefreshCw, Check, X, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { VideoEmbed } from "./VideoEmbed";

/* The teaching sequence that plays while the SA authors the design questions in
   the background. Instead of a long scroll, it's a focused deck: ONE beat at a
   time, tap to advance. It opens by framing the moment — we're understanding
   your intent and will ask a few design questions; here's the path we'll take —
   then walks the mindset, the working habits, and the Databricks pieces. A
   persistent status strip shows when the questions are ready and lets the user
   jump straight in; the final beat's CTA lights up the moment they land. */

interface Props {
  idea: string;
  planning: boolean;          // SA still authoring the tailored questions
  ready: boolean;             // questions have landed
  onEnter: () => void;        // go to the design questions
}

// The Genie "sparkle in a window" mark, lifted from the companion-app tour.
function GenieMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path fill="currentColor" fillRule="evenodd" d="M0 2.75A.75.75 0 0 1 .75 2H8v1.5H1.5v9h13V10H16v3.25a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1-.75-.75zm12.987-.14a.75.75 0 0 0-1.474 0l-.137.728a1.93 1.93 0 0 1-1.538 1.538l-.727.137a.75.75 0 0 0 0 1.474l.727.137c.78.147 1.39.758 1.538 1.538l.137.727a.75.75 0 0 0 1.474 0l.137-.727c.147-.78.758-1.39 1.538-1.538l.727-.137a.75.75 0 0 0 0-1.474l-.727-.137a1.93 1.93 0 0 1-1.538-1.538z" clipRule="evenodd" />
    </svg>
  );
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
      <div className="mt-8 max-w-[420px]">
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
      <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-[-0.025em] text-navy">Three habits that make the difference.</h1>
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

// Two foundational beats, one per piece, so a newcomer meets each on its own.
function BeatGenie() {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">
        The first piece · for everyone
      </div>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-green-soft text-green-ink"><GenieMark className="h-5 w-5" /></span>
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.025em] text-navy">Meet Genie.</h1>
      </div>
      <p className="mt-4 max-w-[54ch] text-[17px] leading-relaxed text-navy-2">
        Genie lets anyone <span className="font-semibold text-navy">ask questions of your data in plain English</span> and
        get a real answer back. You type a question the way you'd say it out loud. Genie figures out
        the query, runs it against your tables, and replies in a sentence. No SQL, no waiting on an analyst.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-green-soft text-green-ink"><GenieMark className="h-3.5 w-3.5" /></span>
          <b className="text-[13px] font-bold text-navy">Genie</b>
        </div>
        <div className="px-4 py-4">
          <div className="rounded-lg border border-line bg-oat px-3.5 py-2.5 text-[14px] text-navy">
            Which regions are down this quarter?<span className="tl-caret font-semibold text-green">|</span>
          </div>
          <div className="mt-3 rounded-lg bg-green-soft px-3.5 py-2.5 text-[13.5px] leading-relaxed text-navy">
            The Northeast and Midwest are both down from last quarter, about 8% and 5%. The rest held steady.
          </div>
        </div>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-navy-3">
        Who it's for: the business users and analysts on your team who need answers, not a data project.
      </p>
    </div>
  );
}

function BeatGenieCode() {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">
        The second piece · what you'll use today
      </div>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#00A870,#2BC48A)" }}>◆</span>
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.025em] text-navy">Meet Genie Code.</h1>
      </div>
      <p className="mt-4 max-w-[54ch] text-[17px] leading-relaxed text-navy-2">
        Where Genie <span className="font-semibold text-navy">answers</span> questions, Genie Code <span className="font-semibold text-navy">builds</span> things.
        You describe what you want in plain words, and it writes and runs the work for you, right in your
        workspace. Tables, an app, a dashboard. It's what you'll use to build your idea today.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line" style={{ background: "#132029" }}>
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="grid h-6 w-6 place-items-center rounded-lg text-white" style={{ background: "linear-gradient(135deg,#00A870,#2BC48A)" }}>◆</span>
          <b className="text-[13px] font-bold text-white">Genie Code</b>
          <span className="ml-auto text-[10.5px] font-medium text-[#6f8b93]">in your workspace</span>
        </div>
        <div className="flex flex-col gap-2.5 px-4 py-4">
          <div className="self-end rounded-xl rounded-tr-sm bg-green/15 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#eafaf3]">
            Build a table of daily sales by store, then an app that flags the ones falling behind.
          </div>
          <div className="rounded-xl rounded-tl-sm border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#c4d4d8]">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-green-l"><Check className="h-3 w-3" /> Made the table · built the app</span>
            Here's your app. Want me to add a weekly summary next?
          </div>
        </div>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-navy-3">
        Who it's for: anyone building something. You steer in plain language; it does the typing.
      </p>
    </div>
  );
}

// A quick check-your-understanding on what the previous beats taught. Not graded —
// just makes the learner wrestle with the material (Akil's ask) and reinforces the ideas.
const QUIZ = [
  { q: "In this workshop, what's mainly YOUR job?",
    options: ["Write all the code by hand", "Decide what's worth building and steer the agent", "Memorize the Databricks UI"],
    answer: 1, why: "You're the architect, not the bricklayer — the agent handles the code; you decide what to build." },
  { q: "You want to BUILD something (a table, an app). Which do you reach for?",
    options: ["Genie", "Genie Code"],
    answer: 1, why: "Genie answers questions about your data; Genie Code builds things for you." },
  { q: "What's a PRD, and why do it first?",
    options: ["A finished app, so you can skip planning", "A short plan of what to build — it's what you hand the agent so the build comes out right", "A billing report"],
    answer: 1, why: "The PRD is the first milestone: a clear plan of what to build, which the agent builds from." },
];

function BeatQuiz() {
  const [picked, setPicked] = useState<Record<number, number>>({});
  return (
    <div>
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Quick check</div>
      <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.025em] text-navy">A few quick ones before we design.</h1>
      <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-navy-2">No grade — just to make the ideas stick.</p>
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
      {!ready && <p className="mt-4 text-[12.5px] text-navy-3">This lights up the moment they land, usually a few more seconds.</p>}
    </div>
  );
}

export function TeachingLoader({ idea, planning, ready, onEnter }: Props) {
  const [beat, setBeat] = useState(0);
  // Non-skippable: you step through the beats in order (dots only go back to ones
  // you've seen), and a short dwell on each stops anyone from sprinting past the
  // teaching into dead air while the questions are still generating.
  const [maxSeen, setMaxSeen] = useState(0);
  const [dwelling, setDwelling] = useState(true);
  useEffect(() => {
    setDwelling(true);
    const t = setTimeout(() => setDwelling(false), 1200);
    return () => clearTimeout(t);
  }, [beat]);
  const goTo = (i: number) => setBeat((b) => { const n = Math.max(0, Math.min(beats.length - 1, i)); setMaxSeen((m) => Math.max(m, n)); return n; });

  const beats = [
    <BeatOrient key="orient" idea={idea} />,
    <BeatMindset key="mindset" />,
    <BeatHabits key="habits" />,
    <BeatGenie key="genie" />,
    <BeatGenieCode key="genie-code" />,
    <BeatQuiz key="quiz" />,
    <BeatReady key="ready" idea={idea} ready={ready} onEnter={onEnter} />,
  ];
  const last = beats.length - 1;
  const onLast = beat === last;

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
            </span> Tailoring your design questions…</>
          )}
        </div>
        <div className="text-[12px] font-medium text-navy-3">A quick primer while we work · {beat + 1} of {beats.length}</div>
      </div>

      {/* the current beat, centered, re-animated on change */}
      <div className="flex flex-1 items-center py-8">
        <div key={beat} className="rise w-full">{beats[beat]}</div>
      </div>

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
                aria-label={seen ? `Go to beat ${i + 1}` : `Beat ${i + 1} — unlocks as you go`}
                title={seen ? `Beat ${i + 1}` : "Unlocks as you go — hit Next"}
                className={`h-2 rounded-full transition-all ${i === beat ? "w-6 bg-green" : seen ? "w-2 bg-line-2 hover:bg-navy-3" : "w-2 bg-line cursor-default"}`} />
            );
          })}
        </div>

        {!onLast ? (
          <button onClick={() => goTo(beat + 1)} disabled={dwelling}
            className="flex items-center gap-1.5 rounded-xl bg-navy px-5 py-2.5 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-navy-2 disabled:opacity-40 disabled:hover:translate-y-0">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <span className="w-[72px]" /> // keep the dots centered; the beat holds the primary CTA
        )}
      </div>
    </div>
  );
}
