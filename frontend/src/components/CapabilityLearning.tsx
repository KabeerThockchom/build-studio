import { useEffect, useMemo, useState } from "react";
import { Check, X, ChevronLeft, ArrowRight, BookOpen, ExternalLink, Sparkles } from "lucide-react";
import { CONCEPTS, learnComponents, quizFor } from "../lib/learn";
import { VideoEmbed } from "./VideoEmbed";
import { BAND_LABELS, NODE_COLORS } from "../lib/constants";
import { componentBand } from "../lib/diagram";
import type { DiagramSpec } from "../lib/types";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { Label, Title, Lead, Card, Go, Primary } from "./ui";

/* Learn plays while the plan drafts in the background. It is about THEIR build: the
   architecture reveals itself piece by piece, each piece gets a short module, then a quick
   check. The rail ticks as they go. */

interface Props {
  capabilities: string[];
  fits: Record<string, string>;
  spec: DiagramSpec;
  beat: number;
  onBeat: (i: number) => void;
  onBack: () => void;
  onDone: () => void;
  planReady: boolean;
}

const clean = (s?: string) => (s || "").trim().replace(/\.$/, "");
const sentences = (t: string) => (t.match(/[^.!?]+[.!?]+/g) || [t]).map((x) => x.trim()).filter(Boolean);

function BandChip({ cap }: { cap: string }) {
  const b = componentBand(cap), c = NODE_COLORS[b];
  const style = b === "delivery" ? { background: "#e9eef0", color: "#1B3139" } : { background: c.fill, color: c.text };
  return <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={style}>{BAND_LABELS[b]}</span>;
}

