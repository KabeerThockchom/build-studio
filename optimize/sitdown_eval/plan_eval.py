"""Plan eval: the back half of Build Studio v2, end to end.

Takes finished Sit-Downs from a conversation-eval run (sessions.jsonl with full final state) and pushes each
through the real pipeline: /api/sitdown/handoff -> /api/plan/start (draft/check/refine) -> /api/build_plan.
A blind Opus judge scores the plan + build steps against the participant's Sit-Down and hidden truth.

    python -m optimize.sitdown_eval.plan_eval --from <conv results dir> [--n 10] [--workers 4]
"""
import argparse, json, os, re, statistics, threading, time
import concurrent.futures as cf
from datetime import datetime
from pathlib import Path

import requests

os.environ.setdefault("DATABRICKS_PROFILE", "build-studio")
from server import llm  # noqa: E402
from .conversation import IDEAS, JUDGE_MODEL  # noqa: E402

API = os.environ.get("SITDOWN_BASE", "http://localhost:8000/api")
ROOT = Path(__file__).parent
COMPONENTS = ["Declarative Pipelines", "Lakebase", "Genie", "AI/BI Dashboards", "Databricks Apps"]


def pipeline(sess):
    f = sess["final"]
    st = {k: v for k, v in f.items() if v is not None}
    st.setdefault("decisions", [])
    st.setdefault("parked", [])
    rb = f.get("readback") or {}
    studio = requests.post(f"{API}/sitdown/handoff", json={"state": st, "readback": rb}, timeout=60).json()["studio"]
    t0 = time.time()
    jid = requests.post(f"{API}/plan/start", json={"idea": studio["idea"], "answers": studio["answers"],
                                                    "capabilities": studio["capabilities"],
                                                    "project_name": studio["projectName"]}, timeout=30).json()["job_id"]
    while True:
        s = requests.get(f"{API}/plan/{jid}", timeout=30).json()
        if s["status"] != "running":
            break
        time.sleep(3)
    if s["status"] != "done":
        return {"studio": studio, "error": s.get("error")}
    plan_s = time.time() - t0
    bp = s["blueprint"]
    t1 = time.time()
    r = requests.post(f"{API}/build_plan", json={"idea": studio["idea"], "capabilities": studio["capabilities"],
                                                  "design_answers": studio["answers"], "prd_markdown": bp["prd_markdown"],
                                                  "project_name": studio["projectName"], "expertise": "New to it"},
                      timeout=600).json()
    steps = (r.get("plan") or r).get("steps", [])
    return {"studio": studio, "blueprint": bp, "issues": s.get("issues"), "steps": steps,
            "plan_s": plan_s, "build_s": time.time() - t1}


def checks(res):
    bp, steps, caps = res.get("blueprint") or {}, res.get("steps") or [], res["studio"]["capabilities"]
    blob = json.dumps({"bp": bp, "steps": steps}).lower()
    app = "Databricks Apps" in caps
    app_steps = [s for s in steps if s.get("capability") == "Databricks Apps"]
    return {
        "components_valid": all(c in COMPONENTS for c in caps),
        "no_agent_or_ka": not re.search(r"supervisor agent|knowledge assistant", blob),
        "app_step_is_app_builder": (not app) or (bool(app_steps) and all(s.get("tool") == "app_builder" for s in app_steps)),
        "no_app_via_genie_code": all(s.get("tool") != "genie_code" for s in app_steps),
        "one_step_per_component": all(any(s.get("capability") == c for s in steps) for c in caps),
        "medallion_mentioned": ("Declarative Pipelines" not in caps) or ("gold" in blob and "bronze" in blob),
        "app_screens_present": (not app) or bool(bp.get("app_screens")),
    }


JUDGE = """You review the PLAN and BUILD STEPS Build Studio produced after a participant's Sit-Down. Pieces allowed:
Declarative Pipelines (medallion), Genie, AI/BI Dashboards, Lakebase, Databricks Apps (built in Genie App Builder,
not Genie Code). No AI agents, no document Q&A. Score strictly, 1-5 (3 acceptable, 5 excellent):
- fidelity: the plan keeps what the participant said (facts, targets, moment, decision, essentials, risks) with nothing invented
- architecture: the right pieces for this idea, wired sensibly, nothing missing that the plan depends on
- buildable_today: realistic for one day on the happy path; today vs later honest
- genie_code_moves: the Genie Code prompts are specific, correct and in a sensible order (data -> pipeline gold -> serve)
- app_builder_prompt: (if an app) the App Builder prompt clearly describes screens, data read and what actions write; else score 5
- clarity: a newcomer could follow the PRD and steps
Reply ONLY JSON: {"fidelity":n,"architecture":n,"buildable_today":n,"genie_code_moves":n,"app_builder_prompt":n,
"clarity":n,"overall":n (1-10),"biggest_issue":"<=25 words","fixes":["<=20 words", ...up to 3]}"""


