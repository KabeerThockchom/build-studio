/* The ui items the SA can attach to a turn, each its own small component. They render in
   order under the SA's message, only after the words have finished revealing. Every item is
   defensive: a malformed item renders nothing instead of breaking the turn. */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CAST, TONE_MOOD, charSVG, personaOf, sketchSVG, cupSVG } from "./art";
import {
  arr, obj, optList, strList, noDash, makeStream, RM, EFFORT, LANES, fitCls,
  coveredDims, overallLetter, gcls, DIMS, type Disp,
} from "./engine";

export type SendFn = (text: string, meta?: Record<string, unknown>, you?: string) => void;
const svg = (html: string) => ({ __html: html });
// staggered entrance for freshly revealed cards
export const stagger = (on: boolean, i: number): { className: string; style?: CSSProperties } =>
  on && !RM ? { className: "in", style: { animationDelay: `${i * 70}ms` } } : { className: "" };

/* ── option cards: multi-select, consider dot, send picks ── */
function Card({ o, i, on, cls, onClick, anim }: { o: { label: string; sub?: string; consider?: string }; i: number; on: boolean; cls?: string; onClick: () => void; anim: { className: string; style?: CSSProperties } }) {
  const c = typeof o.consider === "string" && o.consider.trim() ? o.consider.trim() : "";
  return (
    <button className={`opt ${cls || ""} ${c ? "hasc" : ""} ${on ? "on" : ""} ${anim.className}`} style={anim.style} data-i={i} onClick={onClick}>
      <span className="k">✓</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div className="t">{noDash(o.label)}</div>
        {c ? (
          <>
            <span className="cm">consider</span>
            <div className="sw2"><div className="s">{noDash(o.sub || "")}</div><div className="c">{noDash(c)}</div></div>
          </>
        ) : o.sub ? <div className="s">{noDash(o.sub)}</div> : null}
      </span>
    </button>
  );
}

function useDigitKeys(enabled: boolean, handlers: (() => void)[]) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (t === "textarea" || t === "input" || (e.target as HTMLElement)?.isContentEditable) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < ref.current.length) { e.preventDefault(); ref.current[i](); }
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [enabled]);
}

export function OptionsItem({ it, live, fresh, onSend, base }: { it: any; live: boolean; fresh: boolean; onSend: SendFn; base: number }) {
  const opts = optList(it.options).slice(0, 3);
  const [sel, setSel] = useState<number[]>([]);
  const toggle = (i: number) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  useDigitKeys(live, opts.map((_, i) => () => toggle(i)));
  return (
    <>
      <h2 className="q">{noDash(it.question || "")}</h2>
      <p className="hint">Pick any that fit, then send. Or say it your way below.</p>
      <div className="opts">
        {opts.map((o, i) => <Card key={i} o={o} i={i} on={sel.includes(i)} onClick={() => live && toggle(i)} anim={stagger(fresh, base + i + 1)} />)}
      </div>
      <div className="crow">
        <button className="cbtn" disabled={!live || !sel.length}
          onClick={() => onSend([...sel].sort().map((i) => noDash(opts[i].label)).join("; "), { picked: true })}>Send picks</button>
      </div>
    </>
  );
}

/* ── an open question: no cards on purpose; the chat bar is the next action ── */
export function OpenItem({ it }: { it: any }) {
  return (
    <div className="openq">
      <h2 className="q">{noDash(it.question)}</h2>
      {typeof it.hint === "string" && it.hint.trim() && <p className="ohint">{noDash(it.hint)}</p>}
      <p className="hint">Only you know this one. Type it below.</p>
    </div>
  );
}