export function CapabilityLearning({ capabilities, fits, spec, beat, onBeat, onBack, onDone, planReady }: Props) {
  const caps = learnComponents(capabilities);
  const total = caps.length + 2;
  const cur = Math.max(0, Math.min(total - 1, beat));
  const onArch = cur === 0, onQuiz = cur === caps.length + 1;
  const goTo = (i: number) => onBeat(Math.max(0, Math.min(total - 1, i)));
  useEffect(() => { document.querySelector("main")?.scrollTo({ top: 0 }); }, [cur]);
  const nextLabel = onArch ? `Start with ${CONCEPTS[caps[0]].short}` : cur < caps.length ? `Next: ${CONCEPTS[caps[cur]].short}` : "Quick check";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-[880px] flex-col">
      {/* progress: one segment per beat, the rail mirrors it */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Go to ${i + 1}`}
              className={`h-1 flex-1 rounded-full transition-colors ${i < cur ? "bg-navy-2" : i === cur ? "bg-green" : "bg-line-2 hover:bg-navy-3"}`} />
          ))}
        </div>
        <Label>{onArch ? "Your architecture" : onQuiz ? "Quick check" : `Piece ${cur} of ${caps.length}`}</Label>
      </div>

      <div className="flex flex-1 items-start py-8">
        <div key={cur} className="rise w-full">
          {onArch ? <ArchitectureBeat caps={caps} fits={fits} spec={spec} onOpen={(c) => goTo(caps.indexOf(c) + 1)} />
            : onQuiz ? <QuizBeat caps={caps} />
            : <ModuleBeat cap={caps[cur - 1]} idx={cur - 1} count={caps.length} fit={fits[caps[cur - 1]]} onHome={() => goTo(0)} />}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-2 flex items-center justify-between border-t border-line bg-oat px-2 py-4 shadow-[0_-14px_22px_-18px_rgba(27,49,57,.35)]">
        <button onClick={cur === 0 ? onBack : () => goTo(cur - 1)}
          className="flex items-center gap-1 text-[15px] text-navy-3 hover:text-navy">
          <ChevronLeft className="h-4 w-4" /> {cur === 0 ? "Back to the Sit-Down" : "Previous"}
        </button>
        {onQuiz
          ? <Go onClick={onDone}>{planReady ? "See your plan" : "See your plan, almost ready"} <ArrowRight className="h-4 w-4" /></Go>
          : <Primary onClick={() => goTo(cur + 1)}>{nextLabel} <ArrowRight className="h-4 w-4" /></Primary>}
      </div>
    </div>
  );
}

// ── The opening beat: a reveal of THEIR build, one piece at a time. ──
function ArchitectureBeat({ caps, fits, spec, onOpen }: { caps: string[]; fits: Record<string, string>; spec: DiagramSpec; onOpen: (c: string) => void }) {
  return (
    <div>
      <Label>Your architecture</Label>
      <Title className="mt-1">Here's what you'll build.</Title>
      <Lead className="mt-2 max-w-[60ch]">
        {caps.length} {caps.length === 1 ? "piece" : "pieces"}, chosen from what you scoped in the Sit-Down. Data flows left to right, from your data to the screen people use.
      </Lead>
      <Card className="mt-6 px-3 py-4"><ArchitectureDiagram spec={spec} reveal /></Card>
      <ol className="mt-5 flex flex-col gap-2">
        {caps.map((c, i) => (
          <li key={c} style={{ animation: `rise .5s ${400 + i * 260}ms cubic-bezier(.2,.7,.2,1) both` }}>
            <button onClick={() => onOpen(c)}
              className="group flex w-full items-center gap-4 rounded-xl border border-line bg-white px-4 py-3 text-left transition hover:-translate-y-px hover:border-navy-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-green-soft">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-oat-2 text-[12px] font-semibold text-navy-2">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold text-navy">{CONCEPTS[c].title}</span><BandChip cap={c} />
                </div>
                <div className="mt-0.5 text-[14px] leading-snug text-navy-2">
                  <span className="text-navy-3">In your build: </span>{clean(fits[c]) || CONCEPTS[c].tagline}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-line-2 transition group-hover:translate-x-0.5 group-hover:text-navy-3" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── One piece: what it is, its job in THIS build, how it works in three short points. ──
function ModuleBeat({ cap, idx, count, fit, onHome }: { cap: string; idx: number; count: number; fit?: string; onHome: () => void }) {
  const card = CONCEPTS[cap];
  const points = sentences(card.deeper).slice(0, 3);
  return (
    <div>
      <button onClick={onHome} className="mb-4 inline-flex items-center gap-1 text-[13.5px] text-navy-3 hover:text-navy">
        <ChevronLeft className="h-4 w-4" /> Your architecture
      </button>
      <div className="flex items-center gap-2"><Label>Piece {idx + 1} of {count}</Label><BandChip cap={cap} /></div>
      <Title className="mt-1">{card.title}</Title>
      <Lead className="mt-2 max-w-[56ch]">{card.tagline}</Lead>

      {/* With a video, it gets the whole right column (sticky, full height); everything else stacks on the left. */}
      <div className={`mt-6 grid grid-cols-1 gap-5 ${card.video ? "lg:grid-cols-[minmax(0,1fr)_auto]" : "lg:grid-cols-[1.15fr_1fr]"}`}>
        <div className="flex min-w-0 flex-col gap-4">
          {clean(fit) && (
            <div className="rounded-xl border border-green/40 bg-green-soft px-4 py-3.5">
              <div className="text-[12px] font-medium text-green-ink">Its job in your build</div>
              <div className="mt-1 text-[15px] leading-snug text-navy">{clean(fit)}.</div>
            </div>
          )}
          <Card className="px-4 py-4">
            <div className="text-[12px] font-medium text-navy-3">How it works</div>
            <ol className="mt-2.5 flex flex-col gap-3">
              {points.map((p, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-navy-2">
                  <span className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-oat-2 text-[11px] font-semibold text-navy-2">{i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </Card>
          {card.video && <><ModuleDemo demo={card.demo} /><ModuleLinks links={card.links} /></>}
        </div>
        {card.video ? (
          <div className="lg:sticky lg:top-6 lg:self-start">
            <VideoEmbed id={card.video.id} title={card.video.title} sub={card.video.sub} short={card.video.short} tall eyebrow="A short walkthrough" />
          </div>
        ) : (
          <div className="flex flex-col gap-4"><ModuleDemo demo={card.demo} /><ModuleLinks links={card.links} /></div>
        )}
      </div>
    </div>
  );
}

function ModuleDemo({ demo }: { demo?: string }) {
  if (demo === "genie-chat") return <GenieChatMock />;
  if (demo === "medallion") return <MedallionMock />;
  if (demo === "app-builder") return <AppBuilderMock />;
  if (demo === "decision-log") return <DecisionLogMock />;
  return null;
}
function ModuleLinks({ links }: { links: { label: string; url: string; kind?: string }[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-navy-2 hover:border-navy-3 hover:text-navy">
          {l.kind === "watch" ? <ExternalLink className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}{l.label}
        </a>
      ))}
    </div>
  );
}

// ── The quick check: instant feedback, a small celebration when it's done. ──
function QuizBeat({ caps }: { caps: string[] }) {
  const items = useMemo(() => quizFor(caps), [caps.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState<Record<number, number>>({});
  const answered = Object.keys(picked).length;
  const right = items.filter((it, i) => picked[i] === it.answer).length;
  const finished = answered === items.length;
  return (
    <div>
      <Label>Quick check</Label>
      <Title className="mt-1">Five quick questions on your build.</Title>
      <Lead className="mt-2">No grade. Tap an answer to see why.</Lead>
      <div className="mt-6 flex flex-col gap-3">
        {items.map((item, qi) => {
          const chosen = picked[qi], done = chosen !== undefined;
          return (
            <section key={qi} data-quiz className="rounded-xl border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <Label>{qi + 1} of {items.length} · {item.cap ? CONCEPTS[item.cap].short : "How it fits together"}</Label>
                {done && (chosen === item.answer
                  ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-green-ink"><Check className="h-3.5 w-3.5" /> Right</span>
                  : <span className="text-[12px] font-semibold text-navy-3">Not quite</span>)}
              </div>
              <div className="mt-1.5 text-[16px] font-semibold leading-snug text-navy">{item.q}</div>
              <div className="mt-3 flex flex-col gap-2">
                {item.options.map((opt, oi) => {
                  const isChosen = chosen === oi, isCorrect = oi === item.answer, show = done && (isChosen || isCorrect);
                  return (
                    <button key={oi} disabled={done} onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition
                        ${!done ? "border-line bg-white text-navy hover:border-navy-3"
                          : show && isCorrect ? "border-green bg-green-soft text-navy"
                          : isChosen ? "border-[#f3c3bb] bg-[#fdebe8] text-navy"
                          : "border-line bg-white text-navy-3 opacity-55"}`}>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px]
                        ${show && isCorrect ? "border-green bg-green text-white" : isChosen ? "border-[#e25a45] bg-[#e25a45] text-white" : "border-line-2"}`}>
                        {show && isCorrect ? <Check className="h-3 w-3" /> : isChosen ? <X className="h-3 w-3" /> : null}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {done && <div className="rise mt-3 rounded-lg bg-oat px-3.5 py-2.5 text-[14px] leading-snug text-navy-2">{item.why}</div>}
            </section>
          );
        })}
      </div>
      {finished && (
        <div className="rise relative mt-5 overflow-hidden rounded-xl border border-green/40 bg-green-soft px-5 py-4">
          <Confetti />
          <div className="relative flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-green text-white"><Sparkles className="h-[18px] w-[18px]" /></span>
            <div>
              <div className="text-[16px] font-semibold text-navy">{right === items.length ? "All right first time. You're ready." : `${right} of ${items.length} first time. You're ready.`}</div>
              <div className="text-[14px] text-navy-2">Your plan is next. It's been drafting while you learned.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Confetti() {
  const bits = Array.from({ length: 18 }, (_, i) => i);
  const cols = ["#00A870", "#2E7D9A", "#F59E0B", "#5A8A9A"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {bits.map((i) => (
        <span key={i} className="confetti" style={{ left: `${(i * 53) % 100}%`, background: cols[i % 4], animationDelay: `${(i % 6) * 60}ms` }} />
      ))}
    </div>
  );
}

