"""Sit-Down model bench: speed + deterministic checks + blind LLM judge.

    cd v2v-studio && python -m optimize.sitdown_eval.run --profile build-studio [--configs a,b] [--runs 2]

Each config plays all scenarios through the REAL server/sitdown.py prompts + state machine,
streaming every call to time first token, time-to-reaction (when the UI could first show text)
and total. Then an Opus judge scores each session blind. Writes results/<ts>/ + report.md.
"""
import argparse, json, re, statistics, threading, time
import concurrent.futures as cf
from datetime import datetime
from pathlib import Path

from databricks.sdk import WorkspaceClient
from openai import OpenAI

from server import sitdown as sd
from server.build_plan import SEEDED_DATASETS
from .scenarios import SCENARIOS

CONFIGS = {
    "gpt-oss-20b@low": ("databricks-gpt-oss-20b", {"reasoning_effort": "low"}, 3000),
    "gpt-oss-20b@med": ("databricks-gpt-oss-20b", {"reasoning_effort": "medium"}, 5000),
    "gpt-oss-120b@low": ("databricks-gpt-oss-120b", {"reasoning_effort": "low"}, 3000),
    "gpt-oss-120b@med": ("databricks-gpt-oss-120b", {"reasoning_effort": "medium"}, 5000),
    "haiku-4.5": ("databricks-claude-haiku-4-5", {}, 2000),
    "qwen3-next-80b": ("databricks-qwen3-next-80b-a3b-instruct", {}, 2000),
    "qwen3.5-122b": ("databricks-qwen35-122b-a10b", {}, 8000),
    "llama-4-maverick": ("databricks-llama-4-maverick", {}, 2000),
    "llama-3.3-70b": ("databricks-meta-llama-3-3-70b-instruct", {}, 2000),
    "sonnet-4.6": ("databricks-claude-sonnet-4-6", {}, 2000),
    "sonnet-5 (current)": ("databricks-claude-sonnet-5", {}, 4000),
}
# Split configs: fast model for the conversational beats, stronger model for the "drafting" moments.
ROUTES = {
    "split: haiku + sonnet-4.6": {"open": "haiku-4.5", "turn": "haiku-4.5",
                                  "shapes": "sonnet-4.6", "scope": "sonnet-4.6", "readback": "sonnet-4.6"},
    "split: haiku + sonnet-5": {"open": "haiku-4.5", "turn": "haiku-4.5",
                                "shapes": "sonnet-5 (current)", "scope": "sonnet-5 (current)",
                                "readback": "sonnet-5 (current)"},
}
JUDGE = "databricks-claude-opus-5-5"
ROOT = Path(__file__).parent

_tok_lock = threading.Lock()
_client = None


def client(profile):
    global _client
    with _tok_lock:
        if _client is None:
            w = WorkspaceClient(profile=profile)
            tok = w.config.authenticate()["Authorization"].split(" ", 1)[1]
            _client = OpenAI(api_key=tok, base_url=f"{w.config.host}/serving-endpoints", timeout=180)
        return _client


def _text(ct):
    if isinstance(ct, list):
        return "".join(b.get("text", "") for b in ct if isinstance(b, dict) and b.get("type") == "text")
    return ct or ""


REACTION_RE = re.compile(r'"reaction"\s*:\s*"((?:[^"\\]|\\.)*)"')


def call(c, cfg, messages):
    model, extra, max_tokens = CONFIGS[cfg]
    for attempt in range(4):
        t0 = time.perf_counter()
        first = react = None
        buf = ""
        try:
            stream = c.chat.completions.create(model=model, messages=messages, max_tokens=max_tokens,
                                               stream=True, extra_body=extra or None)
            for ev in stream:
                if not ev.choices:
                    continue
                piece = _text(ev.choices[0].delta.content)
                if not piece:
                    continue
                now = time.perf_counter() - t0
                if first is None:
                    first = now
                buf += piece
                if react is None and REACTION_RE.search(buf):
                    react = now
            total = time.perf_counter() - t0
            return {"text": buf, "t_first": first, "t_react": react or total, "t_total": total,
                    "retries": attempt}
        except Exception as e:
            msg = str(e)
            if attempt < 3 and any(s in msg for s in ("429", "503", "502", "timeout", "Timeout", "REQUEST_LIMIT")):
                time.sleep(2 * (attempt + 1))
                continue
            return {"text": "", "error": msg[:300], "t_first": None, "t_react": None,
                    "t_total": time.perf_counter() - t0, "retries": attempt}


