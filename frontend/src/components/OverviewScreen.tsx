import { MessageSquare, GraduationCap, Map, Hammer, ArrowRight } from "lucide-react";

/* The upfront roadmap: the whole journey first, then one step at a time. */

const PHASES = [
  { n: 1, icon: MessageSquare, name: "Sit down with your SA", why: "Talk your idea through. Your Solutions Architect asks sharp questions, colleagues weigh in, and you leave with a scoped plan for the day." },
  { n: 2, icon: GraduationCap, name: "Learn the pieces", why: "Meet only the Databricks pieces your build uses, and how each one fits your idea." },
  { n: 3, icon: Map, name: "Your plan", why: "The architecture and the PRD on one page, drafted while you learn. Steer anything that's off." },
  { n: 4, icon: Hammer, name: "Build it", why: "Step by step in Genie Code, and the app in Genie App Builder if your build has one." },
];

export function OverviewScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="rise mx-auto max-w-[860px] py-4">
      <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Your build today</div>
      <h1 className="max-w-[20ch] text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-navy">
        From an idea to something real, in one day.
      </h1>
      <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-navy-2">
        Four steps. You'll always know where you are, and the same path works for the next idea you bring back to your team.
      </p>

      <div className="mt-9 flex flex-col gap-3">
        {PHASES.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.name} className="flex items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-soft text-[14px] font-extrabold text-green-ink">{p.n}</span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-oat text-navy-2"><Icon className="h-5 w-5" strokeWidth={2} /></span>
              <div className="min-w-0">
                <b className="text-[16px] font-extrabold tracking-[-0.01em] text-navy">{p.name}</b>
                <p className="mt-0.5 text-[13.5px] leading-snug text-navy-2">{p.why}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-9 flex items-center gap-4">
        <button onClick={onStart}
          className="flex items-center gap-2 rounded-2xl bg-green px-8 py-4 text-[16.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l">
          Pull up a chair <ArrowRight className="h-5 w-5" />
        </button>
        <span className="text-[13px] text-navy-3">Starts with a conversation. No setup needed.</span>
      </div>
    </div>
  );
}