// ── Small product-style visuals ──
function Frame({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2">
        <span className="text-[12px] font-medium text-navy-3">{title}</span>
        {badge && <span className="ml-auto rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-navy-3">{badge}</span>}
      </div>
      <div className="px-3.5 py-3.5">{children}</div>
    </Card>
  );
}
function GenieChatMock() {
  return (
    <Frame title="Genie space">
      <div className="flex flex-col gap-2">
        <div className="self-end rounded-lg rounded-tr-sm bg-oat px-3 py-1.5 text-[13px] text-navy">Which ones need attention this week?</div>
        <div className="rounded-lg rounded-tl-sm bg-green-soft px-3 py-2 text-[13px] leading-snug text-navy">Three are trending the wrong way, led by the top one at 18% above normal. Here's the list.</div>
      </div>
    </Frame>
  );
}
function MedallionMock() {
  const L = [
    { n: "Bronze", d: "raw, as it arrived", bg: "#f6ede1", fg: "#7a5412" },
    { n: "Silver", d: "cleaned and joined", bg: "#eef3f5", fg: "#2E5A6B" },
    { n: "Gold", d: "ready, with your rules", bg: "#fdf6dd", fg: "#7a5f00" },
  ];
  return (
    <Frame title="One pipeline, three layers">
      <div className="flex items-stretch gap-1.5">
        {L.map((l, i) => (
          <div key={l.n} className="flex flex-1 items-center gap-1.5">
            <div className="flex-1 rounded-lg px-3 py-2.5" style={{ background: l.bg, color: l.fg, animation: `rise .5s ${i * 180}ms both` }}>
              <div className="text-[14px] font-semibold">{l.n}</div>
              <div className="text-[12px] opacity-85">{l.d}</div>
            </div>
            {i < L.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-line-2" />}
          </div>
        ))}
      </div>
    </Frame>
  );
}
function DecisionLogMock() {
  const rows = [["Item 1042", "Approved", "9:14"], ["Item 0977", "Changed", "9:21"], ["Item 1108", "Note added", "9:30"]];
  return (
    <Frame title="Lakebase: decisions, as they happen">
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-oat px-3 py-1.5 text-[13px]" style={{ animation: `rise .4s ${i * 140}ms both` }}>
            <span className="text-navy">{r[0]}</span>
            <span className="rounded-full bg-green-soft px-2 text-[11.5px] font-medium text-green-ink">{r[1]}</span>
            <span className="ml-auto text-[12px] tabular-nums text-navy-3">{r[2]}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}
function AppBuilderMock() {
  return (
    <Frame title="Apps  ›  Build" badge="Beta">
      <div className="text-[12px] font-medium text-navy-3">Describe your app</div>
      <div className="mt-1.5 rounded-lg border border-line bg-oat/60 px-3 py-2 text-[13px] leading-snug text-navy">
        One screen that opens on today's ranked list. Each row shows why it was flagged, with Approve and Change buttons that save to Lakebase.
      </div>
      <div className="mt-2 text-[12px] text-navy-3">Builds with AppKit in your App Space. Refine it one change at a time.</div>
    </Frame>
  );
}
