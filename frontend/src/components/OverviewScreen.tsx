import { ArrowRight } from "lucide-react";
import "./sitdown/sitdown.css";
import { charSVG } from "./sitdown/art";
import { Label, Lead } from "./ui";

/* The upfront roadmap: a short, inviting start. The whole journey in four stages, and the
   colleagues you'll meet in the Sit-Down (their roles adapt to your idea). */

const STAGES = [
  { n: 1, name: "Sit down with your SA", why: "Talk your idea through until it's sharp and scoped for a day." },
  { n: 2, name: "Learn the pieces", why: "Only the Databricks pieces your build uses, and their job in it." },
  { n: 3, name: "Your plan", why: "Architecture and PRD on one page, drafted while you learn." },
  { n: 4, name: "Build it", why: "Step by step in Genie Code, and the app in Genie App Builder." },
];
const CAST = [
  { pid: "finance", name: "Marcus" }, { pid: "store_manager", name: "Jo" }, { pid: "data_engineer", name: "Arjun" },
  { pid: "governance", name: "Amara" }, { pid: "platform", name: "Tom" }, { pid: "regional_ops", name: "Sam" },
];

export function OverviewScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="rise mx-auto max-w-[920px] py-2">
      <Label>Build Studio</Label>
      <h1 className="mt-2 max-w-[18ch] text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] text-navy">
        Bring an idea. Leave with something real.
      </h1>
      <Lead className="mt-4 max-w-[54ch]">
        It starts with a conversation, not a form. Your Solutions Architect helps you sharpen the idea, then you build it, one step at a time.
      </Lead>

      <ol className="mt-9 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
        {STAGES.map((s, i) => (
          <li key={s.n} className="relative rounded-xl border border-line bg-white px-4 py-4">
            <div className="flex items-center gap-2">
              <span className={`grid h-6 w-6 place-items-center rounded-full text-[12px] font-semibold ${i === 0 ? "bg-green text-white" : "bg-oat-2 text-navy-2"}`}>{s.n}</span>
              {i === 0 && <span className="text-[12px] font-medium text-green-ink">You start here</span>}
            </div>
            <div className="mt-3 text-[15px] font-semibold text-navy">{s.name}</div>
            <p className="mt-1 text-[13.5px] leading-snug text-navy-3">{s.why}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap items-center gap-6 rounded-xl border border-line bg-white px-5 py-4">
        <div className="min-w-[200px] flex-1">
          <div className="text-[15px] font-semibold text-navy">Colleagues will weigh in</div>
          <p className="mt-1 text-[13.5px] leading-snug text-navy-3">They join the Sit-Down to challenge, ask, or cheer. Their roles adapt to your idea.</p>
        </div>
        <div className="sd sd-inline flex items-end gap-3" aria-hidden>
          {CAST.map((c, i) => (
            <div key={c.pid} className="flex flex-col items-center gap-1" style={{ animation: `rise .5s ${i * 70}ms cubic-bezier(.2,.7,.2,1) both` }}>
              <div dangerouslySetInnerHTML={{ __html: charSVG(c.pid, 46, i % 3 === 0 ? "won" : "warming") }} />
              <span className="text-[12px] font-medium text-navy-3">{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-9 flex flex-wrap items-center gap-4">
        <button onClick={onStart}
          className="inline-flex items-center gap-2 rounded-xl bg-green px-7 py-4 text-[16px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(0,168,112,.8)] transition hover:-translate-y-px hover:bg-green-ink">
          Pull up a chair <ArrowRight className="h-5 w-5" />
        </button>
        <span className="text-[13.5px] text-navy-3">About an hour, end to end. Nothing to set up first.</span>
      </div>
    </div>
  );
}
