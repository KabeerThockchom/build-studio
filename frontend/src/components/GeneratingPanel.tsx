import { useEffect, useState } from "react";

/* A "this is working, hang tight" panel for the long generation waits (blueprint
   ~1-2 min, build ~1 min). The earlier static label read as a crash to impatient
   users; this keeps motion (a sweeping bar), cycles through what's happening so the
   text changes, and sets an honest time expectation. Not a real progress bar — it's
   an indeterminate wait — but it never looks frozen. */

interface Props {
  steps: string[];        // status lines to cycle through, in order
  note?: string;          // one honest line about how long / why it's worth it
  intervalMs?: number;    // cadence — pace it to the real wait so the last line isn't reached too early
}

export function GeneratingPanel({ steps, note, intervalMs = 6000 }: Props) {
  const [i, setI] = useState(0);
  useEffect(() => {
    // Advance the status line, holding on the last one (don't loop back to "starting"
    // after we've clearly moved on — that would read as stuck). The last line must be
    // honest and open-ended (e.g. "still working"), never promise "a few more seconds",
    // since it may sit there past the estimate on a slow call.
    const t = setInterval(() => setI((n) => Math.min(steps.length - 1, n + 1)), intervalMs);
    return () => clearInterval(t);
  }, [steps.length, intervalMs]);

  return (
    <div>
      <div className="rounded-2xl border border-line bg-white px-6 py-6">
        {/* sweeping indeterminate bar */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-oat-2">
          <span className="sweep" />
        </div>
        {/* the current status line, with the ones before it checked off */}
        <div className="mt-5 flex flex-col gap-2.5">
          {steps.map((s, idx) => {
            if (idx > i) return null;
            const done = idx < i, cur = idx === i;
            return (
              <div key={idx} className={`flex items-center gap-2.5 text-[14.5px] ${cur ? "text-navy font-semibold" : "text-navy-3"}`}>
                {done ? (
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-green text-white text-[9px]">✓</span>
                ) : (
                  <span className="flex w-4 shrink-0 justify-center gap-0.5">
                    {[0, 1, 2].map((d) => <span key={d} className="h-1 w-1 rounded-full bg-green" style={{ animation: `dots 1.4s ${d * 0.16}s infinite ease-in-out` }} />)}
                  </span>
                )}
                {s}
              </div>
            );
          })}
        </div>
      </div>
      {note && <p className="mt-3 text-[13px] leading-relaxed text-navy-3">{note}</p>}
    </div>
  );
}
