import { useEffect, useState } from "react";
import { Check, Copy, Lightbulb, ExternalLink, ArrowRight, ChevronLeft, FolderCheck } from "lucide-react";
import type { BuildPlan, BuildStep, BuildTool } from "../lib/types";
import { APPS } from "../lib/constants";
import "./sitdown/sitdown.css";
import { charSVG } from "./sitdown/art";
import { VideoEmbed } from "./VideoEmbed";
import { Label, Title, Lead, Card, Go, Primary, ToolBadge } from "./ui";

/* Build: one step at a time, each clear about WHERE you do it (Genie Code or Genie App
   Builder), the move in a copy box, and "done when" as a checklist item you tick. */

interface Props {
  plan: BuildPlan | null;
  loading: boolean;
  stepIdx: number;
  done: number[];
  publishedDir?: string | null;
  publishedDeepLink?: string | null;
  entered: boolean;
  onEnter: () => void;
  onStep: (i: number) => void;
  onComplete: (n: number) => void;
  onBack: () => void;
}

// Which tool builds a step: Genie App Builder for the app, Genie Code for everything else.
export const stepTool = (s: BuildStep): BuildTool => s.tool || (s.capability === APPS ? "app_builder" : "genie_code");
const firstSentence = (t: string) => (t || "").match(/^.*?[.!?](\s|$)/)?.[0].trim() || (t || "");

