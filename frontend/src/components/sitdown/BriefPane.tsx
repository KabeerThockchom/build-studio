/* The right pane: your idea, the ring (overall letter across all seven sections, arc = the
   same overall progress), and one card per section with a five-dot rating. It waits its turn:
   it only moves after the SA finishes speaking (drafts dashed, then solid, then the grade). */
import { useEffect, useRef, useState } from "react";
import {
  DIMS, dimLabel, dotsOf, gcls, gIdx, GCOL, GINK, noDash, overallLetter, overallMean, coveredDims, RM, type Disp,
} from "./engine";

export interface Draft { dim: string; text: string; old: string; }
export interface BriefFx {
  nonce: number;
  draftIn?: boolean;
  solid?: Record<string, string>;                         // dim -> old text ('' for a first write)
  changed?: { k: string; old: string | null; nw: string }[];
}

function Dots({ g, from, animate, muted }: { g?: string; from?: string | null; animate?: boolean; muted?: boolean }) {
  // Show the old rating first, then fill to the new one with a small green pulse.
  const [phase, setPhase] = useState<"old" | "new">(animate && !RM ? "old" : "new");
  useEffect(() => {
    if (!animate || RM) return;
    const t = setTimeout(() => setPhase("new"), 350);
    return () => clearTimeout(t);
  }, [animate]);
  const show = phase === "old" ? from : g;
  const n = muted ? 0 : dotsOf(show), was = dotsOf(from);
  return (
    <span className={`dots ${muted ? "muted" : gcls(show)}`} title={muted ? "Not covered yet" : `${show || ""} · ${n} of 5`} aria-label={`${n} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const on = i < n, fill = phase === "new" && animate && on && i >= was && !RM;
        return <i key={i} className={`${on ? "on" : ""} ${fill ? "fill" : ""}`} style={fill ? { animationDelay: `${(i - was) * 120}ms` } : undefined} />;
      })}
    </span>
  );
}

function Changelog({ k, disp }: { k: string; disp: Disp }) {
  const lg = disp.log[k] || [];
  const [open, setOpen] = useState(false);
  if (!lg.length) return null;
  const l = lg[lg.length - 1];
  return (
    <>
      <div className="clog"><span className="v">v{l.v}</span><span>{l.t}</span>
        {lg.length > 1 && <button onClick={() => setOpen((o) => !o)}>{open ? "Hide" : `${lg.length - 1} earlier`}</button>}
      </div>
      {open && <ul className="clogall">{lg.slice(0, -1).reverse().map((x) => <li key={x.v}><span className="v">v{x.v}</span> {x.t}</li>)}</ul>}
    </>
  );
}

export function BriefPane({ disp, drafts, fx, idea, started }: { disp: Disp; drafts: Draft[]; fx: BriefFx; idea: string; started: boolean }) {
  const g = overallLetter(disp), m = overallMean(disp);
  const C = 2 * Math.PI * 27;
  // ring flash + slight grow when the overall letter goes up
  const prev = useRef<string | null>(null);
  const [ringUp, setRingUp] = useState(0);
  useEffect(() => {
    if (g && prev.current && gIdx(g) > gIdx(prev.current) && !RM) setRingUp((n) => n + 1);
    if (g) prev.current = g;
  }, [g]);
  const gc = gcls(g);
  const chg = Object.fromEntries((fx.changed || []).filter((c) => c.old && c.old !== c.nw).map((c) => [c.k, c]));
  const jump = (k: string) => { const c = chg[k]; return !!c && !!c.old && c.old[0] !== c.nw[0] && gIdx(c.nw) > gIdx(c.old); };
  const solid = fx.solid || {};
  const dr = (k: string) => drafts.find((d) => d.dim === k);
  const keys = DIMS.map((d) => d.key);
  const shown = keys.filter((k) => disp.settled.includes(k) || dr(k));
  const open = keys.filter((k) => !shown.includes(k));
  const sharperFlash = Object.keys(chg).length > 0 && !!disp.sharper;

  return (
    <aside className="brief">
      <div className="bhd">
        <div key={`ring-${ringUp}`} className={`ringw ${ringUp ? "ringup" : ""}`}>
          <div className="ring">
            <svg viewBox="0 0 64 64">
              <circle className="trk" cx="32" cy="32" r="27" />
              <circle className="val" cx="32" cy="32" r="27"
                style={{ strokeDasharray: C, strokeDashoffset: C * (1 - m / 5), stroke: GCOL[gc] || "var(--line2)" }} />
            </svg>
            <div key={g || "none"} className="L pop" style={{ color: GINK[gc] || undefined }}>{g || "–"}</div>
          </div>
          <div className="ringcov">{coveredDims(disp).length} of {DIMS.length} covered</div>
        </div>
        <div className="ideaw">
          <div className="lb">Your idea</div>
          <div className="ideaT">{noDash(disp.north || idea || "")}</div>
          <div key={sharperFlash ? `s-${fx.nonce}` : "s"} className={`sharp ${sharperFlash ? "flash" : ""}`}>{disp.sharper || ""}</div>
        </div>
      </div>
      <div className="bsecs">
        {!started && !disp.north ? (
          <p className="muted">Your brief builds here as you talk it through.</p>
        ) : (
          <>
            {shown.map((k) => {
              const d = dr(k);
              if (d) return (
                <div key={`d-${k}`} className={`card draft ${fx.draftIn ? "in" : ""}`}>
                  <div className="lb"><span>{dimLabel(k)}</span><span className="dtag">{d.old ? "Updated draft" : "Draft"}</span></div>
                  {d.old && <div className="tx oldtx">{noDash(d.old)}</div>}
                  <div className="tx">{noDash(d.text)}</div>
                </div>
              );
              const animKey = k in solid || chg[k] ? `${k}-${fx.nonce}` : k;
              const c = chg[k];
              return (
                <div key={animKey} className={`card ${jump(k) ? "jump" : k in solid && !solid[k] ? "just" : ""}`}>
                  <div className="lb"><span>{dimLabel(k)}</span>
                    <Dots g={disp.grades[k]} from={c ? c.old : disp.grades[k]} animate={!!c} />
                  </div>
                  {solid[k] ? (
                    <>
                      <div className="tx oldtx out">{noDash(solid[k])}</div>
                      <div className="tx newin">{noDash(disp.brief[k])}</div>
                    </>
                  ) : <div className="tx">{noDash(disp.brief[k] || "")}</div>}
                  <Changelog k={k} disp={disp} />
                </div>
              );
            })}
            {open.length > 0 && (
              <div className="openl">
                <div className="olh">Still open</div>
                {open.map((k) => <div key={k} className="orow"><span>{dimLabel(k)}</span><Dots muted /></div>)}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