def resolve(answer_text, prev_out, kind):
    """'pick:N' resolves against the model's own offered options: the pushback's for a
    pushback reply, otherwise the next question's."""
    m = re.match(r"pick:(\d)", answer_text)
    if not m:
        return answer_text, True
    src = "pushback" if kind == "pushback_reply" else "next_question"
    opts = ((prev_out or {}).get(src) or {}).get("options") or []
    i = int(m.group(1))
    if i < len(opts) and isinstance(opts[i], dict):
        o = opts[i]
        return f"{o.get('label', '')}. {o.get('sub', '')}".strip(), True
    return "The second option sounds right.", False


def play(c, cfg, sc):
    ds = sd.match_dataset(sc["idea"] + " " + " ".join(s["text"] for s in sc["steps"]))
    state = sd.new_state(sc["idea"])
    calls = []

    def record(kind, messages, answer=None, step=None, push=False):
        r = call(c, ROUTES[cfg][kind] if cfg in ROUTES else cfg, messages)
        out = sd.guard(state, kind, sd.parse(r["text"]), answer, push)
        r.update(kind=kind, step=step, answer=answer, out=out, prompt_chars=sum(len(m["content"]) for m in messages))
        calls.append(r)
        try:
            sd.apply(state, kind, out, answer)
        except (AttributeError, TypeError, ValueError, KeyError):
            pass
        return out

    prev = record("open", sd.open_messages(state, ds))
    for i, st in enumerate(sc["steps"]):
        state["stage"] = st["stage"]
        text, resolved = resolve(st["text"], prev, st["kind"])
        kind = st["kind"] if st["kind"] != "card" else "card"
        ans = {"kind": kind, "text": text, "resolved": resolved}
        prev = record("turn", sd.turn_messages(state, ds, ans, require_pushback=st.get("push", False)), ans, i,
                      st.get("push", False))
    record("shapes", sd.shapes_messages(state, ds))
    cf_ = sc.get("custom_feature", "")
    record("scope", sd.scope_messages(state, ds, cf_), {"kind": "custom_feature", "text": cf_} if cf_ else None)
    record("readback", sd.readback_messages(state, ds))
    return {"config": cfg, "scenario": sc["id"], "dataset": (ds or {}).get("schema"), "calls": calls,
            "final_state": {k: v for k, v in state.items() if k != "history"}}


# ── deterministic checks ──────────────────────────────────────────────────────

REQ = {"open": ["reaction", "north_star", "grades", "next_question"],
       "turn": ["reaction", "section", "alignment"],
       "shapes": ["shapes", "recommended"],
       "scope": ["features", "packages"],
       "readback": ["who", "what", "worked_if", "risks", "data_plan"]}
ALL_TABLES = set(re.findall(r"\b((?:dim|fact)_[a-z_]+)", " ".join(d["tables"] for d in SEEDED_DATASETS)))
ALL_TABLES |= {"product_elasticity", "price_change_events", "sales_forecast", "competitor_sites", "customer_reviews"}


def words(s):
    return len(str(s or "").split())


def gidx(g):
    return sd.GRADES.index(g) if g in sd.GRADES else None


def check_session(sess, sc):
    ex = sc["expect"]
    ds_tables = set()
    for d in SEEDED_DATASETS:
        if d["schema"] == sess["dataset"]:
            ds_tables = set(re.findall(r"\b([a-z]+_[a-z_]+)\s*\(", d["tables"] + " (")) | \
                        set(re.findall(r"\b((?:dim|fact)_[a-z_]+)", d["tables"]))
            ds_tables |= set(re.findall(r"\b([a-z]+_[a-z_]+)\b", d["tables"]))
    res = []
    for c in sess["calls"]:
        o, k = c["out"], c["kind"]
        r = {"kind": k, "step": c["step"], "json": o is not None, "err": c.get("error")}
        try:
            _check_call(r, o, k, c, sc, ex, ds_tables)
        except (AttributeError, TypeError, ValueError, KeyError):
            r["schema"] = False
        res.append(r)
    return res