def judge(sess, res):
    idea = IDEAS[sess["idea"]]
    f = sess["final"]
    body = (f"IDEA: {idea['idea']}\nHIDDEN FACTS: {idea['truth']}\nSIT-DOWN BRIEF: {json.dumps(f.get('brief'), ensure_ascii=False)}\n"
            f"FACTS STATED: {json.dumps(f.get('facts'), ensure_ascii=False)}\nSCOPE LANES: "
            f"{json.dumps([(x.get('name'), x.get('lane')) for x in f.get('features') or []], ensure_ascii=False)}\n\n"
            f"PIECES: {res['studio']['capabilities']}\nPLAN PRD:\n{(res.get('blueprint') or {}).get('prd_markdown', '')[:9000]}\n\n"
            f"APP SCREENS: {json.dumps((res.get('blueprint') or {}).get('app_screens'), ensure_ascii=False)}\n\nBUILD STEPS:\n"
            + "\n".join(f"#{s['n']} [{s.get('capability')} via {s.get('tool')}] {s.get('title')}\nMOVE: {s.get('move')}\nVERIFY: {s.get('verify')}"
                        for s in res.get("steps") or [])[:12000])
    for _ in range(3):
        try:
            r = llm.client().chat.completions.create(model=JUDGE_MODEL, max_tokens=3000,
                                                     messages=[{"role": "system", "content": JUDGE}, {"role": "user", "content": body}])
            m = re.search(r"\{.*\}", llm.text_of(r.choices[0].message.content), re.S)
            if m:
                return json.loads(m.group(0))
        except Exception:
            time.sleep(3)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", required=True)
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    sessions = [json.loads(l) for l in open(Path(a.src) / "sessions.jsonl")]
    sessions = [s for s in sessions if s.get("final") and (s["final"].get("readback"))]
    seen, picked = set(), []
    for s in sessions:                       # one per idea first, for diversity
        if s["idea"] not in seen:
            picked.append(s); seen.add(s["idea"])
    picked = (picked + [s for s in sessions if s not in picked])[:a.n]
    out_dir = ROOT / "results" / f"plan-{datetime.now():%Y%m%d-%H%M%S}"
    out_dir.mkdir(parents=True, exist_ok=True)
    rows, lock = [], threading.Lock()

    def one(sess):
        try:
            res = pipeline(sess)
        except Exception as e:
            res = {"studio": {"capabilities": []}, "error": str(e)[:200]}
        res["checks"] = checks(res) if not res.get("error") else {}
        res["judge"] = judge(sess, res) if not res.get("error") else None
        row = {"idea": sess["idea"], "persona": sess["persona"], **res}
        with lock:
            rows.append(row)
            (out_dir / "results.jsonl").open("a").write(json.dumps(row, ensure_ascii=False) + "\n")
            j = res.get("judge") or {}
            print(f"  {sess['idea']:13s} {sess['persona']:10s} caps={res['studio'].get('capabilities')} "
                  f"overall={j.get('overall')} err={res.get('error')}", flush=True)

    with cf.ThreadPoolExecutor(a.workers) as ex:
        list(ex.map(one, picked))
    keys = ["fidelity", "architecture", "buildable_today", "genie_code_moves", "app_builder_prompt", "clarity"]
    J = [r["judge"] for r in rows if r.get("judge")]
    mean = lambda xs: statistics.mean(xs) if xs else 0
    allc = [v for r in rows for v in (r.get("checks") or {}).values()]
    md = [f"# Plan eval · {datetime.now():%Y-%m-%d %H:%M}", "", f"- Judge overall **{mean([j['overall'] for j in J]):.2f}/10** over {len(J)} plans",
          "- " + " · ".join(f"{k} {mean([j.get(k, 0) for j in J]):.2f}" for k in keys),
          f"- Deterministic checks pass {sum(allc)}/{len(allc)} · errors {sum(1 for r in rows if r.get('error'))}",
          f"- Plan job p50 {mean([r.get('plan_s', 0) for r in rows if r.get('plan_s')]):.0f}s · build plan p50 {mean([r.get('build_s', 0) for r in rows if r.get('build_s')]):.0f}s",
          "", "| idea | persona | pieces | overall | fid | arch | today | moves | app prompt | failed checks | biggest issue |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        j = r.get("judge") or {}
        failed = [k for k, v in (r.get("checks") or {}).items() if not v]
        md.append(f"| {r['idea']} | {r['persona']} | {', '.join(c.split()[0] for c in r['studio'].get('capabilities', []))} | {j.get('overall', '-')} | "
                  f"{j.get('fidelity', '-')} | {j.get('architecture', '-')} | {j.get('buildable_today', '-')} | {j.get('genie_code_moves', '-')} | "
                  f"{j.get('app_builder_prompt', '-')} | {', '.join(failed) or '-'} | {j.get('biggest_issue', r.get('error', ''))} |")
    md += ["", "## Fixes (judge)", ""] + [f"- ({r['idea']}) {fx}" for r in rows for fx in (r.get("judge") or {}).get("fixes", [])]
    (out_dir / "report.md").write_text("\n".join(md))
    print("\n".join(md))


if __name__ == "__main__":
    main()
