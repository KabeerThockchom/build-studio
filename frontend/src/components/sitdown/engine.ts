/* The Sit-Down's pure helpers: defensive parsing, grades, the brief model, the smooth
   word-level streamer and the page-turn scroll. Ported from server/static/sitdown3.html. */

export const RM = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const noDash = (s: unknown) => String(s ?? "").replace(/\s*\u2014\s*/g, ", ");
export const words = (s: string) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
export const clone = <T,>(o: T): T => (o == null ? o : JSON.parse(JSON.stringify(o)));

// Defensive: the model can send the wrong shape. Lists are lists or nothing.
export const arr = (x: unknown): any[] => (Array.isArray(x) ? x : []);
export const obj = (x: unknown): Record<string, any> => (x && typeof x === "object" && !Array.isArray(x) ? (x as any) : {});
export const optList = (x: unknown): { label: string; sub?: string; consider?: string }[] =>
  arr(x).map((o) => (typeof o === "string" ? { label: o } : o)).filter((o) => o && typeof o === "object" && o.label);
export const strList = (x: unknown): string[] =>
  arr(x).filter((v) => typeof v === "string" || typeof v === "number").map(String);

// --- the seven brief sections and the stages ---
export const DIMS = [
  { key: "problem", label: "Problem" }, { key: "user_moment", label: "User & moment" },
  { key: "objective", label: "Objective" }, { key: "decision", label: "Decision it drives" },
  { key: "data", label: "Data reality" }, { key: "scope", label: "Scope for a day" },
  { key: "risk", label: "Biggest risk" },
];
export const SHARP = ["problem", "user_moment", "objective", "decision", "data", "risk"];
export const STAGE_LABEL: Record<string, string> = {
  problem: "Problem", user_moment: "User & moment", objective: "Objective", decision: "Decision",
  data: "Data", risk: "Risk", shapes: "Ways to build it", scope: "Fit it in a day", readback: "Your plan",
};
export const dimLabel = (k: string) => DIMS.find((d) => d.key === k)?.label || k;

// --- grades ---
export const GRADES = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
export const gIdx = (g?: string | null) => GRADES.indexOf(g || "");
// Section rating out of 5: F/D- 0 · D/D+ 1 · C-/C 2 · C+/B- 3 · B/B+ 4 · A-/A/A+ 5
const DOTS: Record<string, number> = { F: 0, "D-": 0, D: 1, "D+": 1, "C-": 2, C: 2, "C+": 3, "B-": 3, B: 4, "B+": 4, "A-": 5, A: 5, "A+": 5 };
export const dotsOf = (g?: string | null) => DOTS[g || ""] ?? 0;
export const gcls = (g?: string | null) => {
  const c = String(g || "")[0];
  return c === "A" ? "gA" : c === "B" ? "gB" : c === "C" ? "gC" : c === "D" || c === "F" ? "gD" : "";
};
export const GCOL: Record<string, string> = { gA: "var(--gA)", gB: "var(--gB)", gC: "var(--gC)", gD: "var(--gD)" };
export const GINK: Record<string, string> = { gA: "var(--gA-i)", gB: "var(--gB-i)", gC: "var(--gC-i)", gD: "var(--gD-i)" };

// What the right pane shows. It only moves after the SA finishes speaking.
export interface LogLine { v: number; t: string; }
export interface Disp {
  grades: Record<string, string>;
  brief: Record<string, string>;
  settled: string[];
  north: string;
  sharper: string;
  log: Record<string, LogLine[]>;
  firstOverall: string | null;
}
export const freshDisp = (): Disp => ({ grades: {}, brief: {}, settled: [], north: "", sharper: "", log: {}, firstOverall: null });
export const coveredDims = (d: Disp) => DIMS.map((x) => x.key).filter((k) => d.brief[k]);
// Overall = mean dots over ALL seven sections (uncovered count 0): it climbs with coverage AND quality.
export const overallMean = (d: Disp) => DIMS.reduce((a, x) => a + (d.brief[x.key] ? dotsOf(d.grades[x.key]) : 0), 0) / DIMS.length;
const BANDS: [number, string][] = [[0.6, "F"], [1.2, "D-"], [1.6, "D"], [2.0, "D+"], [2.4, "C-"], [2.8, "C"], [3.1, "C+"], [3.4, "B-"], [3.8, "B"], [4.1, "B+"], [4.4, "A-"], [4.8, "A"]];
export const letterOfMean = (m: number) => (BANDS.find(([t]) => m < t) || [0, "A+"])[1];
export const overallLetter = (d: Disp) => (coveredDims(d).length ? letterOfMean(overallMean(d)) : null);

// --- scope ---
export const EFFORT: Record<string, { t: string; cups: number }> = { quick: { t: "Quick", cups: 1 }, half: { t: "Half day", cups: 2 }, big: { t: "Big", cups: 3 } };
export const LANES = [{ k: "today", t: "Today" }, { k: "stretch", t: "Stretch, after the core" }, { k: "later", t: "Saved for later" }];
export const fitCls = (fit?: string) => (/won/i.test(fit || "") ? "no" : /tight/i.test(fit || "") ? "tight" : /comfort/i.test(fit || "") ? "ok" : "");

