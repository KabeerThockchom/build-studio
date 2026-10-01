import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import { Check, ArrowRight, ChevronLeft, Monitor, RefreshCw, X, ChevronDown } from "lucide-react";
import type { Blueprint, PlanJob } from "../lib/types";
import { componentBand } from "../lib/diagram";
import { NODE_COLORS, COMPONENT_ORDER } from "../lib/constants";
import { CONCEPTS } from "../lib/learn";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { VideoEmbed } from "./VideoEmbed";
import { Label, Title, Lead, Card, Go } from "./ui";

/* Your plan: the architecture + PRD, drafted by a background job that started at the
   Sit-Down handoff. Arriving early shows an honest, alive drafting state (three named stages
   and what each does). Refine through the chat bar starts a new job; the change note lands
   at the top. One obvious next step: "Looks good, let's build". */

interface Props {
  blueprint: Blueprint | null;
  job: PlanJob | null;
  error: string | null;
  answers: Record<string, string>;
  onRefine: (note: string) => void;
  onRetry: () => void;
  onBack: () => void;
  onNext: () => void;
}

const STAGES = [
  { k: "drafting", label: "Drafting your plan", sub: "Turning your Sit-Down into a PRD: who it's for, the first screen, the data, the scope." },
  { k: "checking", label: "Checking it against your Sit-Down", sub: "A second pass makes sure your numbers, scope and data are kept exactly, and nothing is invented." },
  { k: "refining", label: "Tightening it up", sub: "Fixes anything the check found. Skipped when the draft is already clean." },
];
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const textOf = (n: ReactNode): string => Children.toArray(n).map((c) => (typeof c === "string" ? c : isValidElement(c) ? textOf((c.props as any).children) : "")).join("");
const split = (v?: string) => (v || "").split(";").map((x) => x.trim()).filter(Boolean);

function Drafting({ job, compact }: { job: PlanJob | null; compact?: boolean }) {
  const at = Math.max(0, STAGES.findIndex((s) => s.k === job?.stage));
  const t0 = useRef(Date.now());
  const [secs, setSecs] = useState(0);
  useEffect(() => { const iv = setInterval(() => setSecs(Math.round((Date.now() - t0.current) / 1000)), 1000); return () => clearInterval(iv); }, []);
  return (
    <Card className="px-5 py-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-navy">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green" /></span>
          {compact ? "Reworking your plan" : "Your plan is on its way"}
        </div>
        <Label>{secs}s so far · usually a minute or two</Label>
      </div>
      <ol className="mt-4 flex flex-col gap-3.5">
        {STAGES.map((s, i) => {
          const done = i < at, cur = i === at;
          return (
            <li key={s.k} className={`flex items-start gap-3 transition-opacity ${i > at ? "opacity-45" : ""}`}>
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold
                ${done ? "bg-green text-white" : cur ? "border-2 border-green text-green-ink" : "border-2 border-line-2 text-navy-3"}`}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-[15px] ${cur ? "font-semibold text-navy" : "text-navy-2"}`}>{s.label}</div>
                <div className="text-[13.5px] leading-snug text-navy-3">{s.sub}</div>
                {cur && <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-oat-2"><span className="sweep" /></div>}
              </div>
            </li>
          );
        })}
      </ol>
      {!compact && (
        <div className="mt-5 border-t border-line pt-4" aria-hidden>
          <Label>What's coming</Label>
          <div className="mt-2 grid grid-cols-[1fr_2fr] gap-3">
            <div className="h-24 animate-pulse rounded-lg bg-oat-2" />
            <div className="flex flex-col gap-2">{[92, 80, 86, 64].map((w, i) => <div key={i} className="h-3 animate-pulse rounded bg-oat-2" style={{ width: `${w}%` }} />)}</div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Chips({ label, items, tone }: { label: string; items: string[]; tone: "today" | "stretch" | "later" }) {
  if (!items.length) return null;
  const cls = tone === "today" ? "border-green/40 bg-green-soft text-navy" : tone === "stretch" ? "border-[#ecd9a8] bg-[#fdf6e6] text-navy" : "border-line bg-white text-navy-3";
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="w-[92px] shrink-0 text-[12px] font-medium text-navy-3">{label}</span>
      {items.map((x, i) => <span key={i} className={`rounded-full border px-3 py-1 text-[13.5px] ${cls}`}>{x}</span>)}
    </div>
  );
}

function RefineBar({ onRefine, disabled }: { onRefine: (n: string) => void; disabled: boolean }) {
  const [note, setNote] = useState("");
  const go = () => { const v = note.trim(); if (v && !disabled) { onRefine(v); setNote(""); } };
  const ideas = ["Make the first screen simpler", "Move the dashboard to stretch", "Explain the data in plainer words"];
  return (
    <Card className="mt-8 px-5 py-4">
      <div className="text-[15px] font-semibold text-navy">Something off? Tell your SA.</div>
      <div className="mt-1 text-[13.5px] text-navy-3">It reworks the plan and tells you exactly what changed.</div>
      <div className="mt-3 flex items-end gap-2">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} disabled={disabled}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } }}
          placeholder="Say what to change…"
          className="min-h-[48px] flex-1 resize-none rounded-xl border border-line-2 bg-white px-4 py-3 text-[15px] text-navy outline-none focus:border-navy-3 disabled:opacity-50" />
        <button onClick={go} disabled={disabled || !note.trim()}
          className="h-12 rounded-xl bg-navy px-5 text-[15px] font-semibold text-white hover:bg-navy-2 disabled:bg-line-2">Rework it</button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {ideas.map((c) => <button key={c} disabled={disabled} onClick={() => setNote(c)}
          className="rounded-full border border-line px-3 py-1 text-[12.5px] text-navy-2 hover:border-navy-3 disabled:opacity-40">{c}</button>)}
      </div>
    </Card>
  );
}

