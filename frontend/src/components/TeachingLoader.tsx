import { useEffect, useRef, useState } from "react";
import { ArrowDown, Target, ShieldCheck, RefreshCw, Check, Sparkles, ChevronRight } from "lucide-react";

/* The interactive teaching section. Plays while the SA authors ALL of the
   design questions in the background. Progressive downward-scroll reveal in
   three layers: the mindset shift → three working habits → the Databricks
   pieces (Genie / Genie Code / Omnigent). A bottom CTA is dimmed while the
   questions generate and starts glowing the moment they're ready; a soft toast
   also lets the user jump straight in without losing their place. */

interface Props {
  idea: string;
  planning: boolean;          // SA still authoring the tailored questions
  ready: boolean;             // questions have landed
  onEnter: () => void;        // go to the design questions
}

// Small hook: reveal any child carrying .tl-reveal as it scrolls into view.
function useReveal(scopeRef: React.RefObject<HTMLElement>, deps: unknown[] = []) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const els = Array.from(scope.querySelectorAll<HTMLElement>(".tl-reveal"));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("tl-in"); }),
      { threshold: 0.18 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, deps); // eslint-disable-line
}

// The Genie "sparkle in a window" mark, lifted from the companion-app tour.
function GenieMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path fill="currentColor" fillRule="evenodd" d="M0 2.75A.75.75 0 0 1 .75 2H8v1.5H1.5v9h13V10H16v3.25a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1-.75-.75zm12.987-.14a.75.75 0 0 0-1.474 0l-.137.728a1.93 1.93 0 0 1-1.538 1.538l-.727.137a.75.75 0 0 0 0 1.474l.727.137c.78.147 1.39.758 1.538 1.538l.137.727a.75.75 0 0 0 1.474 0l.137-.727c.147-.78.758-1.39 1.538-1.538l.727-.137a.75.75 0 0 0 0-1.474l-.727-.137a1.93 1.93 0 0 1-1.538-1.538z" clipRule="evenodd" />
    </svg>
  );
}

const TIPS = [
  {
    icon: Target, tag: "Be specific",
    title: "Specific beats verbose.",
    body: "Three sentences that name the real thing — the table, the metric, who looks at it — beat three paragraphs of throat-clearing. The clearer your intent, the closer the first result lands.",
    aside: '"Flag stores whose weekly sales dropped >15% vs last month" › "make it better"',
  },
  {
    icon: ShieldCheck, tag: "Trust, but verify",
    title: "Read what it built.",
    body: "The agent writes real code and runs it against real data. It's fast and usually right — but you're the one who ships it. Glance at each step, confirm the number makes sense, then move on.",
    aside: "You stay the reviewer. It does the typing.",
  },
  {
    icon: RefreshCw, tag: "Iteration is the point",
    title: "The first pass is a draft.",
    body: "Nobody nails it in one prompt, and you're not meant to. Say what's off — \"group by region, not store\" — and go again. Small corrections compound into exactly what you pictured.",
    aside: "Steer in small nudges, not one giant prompt.",
  },
];