export function BuildScreen({ plan, loading, stepIdx, done, publishedDir, publishedDeepLink, entered, onEnter, onStep, onComplete, onBack }: Props) {
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => { document.querySelector("main")?.scrollTo({ top: 0 }); }, [stepIdx, entered]);

  if (!entered || !plan) {
    const ready = !loading && !!plan;
    const hasApp = !!plan?.steps.some((s) => stepTool(s) === "app_builder");
    return (
      <div className="rise mx-auto max-w-[820px]">
        <Label>Build</Label>
        <Title className="mt-1">{ready ? "Here's your build, step by step." : "Writing your build steps…"}</Title>
        {!ready && (
          <Card className="mt-6 px-5 py-5">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-navy">
              <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green" /></span>
              Turning your plan into steps
            </div>
            <p className="mt-1 text-[14px] leading-snug text-navy-3">One step per piece, in build order, each with the exact prompt and how you'll know it worked. Up to a minute.</p>
            <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-oat-2"><span className="sweep" /></div>
          </Card>
        )}
        {ready && plan && (
          <>
            <Lead className="mt-2 max-w-[60ch]">
              {hasApp ? "The data and the pieces in Genie Code, then the app in Genie App Builder." : "All of it in Genie Code, one step at a time."} Set up once, then follow the steps in order.
            </Lead>
            <Card className="mt-6 px-5 py-4">
              <div className="text-[15px] font-semibold text-navy">Set up once</div>
              <ol className="mt-3 flex flex-col gap-3">
                <SetupItem n={1}>
                  <b className="font-semibold">Open your plan</b> and skim it so you know what you're building. Every step points back to it.
                  {publishedDeepLink && <a href={publishedDeepLink} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 font-semibold text-green-ink underline decoration-green/40"><ExternalLink className="h-3.5 w-3.5" />Open PROJECT.md</a>}
                </SetupItem>
                <SetupItem n={2}><b className="font-semibold">Open Genie Code</b> in your workspace and start one chat. Keep it open the whole way.</SetupItem>
                {hasApp && <SetupItem n={3}><b className="font-semibold">Check Genie App Builder is on.</b> The app step uses it (Apps, then the Build tab). It's in Beta, so the workspace preview needs to be enabled; ask your facilitator if you don't see the Build tab.</SetupItem>}
              </ol>
            </Card>
            <Card className="mt-3 px-5 py-4">
              <div className="text-[15px] font-semibold text-navy">The {plan.steps.length} steps</div>
              <ol className="mt-3 flex flex-col">
                {plan.steps.map((s, i) => (
                  <li key={s.n} className={`flex items-start gap-3 py-3 ${i ? "border-t border-line" : ""}`}>
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-oat-2 text-[12px] font-semibold text-navy-2">{s.n}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="text-[15px] font-semibold text-navy">{s.title}</span><ToolBadge tool={stepTool(s)} /></div>
                      <div className="mt-0.5 text-[14px] leading-snug text-navy-3">{firstSentence(s.concept)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
            <div className="mt-6 flex items-center justify-between">
              <button onClick={onBack} className="flex items-center gap-1 text-[15px] text-navy-3 hover:text-navy"><ChevronLeft className="h-4 w-4" /> Your plan</button>
              <Go onClick={onEnter}>Start step 1 <ArrowRight className="h-4 w-4" /></Go>
            </div>
          </>
        )}
        <div className="mt-10 max-w-[640px] border-t border-line pt-6">
          <Label>New to Genie Code? Two minutes</Label>
          <div className="mt-2"><VideoEmbed id="heouBA5U1bE" title="Intro to Genie Code" sub="The AI coding agent you'll build with. You describe what you want in plain words; it writes and runs the work in your workspace." /></div>
        </div>
      </div>
    );
  }

  const steps = plan.steps;
  const step = steps[stepIdx];
  if (!step) return null;
  const allDone = done.length >= steps.length;
  if (allDone && !reviewing) return <CompletionScreen steps={steps} onReview={() => { setReviewing(true); onStep(0); }} onBack={onBack} />;

  const isDone = done.includes(step.n);
  const tool = stepTool(step);
  const complete = () => { onComplete(step.n); if (stepIdx < steps.length - 1) onStep(stepIdx + 1); };

  return (
    <div className="rise mx-auto max-w-[820px]">
      {/* progress through the steps */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1">
          {steps.map((s, i) => (
            <button key={s.n} onClick={() => onStep(i)} aria-label={`Step ${s.n}`}
              className={`h-1.5 flex-1 rounded-full transition-colors ${done.includes(s.n) ? "bg-green" : i === stepIdx ? "bg-navy" : "bg-line-2 hover:bg-navy-3"}`} />
          ))}
        </div>
        <Label>Step {stepIdx + 1} of {steps.length} · {done.length} done</Label>
      </div>

      <div className="mt-6 flex items-center gap-2"><ToolBadge tool={tool} size="md" /></div>
      <Title className="mt-2">{step.title}</Title>
      <p className="mt-2 max-w-[66ch] text-[16px] leading-relaxed text-navy-2">{step.concept}</p>
      {step.teach && (
        <div className="mt-3 flex max-w-[66ch] items-start gap-2 rounded-lg border border-dashed border-[#ecd9a8] bg-[#fffbf3] px-3.5 py-2.5">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#9a5b00]" />
          <div className="text-[14px] leading-snug text-navy-2">{step.teach}</div>
        </div>
      )}

      <StepCard key={step.n} step={step} tool={tool} isDone={isDone} publishedDir={publishedDir} onComplete={complete} />

      {publishedDir && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-2.5">
          <FolderCheck className="h-4 w-4 shrink-0 text-green" />
          <div className="min-w-0 flex-1 text-[13px] text-navy-2">Your full plan is saved: <code className="break-all text-[12px] text-navy-3">{publishedDir}/PROJECT.md</code></div>
          {publishedDeepLink && <a href={publishedDeepLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-navy-2 hover:text-navy"><ExternalLink className="h-3.5 w-3.5" />Open</a>}
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-2 mt-8 flex items-center justify-between border-t border-line bg-oat px-2 py-4 shadow-[0_-14px_22px_-18px_rgba(27,49,57,.35)]">
        <button onClick={stepIdx === 0 ? onBack : () => onStep(stepIdx - 1)} className="flex items-center gap-1 text-[15px] text-navy-3 hover:text-navy">
          <ChevronLeft className="h-4 w-4" /> {stepIdx === 0 ? "Your plan" : "Previous step"}
        </button>
        {isDone && stepIdx < steps.length - 1 && <Primary onClick={() => onStep(stepIdx + 1)}>Next step <ArrowRight className="h-4 w-4" /></Primary>}
      </div>
    </div>
  );
}

const SetupItem = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex items-start gap-3">
    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green text-[12px] font-semibold text-white">{n}</span>
    <div className="text-[15px] leading-snug text-navy">{children}</div>
  </li>
);

// One step's "how": numbered mini-steps for the tool, the move in a copy box, and the
// "done when" checklist item that completes the step.
function StepCard({ step, tool, isDone, publishedDir, onComplete }: { step: BuildStep; tool: BuildTool; isDone: boolean; publishedDir?: string | null; onComplete: () => void }) {
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState(isDone);
  useEffect(() => { setChecked(isDone); setCopied(false); }, [step.n, isDone]);
  const prdRef = publishedDir ? `${publishedDir}/PROJECT.md` : "PROJECT.md in your project folder";
  const move = step.move.replace(/__PROJECT_MD__/g, prdRef);
  const copy = () => { navigator.clipboard?.writeText(move); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  const app = tool === "app_builder";
  const isData = step.capability === "data" || step.n === 1;
  const accent = app ? "border-[#b6d6e2]" : "border-green/40";

  return (
    <Card className={`mt-6 border-[1.5px] ${accent} px-5 py-5`}>
      <div className="text-[15px] font-semibold text-navy">{app ? "Do it in Genie App Builder" : "Do it in Genie Code"}</div>
      <ol className="mt-3 flex flex-col gap-4">
        {app && (
          <Mini n={1} title="Open Genie App Builder">
            In your workspace, open <b className="font-semibold text-navy">Apps</b>, then the <b className="font-semibold text-navy">Build</b> tab, and choose your <b className="font-semibold text-navy">App Space</b> (or create one) so the app sits next to your data.
            <div className="mt-2 rounded-lg border border-dashed border-[#ecd9a8] bg-[#fffbf3] px-3 py-2 text-[13.5px] text-navy-2">Genie App Builder is in Beta, so the workspace preview needs to be enabled. No Build tab? Ask your facilitator to turn it on.</div>
          </Mini>
        )}
        <Mini n={app ? 2 : 1} title={app ? "Paste your app prompt" : "Paste this into your Genie Code chat"}>
          {app ? "It describes your screens in plain language, from your plan. Reword anything you like." : "Your exact wording doesn't matter; the plan carries the details. Reword it if you like."}
          <div className={`relative mt-2.5 rounded-xl border bg-oat/50 px-4 py-3 ${app ? "border-[#b6d6e2]" : "border-line"}`}>
            <button onClick={copy} className="absolute right-3 top-2.5 inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[12px] font-semibold text-navy-2 shadow-sm hover:text-navy">
              {copied ? <><Check className="h-3.5 w-3.5 text-green" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
            </button>
            <div className="text-[12px] font-medium text-navy-3">{app ? "Your app prompt" : "The move"}</div>
            <div className={`mt-1.5 whitespace-pre-wrap pr-16 leading-relaxed text-navy ${app ? "text-[14px]" : "font-mono text-[13px]"}`}>{move}</div>
          </div>
        </Mini>
        {app && (
          <Mini n={3} title="Refine it in short cycles">
            <ul className="mt-1 flex flex-col gap-1.5">
              <li>Ask for one change at a time, check it, then the next.</li>
              <li>Be specific about screens: what it opens on, what each row shows, what each button does.</li>
              <li>Name the tables it reads and the Lakebase table it saves to, exactly as in your plan.</li>
            </ul>
          </Mini>
        )}
        {!app && isData && (
          <Mini n={2} title="Look at what it made">
            Open the catalog, find your schema, and look at the tables. What does one row mean? It makes your next prompts sharper.
          </Mini>
        )}
      </ol>
      <div className="mt-5 border-t border-line pt-4">
        <div className="text-[12px] font-medium text-navy-3">Done when</div>
        <label className={`mt-2 flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${checked ? "border-green bg-green-soft" : "border-line bg-white hover:border-navy-3"}`}>
          <input type="checkbox" className="peer sr-only" checked={checked} disabled={isDone}
            onChange={(e) => { setChecked(e.target.checked); if (e.target.checked) setTimeout(onComplete, 450); }} />
          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px] transition ${checked ? "border-green bg-green text-white" : "border-line-2 bg-white"}`}>
            {checked && <Check className="h-3.5 w-3.5" />}
          </span>
          <span className="text-[15px] leading-snug text-navy">{step.verify}</span>
        </label>
      </div>
    </Card>
  );
}
const Mini = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-oat-2 text-[12px] font-semibold text-navy-2">{n}</span>
    <div className="min-w-0 flex-1">
      <div className="text-[15px] font-semibold text-navy">{title}</div>
      <div className="mt-1 text-[14.5px] leading-relaxed text-navy-2">{children}</div>
    </div>
  </li>
);

// A real finish line: what they stood up, who helped, and what's next.
function CompletionScreen({ steps, onReview, onBack }: { steps: BuildStep[]; onReview: () => void; onBack: () => void }) {
  const NEXT = [
    "Open your app and use it the way the people it's for would.",
    "Show it to a colleague. It's the fastest way to find what to improve.",
    "Keep going one change at a time, the same way you built it.",
    "When you're ready, swap the sample data for your real tables.",
  ];
  const bits = Array.from({ length: 26 }, (_, i) => i);
  return (
    <div className="rise mx-auto max-w-[820px]">
      <div className="relative overflow-hidden rounded-xl border border-green/40 bg-green-soft px-6 py-7">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {bits.map((i) => <span key={i} className="confetti" style={{ left: `${(i * 37) % 100}%`, background: ["#00A870", "#2E7D9A", "#F59E0B", "#5A8A9A"][i % 4], animationDelay: `${(i % 8) * 70}ms` }} />)}
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <Label className="text-green-ink">Build complete</Label>
            <h1 className="mt-1 text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy">You built it.</h1>
            <p className="mt-2 max-w-[48ch] text-[16px] leading-relaxed text-navy-2">From an idea to a working build, one step at a time.</p>
          </div>
          <div className="sd sd-inline flex items-end gap-2" aria-hidden>
            {["store_manager", "finance", "data_engineer"].map((pid, i) => (
              <div key={pid} style={{ animation: `rise .5s ${300 + i * 120}ms both` }} dangerouslySetInnerHTML={{ __html: charSVG(pid, 54, "won") }} />
            ))}
          </div>
        </div>
      </div>
      <Card className="mt-4 px-5 py-4">
        <div className="text-[15px] font-semibold text-navy">What you built</div>
        <ul className="mt-3 flex flex-col gap-2.5">
          {steps.map((s) => (
            <li key={s.n} className="flex flex-wrap items-center gap-2.5 text-[15px] text-navy">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-green text-white"><Check className="h-3 w-3" /></span>
              {s.title}<ToolBadge tool={stepTool(s)} />
            </li>
          ))}
        </ul>
      </Card>
      <Card className="mt-3 px-5 py-4">
        <div className="text-[15px] font-semibold text-navy">Where to go next</div>
        <ul className="mt-2 flex flex-col gap-2">
          {NEXT.map((n, i) => <li key={i} className="flex items-start gap-2 text-[15px] leading-snug text-navy-2"><span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-green" />{n}</li>)}
        </ul>
      </Card>
      <div className="mt-6 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-[15px] text-navy-3 hover:text-navy"><ChevronLeft className="h-4 w-4" /> Your plan</button>
        <Primary onClick={onReview}>Review the steps</Primary>
      </div>
    </div>
  );
}