def _check_call(r, o, k, c, sc, ex, ds_tables):
        if o:
            r["schema"] = all(x in o for x in REQ[k])
            blob = json.dumps(o, ensure_ascii=False)
            r["no_emdash"] = "—" not in blob
            r["reaction_len_ok"] = words(o.get("reaction")) <= 45 if "reaction" in o else True
            if k in ("open", "turn"):
                nq = o.get("next_question")
                if nq:
                    opts = nq.get("options") or []
                    r["opts_ok"] = len(opts) == 3 and all(words(x.get("label")) <= 10 for x in opts if isinstance(x, dict))
                g = o.get("grades") or {}
                r["grades_ok"] = all(v in sd.GRADES for v in g.values()) and (k != "open" or len(g) >= 7)
            if k == "turn":
                t = o.get("tightened") or ""
                r["tight_ok"] = words(t) <= 18
                r["section_ok"] = words((o.get("section") or {}).get("text")) <= 40
                if c["step"] is not None and c["step"] < len(ex["alignment"]):
                    r["align_ok"] = o.get("alignment") in ex["alignment"][c["step"]]
                    r["alignment"] = o.get("alignment")
                if sc["steps"][c["step"]].get("push"):
                    r["pushback_ok"] = bool((o.get("pushback") or {}).get("line"))
            if k == "scope":
                feats = o.get("features") or []
                r["blocks_ok"] = bool(feats) and all(f.get("block") in sd.BLOCKS for f in feats)
                r["has_screen"] = any(f.get("block") in ("app_screen", "dashboard") for f in feats)
                if sc.get("custom_feature"):
                    cf_ = next((f for f in feats if f.get("custom")), None)
                    r["custom_listed"] = bool(cf_)
                    if ex.get("custom_heavy") and cf_:
                        r["custom_honest"] = cf_.get("block") in ("not_today", "agent")
            if k == "shapes":
                r["shapes_ok"] = len(o.get("shapes") or []) == 3
            if k == "readback" and ex.get("must_generate"):
                gen = " ".join((o.get("data_plan") or {}).get("generate") or []).lower()
                r["generate_ok"] = bool(re.search(ex["must_generate"], gen))
            if k == "readback":
                seeded = (o.get("data_plan") or {}).get("seeded") or []
                bad = [t for t in seeded if isinstance(t, str) and
                       re.sub(r"^.*\.", "", t.strip()).split()[0] not in (ds_tables | ALL_TABLES)]
                r["no_fake_seeded"] = not bad
                if bad:
                    r["fake_tables"] = bad[:3]
            if k == "open" and ex.get("open_max_mean"):
                gi = [gidx(v) for v in (o.get("grades") or {}).values() if gidx(v) is not None]
                r["calibrated"] = bool(gi) and statistics.mean(gi) <= gidx(ex["open_max_mean"])


# ── blind judge ───────────────────────────────────────────────────────────────

JUDGE_SYS = """You are an exacting reviewer of an AI "Solutions Architect" that coaches workshop participants
through sharpening a build idea, one step at a time. You score transcripts blind (you do not know which
model produced them). Be strict and consistent; 3 is acceptable, 5 is what a top human SA would say."""


def judge_prompt(sess, sc):
    ds = next((d for d in SEEDED_DATASETS if d["schema"] == sess["dataset"]), None)
    lines = []
    for i, c in enumerate(sess["calls"]):
        a = c.get("answer")
        lines.append(f"### Step {i} · {c['kind']}" + (f" · participant ({a['kind']}): {a['text']}" if a else ""))
        lines.append(json.dumps(c["out"], ensure_ascii=False) if c["out"] else f"(no valid JSON) raw: {c['text'][:400]}")
    truth = (f"Seeded tables that exist: {ds['schema']}: {ds['tables']}" if ds else "No seeded dataset matched; all data is generated.")
    return f"""PARTICIPANT'S ORIGINAL IDEA: "{sc['idea']}"
GROUND TRUTH: {truth}. Anything else must be described as generated, not existing. The workshop is ONE day,
happy path, no ML training, no live integrations. Participants are Costa Coffee (UK) staff, so the coach
referring to Costa, stores and £ is correct context, not a hallucination. Expected alignment labels per turn step: {sc['expect']['alignment']}.

TRANSCRIPT (step outputs are the coach's JSON):
{chr(10).join(lines)}

Score each step 1-5 on:
- grounding: specific to THIS idea and data, not generic
- continuity: builds on what was already said/decided, no re-asking, remembers corrections
- coaching: sharpness of reactions, pushback and options; would a great SA say this
- concision: snappy and scannable, no bloat
- accuracy: data claims true to ground truth, grades honest for the input quality, realistic day scope
Then score the session 1-10 on overall quality, and 1-5 on: idea_improved (is the final brief much sharper
than v1), drift_handling (noticed drift and steered back without steamrolling), realism (one-day honest).

Reply with ONLY JSON:
{{"steps": [{{"step": 0, "grounding": n, "continuity": n, "coaching": n, "concision": n, "accuracy": n}}, ...],
  "session": {{"overall": n, "idea_improved": n, "drift_handling": n, "realism": n}},
  "best": "<=20 words", "worst": "<=20 words"}}"""