/* ── a colleague joins the conversation: their line types in, then their replies arrive ── */
export function StakeholderItem({ it, live, fresh, onSend }: { it: any; live: boolean; fresh: boolean; onSend: SendFn }) {
  const pid = personaOf(it), c = CAST[pid], tone = it.tone || "challenge";
  const nm = String(it.name || "A colleague"), rl = String(it.role || "");
  const opts = optList(it.options).slice(0, 3);
  const lineRef = useRef<HTMLDivElement>(null);
  const animate = fresh && !RM;   // type the line in when it is first revealed; replies stay inert until the turn is live
  const [ready, setReady] = useState(!animate);
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    if (!animate || !lineRef.current) return;
    const el = lineRef.current;
    let st: { abort(): void } | null = null;
    const t = setTimeout(() => { const s = makeStream(el, { onEnd: () => setReady(true) }); st = s; s.push(String(it.line)); s.finish(); }, 380);
    return () => { clearTimeout(t); st?.abort(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (i: number) => { if (!live || !ready) return; setPicked(i); onSend(noDash(opts[i].label), { picked: true }); };
  useDigitKeys(live && ready, opts.map((_, i) => () => pick(i)));
  return (
    <>
      <div className="stake" style={{ ["--acc" as any]: c.acc }}>
        <div className={`charwrap ${tone === "excited" ? "lean" : ""}`}>
          <div dangerouslySetInnerHTML={svg(charSVG(pid, 84, TONE_MOOD[tone] || "skeptical"))} />
          <div className="floor" />
        </div>
        <div className="sbub">
          <div className="shead"><b>{nm}</b><span className="smeta">{rl ? rl + " · " : ""}{tone === "challenge" ? "has a challenge" : tone === "excited" ? "is excited" : "is curious"}</span></div>
          <div className="sl" ref={lineRef}>{animate ? null : noDash(it.line)}</div>
        </div>
      </div>
      <p className="hint">Reply to {nm}. Pick one, or say it your way below.</p>
      <div className={`opts sopts ${ready ? "" : "wait"}`}>
        {opts.map((o, i) => <Card key={i} o={o} i={i} cls="optp" on={picked === i} onClick={() => pick(i)} anim={stagger(animate && ready, i)} />)}
      </div>
    </>
  );
}

/* ── drift: the conversation is moving somewhere new ── */
export function DriftItem({ it, live, onSend, north }: { it: any; live: boolean; onSend: SendFn; north: string }) {
  return (
    <div className="driftc">
      <div className="lb">This is moving somewhere new</div><div className="tx">{noDash(it.note || "")}</div>
      <div className="lb">Your idea</div><div className="tx">{noDash(it.north_star || "")}</div>
      <div className="bs">
        <button className="cbtn" disabled={!live} onClick={() => onSend(`Stay on my original idea: ${noDash(it.north_star || north)}. Park the other one for later.`, { picked: true }, "Stay on my idea")}>Stay on my idea</button>
        <button className="ghostbtn" disabled={!live} onClick={() => onSend("Switch the build to this new direction.", { picked: true }, "Switch to this")}>Switch to this</button>
      </div>
    </div>
  );
}

/* ── three ways to build it, each with a sketch ── */
function ShapeCard({ s, why, rec, on, onClick, anim }: { s: any; why: string; rec: boolean; on: boolean; onClick: () => void; anim: { className: string; style?: CSSProperties } }) {
  return (
    <button className={`cc ${on ? "on" : ""} ${anim.className}`} style={anim.style} onClick={onClick}>
      <span dangerouslySetInnerHTML={svg(sketchSVG(s.sketch))} style={{ display: "contents" }} />
      {rec && <span className="rec">Recommended</span>}
      <div className="t">{noDash(s.name)}</div><div className="d">{noDash(s.one_liner)}</div>
      {s.first_screen && <div className="fs"><b>Opens on</b> {noDash(s.first_screen)}</div>}
      {s.tradeoff && <div className="tr"><b>Tradeoff</b> {noDash(s.tradeoff)}</div>}
      {why && <div className="why">{noDash(why)}</div>}
    </button>
  );
}
export function ShapesItem({ it, live, fresh, onSend, base }: { it: any; live: boolean; fresh: boolean; onSend: SendFn; base: number }) {
  const sh = arr(it.shapes).filter((x) => x && typeof x === "object").slice(0, 3);
  const [pick, setPick] = useState<string | null>(null);
  useDigitKeys(live, sh.map((s) => () => setPick(s.key)));
  return (
    <>
      <h2 className="q">Three ways to build it.</h2>
      <div className="cgrid">
        {sh.map((s, i) => <ShapeCard key={s.key || i} s={s} why={s.key === it.recommended ? it.why : ""} rec={s.key === it.recommended}
          on={pick === s.key} onClick={() => live && setPick(s.key)} anim={stagger(fresh, base + i + 1)} />)}
      </div>
      <div className="crow">
        <button className="cbtn" disabled={!live || !pick}
          onClick={() => { const s = sh.find((x) => x.key === pick); if (s) onSend(`Let's build: ${noDash(s.name)}`, { picked: true, shape_key: s.key }); }}>Use this</button>
        <p className="hint">Or tweak one, combine two, or describe your own below.</p>
      </div>
    </>
  );
}

/* ── fit it in a day: packages + lanes ── */
const fitPill = (fit?: string) => <span className={`fit ${fitCls(fit)}`}>{fit || ""}</span>;
function EffortTag({ f }: { f: any }) {
  if (f.block === "not_today" || !f.effort) return <span className="eff lock" title={noDash(f.why || "")}>Not in a day</span>;
  const e = EFFORT[f.effort] || EFFORT.quick;
  return <span className="eff" title={e.t}><span style={{ display: "contents" }} dangerouslySetInnerHTML={svg([1, 2, 3].map((i) => cupSVG(i <= e.cups)).join(""))} /><span>{e.t}</span></span>;
}
export interface ScopeOps {
  session: any;
  busy: boolean;
  dayCapacity: number;
  onPackage: (it: any, key: string) => void;
  onMove: (i: number, lane: string) => void;
  onDone: () => void;
}
export function ScopeItem({ it, live, fresh, ops, base }: { it: any; live: boolean; fresh: boolean; ops: ScopeOps; base: number }) {
  const s = ops.session || {};
  const pk = arr(it.packages).filter((x) => x && typeof x === "object");
  const f = arr(s.features).length ? arr(s.features) : arr(it.features);
  const cur = s.package || "recommended";
  const [custom, setCustom] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const fit = s.fit || "", warn = /won/i.test(fit), units = s.day_units || 0;
  const can = live && !ops.busy;
  return (
    <>
      <h2 className="q">Fit it in a day.</h2>
      <p className="hint">Pick a package. Build the core first, then pick up stretch if time allows.</p>
      <div className="pgrid">
        {pk.map((p, i) => {
          const a = stagger(fresh, base + i + 1);
          return (
            <button key={p.key} className={`pkg ${p.key === cur ? "on" : ""} ${a.className}`} style={a.style}
              onClick={() => can && p.key !== cur && ops.onPackage(it, p.key)}>
              <div className="ph"><span className="t">{p.label}</span></div>
              <div className="d">{noDash(p.blurb || "")}</div>
              <div className="pl"><b>Today</b>{strList(p.today).length ? strList(p.today).map((n, j) => <div key={j}>{noDash(n)}</div>) : <div className="m">Nothing yet</div>}</div>
              {strList(p.stretch).length > 0 && <div className="pl m"><b>Stretch, after the core</b>{strList(p.stretch).map((n, j) => <div key={j}>{noDash(n)}</div>)}</div>}
              <div className="pf"><span className="m">Saved for later: {arr(p.later).length}</span>{fitPill(p.fit)}</div>
            </button>
          );
        })}
      </div>
      {custom && (
        <>
          <div className="daybar">
            <div className="row"><span>Your day</span>{fitPill(fit)}</div>
            <div className="bar"><div className={`fill ${warn ? "over" : fitCls(fit)}`} style={{ width: `${Math.min(100, (units / (ops.dayCapacity || 6)) * 100)}%` }} /></div>
            <div className="bmsg">{warn ? "Build the core first, then pick up stretch if time allows." : "Drag features between lanes, or use Move."}</div>
          </div>
          <div className="lanes">
            {LANES.map((l) => {
              const chips = f.map((x, i) => ({ x, i })).filter(({ x }) => x && typeof x === "object" && (x.lane || "later") === l.k);
              return (
                <div key={l.k} className={`lane ${over === l.k ? "over" : ""}`} data-lane={l.k}
                  onDragOver={(e) => { e.preventDefault(); setOver(l.k); }} onDragLeave={() => setOver(null)}
                  onDrop={(e) => { e.preventDefault(); setOver(null); const i = Number(e.dataTransfer.getData("text/plain")); if (can && !isNaN(i)) ops.onMove(i, l.k); }}>
                  <div className="lh">{l.t}</div>
                  {chips.length ? chips.map(({ x, i }) => {
                    const lk = x.block === "not_today";
                    return (
                      <div key={i} className={`fchip ${lk ? "locked" : ""}`} draggable={!lk && can} data-i={i} title={noDash(x.why || "")}
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(i)); (e.currentTarget as HTMLElement).classList.add("dragging"); }}
                        onDragEnd={(e) => (e.currentTarget as HTMLElement).classList.remove("dragging")}>
                        <div className="fn">{lk && <span className="lk">&#128274; </span>}{noDash(x.name)}{x.custom && <span className="yours">yours</span>}</div>
                        <div className="fm"><EffortTag f={x} />{!lk && <button className="mv" onClick={(e) => { e.stopPropagation(); setMenu(menu === i ? null : i); }}>Move</button>}</div>
                        {lk && <div className="why">{noDash(x.why || "")}</div>}
                        {menu === i && (
                          <div className="mvmenu">
                            {LANES.filter((z) => z.k !== (x.lane || "later")).map((z) => (
                              <button key={z.k} onClick={(e) => { e.stopPropagation(); setMenu(null); if (can) ops.onMove(i, z.k); }}>{z.t}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }) : <div className="empty">Drop here</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
      <div className="crow">
        <button className="cbtn" disabled={!can} onClick={ops.onDone}>Scope looks good</button>
        <button className="link" onClick={() => setCustom((v) => !v)}>{custom ? "Hide lanes" : "Customise"}</button>
      </div>
    </>
  );
}

/* ── the ceremonial go-ahead ── */
// An editable who / what / worked-if line. Uncontrolled on purpose (contentEditable): the text
// is set once and read back on blur, so a re-render never resets what someone is typing.
function RbLine({ it, k, l, live, onEdit }: { it: any; k: string; l: string; live: boolean; onEdit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current && document.activeElement !== ref.current) ref.current.textContent = noDash(it[k] || ""); }, [it, k]);
  return (
    <div className="rbl"><span>{l}</span>
      <div ref={ref} tabIndex={0} contentEditable={live} suppressContentEditableWarning
        onBlur={(e) => { it[k] = (e.currentTarget.textContent || "").trim(); onEdit(); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }} />
    </div>
  );
}
export interface CeremonyOps {
  turns: { ui: any[] }[];
  session: any;
  disp: Disp;
  busy: boolean;
  onBuild: (rb: any) => Promise<void>;
  onEdit: () => void;
  md: (rb: any) => string;
  toast: (m: string) => void;
}
export function CeremonyItem({ it, live, ops }: { it: any; live: boolean; ops: CeremonyOps }) {
  const dp = obj(it.data_plan), endG = overallLetter(ops.disp), startG = ops.disp.firstOverall || "–";
  const seen: { pid: string; name: string; role: string }[] = [];
  const keys = new Set<string>();
  ops.turns.forEach((t) => arr(t.ui).forEach((u) => {
    if (u && (u.type === "stakeholder" || u.type === "pushback") && u.line) {
      const p = { pid: personaOf(u), name: String(u.name || "A colleague"), role: String(u.role || "") };
      const k = (p.name + "|" + p.role).toLowerCase();
      if (!keys.has(k)) { keys.add(k); seen.push(p); }
    }
  }));
  const lane = (k: string) => arr(ops.session?.features).filter((f) => f && (f.lane || "later") === k).map((f) => noDash(f.name));
  const tbl = (t: string) => { const m = String(t).match(/^([a-z0-9_.]+)(.*)$/i); return m ? <><span className="mono">{m[1]}</span>{noDash(m[2])}</> : t; };
  const gaps = arr(it.gaps).filter((x) => typeof x === "string" && x.trim());
  const [md, setMd] = useState(false);
  const [going, setGoing] = useState(false);
  return (
    <div className="cere">
      <h2 className="q">Here's your plan.</h2>
      <p className="hint">Look it over, fix any line, then give it the go-ahead.</p>
      <div className="ctop">
        <div className="cbox"><div className="lb">Your idea's journey</div>
          <div className="jrow"><span className={`gr big ${gcls(startG)}`}>{startG}</span><span>→</span><span className={`gr big ${gcls(endG)}`}>{endG || "–"}</span></div>
          <div className="jsc">{coveredDims(ops.disp).length} of {DIMS.length} sections covered</div>
        </div>
        <div className="cbox"><div className="lb">Colleagues who weighed in</div>
          {seen.length ? (
            <div className="faces">{seen.map((p, i) => (
              <div key={i} className="face1" title={p.role}><div className="fh" dangerouslySetInnerHTML={svg(charSVG(p.pid, 40, "won"))} /><b>{p.name}</b><span className="fr">{p.role}</span></div>
            ))}</div>
          ) : <p className="muted" style={{ fontSize: 12 }}>Just you and your SA this time</p>}
        </div>
      </div>
      <div className="rb">{[["who", "Who"], ["what", "What"], ["worked_if", "Worked if"]].map(([k, l]) => <RbLine key={k} it={it} k={k} l={l} live={live} onEdit={ops.onEdit} />)}</div>
      <div className="lanechips">
        {[["today", "Today"], ["stretch", "Stretch"], ["later", "Saved for later"]].map(([k, l]) => (
          <div key={k} className={`lr ${k}`}><span className="lk2">{l}</span>
            {lane(k).length ? lane(k).map((x, i) => <span key={i} className="ch">{x}</span>) : <span className="none">Nothing here</span>}
          </div>
        ))}
      </div>
      <div className="rbx">
        {arr(it.risks).length > 0 && (
          <div><h5>Risks and guards</h5><ul>{arr(it.risks).map((r, i) => r && (
            <li key={i}>{noDash(r.risk || r)}{r.mitigation && <>. <span style={{ color: "var(--gA-i)" }}>Guard: {noDash(r.mitigation)}</span></>}</li>
          ))}</ul></div>
        )}
        {gaps.length > 0 && <div><h5>Watch-outs</h5><ul className="watch">{gaps.map((g, i) => <li key={i}>{noDash(g)}</li>)}</ul></div>}
        <div><h5>Data</h5><div className="chips">
          {strList(dp.seeded).map((t, i) => <span key={"s" + i} className="chip">{tbl(t)}</span>)}
          {strList(dp.generate).map((t, i) => <span key={"g" + i} className="chip gen">{tbl(t)} · generate</span>)}
        </div></div>
      </div>
      <div className="crow" style={{ marginTop: 24 }}>
        <button className="cbtn go" disabled={!live || going || ops.busy}
          onClick={async () => { setGoing(true); try { await ops.onBuild(it); } finally { setGoing(false); } }}>
          {going ? "Opening your plan…" : "Let's build it"}
        </button>
        <button className="link" onClick={() => setMd((v) => !v)}>Preview PROJECT.md</button>
        <button className="link" onClick={() => navigator.clipboard.writeText(ops.md(it)).then(() => ops.toast("Copied."), () => ops.toast("Copy blocked, use Preview and select the text."))}>Copy</button>
      </div>
      {md && <div className="mdprev"><pre>{ops.md(it)}</pre></div>}
    </div>
  );
}