const Section = ({ id, title, children }: { id?: string; title: string; children: ReactNode }) => (
  <section id={id} className="mt-9 scroll-mt-6">
    <div className="mb-3 text-[17px] font-semibold text-navy">{title}</div>
    {children}
  </section>
);

export function PlanScreen({ blueprint, job, error, answers, onRefine, onRetry, onBack, onNext }: Props) {
  const running = job?.status === "running";
  const [noteOpen, setNoteOpen] = useState(true);
  const lastNote = useRef<string>("");
  useEffect(() => {
    // a refine just landed: bring the change note into view
    if (blueprint?.refine_note && blueprint.refine_note !== lastNote.current) {
      lastNote.current = blueprint.refine_note; setNoteOpen(true);
      document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [blueprint?.refine_note]);
  const outline = useMemo(() => (blueprint?.prd_markdown || "").split("\n").filter((l) => /^##\s+/.test(l)).map((l) => l.replace(/^##\s+/, "").trim()), [blueprint?.prd_markdown]);
  const today = split(answers["build_today (core first, in order)"]);
  const stretch = split(answers["stretch (only after the core works)"]);
  const later = split(answers["saved_for_later (do NOT build today)"]);

  return (
    <div className="rise mx-auto max-w-[1040px] pb-4">
      <Label>Your plan</Label>
      <Title className="mt-1">Architecture and PRD, on one page.</Title>
      <Lead className="mt-2 max-w-[62ch]">Everything from your Sit-Down, written up as the plan you'll build from. Read it, and steer anything that's off before you start.</Lead>

      <div className="mt-6">
        {running && <Drafting job={job} compact={!!blueprint} />}
        {error && !running && (
          <Card className="border-[#f3c3bb] bg-[#fdebe8] px-5 py-4">
            <p className="text-[15px] font-semibold text-[#b3261e]">The plan didn't come through</p>
            <p className="mt-1 text-[14px] text-navy-2">{error}</p>
            <button onClick={onRetry} className="mt-2 text-[14px] font-semibold text-[#b3261e] underline">Try again</button>
          </Card>
        )}
        {!blueprint && !running && !error && <Drafting job={job} />}
      </div>

      {blueprint && (
        <div className={running ? "pointer-events-none mt-6 opacity-40 transition-opacity" : "transition-opacity"}>
          {blueprint.refine_note?.trim() && noteOpen && (
            <div className="rise mt-2 flex items-start gap-3 rounded-xl border border-green/40 bg-green-soft px-4 py-3.5">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-green-ink" />
              <div className="flex-1">
                <div className="text-[12px] font-medium text-green-ink">What changed</div>
                <div className="mt-0.5 text-[15px] leading-snug text-navy">{blueprint.refine_note}</div>
                {blueprint.components_changed && (blueprint.components_changed.added.length > 0 || blueprint.components_changed.removed.length > 0) && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {blueprint.components_changed.added.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 rounded-full bg-white bg-opacity-60 px-2.5 py-1 text-[12px] font-semibold text-green-ink">
                        + {c}
                      </span>
                    ))}
                    {blueprint.components_changed.removed.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 rounded-full bg-white bg-opacity-40 px-2.5 py-1 text-[12px] font-semibold text-navy-2">
                        – {c}
                      </span>
                    ))}
                  </div>
                )}
                {blueprint.components_changed?.notes && (
                  <div className="mt-2 text-[13px] text-navy-2">{blueprint.components_changed.notes}</div>
                )}
              </div>
              <button onClick={() => setNoteOpen(false)} aria-label="Dismiss" className="text-navy-3 hover:text-navy"><X className="h-4 w-4" /></button>
            </div>
          )}

          {blueprint.components_changed?.added.length ? (
            <div className="rise mt-4 flex flex-col gap-3">
              {blueprint.components_changed.added.map((cap) => <NewPieceCard key={cap} cap={cap} />)}
            </div>
          ) : null}

          <Section title="How it's put together">
            <Card className="px-3 py-5"><ArchitectureDiagram spec={blueprint.spec} reveal /></Card>
            {blueprint.flow?.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[12px] font-medium text-navy-3">How someone uses it</span>
                {blueprint.flow.map((f, i) => (
                  <span key={f.n} className="flex items-center gap-2">
                    <span className="rounded-full border border-line bg-white px-3 py-1 text-[13.5px] text-navy"><b className="mr-1 font-semibold text-navy-3">{f.n}</b>{f.title}</span>
                    {i < blueprint.flow.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-line-2" />}
                  </span>
                ))}
              </div>
            )}
          </Section>

          <Section title="Today, stretch, later">
            <Card className="flex flex-col gap-3 px-5 py-4">
              {today.length || stretch.length || later.length ? (
                <>
                  <Chips label="Today" items={today} tone="today" />
                  <Chips label="Stretch" items={stretch} tone="stretch" />
                  <Chips label="Later" items={later} tone="later" />
                </>
              ) : (
                <>
                  <Chips label="Today" items={blueprint.scope_in} tone="today" />
                  <Chips label="Later" items={blueprint.scope_later} tone="later" />
                </>
              )}
            </Card>
          </Section>

          <Section title="The PRD">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
              {outline.length > 2 && (
                <nav className="hidden lg:block" aria-label="PRD outline">
                  <div className="sticky top-4 flex flex-col gap-0.5">
                    {outline.map((h) => (
                      <a key={h} href={`#prd-${slug(h)}`} onClick={(e) => { e.preventDefault(); document.getElementById(`prd-${slug(h)}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                        className="rounded-md px-2 py-1 text-[13.5px] text-navy-3 hover:bg-white hover:text-navy">{h}</a>
                    ))}
                  </div>
                </nav>
              )}
              <article className="prd rounded-xl border border-line bg-white px-8 py-7">
                <Markdown components={{ h2: ({ children }) => <h2 id={`prd-${slug(textOf(children))}`} className="scroll-mt-6">{children}</h2> }}>
                  {blueprint.prd_markdown}
                </Markdown>
              </article>
            </div>
          </Section>

          {(blueprint.app_screens?.length ?? 0) > 0 && (
            <Section title="The app's screens">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {blueprint.app_screens!.map((s, i) => (
                  <Card key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e6f2f6] text-[#1f6480]"><Monitor className="h-4 w-4" /></span>
                    <span className="text-[14.5px] leading-snug text-navy">{s}</span>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {blueprint.decisions.length > 0 && (
            <Section title="Decisions and tradeoffs">
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {blueprint.decisions.map((d, i) => {
                  const b = NODE_COLORS[componentBand(d.tag)];
                  return (
                    <Card key={i} className="px-4 py-4">
                      <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
                        style={componentBand(d.tag) === "delivery" ? { background: "#e9eef0", color: "#1B3139" } : { background: b.fill, color: b.text }}>{d.tag}</span>
                      <div className="mt-2 text-[15px] font-semibold leading-snug text-navy">{d.text}</div>
                      {d.tradeoff && <div className="mt-2 border-t border-line pt-2 text-[13.5px] leading-snug text-navy-2"><span className="font-semibold text-[#9a5b00]">Tradeoff </span>{d.tradeoff}</div>}
                    </Card>
                  );
                })}
              </div>
            </Section>
          )}

          <RefineBar onRefine={onRefine} disabled={running} />
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-2 mt-8 flex items-center justify-between border-t border-line bg-oat px-2 py-4 shadow-[0_-14px_22px_-18px_rgba(27,49,57,.35)]">
        <button onClick={onBack} className="flex items-center gap-1 text-[15px] text-navy-3 hover:text-navy"><ChevronLeft className="h-4 w-4" /> Back to Learn</button>
        <Go onClick={onNext} disabled={!blueprint || running}>Looks good, let's build <ArrowRight className="h-4 w-4" /></Go>
      </div>
    </div>
  );
}

// A piece a refine added that Learn never taught: its short version, right here (hooks live in their own
// component, so adding several pieces in one refine can't change the parent's hook order).
function NewPieceCard({ cap }: { cap: string }) {
  const [expanded, setExpanded] = useState(false);
  const concept = CONCEPTS[cap];
  if (!concept) return null;
  return (
    <Card className="px-4 py-3.5">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-start justify-between gap-2 text-left">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-green-ink">New piece</div>
          <div className="mt-0.5 text-[15px] font-semibold text-navy">{concept.title}</div>
          <div className="mt-1 text-[14px] text-navy-2">{concept.tagline}</div>
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-navy-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="text-[14px] leading-snug text-navy-2">{concept.deeper}</div>
          {concept.video && (
            <div className="mt-3">
              <VideoEmbed id={concept.video.id} title={concept.video.title} sub={concept.video.sub} short={concept.video.short} eyebrow="How it works" />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
