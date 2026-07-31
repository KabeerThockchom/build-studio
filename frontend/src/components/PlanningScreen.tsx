// Shown while the SA reads the idea and authors the design questions.
export function PlanningScreen({ idea, error, onRetry, onSkip }: {
  idea: string; error: string | null; onRetry: () => void; onSkip: () => void;
}) {
  return (
    <div className="rise max-w-[680px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Design</div>
      {!error ? (
        <>
          <h2 className="mb-4 text-[29px] font-extrabold leading-[1.1] tracking-[-0.022em] text-navy">
            Reading your idea…
          </h2>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-6 py-7 text-[15px] text-navy-2">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 rounded-full bg-green"
                  style={{ animation: `dots 1.4s ${i * 0.16}s infinite ease-in-out` }} />
              ))}
            </span>
            Thinking through the design questions that matter for what you're building…
          </div>
          <p className="mt-4 max-w-[54ch] text-[14px] italic leading-relaxed text-navy-3">"{idea.slice(0, 160)}{idea.length > 160 ? "…" : ""}"</p>
        </>
      ) : (
        <>
          <h2 className="mb-3 text-[26px] font-extrabold leading-tight text-navy">Couldn't reach the design assistant</h2>
          <p className="mb-5 max-w-[54ch] text-[15px] text-navy-2">{error}</p>
          <div className="flex gap-3">
            <button onClick={onRetry} className="rounded-xl bg-green px-6 py-3 text-[15px] font-bold text-white hover:bg-green-l">Try again</button>
            <button onClick={onSkip} className="rounded-xl border border-line-2 px-6 py-3 text-[15px] font-semibold text-navy-2 hover:bg-oat">Use standard questions</button>
          </div>
        </>
      )}
    </div>
  );
}
