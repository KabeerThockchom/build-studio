import { useState } from "react";
import { Target, ShieldCheck, RefreshCw, Check, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";

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
    body: "Name the real thing — the table, the metric, who looks at it. The clearer your intent, the closer the first result lands.",
    aside: '"Flag stores whose weekly sales dropped >15% vs last month" › "make it better"' },
  { icon: ShieldCheck, tag: "Trust, but verify",
    title: "Read what it built.",
    body: "It writes real code and runs it on real data — fast and usually right. But you're the one who ships it, so glance at each step and confirm the number makes sense.",
    aside: "You stay the reviewer. It does the typing." },
  { icon: RefreshCw, tag: "Iteration is the point",
    title: "The first pass is a draft.",
    body: "Nobody nails it in one prompt. Say what's off — \"group by region, not store\" — and go again. Small corrections compound into what you pictured.",
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
          ? <>Give us a few seconds with <span className="font-semibold text-navy">"{idea1}"</span>. While we do, here's the path we'll take together — and a couple of things worth knowing first.</>
          : <>Give us a few seconds. While we do, here's the path we'll take together — and a couple of things worth knowing first.</>}
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
        The agent handles the syntax and plumbing now. Your job is the part only you can do —
        deciding <span className="font-semibold text-navy">what</span> is worth building.
      </p>
      <div className="mt-7 grid grid-cols-2 gap-3.5">
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-navy-3">The old bottleneck</div>
          <div className="text-[16px] font-bold text-navy-2 line-through decoration-line-2 decoration-2">How do I build it?</div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-navy-3">Which library, what schema, why won't this join run — hours on plumbing before you learn anything.</p>
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

function BeatPieces() {
  return (
    <div>
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">The pieces you'll use</div>
      <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-[-0.025em] text-navy">Two ways to talk to your data.</h1>
      <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-navy-2">
        Everything runs inside Databricks — already signed in, already governed. You meet it through
        two front doors, depending on whether you're <span className="font-semibold text-navy">asking</span> or <span className="font-semibold text-navy">building</span>.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3.5">
        {/* Genie */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-green-soft text-green-ink"><GenieMark className="h-3.5 w-3.5" /></span>
            <b className="text-[13px] font-bold text-navy">Genie</b>
            <span className="ml-auto text-[10.5px] font-medium text-navy-3">for everyone</span>
          </div>
          <div className="px-4 py-4">
            <div className="rounded-lg border border-line bg-oat px-3 py-2 text-[13px] text-navy">
              Which regions are down this quarter?<span className="tl-caret font-semibold text-green">|</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-navy-2">
              Ask in plain English. Genie writes the SQL, runs it on your governed tables, and answers
              in a sentence — how a business user gets to data without waiting on anyone.
            </p>
          </div>
        </div>
        {/* Genie Code */}
        <div className="overflow-hidden rounded-2xl border border-line" style={{ background: "#132029" }}>
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="grid h-6 w-6 place-items-center rounded-lg text-white" style={{ background: "linear-gradient(135deg,#00A870,#2BC48A)" }}>◆</span>
            <b className="text-[13px] font-bold text-white">Genie Code</b>
            <span className="ml-auto text-[10.5px] font-medium text-[#6f8b93]">for builders — you</span>
          </div>
          <div className="px-4 py-4">
            <div className="rounded-lg bg-green/15 px-3 py-2 text-[12.5px] leading-relaxed text-[#eafaf3]">
              Build a table of daily sales, then an app that flags stores falling behind.
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#c4d4d8]">
              Describe what to build; it writes and runs the code in your workspace. The same agent
              that powers this Studio — it's what you'll build with today.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-line bg-white px-4 py-3">
        <span className="mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-navy-3">Underneath</span>
        <p className="text-[13px] leading-relaxed text-navy-2">
          Both sit on one governed platform — the same Lakehouse, the same Unity Catalog permissions.
          <span className="text-navy-3"> (And when a whole org brings its own coding agents, Omnigent governs them under one roof — for later, not today.)</span>
        </p>
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
      {!ready && <p className="mt-4 text-[12.5px] text-navy-3">This lights up the moment they land — usually a few more seconds.</p>}
    </div>
  );
}

export function TeachingLoader({ idea, planning, ready, onEnter }: Props) {
  const [beat, setBeat] = useState(0);

  const beats = [
    <BeatOrient key="orient" idea={idea} />,
    <BeatMindset key="mindset" />,
    <BeatHabits key="habits" />,
    <BeatPieces key="pieces" />,
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
        {ready && !onLast && (
          <button onClick={onEnter} className="flex items-center gap-1 text-[12.5px] font-bold text-green-ink hover:text-green">
            Skip to questions <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
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
          {beats.map((_, i) => (
            <button key={i} onClick={() => setBeat(i)} aria-label={`Go to beat ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === beat ? "w-6 bg-green" : "w-2 bg-line-2 hover:bg-navy-3"}`} />
          ))}
        </div>

        {!onLast ? (
          <button onClick={() => setBeat((b) => Math.min(last, b + 1))}
            className="flex items-center gap-1.5 rounded-xl bg-navy px-5 py-2.5 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-navy-2">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <span className="w-[72px]" /> // keep the dots centered; the beat holds the primary CTA
        )}
      </div>
    </div>
  );
}
