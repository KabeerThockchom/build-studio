/* Co-brand lockup: Publix + Databricks. Tasteful, minimal — the two real logos separated
   by a hairline divider. `size` scales both marks together; `variant="rail"` is the compact
   left-rail treatment. Assets live in /public (publix.svg is the green Publix mark, and
   databricks.svg is the Lava Spark + wordmark). */

export function BrandLockup({ size = 30, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <img src="/publix.svg" alt="Publix" style={{ height: size, width: size }} className="shrink-0" />
      <span aria-hidden className="h-6 w-px bg-line-2" />
      <img src="/databricks.svg" alt="Databricks" style={{ height: size * 0.62 }} className="shrink-0" />
    </div>
  );
}
