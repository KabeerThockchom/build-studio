import { useState } from "react";
import { Check, X, Sparkles, ChevronRight, ChevronLeft, GraduationCap, ExternalLink, BookOpen } from "lucide-react";
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
  // modules -> an optional "watch Genie Code" video beat -> the quiz
  const videoIdx = caps.length;
  const total = caps.length + 2;
  const onVideo = beat === videoIdx;
  const onQuiz = beat === videoIdx + 1;
  const goTo = (i: number) => setBeat(() => {
    const n = Math.max(0, Math.min(total - 1, i));
    setMaxSeen((m) => Math.max(m, n));
    return n;
  });

  return (
    <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-[820px] flex-col">
      {/* status strip */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-navy-3">
          <GraduationCap className="h-4 w-4 text-green" />
          Learn the pieces your build uses
        </div>
        <span className="text-[12px] font-medium text-navy-3">
          {onQuiz ? "Quick check" : onVideo ? "Watch (optional)" : `Piece ${beat + 1} of ${caps.length}`} · {beat + 1} of {total}
        </span>
      </div>

      {/* current beat */}
      <div className="flex flex-1 items-start py-8">
        <div key={beat} className="rise w-full">
          {onQuiz ? <QuizBeat caps={caps} /> : onVideo ? <VideoBeat /> : <ModuleBeat cap={caps[beat]} idx={beat} count={caps.length} />}
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

// Optional "meet the tool" video, between the piece modules and the quiz. Skippable —
// the footer Next goes straight to the check. Moved here from the Build overview screen.
function VideoBeat() {
  return (
    <div>
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Optional · watch</div>
      <h1 className="text-[32px] font-extrabold leading-[1.08] tracking-[-0.025em] text-navy">Meet Genie Code.</h1>
      <p className="mt-3 max-w-[56ch] text-[15.5px] leading-relaxed text-navy-2">
        The AI coding agent you'll build with in a moment. Optional, watch it now or skip straight to the quick check.
      </p>
      <div className="mt-5 max-w-[640px]">
        <VideoEmbed id="heouBA5U1bE" title="Intro to Genie Code"
          sub="You describe what you want in plain words; it writes and runs the work in your workspace." />
      </div>
    </div>
  );
}

// One piece: what it is, why it matters, a short video/demo, and a couple of links.
function ModuleBeat({ cap, idx, count }: { cap: string; idx: number; count: number }) {
  const card = CONCEPTS[cap];
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">
        <span className="font-mono">{cap}</span>
        <span className="text-line-2">·</span>
        <span className="text-navy-3">piece {idx + 1} of {count}</span>
      </div>
      <h1 className="text-[32px] font-extrabold leading-[1.08] tracking-[-0.025em] text-navy">{card.title}</h1>
      <p className="mt-3 max-w-[56ch] text-[17px] font-semibold leading-relaxed text-navy">{card.tagline}</p>
      <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-navy-2">{card.deeper}</p>

      {card.demo === "genie-chat" && <GenieChatMock />}

      {card.video ? (
        <div className="mt-5 max-w-[560px]">
          <VideoEmbed id={card.video.id} title={card.video.title} sub={card.video.sub} />
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-dashed border-line bg-oat/50 px-4 py-3 text-[12.5px] text-navy-3">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-green" /> A short walkthrough video for this piece goes here.
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
    <div className="mt-5 max-w-[440px] overflow-hidden rounded-xl border border-line bg-white">
      <div className="border-b border-line px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-green-ink">Genie</div>
      <div className="flex flex-col gap-2 px-3.5 py-3.5">
        <div className="self-end rounded-lg rounded-tr-sm bg-oat px-3 py-1.5 text-[12.5px] text-navy">Which regions are down this quarter?</div>
        <div className="rounded-lg rounded-tl-sm bg-green-soft px-3 py-1.5 text-[12.5px] leading-snug text-navy">Northeast and Midwest are down about 8% and 5% from last quarter. The rest held steady.</div>
      </div>
    </div>
  );
}