export function TeachingLoader({ idea, planning, ready, onEnter }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showToast, setShowToast] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const shownOnce = useRef(false);

  useReveal(scope);

  // When the questions land, surface a one-time toast (unless already parked at
  // the bottom CTA, where the glow already says everything).
  useEffect(() => {
    if (ready && !shownOnce.current && !atBottom) {
      shownOnce.current = true;
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 6500);
      return () => clearTimeout(t);
    }
  }, [ready, atBottom]);

  // Track whether the closing CTA is in view (to guide + suppress the toast).
  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { setAtBottom(e.isIntersecting); if (e.isIntersecting) setShowToast(false); },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const idea1 = idea.trim().length > 0 && idea.trim().length <= 70 ? idea.trim() : "";

  return (
    <div ref={scope} className="relative mx-auto max-w-[760px] pb-24">
      {/* ready-toast: lets them jump straight to the questions */}
      {showToast && (
        <button onClick={onEnter}
          className="tl-toast fixed left-1/2 top-6 z-30 flex items-center gap-3 rounded-full border border-green/30 bg-white px-5 py-2.5 shadow-[0_10px_30px_rgba(0,168,112,0.18)]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-green text-white"><Check className="h-3.5 w-3.5" /></span>
          <span className="text-[13.5px] font-semibold text-navy">Your design questions are ready</span>
          <span className="flex items-center gap-1 text-[13px] font-bold text-green-ink">Jump in <ChevronRight className="h-3.5 w-3.5" /></span>
        </button>
      )}

      {/* ── Layer 0 · opener — the mindset shift ─────────────────────── */}
      <section className="flex min-h-[76vh] flex-col justify-center">
        <div className="rise">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-green-soft px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-green-ink">
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-green" style={{ animation: `dots 1.4s ${i * 0.16}s infinite ease-in-out` }} />)}
            </span>
            While we tailor your questions — a two-minute read
          </div>
          <h1 className="text-[44px] font-extrabold leading-[1.05] tracking-[-0.03em] text-navy">
            You're the architect,<br />not the bricklayer.
          </h1>
          <p className="mt-6 max-w-[52ch] text-[19px] leading-relaxed text-navy-2">
            The old question was <span className="font-semibold text-navy">"how do I build this?"</span> — syntax,
            plumbing, the thousand small decisions. The agent handles that now.
          </p>
          <p className="mt-4 max-w-[52ch] text-[19px] leading-relaxed text-navy-2">
            Your question becomes <span className="rounded-md bg-green-soft px-1.5 font-semibold text-green-ink">"what should I build?"</span> —
            and that's the part only you can answer.
          </p>
        </div>
        <div className="mt-14 flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-navy-3">
          <ArrowDown className="tl-bob h-4 w-4 text-green" /> Scroll
        </div>
      </section>

      {/* the before/after of the shift, made visual */}
      <section className="tl-reveal mb-10">
        <div className="grid grid-cols-2 gap-3.5">
          <div className="rounded-2xl border border-line bg-white/60 p-6">
            <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-navy-3">The old bottleneck</div>
            <div className="text-[17px] font-bold text-navy-2 line-through decoration-line-2 decoration-2">How do I build it?</div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-navy-3">Which library, what schema, why won't this join run. Hours spent on plumbing before you learn anything.</p>
          </div>
          <div className="rounded-2xl border-[1.5px] border-green bg-green-soft p-6">
            <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-green-ink">The new one</div>
            <div className="text-[17px] font-extrabold text-navy">What should I build?</div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-navy-2">Who's it for, what decision does it drive, what's the one thing it must get right. Clarity of vision is the work now.</p>
          </div>
        </div>
      </section>

      {/* ── Layer 1 · three working habits ───────────────────────────── */}
      <section className="tl-reveal pt-16">
        <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">How to work with it</div>
        <h2 className="max-w-[20ch] text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em] text-navy">
          Three habits that make the difference.
        </h2>
      </section>

      <div className="mt-8 flex flex-col gap-4">
        {TIPS.map((t, i) => {
          const Icon = t.icon;
          return (
            <section key={t.tag} className="tl-reveal" style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="flex gap-5 rounded-2xl border border-line bg-white p-6">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-green-soft text-green">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-green-ink">{t.tag}</div>
                  <h3 className="mt-1 text-[19px] font-extrabold tracking-[-0.01em] text-navy">{t.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-navy-2">{t.body}</p>
                  <div className="mt-3.5 flex items-start gap-2 rounded-lg bg-oat px-3.5 py-2.5">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green" />
                    <span className="font-mono text-[12.5px] leading-snug text-navy-2">{t.aside}</span>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* ── Layer 2 · the Databricks pieces ──────────────────────────── */}
      <section className="tl-reveal pt-20">
        <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">The pieces you'll use</div>
        <h2 className="max-w-[22ch] text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em] text-navy">
          Two ways to talk to your data. One place they live.
        </h2>
        <p className="mt-4 max-w-[54ch] text-[16px] leading-relaxed text-navy-2">
          Everything here runs inside Databricks — already signed in, already governed. You mostly
          meet it through two front doors, depending on whether you're <span className="font-semibold text-navy">asking</span> or <span className="font-semibold text-navy">building</span>.
        </p>
      </section>

      {/* Genie — the "ask anything" preview, in the companion-app style */}
      <section className="tl-reveal mt-8">
        <PieceHeader kicker="For everyone" name="Genie" line="Ask your data anything, in plain English." />
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-green-soft text-green-ink"><GenieMark className="h-4 w-4" /></span>
            <b className="text-[13.5px] font-bold text-navy">Genie</b>
            <span className="ml-auto text-[11px] font-medium text-navy-3">No SQL required</span>
          </div>
          <div className="px-5 py-5">
            <div className="rounded-xl border border-line bg-oat px-4 py-3 text-[14.5px] text-navy">
              Which regions are trending down this quarter?<span className="tl-caret font-semibold text-green">|</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-semibold">
              <span className="rounded-md bg-navy px-2 py-1 font-mono text-[11px] text-[#cfe9df]">SELECT region, …</span>
              <ChevronRight className="h-3.5 w-3.5 text-navy-3" />
              <span className="rounded-md bg-green-soft px-2 py-1 text-green-ink">runs the query</span>
              <ChevronRight className="h-3.5 w-3.5 text-navy-3" />
              <span className="rounded-md bg-green-soft px-2 py-1 text-green-ink">plain-English answer</span>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-navy-2">
              Genie writes the SQL, runs it against your governed tables, and answers in a sentence.
              It's how a business user or analyst gets to data without waiting on anyone.
            </p>
          </div>
        </div>
      </section>

      {/* Genie Code — the "describe it and it builds" preview */}
      <section className="tl-reveal mt-5">
        <PieceHeader kicker="For builders — you, today" name="Genie Code" line="Describe what to build. It writes and runs the code." />
        <div className="overflow-hidden rounded-2xl border border-line" style={{ background: "#132029" }}>
          <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-3.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: "linear-gradient(135deg,#00A870,#2BC48A)" }}>◆</span>
            <b className="text-[13.5px] font-bold text-white">Genie Code</b>
            <span className="ml-auto text-[11px] font-medium text-[#6f8b93]">in your workspace</span>
          </div>
          <div className="flex flex-col gap-3 px-5 py-5">
            <div className="self-end rounded-xl rounded-tr-sm bg-green/15 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#eafaf3]">
              Build me a table of daily sales by store, then an app that flags the ones falling behind.
            </div>
            <div className="rounded-xl rounded-tl-sm border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#c4d4d8]">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-green-l"><Check className="h-3 w-3" /> Created table · wrote the app · deployed it</span>
              Done — here's the live app. Want me to add a weekly email digest?
            </div>
          </div>
          <div className="border-t border-white/10 px-5 py-3 text-[12px] leading-snug text-[#8aa2a8]">
            The same agent that powers this Studio. Technical users — data scientists, engineers,
            anyone comfortable describing intent — use it to build almost anything on the platform.
          </div>
        </div>
      </section>

      {/* Omnigent + the platform underneath — compact, one row */}
      <section className="tl-reveal mt-5">
        <div className="grid grid-cols-2 gap-3.5">
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-navy-3">Good to know · Omnigent</div>
            <h3 className="text-[17px] font-extrabold text-navy">One layer above every coding agent.</h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-navy-2">
              When engineering teams bring their own agents — Claude Code, Codex — Omnigent governs and
              shares them under one roof. You don't need it today; it's where this scales to a whole org.
            </p>
          </div>
          <div className="rounded-2xl border-[1.5px] border-navy bg-navy p-6 text-[#eaf1f2]">
            <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-green-l">Underneath it all</div>
            <h3 className="text-[17px] font-extrabold text-white">One governed platform.</h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#c4d4d8]">
              Genie and Genie Code aren't bolt-ons — they sit on the same Lakehouse, the same Unity
              Catalog permissions. Ask or build, it's the same governed data underneath.
            </p>
          </div>
        </div>
      </section>

      {/* ── Closing · the transition into the design questions ───────── */}
      <section ref={bottomRef} className="tl-reveal mt-24 flex flex-col items-center text-center">
        <div className={`mb-6 flex items-center gap-2 text-[12.5px] font-semibold ${ready ? "text-green-ink" : "text-navy-3"}`}>
          {ready ? (
            <><span className="grid h-5 w-5 place-items-center rounded-full bg-green text-white"><Check className="h-3 w-3" /></span> Your tailored questions are ready</>
          ) : (
            <><span className="flex gap-0.5">
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-green" style={{ animation: `dots 1.4s ${i * 0.16}s infinite ease-in-out` }} />)}
            </span> Still tailoring your questions to this idea…</>
          )}
        </div>
        <h2 className="max-w-[18ch] text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em] text-navy">
          {ready ? "That's the mindset. Now let's design yours." : "That's the mindset. Yours is almost ready."}
        </h2>
        {idea1 && (
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-navy-3">
            A few quick choices, shaped around <span className="font-semibold text-navy-2">"{idea1}"</span>.
          </p>
        )}
        <button onClick={onEnter} disabled={!ready}
          className={`mt-8 flex items-center gap-2 rounded-2xl px-9 py-4 text-[16.5px] font-bold transition-all
            ${ready
              ? "tl-glow bg-green text-white hover:-translate-y-px hover:bg-green-l"
              : "cursor-default bg-oat-2 text-navy-3"}`}>
          {ready ? <>Design my build <ChevronRight className="h-5 w-5" /></> : "Preparing your questions…"}
        </button>
        <p className="mt-4 text-[12.5px] text-navy-3">
          {ready ? "No rush — scroll back up any time. Your place is saved." : "You can keep reading — this button lights up the moment they land."}
        </p>
      </section>
    </div>
  );
}

function PieceHeader({ kicker, name, line }: { kicker: string; name: string; line: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[13px] font-bold uppercase tracking-[0.04em] text-green-ink">{name}</span>
        <span className="rounded-full bg-oat-2 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-navy-3">{kicker}</span>
      </div>
      <p className="mt-1.5 text-[16px] font-semibold text-navy">{line}</p>
    </div>
  );
}
