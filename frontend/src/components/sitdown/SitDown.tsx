/* The Sit-Down: a conversational SA sharpens the participant's idea before they build.
   React port of server/static/sitdown3.html (same behaviour, same look):
   - one chat that pages: each exchange is a page, the participant's words rise to the top
   - thinking only in the header indicator + a breathing avatar; the voice streams word by word
   - cards, open questions, colleagues, drift, shapes, scope, and the go-ahead ceremony
   - the right pane waits its turn: drafts, then solid, then the grade
   API: POST /api/sitdown/chat (NDJSON), /apply_package, /set_features, /handoff. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./sitdown.css";
import { api } from "../../lib/api";
import type { StudioHandoff } from "../../lib/types";
import type { SitDownProgress } from "../../lib/store";
import {
  arr, obj, clone, noDash, words, freshDisp, coveredDims, overallLetter, makeStream, scrollTo, motion,
  wait, SHARP, DIMS, STAGE_LABEL, dimLabel, strList, projectMd, RM, type Disp, type Streamer,
} from "./engine";
import { BriefPane, type Draft, type BriefFx } from "./BriefPane";
import { TurnBlock, type TurnData } from "./Turn";
import { ChatBar } from "./ChatBar";

export const SD_KEY = "bs2_sitdown";
const TOUR_KEY = "bs2_sitdown_toured";
const IDEA_PH = "Like: our planners scramble when things change at the last minute. I want something that spots problems early and suggests what to do.";

export interface SitDownBlob { SESSION: any; DISP: Disp; TURNS: TurnData[]; }
interface Props {
  saved: SitDownBlob | null;                                  // from app state (server session) or localStorage
  onSave: (blob: SitDownBlob | null, progress: SitDownProgress) => void;
  onHandoff: (studio: StudioHandoff) => void;
  focusStage?: { stage: string; nonce: number } | null;       // the rail asked to jump to a stage
}

const stripTransient = (t: TurnData): TurnData => {
  const out: any = {};
  for (const [k, v] of Object.entries(t)) if (!k.startsWith("_")) out[k] = v;
  return out;
};
let uid = 0;
const newId = () => `t${Date.now().toString(36)}${(uid++).toString(36)}`;

const TOUR_STEPS = [
  { sel: ".blk:last-child .voiceRow", text: "You're sitting with your Solutions Architect. This is their read on your idea. Read this first.", at: "below" },
  { sel: ".blk:last-child .ask", text: "Pick any options that fit, or just type in the box below. It's a real conversation.", at: "right" },
  { sel: ".brief", text: "Your idea gets a grade across a few areas. We keep refining it here as we push on it together.", at: "left" },
];

export function SitDown({ saved, onSave, onHandoff, focusStage }: Props) {
  // --- state (refs mirror state so async flows always read the latest) ---
  const init = useMemo(() => {
    const b = saved && typeof saved === "object" ? saved : null;
    return {
      session: b?.SESSION || null,
      disp: { ...freshDisp(), ...(b?.DISP || {}) } as Disp,
      turns: arr(b?.TURNS).filter((t) => t && typeof t === "object").map(stripTransient) as TurnData[],
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [session, setSessionS] = useState<any>(init.session);
  const [disp, setDispS] = useState<Disp>(init.disp);
  const [turns, setTurnsS] = useState<TurnData[]>(init.turns);
  const sessionRef = useRef(session), dispRef = useRef(disp), turnsRef = useRef(turns);
  const setSession = (s: any) => { sessionRef.current = s; setSessionS(s); };
  const setDisp = (d: Disp) => { dispRef.current = d; setDispS(d); };
  const setTurns = (f: (t: TurnData[]) => TurnData[]) => { const n = f(turnsRef.current); turnsRef.current = n; setTurnsS(n); };
  const patchTurn = (id: string, p: Partial<TurnData>) => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const [busy, setBusyS] = useState(false);
  const busyRef = useRef(false);
  const setBusy = (b: boolean) => { busyRef.current = b; setBusyS(b); };
  const [thinking, setThinking] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [fx, setFx] = useState<BriefFx>({ nonce: 0 });
  const fxN = useRef(0);
  const bumpFx = (f: Omit<BriefFx, "nonce">) => setFx({ ...f, nonce: ++fxN.current });
  const [chat, setChat] = useState("");
  const [focusNonce, setFocusNonce] = useState(0);
  const [landing, setLanding] = useState("");
  const [lost, setLost] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [dayCapacity, setDayCapacity] = useState(6);
  const [tour, setTour] = useState<{ i: number; ready: boolean } | null>(null);
  const [tourCls, setTourCls] = useState<string[]>([]);
  const toured = useRef((() => { try { return localStorage.getItem(TOUR_KEY) === "1"; } catch { return false; } })());

  const rootRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const voiceEls = useRef<Record<string, HTMLDivElement | null>>({});
  const [threadH, setThreadH] = useState(0);

  const toast = (m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(""), 2600); };

  useEffect(() => { api.sitdownConfig().then((c) => { if (c.day_capacity) setDayCapacity(c.day_capacity); }).catch(() => {}); }, []);

  // --- persistence: localStorage + the app (which saves it to the server session) ---
  const progressOf = (s: any, d: Disp): SitDownProgress => ({
    stage: (s && s.stage) || "", covered: coveredDims(d).length, started: !!s, done: false,
  });
  const persist = useCallback(() => {
    const s = sessionRef.current;
    const blob: SitDownBlob | null = s ? { SESSION: s, DISP: dispRef.current, TURNS: turnsRef.current.filter((t) => !t._err).map(stripTransient) } : null;
    try { if (blob) localStorage.setItem(SD_KEY, JSON.stringify(blob)); else localStorage.removeItem(SD_KEY); } catch { /* storage full or blocked */ }
    onSave(blob, progressOf(s, dispRef.current));
  }, [onSave]);

  // --- layout: each page is one thread-height tall ---
  useLayoutEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setThreadH(el.clientHeight));
    ro.observe(el);
    setThreadH(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  // scroll requests (the page turn, Back, the rail): smooth, eased, one intentional motion
  const scrollReq = useRef<{ idx: number; ms: number } | null>(null);
  const lastCount = useRef(turns.length);
  useLayoutEffect(() => {
    const th = threadRef.current;
    if (!th) return;
    const req = scrollReq.current;
    scrollReq.current = null;
    if (req) {
      const blk = th.querySelector<HTMLElement>(`.blk[data-turn="${req.idx}"]`) || th.querySelector<HTMLElement>(".blk:last-child");
      if (blk) scrollTo(th, blk.offsetTop, req.ms);
    } else if (turns.length !== lastCount.current) {
      const blk = th.querySelector<HTMLElement>(".blk:last-child");
      if (blk) scrollTo(th, blk.offsetTop, 0);
    }
    lastCount.current = turns.length;
  }, [turns.length, threadH]); // eslint-disable-line react-hooks/exhaustive-deps
  // first mount with history: land on the latest page
  useLayoutEffect(() => {
    const th = threadRef.current, blk = th?.querySelector<HTMLElement>(".blk:last-child");
    if (th && blk) th.scrollTop = blk.offsetTop;
  }, [threadH > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // the rail asked to jump to a stage: scroll to the first page in that stage
  useEffect(() => {
    if (!focusStage || !threadRef.current) return;
    const ts = turnsRef.current;
    const target = focusStage.stage;
    let idx = ts.findIndex((t) => (t.stage || "") === target);
    if (target === "problem" || SHARP.includes(target)) idx = 0;
    if (idx < 0) idx = ts.length - 1;
    const blk = threadRef.current.querySelector<HTMLElement>(`.blk[data-turn="${idx}"]`);
    if (blk) scrollTo(threadRef.current, blk.offsetTop, 550);
  }, [focusStage?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- the brief choreography: drafts, then solid, then the grade (after the words) ---
  const playEvents = useCallback(async (evsIn: any[], turnId: string | null) => {
    const evs = arr(evsIn).filter((e) => e && typeof e === "object" && e.kind);
    let d: Disp = clone(dispRef.current);
    const ns = evs.find((e) => e.kind === "north_star");
    if (ns && ns.text) d.north = ns.text;
    const briefs = evs.filter((e) => (e.kind === "brief_added" || e.kind === "brief_updated") && e.dim && typeof e.new === "string");
    const gr = evs.find((e) => e.kind === "grades");
    if (turnId) patchTurn(turnId, { note: briefs.map((e) => ({ kind: e.kind, dim: e.dim })) });
    const gdims = Object.keys(obj(gr && gr.changes));
    const draftOf = (e: any): Draft => ({ dim: e.dim, text: e.new, old: e.kind === "brief_updated" ? (e.old || d.brief[e.dim] || "") : "" });
    const applyBriefs = (list: any[]) => {
      const olds: Record<string, string> = {};
      d = clone(d);
      list.forEach((e) => {
        olds[e.dim] = e.kind === "brief_updated" ? (e.old || d.brief[e.dim] || "") : "";
        const lg = (d.log[e.dim] = arr(d.log[e.dim]));
        const why = (gr && gr.sharper && gdims.includes(e.dim) && noDash(gr.sharper)) || (e.kind === "brief_added" ? "first draft" : "reworded with your input");
        lg.push({ v: lg.length + 1, t: String(why).replace(/\.$/, "") });
        d.brief[e.dim] = e.new;
        if (!d.settled.includes(e.dim)) d.settled.push(e.dim);
      });
      setDisp(d);
      return olds;
    };
    const applyGrades = () => {
      if (!gr) return [];
      d = clone(d);
      const ch: { k: string; old: string | null; nw: string }[] = [];
      Object.entries(obj(gr.changes)).forEach(([k, v]: [string, any]) => {
        if (!v || typeof v !== "object" || !v.new) return;
        ch.push({ k, old: v.old || d.grades[k] || null, nw: v.new });
        d.grades[k] = v.new;
      });
      const vis = ch.filter((c) => c.old && c.old !== c.nw);
      d.sharper = noDash(gr.sharper) || (vis.length ? vis.slice(0, 2).map((c) => `${dimLabel(c.k)} ${c.old} → ${c.nw}`).join(" · ") : d.sharper);
      if (!d.firstOverall) d.firstOverall = overallLetter(d);
      setDisp(d);
      return ch;
    };
    const finish = () => { const ch = applyGrades(); bumpFx({ changed: ch }); persist(); };
    if (RM) { applyBriefs(briefs); finish(); setDrafts([]); return; }
    setDisp(d);
    if (briefs.length <= 2) {
      if (briefs.length) {
        setDrafts(briefs.map(draftOf)); bumpFx({ draftIn: true });
        await wait(900);
        const olds = applyBriefs(briefs); setDrafts([]); bumpFx({ solid: olds });
        await wait(450);
      }
      finish();
      return;
    }
    // a burst (the readback consolidates the brief): one section at a time, calmly
    for (const e of briefs) {
      setDrafts([draftOf(e)]); bumpFx({ draftIn: true });
      await wait(520);
      const olds = applyBriefs([e]); setDrafts([]); bumpFx({ solid: olds });
      await wait(380);
    }
    finish();
    await wait(500);
  }, [persist]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- the one call: /api/sitdown/chat ---
  const send = useCallback(async (textIn: string, meta: Record<string, unknown> = {}, you?: string) => {
    const text = String(textIn || "").trim();
    if (busyRef.current || !text) return;
    if (turnsRef.current.some((t) => t._err)) setTurns((ts) => ts.filter((t) => !t._err));
    const first = !sessionRef.current, withTour = first && !toured.current;
    (document.activeElement as HTMLElement | null)?.blur?.();
    const id = newId();
    const turn: TurnData = {
      id, you: you || text, text: "", ui: [], events: [], req: { text, meta },
      sessBefore: clone(sessionRef.current), dispBefore: clone(dispRef.current), _live: true,
    };
    const idx = turnsRef.current.length;
    scrollReq.current = { idx, ms: idx > 0 ? 600 : 0 };
    setTurns((ts) => [...ts, turn]);
    if (withTour) setTourCls(["touring", "tour-hideAsk", "tour-hideR"]);
    setBusy(true);
    setThinking(first ? "Reading your idea…" : "Reading your answer…");
    // wait for the new page's voice element
    let el: HTMLDivElement | null = null;
    for (let i = 0; i < 30 && !el; i++) { await new Promise((r) => requestAnimationFrame(() => r(null))); el = voiceEls.current[id] || null; }
    const t0 = performance.now();
    let done: any = null, ended = false;
    let st: Streamer | null = null;
    const reveal = new Promise<void>((res) => {
      st = el ? makeStream(el, {
        onFirst: () => { setThinking(""); if (withTour) setTour({ i: 0, ready: false }); },
        onEnd: () => { if (!done) patchTurn(id, { _pend: "Preparing the next step" }); res(); },
      }) : null;
      if (!st) res();
    });
    let full = "";
    try {
      const resp = await fetch("/api/sitdown/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: sessionRef.current, text, meta }) });
      if (!resp.ok || !resp.body) throw new Error("The server answered " + resp.status);
      const rd = resp.body.getReader(), dec = new TextDecoder();
      let buf = "", err: string | null = null;
      const take = (line: string) => {
        line = line.trim(); if (!line) return;
        let ev: any; try { ev = JSON.parse(line); } catch { return; }
        if (ev.type === "text_delta" && typeof ev.text === "string") { full += ev.text; (st as Streamer | null)?.push(ev.text); }
        else if (ev.type === "text_end") { if (!ended) { ended = true; (st as Streamer | null)?.finish(); } }
        else if (ev.type === "done") done = ev;
        else if (ev.type === "error") err = ev.message;
      };
      for (;;) {
        const { value, done: fin } = await rd.read();
        if (value) buf += dec.decode(value, { stream: true });
        let nl; while ((nl = buf.indexOf("\n")) >= 0) { take(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
        if (fin) break;
      }
      take(buf);
      if (!done) throw new Error(err || "The SA's reply did not come through.");
      if (!full && done.text) { full = String(done.text); (st as Streamer | null)?.push(full); }
      (st as Streamer | null)?.finish();
    } catch (e: any) {
      (st as Streamer | null)?.abort();
      setThinking(""); setBusy(false);
      setTour(null); setTourCls([]);
      patchTurn(id, { _live: false, text: "", _err: e?.message || String(e) });
      return;
    }
    await reveal;
    setThinking("");
    const nextSession = obj(done.session);
    setSession(nextSession);
    const ui = arr(done.ui), events = arr(done.events);
    const stats = { first_ms: done.first_ms, ms: done.ms, model: done.model, done_ms: Math.round(performance.now() - t0) };
    (window as any).__turns = [...((window as any).__turns || []), stats];
    const base: Partial<TurnData> = { text: full, ui, events, stage: nextSession.stage, stats };
    if (ui.some((u) => u && u.type === "readback")) {
      patchTurn(id, { ...base, _pend: "Pulling your plan together" });
      await playEvents(events, id);
      patchTurn(id, { _ready: true, _fresh: true, _pend: undefined });
    } else {
      patchTurn(id, { ...base, _ready: true, _fresh: true, _pend: undefined });
      playEvents(events, id);
    }
    setBusy(false);
    persist();
    if (withTour) setTour((t) => (t ? { ...t, ready: true } : t));
  }, [playEvents, persist]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => {
    const t = turnsRef.current.find((x) => x._err);
    if (!t || !t.req) return;
    setTurns((ts) => ts.filter((x) => !x._err));
    send(t.req.text, t.req.meta, t.you);
  };

  // --- Back / Edit: like editing a message, drop it and everything after, branch from there ---
  const restoreTo = (k: number, prefill?: string) => {
    const ts = turnsRef.current;
    if (busyRef.current || k < 0 || k >= ts.length) return;
    if (k === 0) {
      setLanding(ts[0].you || "");
      setTurns(() => []); setSession(null); setDisp(freshDisp()); setDrafts([]);
      try { localStorage.removeItem(SD_KEY); } catch { /* */ }
      onSave(null, { stage: "", covered: 0, started: false, done: false });
      return;
    }
    const t = ts[k];
    setSession(t.sessBefore);
    setDisp({ ...freshDisp(), ...(t.dispBefore || {}) });
    setDrafts([]);
    scrollReq.current = { idx: k - 1, ms: RM ? 0 : 550 };
    setTurns((x) => x.slice(0, k).map((tt, i) => (i === k - 1 ? { ...tt, _live: false, _fresh: false } : tt)));
    if (prefill != null) { setChat(prefill); setFocusNonce((n) => n + 1); }
    setTimeout(persist, 0);
  };
  const editFrom = (k: number) => restoreTo(k, k > 0 ? turnsRef.current[k]?.you || "" : undefined);
  const goBack = () => editFrom(turnsRef.current.length - 1);
  const resetAll = () => {
    if (sessionRef.current && !confirm("Start over with a new idea?")) return;
    setLanding(""); setTurns(() => []); setSession(null); setDisp(freshDisp()); setDrafts([]); setChat("");
    try { localStorage.removeItem(SD_KEY); } catch { /* */ }
    onSave(null, { stage: "", covered: 0, started: false, done: false });
  };

  // --- scope: packages + lanes (the server rewrites the scope section; animate the diff) ---
  const scopeDiff = () => {
    const s = sessionRef.current || {}, d = dispRef.current;
    const nb = obj(s.brief).scope, ng = obj(s.grades).scope, ob = d.brief.scope, og = d.grades.scope, ev: any[] = [];
    if (nb && nb !== ob) ev.push({ kind: ob ? "brief_updated" : "brief_added", dim: "scope", old: ob || null, new: nb });
    if (ng && ng !== og) ev.push({ kind: "grades", changes: { scope: { old: og || null, new: ng } }, sharper: ob ? "Scope reshaped for the day" : "Scope set for the day" });
    const last = turnsRef.current[turnsRef.current.length - 1];
    if (ev.length) playEvents(ev, last?.id || null);
  };
  const scopeOps = {
    session, busy, dayCapacity,
    onPackage: async (it: any, key: string) => {
      setBusy(true);
      try {
        const r = await api.sitdownApplyPackage(sessionRef.current, key);
        setSession(r.state);
        if (Array.isArray(r.packages)) it.packages = r.packages;
      } catch (e: any) { toast(e.message); }
      setBusy(false); scopeDiff(); persist();
    },
    onMove: async (i: number, lane: string) => {
      const fs = clone(arr(sessionRef.current?.features));
      if (!fs[i] || fs[i].block === "not_today" || fs[i].lane === lane) return;
      fs[i].lane = lane;
      setBusy(true);
      try { setSession((await api.sitdownSetFeatures(sessionRef.current, fs)).state); } catch (e: any) { toast(e.message); }
      setBusy(false); scopeDiff(); persist();
    },
    onDone: () => send("Scope looks good", { scope_done: true }),
  };

  // --- the go-ahead: hand the whole Sit-Down to Build Studio ---
  const ceremonyOps = {
    turns, session, disp, busy,
    onEdit: () => persist(),
    md: (rb: any) => projectMd(rb, sessionRef.current, dispRef.current),
    toast,
    onBuild: async (rb: any) => {
      const { _custom, ...clean } = rb || {};
      try {
        const r = await api.sitdownHandoff(sessionRef.current, clean);
        persist();
        onHandoff(r.studio);
      } catch (e: any) { toast(e.message || "Could not hand off. Try again."); }
    },
  };

  // --- derived ---
  const last = turns[turns.length - 1];
  const stage = session?.stage || "";
  const covered = coveredDims(disp);
  const sharpCovered = SHARP.filter((k) => disp.brief[k]).length;
  const openq = (() => {
    if (!last || busy || !last._ready && last._live) return null;
    const o = arr(last.ui).find((u) => u && u.type === "open");
    return o ? (typeof o.hint === "string" && o.hint.trim() ? noDash(o.hint.trim()) : "Type your answer") : null;
  })();
  const stepText = !stage ? "Before we start" : SHARP.includes(stage) ? `Sharpening your idea · ${covered.length} of ${DIMS.length} covered` : STAGE_LABEL[stage] || "";
  const chatEnabled = !!session && !busy && !tour;
  const wrapUp = !!session && SHARP.includes(stage) && sharpCovered >= 3 && !busy && !tour;

  // --- tour: voice, then the question, then the brief; flows with the content ---
  useEffect(() => {
    if (!tour) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.(".tk")) { e.preventDefault(); e.stopPropagation(); endTour(); return; }
      if (!tour.ready) { if (t.closest?.(".tourmark")) { e.preventDefault(); e.stopPropagation(); } return; }
      e.preventDefault(); e.stopPropagation(); advance();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); endTour(); }
      else if (tour.ready && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); advance(); }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("keydown", onKey, true); };
  }); // re-bound each render with the latest tour state
  const advance = () => {
    if (!tour) return;
    const i = tour.i + 1;
    if (i === 1) setTourCls((c) => c.filter((x) => x !== "tour-hideAsk"));
    if (i === 2) setTourCls((c) => c.filter((x) => x !== "tour-hideR"));
    if (i >= TOUR_STEPS.length) return endTour();
    setTour({ ...tour, i });
  };
  const endTour = () => {
    setTour(null); setTourCls([]);
    toured.current = true;
    try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* */ }
  };

  // --- render ---
  const voiceRefFor = (id: string) => (el: HTMLDivElement | null) => { voiceEls.current[id] = el; };
  return (
    <div ref={rootRef} className={`sd ${busy ? "busy" : ""} ${tourCls.join(" ")}`}>
      <div className="stage">
        <section className="left">
          <div className="col">
            <div className="hdr">
              <div className="segs">{session ? DIMS.map((d) => <i key={d.key} className={disp.brief[d.key] ? "done" : ""} title={d.label} />) : null}</div>
              <span className="step">{stepText}</span>
              <span className={`think ${thinking ? "on" : ""}`}>{thinking}</span>
              <div className="hbtns">
                {turns.length > 0 && !busy && <button className="hbtn" onClick={goBack}>Back</button>}
                {session && <button className="hbtn" onClick={() => setLost(true)}>I'm lost</button>}
              </div>
            </div>
            <div className="thread" ref={threadRef}>
              {turns.length === 0 ? (
                <Landing idea={landing} minH={threadH} onStart={(v) => { setLanding(v); send(v); }} />
              ) : turns.map((t, i) => (
                <TurnBlock key={t.id} turn={t} index={i} last={i === turns.length - 1} minH={threadH} busy={busy}
                  thinking={i === turns.length - 1 && busy && !!thinking} north={disp.north}
                  voiceRef={voiceRefFor(t.id)} onSend={send} onEdit={editFrom} onRetry={retry}
                  scope={scopeOps} ceremony={ceremonyOps} />
              ))}
            </div>
            <ChatBar value={chat} onChange={setChat} enabled={chatEnabled} started={!!session} askme={openq}
              wrapUp={wrapUp} focusNonce={focusNonce}
              onSend={(v) => { setChat(""); send(v, {}); }}
              onWrapUp={() => send("I'm ready, let's see how to build it.", { wrap_up: true })} />
          </div>
        </section>
        <BriefPane disp={disp} drafts={drafts} fx={fx} idea={session?.idea || ""} started={!!session} />
      </div>

      {lost && session && (
        <LostSheet stepText={stepText} disp={disp} session={session} turns={turns} stage={stage}
          onClose={() => setLost(false)} onGo={(k) => { setLost(false); restoreTo(k); }}
          onStartOver={() => { setLost(false); resetAll(); }} />
      )}
      {tour && <TourMark i={tour.i} ready={tour.ready} root={rootRef.current} onEnd={endTour} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}

function Landing({ idea, minH, onStart }: { idea: string; minH: number; onStart: (v: string) => void }) {
  const [v, setV] = useState(idea);
  const ta = useRef<HTMLTextAreaElement>(null);
  const go = () => { const t = v.trim(); if (words(t) < 4) { ta.current?.focus(); return; } onStart(t); };
  return (
    <div className="blk" style={minH ? { minHeight: minH } : undefined}>
      <div className="vrow voiceRow">
        <div className="av">SA</div>
        <div><div className="who">Your SA</div>
          <div className="voiceBox"><div className="voiceT">Tell me what you want to build, the way you'd say it to a colleague. Rough is fine. I grade the idea, never you.</div></div>
        </div>
      </div>
      <div className="note" />
      <div className="ask">
        <h1 className="q">What do you want to build?</h1>
        <p className="hint">Say it the way you would to a colleague.</p>
        <textarea ref={ta} className="idea" value={v} placeholder={IDEA_PH} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } }} />
        <div className="crow"><button className="cbtn" onClick={go}>Pull up a chair</button></div>
      </div>
    </div>
  );
}

function LostSheet({ stepText, disp, session, turns, stage, onClose, onGo, onStartOver }: {
  stepText: string; disp: Disp; session: any; turns: TurnData[]; stage: string; onClose: () => void; onGo: (k: number) => void; onStartOver: () => void;
}) {
  const order = ["shapes", "scope", "readback"];
  const left = [...DIMS.filter((d) => !disp.brief[d.key]).map((d) => d.label),
    ...order.filter((x) => order.indexOf(x) >= order.indexOf(stage) && x !== stage).map((x) => STAGE_LABEL[x])];
  const got = [...disp.settled.map((k) => `${dimLabel(k)}: ${disp.brief[k]}`), ...strList(session.decisions)].slice(-3);
  return (
    <div className="veil on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="lb">{stepText}</div>
        <h3>Here's where we are.</h3>
        <div className="cols">
          <div><div className="lb">Settled so far</div>{got.length ? <ul>{got.map((x, i) => <li key={i}>{noDash(x)}</li>)}</ul> : <p className="muted">Nothing settled yet. That is fine.</p>}</div>
          <div><div className="lb">Still to do</div>{left.length ? <ul>{left.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">Just this step.</p>}</div>
        </div>
        {turns.length > 1 && (
          <>
            <div className="lb">Go back to what you said</div>
            <div className="acts">{turns.slice(0, -1).map((t, i) => (
              <button key={t.id} className="stepbtn" title={noDash(t.you)} onClick={() => onGo(i + 1)}>{noDash(t.you).slice(0, 28)}{t.you.length > 28 ? "…" : ""}</button>
            ))}</div>
          </>
        )}
        <p className="muted" style={{ marginTop: 16 }}>You can always just type in the box below and tell your SA what's confusing.</p>
        <div className="acts" style={{ marginTop: 8, justifyContent: "space-between", alignItems: "center" }}>
          <button className="hbtn" onClick={onClose}>Keep going</button>
          <button className="link" style={{ fontSize: 13 }} onClick={onStartOver}>Start over with a new idea</button>
        </div>
      </div>
    </div>
  );
}

function TourMark({ i, ready, root, onEnd }: { i: number; ready: boolean; root: HTMLElement | null; onEnd: () => void }) {
  const st = TOUR_STEPS[i];
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 80, top: 120 });
  useLayoutEffect(() => {
    const el = root?.querySelector<HTMLElement>(st.sel);
    root?.querySelectorAll(".tour-focus").forEach((x) => x.classList.remove("tour-focus"));
    if (el) el.classList.add("tour-focus");
    const r = el ? el.getBoundingClientRect() : { left: 80, right: 400, top: 120, bottom: 200, height: 80 } as DOMRect;
    const W = 320, vw = window.innerWidth;
    let left = r.left, top = r.bottom + 16;
    if (st.at === "below") top = r.top + Math.min(r.height, 140) + 16;
    if (st.at === "right") { left = Math.min(r.right + 16, vw - W - 16); top = r.top + 16; }
    if (st.at === "left") { left = Math.max(16, r.left - W - 16); top = r.top + 96; }
    setPos({ left: Math.max(16, left), top: Math.max(64, Math.min(top, window.innerHeight - 180)) });
    return () => { el?.classList.remove("tour-focus"); };
  }, [i, root]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastStep = i === TOUR_STEPS.length - 1;
  return (
    <div key={i} className={`tourmark ${ready ? "" : "wait"}`} style={{ left: pos.left, top: pos.top }}>
      <p>{st.text}</p>
      <div className="ta"><button className="tn">{lastStep ? "Got it" : "Next"}</button><button className="tk" onClick={onEnd}>Skip tour</button></div>
    </div>
  );
}

// re-exported for tests
export { motion };