def judge(c, sess, sc):
    msgs = [{"role": "system", "content": JUDGE_SYS}, {"role": "user", "content": judge_prompt(sess, sc)}]
    for attempt in range(4):
        try:
            r = c.chat.completions.create(model=JUDGE, messages=msgs, max_tokens=12000)
            j = sd.parse(_text(r.choices[0].message.content))
            if j and (j.get("session") or {}).get("overall") is not None:
                return j
        except Exception as e:
            time.sleep(3 * (attempt + 1))
    return None


# ── report ────────────────────────────────────────────────────────────────────

def pct(xs, p):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    return xs[min(len(xs) - 1, int(round(p * (len(xs) - 1))))]


def report(sessions, out_dir):
    by = {}
    for s in sessions:
        by.setdefault(s["config"], []).append(s)
    rows = []
    for cfg, ss in by.items():
        calls = [c for s in ss for c in s["calls"]]
        turns = [c for c in calls if c["kind"] == "turn"]
        checks = [r for s in ss for r in s["checks"]]
        flat = [v for r in checks for kk, v in r.items() if kk.endswith("_ok") or kk in
                ("json", "schema", "no_emdash", "custom_honest", "custom_listed", "no_fake_seeded", "calibrated")]
        flat = [v for v in flat if isinstance(v, bool)]
        align = [r["align_ok"] for r in checks if "align_ok" in r]
        drift_hits = [r["align_ok"] for s in ss for r in s["checks"]
                      if "align_ok" in r and SCN[s["scenario"]]["expect"]["alignment"][r["step"]] == ["drifting"]]
        js = [s["judge"] for s in ss if s.get("judge")]
        step_scores = [st for j in js for st in j.get("steps", [])]
        dim = lambda d: statistics.mean(st.get(d, 0) for st in step_scores) if step_scores else None
        rows.append({
            "config": cfg,
            "turn_react_p50": pct([c["t_react"] for c in turns], .5),
            "turn_total_p50": pct([c["t_total"] for c in turns], .5),
            "turn_total_p90": pct([c["t_total"] for c in turns], .9),
            "all_total_p50": pct([c["t_total"] for c in calls], .5),
            "session_s": statistics.mean(sum(c["t_total"] for c in s["calls"]) for s in ss),
            "json": sum(1 for c in calls if c["out"]) / len(calls),
            "checks": sum(flat) / len(flat) if flat else 0,
            "align": sum(align) / len(align) if align else 0,
            "drift": f"{sum(drift_hits)}/{len(drift_hits)}",
            "errors": sum(1 for c in calls if c.get("error")),
            "judge_overall": statistics.mean(j["session"]["overall"] for j in js) if js else None,
            "grounding": dim("grounding"), "continuity": dim("continuity"), "coaching": dim("coaching"),
            "concision": dim("concision"), "accuracy": dim("accuracy"),
            "improved": statistics.mean(j["session"].get("idea_improved", 0) for j in js) if js else None,
            "drift_j": statistics.mean(j["session"].get("drift_handling", 0) for j in js) if js else None,
            "realism": statistics.mean(j["session"].get("realism", 0) for j in js) if js else None,
        })
    rows.sort(key=lambda r: -(r["judge_overall"] or 0))
    f = lambda v, d=2: "–" if v is None else (f"{v:.{d}f}" if isinstance(v, float) else str(v))
    md = ["# Sit-Down model bench", "", f"_{datetime.now():%Y-%m-%d %H:%M}_ · {len(SCENARIOS)} scenarios × runs · judge {JUDGE} (blind)", "",
          "## Speed (seconds)", "", "| config | turn: reaction p50 | turn: total p50 | turn: total p90 | any call p50 | full session | errors |",
          "|---|---|---|---|---|---|---|"]
    for r in sorted(rows, key=lambda r: r["turn_total_p50"] or 99):
        md.append(f"| {r['config']} | {f(r['turn_react_p50'])} | {f(r['turn_total_p50'])} | {f(r['turn_total_p90'])} | {f(r['all_total_p50'])} | {f(r['session_s'],0)} | {r['errors']} |")
    md += ["", "## Quality", "", "| config | judge /10 | grounding | continuity | coaching | concision | accuracy | improved | drift (judge) | realism | JSON | checks | alignment | drift caught |",
           "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        md.append(f"| {r['config']} | {f(r['judge_overall'])} | {f(r['grounding'])} | {f(r['continuity'])} | {f(r['coaching'])} | {f(r['concision'])} | {f(r['accuracy'])} | {f(r['improved'])} | {f(r['drift_j'])} | {f(r['realism'])} | {r['json']:.0%} | {r['checks']:.0%} | {r['align']:.0%} | {r['drift']} |")
    md += ["", "## Judge notes (best / worst, one per session)", ""]
    for s in sessions:
        j = s.get("judge") or {}
        md.append(f"- **{s['config']} · {s['scenario']}** · {j.get('session', {}).get('overall', '–')}/10 · + {j.get('best', '')} · − {j.get('worst', '')}")
    (out_dir / "report.md").write_text("\n".join(md))
    (out_dir / "summary.json").write_text(json.dumps(rows, indent=2))
    return "\n".join(md)


SCN = {s["id"]: s for s in SCENARIOS}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", default="build-studio")
    ap.add_argument("--configs", default="")
    ap.add_argument("--scenarios", default="")
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--no-judge", action="store_true")
    ap.add_argument("--workers", type=int, default=3, help="parallel sessions per config")
    ap.add_argument("--resume", default="", help="results dir: re-check saved sessions, run only missing ones")
    a = ap.parse_args()

    c = client(a.profile)
    cfgs = a.configs.split(",") if a.configs else list(CONFIGS)
    assert all(x in CONFIGS or x in ROUTES for x in cfgs), cfgs
    scs = [s for s in SCENARIOS if not a.scenarios or s["id"] in a.scenarios.split(",")]
    out_dir = Path(a.resume) if a.resume else ROOT / "results" / datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    jobs = [(cfg, sc, r) for r in range(a.runs) for sc in scs for cfg in cfgs]
    sessions = []
    if a.resume and (out_dir / "sessions.jsonl").exists():
        for line in (out_dir / "sessions.jsonl").open():
            s = json.loads(line)
            s["checks"] = check_session(s, SCN[s["scenario"]])
            sessions.append(s)
        done = {(s["config"], s["scenario"], s["run"]) for s in sessions}
        jobs = [j for j in jobs if (j[0], j[1]["id"], j[2]) not in done]
    sems = {cfg: threading.Semaphore(a.workers) for cfg in cfgs}
    print(f"{len(jobs)} sessions → {out_dir}")

    lock = threading.Lock()

    def one(job):
        cfg, sc, r = job
        with sems[cfg]:
            s = play(c, cfg, sc)
        s["run"] = r
        s["checks"] = check_session(s, sc)
        if not a.no_judge:
            s["judge"] = judge(c, s, sc)
        with lock:
            sessions.append(s)
            (out_dir / "sessions.jsonl").open("a").write(json.dumps(s, ensure_ascii=False) + "\n")
            t = sum(x["t_total"] for x in s["calls"])
            print(f"  {cfg:20s} {sc['id']:20s} r{r} {t:6.1f}s  judge={((s.get('judge') or {}).get('session') or {}).get('overall')}", flush=True)

    # per-config semaphore: at most `workers` live sessions per endpoint
    with cf.ThreadPoolExecutor(max_workers=len(cfgs) * a.workers) as ex:
        list(ex.map(one, jobs))
    print(report(sessions, out_dir))


if __name__ == "__main__":
    main()