// --- motion ---
export const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// True while the page-turn scroll runs: the streamer holds words until the page is still.
export const motion = { scrolling: false };

export function scrollTo(el: HTMLElement, top: number, ms: number) {
  const from = el.scrollTop, d = top - from;
  if (RM || !ms || Math.abs(d) < 2) { el.scrollTop = top; motion.scrolling = false; return; }
  motion.scrolling = true;
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    el.scrollTop = from + d * easeIO(k);
    if (k < 1) requestAnimationFrame(step); else motion.scrolling = false;
  };
  requestAnimationFrame(step);
}

/* Smooth stream: network chunks go into a buffer; a rAF loop reveals whole words at an
   adaptive rate (steady ~48 chars/s, faster as the backlog grows so it never trails the
   network by more than ~300ms, a brisk drain once the prose is complete). Append-only DOM:
   one span per revealed chunk, never a rewrite. A calm caret sits at the end. */
export interface Streamer { push(t: string): void; finish(): void; abort(): void; }
export function makeStream(el: HTMLElement, { onFirst, onEnd }: { onFirst?: () => void; onEnd?: () => void } = {}): Streamer {
  el.textContent = "";
  const caret = document.createElement("span");
  caret.className = "caret";
  el.appendChild(caret);
  let full = "", shown = 0, fin = false, raf = 0, last = 0, budget = 0, started = false, stopped = false, lastPush = performance.now();
  const WORD = /\S+\s+/y;
  const frame = (now: number) => {
    if (stopped) return;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    if (motion.scrolling) { raf = requestAnimationFrame(frame); return; }   // words only on a still page
    const backlog = full.length - shown;
    let rate = Math.max(48, backlog / 0.3);
    if (fin) rate = Math.max(rate, backlog / 0.12, 200);
    budget = Math.min(budget + (rate * dt) / 1000, 40);
    let target = shown, n = 0;
    while (n < (fin ? 3 : 2)) {
      WORD.lastIndex = target;
      const m = WORD.exec(full);
      let nx = m ? WORD.lastIndex : -1;
      const idle = !fin && performance.now() - lastPush > 500;   // stalled network: don't hold a finished-looking word
      if (nx < 0 && (fin || idle) && target < full.length) nx = full.length;
      if (nx < 0) break;
      if (nx - shown > budget && budget < 40) break;              // reveal a whole word once the budget covers it
      target = nx; n++;
    }
    if (target > shown) {
      const w = document.createElement("span");
      w.className = "w";
      w.textContent = noDash(full.slice(shown, target));
      el.insertBefore(w, caret);
      budget = Math.max(0, budget - (target - shown));
      shown = target;
      if (!started) { started = true; onFirst?.(); }
    }
    if (fin && shown >= full.length) {
      caret.classList.add("gone");
      setTimeout(() => caret.remove(), 320);
      stopped = true;
      onEnd?.();
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  return {
    push(t) { full += t; lastPush = performance.now(); if (!raf) raf = requestAnimationFrame(frame); },
    finish() { fin = true; if (!raf) raf = requestAnimationFrame(frame); },
    abort() { stopped = true; cancelAnimationFrame(raf); caret.remove(); },
  };
}

// A short PROJECT.md preview built from the readback and the brief (Copy / Preview in the ceremony).
export function projectMd(rb: Record<string, any>, session: Record<string, any>, disp: Disp) {
  const s = session || {}, dp = obj(rb.data_plan), L: string[] = [];
  const lane = (k: string) => arr(s.features).filter((f) => f && (f.lane || "later") === k).map((f) => f.name);
  L.push("# PROJECT.md", "", `> ${noDash(rb.north_star || disp.north || s.idea)}`, "", "## What we are building",
    `- **Who:** ${noDash(rb.who || "")}`, `- **What:** ${noDash(rb.what || "")}`, `- **Worked if:** ${noDash(rb.worked_if || "")}`);
  L.push("", "## Decisions"); strList(s.decisions).forEach((d) => L.push("- " + noDash(d)));
  L.push("", `## Today's build (${s.fit || "fit not set"})`); lane("today").forEach((n) => L.push("- " + noDash(n)));
  if (lane("stretch").length) { L.push("", "## Stretch, after the core"); lane("stretch").forEach((n) => L.push("- " + noDash(n))); }
  L.push("", "## Brief"); DIMS.forEach((d) => L.push(`- **${d.label}** (${disp.grades[d.key] || "–"}): ${disp.brief[d.key] ? noDash(disp.brief[d.key]) : "_not settled_"}`));
  L.push("", "## Data plan"); strList(dp.seeded).forEach((t) => L.push(`- Seeded, read only: ${t}`)); strList(dp.generate).forEach((t) => L.push(`- Generate in your own schema: ${t}`));
  L.push("", "## Risks and mitigations"); arr(rb.risks).forEach((r) => r && L.push(`- ${noDash(r.risk || r)}${r.mitigation ? `\n  - Mitigation: ${noDash(r.mitigation)}` : ""}`));
  const pk = strList(s.parked); if (pk.length) { L.push("", "## Parked for v2"); pk.forEach((p) => L.push("- " + noDash(p))); }
  return L.join("\n");
}
