import { useState, useEffect } from "react";
import { Check, X, Sparkles, ChevronRight, ChevronLeft, ChevronDown, GraduationCap, ExternalLink, BookOpen, User, ShieldCheck, Database } from "lucide-react";
import { CONCEPTS, FINAL_QUIZ } from "../lib/learn";
import { VideoEmbed } from "./VideoEmbed";

/* The learning phase that runs AFTER Assemble. Now that the architecture is fully
   prescribed, this is a short, focused deck: one module per piece the build uses (what
   it is, why it matters, a short video/demo), then a single quiz — one question per piece,
   at the post-Shape primer's difficulty. It plays while the blueprint generates in the
   background, so the wait is hidden behind real learning (Akil's ask). */

interface Props {
  capabilities: string[];   // the locked, prescribed set
  onBack: () => void;       // → Assemble
  onDone: () => void;       // → Blueprint
}

// Canonical teaching order; we render modules for the pieces that have a concept card.
const ORDER = ["Genie", "Knowledge Assistant", "Supervisor agent", "Lakebase", "Databricks Apps"];

export function CapabilityLearning({ capabilities, onBack, onDone }: Props) {
  const caps = ORDER.filter((c) => capabilities.includes(c) && CONCEPTS[c]);
  const [beat, setBeat] = useState(0);
  const [maxSeen, setMaxSeen] = useState(0);
  // beats: the architecture overview (0) -> one per piece -> the quick check
  const total = caps.length + 2;
  const onArch = beat === 0;
  const onQuiz = beat === caps.length + 1;
  const goTo = (i: number) => setBeat(() => {
    const n = Math.max(0, Math.min(total - 1, i));
    setMaxSeen((m) => Math.max(m, n));
    return n;
  });
  // the architecture diagram is also the navigation — tapping a piece opens its module
  const openPiece = (cap: string) => { const i = caps.indexOf(cap); if (i >= 0) goTo(i + 1); };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-[820px] flex-col">
      {/* status strip */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-navy-3">
          <GraduationCap className="h-4 w-4 text-green" />
          Learn the pieces your build uses
        </div>
        <span className="text-[12px] font-medium text-navy-3">
          {onArch ? "The architecture" : onQuiz ? "Quick check" : `Piece ${beat} of ${caps.length}`} · {beat + 1} of {total}
        </span>
      </div>

      {/* current beat */}
      <div className="flex flex-1 items-start py-8">
        <div key={beat} className="rise w-full">
          {onArch ? <ArchitectureBeat caps={caps} onOpen={openPiece} />
            : onQuiz ? <QuizBeat caps={caps} />
            : <ModuleBeat cap={caps[beat - 1]} idx={beat - 1} count={caps.length} onHome={() => goTo(0)} />}
        </div>
      </div>

      {/* footer nav */}
      <div className="flex items-center justify-between border-t border-line pt-4">
        <button onClick={beat === 0 ? onBack : () => setBeat((b) => Math.max(0, b - 1))}
          className="flex items-center gap-1 text-[14px] font-semibold text-navy-3 hover:text-navy">
          <ChevronLeft className="h-4 w-4" /> {beat === 0 ? "Back" : "Previous"}
        </button>

        <div className="flex items-center gap-2">
          {Array.from({ length: total }).map((_, i) => {
            const seen = i <= maxSeen;
            return (
              <button key={i} onClick={() => seen && goTo(i)} disabled={!seen}
                aria-label={seen ? `Go to ${i + 1}` : `Unlocks as you go`}
                className={`h-2 rounded-full transition-all ${i === beat ? "w-6 bg-green" : seen ? "w-2 bg-line-2 hover:bg-navy-3" : "w-2 bg-line cursor-default"}`} />
            );
          })}
        </div>

        {onQuiz ? (
          <button onClick={onDone}
            className="flex items-center gap-1.5 rounded-xl bg-green px-6 py-2.5 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l">
            See your blueprint <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={() => goTo(beat + 1)}
            className="flex items-center gap-1.5 rounded-xl bg-navy px-5 py-2.5 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-navy-2">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── The opening beat: one static portrait of the architecture everyone builds. ──
// It reads top-down as a story (you -> app -> agent -> tools -> data) and doubles as
// navigation: each named piece is a door into its own module. No two builds differ here,
// so the diagram is fixed, not generated.
function ArchitectureBeat({ caps, onOpen }: { caps: string[]; onOpen: (cap: string) => void }) {
  const [lit, setLit] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setLit(true)); return () => cancelAnimationFrame(r); }, []);
  // staggered top-to-bottom entrance; transform+opacity only, honors reduced motion
  const enter = (i: number) => ({ transitionDelay: `${i * 80}ms`, opacity: lit ? 1 : 0, transform: lit ? "none" : "translateY(12px)" });
  const anim = "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:transform-none";
  const has = (cap: string) => caps.includes(cap);

  // a clickable piece — a door into its module (falls back to a plain node if not in this build)
  const Door = ({ cap, name, role }: { cap: string; name: string; role: string }) =>
    has(cap) ? (
      <button onClick={() => onOpen(cap)}
        className="group w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-left outline-none transition
          hover:-translate-y-px hover:border-green focus-visible:ring-[3px] focus-visible:ring-green-soft">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-green-ink">{name}</span>
          <span className="text-[11px] font-semibold text-navy-3 opacity-0 transition-opacity group-hover:opacity-100">Learn &rarr;</span>
        </div>
        <div className="mt-1 text-[13px] leading-snug text-navy">{role}</div>
      </button>
    ) : (
      <div className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-green-ink">{name}</span>
        <div className="mt-1 text-[13px] leading-snug text-navy">{role}</div>
      </div>
    );

  // a labeled connector between layers
  const Link = ({ label }: { label: string }) => (
    <div className="flex flex-col items-center py-0.5 text-navy-3">
      <span className="h-3 w-px bg-line-2" />
      <span className="my-0.5 text-[10.5px] font-medium">{label}</span>
      <ChevronDown className="h-3.5 w-3.5 text-line-2" />
    </div>
  );

  return (
    <div>
      <div className="mb-2 font-mono text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">The architecture &middot; everyone builds this</div>
      <h1 className="text-[32px] font-extrabold leading-[1.08] tracking-[-0.025em] text-navy">Here's the whole thing you'll build.</h1>
      <p className="mt-3 max-w-[60ch] text-[15.5px] leading-relaxed text-navy-2">
        Same shape for everyone. You open an app; behind it, an agent sends each question to the right piece &mdash; all inside your governed Databricks workspace. Tap any piece to jump into it.
      </p>

      <div className="mt-6 flex flex-col items-center">
        {/* you — outside the workspace, the person using it */}
        <div style={enter(0)} className={anim}>
          <div className="flex items-center gap-2 rounded-full border border-line-2 bg-white px-3.5 py-1.5">
            <User className="h-4 w-4 text-navy-2" />
            <span className="text-[13px] font-bold text-navy">You</span>
            <span className="rounded-full bg-green-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-green-ink">you're here</span>
          </div>
        </div>
        <div style={enter(1)} className={anim}><Link label="open it in your browser" /></div>

        {/* the governed workspace boundary — what's contained, and that nothing leaves */}
        <div style={enter(2)} className={`${anim} w-full max-w-[520px] rounded-2xl border border-dashed border-line-2 bg-oat/40 p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-navy-3">
              <ShieldCheck className="h-3.5 w-3.5 text-green" /> Your Databricks workspace
            </span>
            <span className="text-[10.5px] font-medium text-navy-3">governed &middot; nothing leaves</span>
          </div>

          {/* the app — where you interact — and the agent that runs inside it */}
          <div className="rounded-xl border-[1.5px] border-green bg-white p-3">
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <button onClick={() => onOpen("Databricks Apps")}
                className="group rounded text-left outline-none focus-visible:ring-[3px] focus-visible:ring-green-soft">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-green-ink">Databricks App</span>
                <div className="mt-0.5 text-[13px] leading-snug text-navy">
                  the front door &middot; React + FastAPI <span className="font-semibold text-navy-3 group-hover:text-green-ink">Learn &rarr;</span>
                </div>
              </button>
              <span className="shrink-0 rounded-full bg-green-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-green-ink">where you interact</span>
            </div>
            <div className="rounded-lg bg-oat/60 p-2">
              <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-navy-3">runs inside the app</div>
              <Door cap="Supervisor agent" name="Supervisor agent" role="reads your question, picks the right piece" />
            </div>
          </div>

          <Link label="the agent calls" />

          {/* the pieces the agent calls */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Door cap="Genie" name="Genie" role="asks your data in plain English" />
            <Door cap="Lakebase" name="Lakebase" role="saves what people do" />
          </div>

          <Link label="Genie reads" />

          {/* the governed data everything sits on (context, not a learning module) */}
          <div className="flex items-center gap-2.5 rounded-xl bg-oat-2 px-4 py-3">
            <Database className="h-4 w-4 shrink-0 text-navy-3" />
            <div>
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-navy-3">Your data</div>
              <div className="text-[13px] leading-snug text-navy">governed tables in Unity Catalog</div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-5 text-center text-[12.5px] text-navy-3">Tap a piece above, or step through them one at a time &rarr;</p>
    </div>
  );
}

// One piece: what it is, why it matters, a short video/demo, and a couple of links.
function ModuleBeat({ cap, idx, count, onHome }: { cap: string; idx: number; count: number; onHome: () => void }) {
  const card = CONCEPTS[cap];
  return (
    <div>
      <button onClick={onHome}
        className="mb-3 inline-flex items-center gap-1 rounded text-[12px] font-semibold text-navy-3 outline-none hover:text-green-ink focus-visible:ring-[3px] focus-visible:ring-green-soft">
        <ChevronLeft className="h-3.5 w-3.5" /> The architecture
      </button>
      <div className="mb-2 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">
        <span className="font-mono">{cap}</span>
        <span className="text-line-2">·</span>
        <span className="text-navy-3">piece {idx + 1} of {count}</span>
      </div>
      <h1 className="text-[32px] font-extrabold leading-[1.08] tracking-[-0.025em] text-navy">{card.title}</h1>
      <p className="mt-3 max-w-[56ch] text-[17px] font-semibold leading-relaxed text-navy">{card.tagline}</p>
      <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-navy-2">{card.deeper}</p>

      {(card.demo || card.video) && (
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
          {card.demo === "genie-chat" && <GenieChatMock />}
          {card.demo === "agent-routing" && <AgentRoutingMock />}
          {card.video && (
            <VideoEmbed id={card.video.id} title={card.video.title} sub={card.video.sub} short={card.video.short} />
          )}
        </div>
      )}

      {card.links.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {card.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-navy-2 hover:border-green hover:text-green-ink">
              {l.kind === "watch" ? <ExternalLink className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// The final quiz: one question per piece, on one screen. Not graded — reinforcement.
function QuizBeat({ caps }: { caps: string[] }) {
  const items = caps.filter((c) => FINAL_QUIZ[c]).map((c) => ({ cap: c, ...FINAL_QUIZ[c] }));
  const [picked, setPicked] = useState<Record<number, number>>({});
  return (
    <div>
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Quick check</div>
      <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.025em] text-navy">One on each piece before you build.</h1>
      <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-navy-2">No grade. Just to make each piece stick.</p>
      <div className="mt-6 flex flex-col gap-5">
        {items.map((item, qi) => {
          const chosen = picked[qi];
          const answered = chosen !== undefined;
          return (
            <div key={qi} className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-green-ink">{item.cap}</div>
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

// A compact product-style demo for Genie's module — "ask in plain English, get a real answer."
function GenieChatMock() {
  return (
    <div className="max-w-[440px] overflow-hidden rounded-xl border border-line bg-white">
      <div className="border-b border-line px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-green-ink">Genie</div>
      <div className="flex flex-col gap-2 px-3.5 py-3.5">
        <div className="self-end rounded-lg rounded-tr-sm bg-oat px-3 py-1.5 text-[12.5px] text-navy">Which regions are down this quarter?</div>
        <div className="rounded-lg rounded-tl-sm bg-green-soft px-3 py-1.5 text-[12.5px] leading-snug text-navy">Northeast and Midwest are down about 8% and 5% from last quarter. The rest held steady.</div>
      </div>
    </div>
  );
}

// The Supervisor agent module's visual: one plain question routed to the right pieces.
// Shows WHY the agent exists (ask in one place) and HOW it's wired (Genie + Lakebase).
function AgentRoutingMock() {
  return (
    <div className="max-w-[440px] overflow-hidden rounded-xl border border-line bg-white">
      <div className="border-b border-line px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-green-ink">
        Supervisor agent · routes one question
      </div>
      <div className="flex flex-col items-center gap-1.5 px-3.5 py-4">
        <div className="w-full rounded-lg bg-oat px-3 py-2 text-[12.5px] leading-snug text-navy">
          "Which stores are slipping, and mark store 4 as handled."
        </div>
        <ChevronDown className="h-4 w-4 text-line-2" />
        <div className="rounded-lg bg-navy px-3.5 py-1.5 text-[12px] font-bold text-white">Supervisor agent</div>
        <div className="text-[10.5px] text-navy-3">reads the question, picks the right piece for each part</div>
        <ChevronDown className="h-4 w-4 text-line-2" />
        <div className="grid w-full grid-cols-2 gap-2">
          <div className="rounded-lg border border-green/40 bg-green-soft px-3 py-2">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-green-ink">Genie</div>
            <div className="mt-0.5 text-[11.5px] leading-snug text-navy">reads the sales numbers</div>
          </div>
          <div className="rounded-lg border border-green/40 bg-green-soft px-3 py-2">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-green-ink">Lakebase</div>
            <div className="mt-0.5 text-[11.5px] leading-snug text-navy">saves the "handled" note</div>
          </div>
        </div>
        <div className="mt-1 text-[10.5px] text-navy-3">one question, no picking tools by hand</div>
      </div>
    </div>
  );
}
