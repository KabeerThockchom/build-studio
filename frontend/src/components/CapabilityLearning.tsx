import { useEffect, useState } from "react";
import { Check, X, Sparkles, ChevronRight, ChevronLeft, GraduationCap, BookOpen, ExternalLink } from "lucide-react";
import { CONCEPTS, learnComponents } from "../lib/learn";
import type { DiagramSpec } from "../lib/types";
import { ArchitectureDiagram } from "./ArchitectureDiagram";

/* Learn: plays while the plan job drafts in the background. It is dynamic: first the
   architecture of THIS build, then one module per component the build uses (in order), then a
   quick check with one question per component. */

interface Props {
  capabilities: string[];
  fits: Record<string, string>;        // how each piece is used in this build (from the Sit-Down)
  spec: DiagramSpec;                   // this build's architecture
  beat: number;
  onBeat: (i: number) => void;
  onBack: () => void;                  // back to the Sit-Down
  onDone: () => void;                  // on to the plan
  planReady: boolean;
}

const clean = (s?: string) => (s || "").trim().replace(/\.$/, "");

export function CapabilityLearning({ capabilities, fits, spec, beat, onBeat, onBack, onDone, planReady }: Props) {
  const caps = learnComponents(capabilities);
  const total = caps.length + 2;
  const cur = Math.max(0, Math.min(total - 1, beat));
  const onArch = cur === 0, onQuiz = cur === caps.length + 1;
  const goTo = (i: number) => onBeat(Math.max(0, Math.min(total - 1, i)));
  useEffect(() => { document.querySelector("main")?.scrollTo({ top: 0 }); }, [cur]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-[860px] flex-col">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-navy-3">
          <GraduationCap className="h-4 w-4 text-green" /> Learn the pieces your build uses
        </div>
        <span className="text-[12px] font-medium text-navy-3">
          {onArch ? "Your architecture" : onQuiz ? "Quick check" : `${CONCEPTS[caps[cur - 1]].short} · ${cur} of ${caps.length}`}
        </span>
      </div>

      <div className="flex flex-1 items-start py-8">
        <div key={cur} className="rise w-full">
          {onArch ? <ArchitectureBeat caps={caps} fits={fits} spec={spec} onOpen={(c) => goTo(caps.indexOf(c) + 1)} />
            : onQuiz ? <QuizBeat caps={caps} />
            : <ModuleBeat cap={caps[cur - 1]} idx={cur - 1} count={caps.length} fit={fits[caps[cur - 1]]} onHome={() => goTo(0)} />}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-4">
        <button onClick={cur === 0 ? onBack : () => goTo(cur - 1)}
          className="flex items-center gap-1 text-[14px] font-semibold text-navy-3 hover:text-navy">
          <ChevronLeft className="h-4 w-4" /> {cur === 0 ? "Back to the Sit-Down" : "Previous"}
        </button>
        <div className="flex items-center gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Go to ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === cur ? "w-6 bg-green" : "w-2 bg-line-2 hover:bg-navy-3"}`} />
          ))}
        </div>
        {onQuiz ? (
          <button onClick={onDone}
            className="flex items-center gap-1.5 rounded-xl bg-green px-6 py-2.5 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l">
            {planReady ? "See your plan" : "See your plan (almost ready)"} <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={() => goTo(cur + 1)}
            className="flex items-center gap-1.5 rounded-xl bg-navy px-5 py-2.5 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-navy-2">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── The opening beat: the architecture of THIS build, and a door into each piece. ──
function ArchitectureBeat({ caps, fits, spec, onOpen }: { caps: string[]; fits: Record<string, string>; spec: DiagramSpec; onOpen: (c: string) => void }) {
  return (
    <div>
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Your architecture</div>
      <h1 className="text-[32px] font-extrabold leading-[1.08] tracking-[-0.025em] text-navy">Here's what you'll build.</h1>
      <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-navy-2">
        {caps.length} {caps.length === 1 ? "piece" : "pieces"}, picked from what you scoped in the Sit-Down. Data flows left to right: from your data,
        through the pieces that shape and serve it, to where people use it. All of it runs in your governed Databricks workspace.
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-white px-3 py-4">
        <ArchitectureDiagram spec={spec} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {caps.map((c, i) => (
          <button key={c} onClick={() => onOpen(c)}
            className="group rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-left outline-none transition hover:-translate-y-px hover:border-green focus-visible:ring-[3px] focus-visible:ring-green-soft">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-navy"><span className="mr-1.5 text-navy-3">{i + 1}.</span>{CONCEPTS[c].title}</span>
              <span className="text-[11.5px] font-semibold text-navy-3 opacity-0 transition-opacity group-hover:opacity-100">Learn &rarr;</span>
            </div>
            <div className="mt-1 text-[13px] leading-snug text-navy-2">{clean(fits[c]) || CONCEPTS[c].tagline}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── One piece: what it is, how it's used in THIS build, a small visual, docs links. ──
function ModuleBeat({ cap, idx, count, fit, onHome }: { cap: string; idx: number; count: number; fit?: string; onHome: () => void }) {
  const card = CONCEPTS[cap];
  return (
    <div>
      <button onClick={onHome}
        className="mb-4 inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-line bg-white px-4 py-2 text-[13.5px] font-bold text-navy-2 outline-none transition hover:-translate-y-px hover:border-green hover:bg-green-soft hover:text-green-ink focus-visible:ring-[3px] focus-visible:ring-green-soft">
        <ChevronLeft className="h-4 w-4" /> Back to your architecture
      </button>
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Piece {idx + 1} of {count}</div>
      <h1 className="text-[32px] font-extrabold leading-[1.08] tracking-[-0.025em] text-navy">{card.title}</h1>
      <p className="mt-3 max-w-[56ch] text-[17px] font-semibold leading-relaxed text-navy">{card.tagline}</p>
      <p className="mt-3 max-w-[64ch] text-[15.5px] leading-relaxed text-navy-2">{card.deeper}</p>

      {clean(fit) && (
        <div className="mt-5 max-w-[64ch] rounded-xl border-[1.5px] border-green bg-green-soft px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-green-ink">In your build</div>
          <div className="mt-1 text-[14.5px] leading-snug text-navy">{clean(fit)}.</div>
        </div>
      )}

      {card.demo && (
        <div className="mt-5">
          {card.demo === "genie-chat" && <GenieChatMock />}
          {card.demo === "medallion" && <MedallionMock />}
          {card.demo === "app-builder" && <AppBuilderMock />}
        </div>
      )}

      {card.links.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {card.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-navy-2 hover:border-green hover:text-green-ink">
              {l.kind === "watch" ? <ExternalLink className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}{l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── The quick check: one question per piece. Not graded, reinforcement. ──
function QuizBeat({ caps }: { caps: string[] }) {
  const items = caps.map((c) => ({ cap: c, ...CONCEPTS[c].quiz }));
  const [picked, setPicked] = useState<Record<number, number>>({});
  return (
    <div>
      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Quick check</div>
      <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.025em] text-navy">One on each piece before you build.</h1>
      <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-navy-2">No grade. Just to make each piece stick.</p>
      <div className="mt-6 flex flex-col gap-5">
        {items.map((item, qi) => {
          const chosen = picked[qi], answered = chosen !== undefined;
          return (
            <div key={qi} className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-green-ink">{CONCEPTS[item.cap].short}</div>
              <div className="mb-3 text-[15px] font-bold text-navy">{qi + 1}. {item.q}</div>
              <div className="flex flex-col gap-2">
                {item.options.map((opt, oi) => {
                  const isChosen = chosen === oi, isCorrect = oi === item.answer, show = answered && (isChosen || isCorrect);
                  return (
                    <button key={oi} disabled={answered} onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                      className={`flex items-center gap-2.5 rounded-xl border-[1.5px] px-4 py-2.5 text-left text-[14px] transition-colors
                        ${!answered ? "border-line bg-white text-navy hover:border-green"
                          : show && isCorrect ? "border-green bg-green-soft text-navy"
                          : isChosen ? "border-lava/40 bg-[#fdecef] text-navy"
                          : "border-line bg-white text-navy-3 opacity-60"}`}>
                      {answered && show && (isCorrect ? <Check className="h-4 w-4 shrink-0 text-green" /> : <X className="h-4 w-4 shrink-0 text-lava" />)}
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

// ── Small product-style visuals ──
function GenieChatMock() {
  return (
    <div className="max-w-[460px] overflow-hidden rounded-xl border border-line bg-white">
      <div className="border-b border-line px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-green-ink">Genie</div>
      <div className="flex flex-col gap-2 px-3.5 py-3.5">
        <div className="self-end rounded-lg rounded-tr-sm bg-oat px-3 py-1.5 text-[12.5px] text-navy">Which ones need attention this week?</div>
        <div className="rounded-lg rounded-tl-sm bg-green-soft px-3 py-1.5 text-[12.5px] leading-snug text-navy">Three items are trending the wrong way, led by the top one at 18% above normal. Here's the list.</div>
      </div>
    </div>
  );
}
function MedallionMock() {
  const L = [
    { n: "Bronze", d: "raw, as it arrived", c: "bg-[#f6ede1] text-[#7a5412] border-[#ecd9bd]" },
    { n: "Silver", d: "cleaned and joined", c: "bg-[#eef3f5] text-navy-2 border-line-2" },
    { n: "Gold", d: "ready to use, with your rules", c: "bg-[#fdf6dd] text-[#7a5f00] border-[#ecdca0]" },
  ];
  return (
    <div className="flex max-w-[620px] flex-wrap items-center gap-2">
      {L.map((l, i) => (
        <div key={l.n} className="flex items-center gap-2">
          <div className={`rounded-xl border px-4 py-2.5 ${l.c}`}>
            <div className="text-[13px] font-bold">{l.n}</div>
            <div className="text-[11.5px] opacity-80">{l.d}</div>
          </div>
          {i < L.length - 1 && <ChevronRight className="h-4 w-4 text-line-2" />}
        </div>
      ))}
    </div>
  );
}
function AppBuilderMock() {
  return (
    <div className="max-w-[520px] overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-navy-3">Apps</span>
        <span className="text-line-2">›</span>
        <span className="rounded-md bg-green-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-green-ink">Build</span>
        <span className="ml-auto rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-navy-3">Beta</span>
      </div>
      <div className="px-3.5 py-3.5">
        <div className="text-[11px] font-semibold text-navy-3">Describe your app</div>
        <div className="mt-1.5 rounded-lg border border-line bg-oat/60 px-3 py-2 text-[12.5px] leading-snug text-navy">
          One screen that opens on today's ranked list. Each row shows why it was flagged, with Approve and Change buttons that save to Lakebase.
        </div>
        <div className="mt-2 text-[11px] text-navy-3">Builds with AppKit in your App Space. Refine it one change at a time.</div>
      </div>
    </div>
  );
}
