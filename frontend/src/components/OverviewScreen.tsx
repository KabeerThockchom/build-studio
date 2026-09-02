import { Lightbulb, MessageSquare, Boxes, Map, Hammer, ArrowRight } from "lucide-react";

/* The upfront roadmap — grounds a newcomer in the whole journey before diving into
   specifics (Akil's ask): "give the holistic picture, then dive into each module."
   Five phases, each with a one-line why-it-matters, then jump into the material. */

const PHASES = [
  { n: 1, icon: Lightbulb, name: "Shape", why: "Start with the problem in your own words. The clearer your intent, the better everything downstream." },
  { n: 2, icon: MessageSquare, name: "Design", why: "Answer a few questions tailored to your idea. This is where your plan — the PRD — takes shape." },
  { n: 3, icon: Boxes, name: "Assemble", why: "Pick the Databricks pieces that fit: ask your data, an app to open, a place to record decisions." },
  { n: 4, icon: Map, name: "Blueprint", why: "See the whole build on one page — the plan and how the parts connect — before you build it." },
  { n: 5, icon: Hammer, name: "Build", why: "Build it for real in Genie Code, one bite-sized move at a time. Not a wall of prompts." },
];

export function OverviewScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="rise mx-auto max-w-[880px] py-4">
      <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Your workshop today</div>
      <h1 className="max-w-[18ch] text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-navy">
        How do you build an end-to-end AI app?
      </h1>
      <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-navy-2">
        You'll go from a plain idea to a working app you built yourself, in five steps. Here's the
        whole path first — then we'll take it one step at a time, so you always know where you are
        and why each part matters.
      </p>

      <div className="mt-9 flex flex-col gap-3">
        {PHASES.map((p, i) => {
          const Icon = p.icon;
          return (
            <div key={p.name} className="flex items-center gap-4">
              <div className="flex items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4 flex-1">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-soft text-[14px] font-extrabold text-green-ink">{p.n}</span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-oat text-navy-2"><Icon className="h-5 w-5" strokeWidth={2} /></span>
                <div className="min-w-0">
                  <b className="text-[16px] font-extrabold tracking-[-0.01em] text-navy">{p.name}</b>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-navy-2">{p.why}</p>
                </div>
              </div>
              {i < PHASES.length - 1 && <ArrowRight className="hidden h-4 w-4 shrink-0 text-line-2 sm:block" />}
            </div>
          );
        })}
      </div>

      <div className="mt-9 flex items-center gap-4">
        <button onClick={onStart}
          className="flex items-center gap-2 rounded-2xl bg-green px-8 py-4 text-[16.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l">
          Start with your idea <ArrowRight className="h-5 w-5" />
        </button>
        <span className="text-[13px] text-navy-3">Takes about an hour. You'll leave with something real.</span>
      </div>
    </div>
  );
}
