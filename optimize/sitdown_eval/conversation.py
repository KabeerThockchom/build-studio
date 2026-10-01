"""Conversation-level eval for the Sit-Down agent (/api/sitdown/chat).

Simulated participants (a model playing a persona) talk to the REAL agent end to end. Each idea has
a hidden TRUTH sheet the participant reveals only when asked, so the judge can check the final brief
for fidelity (no invented facts) instead of just "does it sound good". Personas stress the harness:
engaged, card clicker, vague, rambler, drifter, contrarian, technical, impatient (quick finish).

    python -m optimize.sitdown_eval.conversation [--sessions N] [--workers 6] [--tag name]

Writes results/conv-<ts>/ (sessions.jsonl + report.md).
"""
import argparse, json, os, re, statistics, threading, time
import concurrent.futures as cf
from datetime import datetime
from pathlib import Path

import requests

os.environ.setdefault("DATABRICKS_PROFILE", "build-studio")
from server import llm  # noqa: E402

API = os.environ.get("SITDOWN_API", "http://localhost:8000/api/sitdown/chat")
SIM_MODEL = "databricks-claude-sonnet-4-6"
JUDGE_MODEL = "databricks-claude-opus-5-5"
ROOT = Path(__file__).parent
DIMS = ["problem", "user_moment", "objective", "decision", "data", "scope", "risk"]

# Ideas: Costa (seeded data) + the prior Build Studio quality/build cases (diverse domains).
IDEAS = {
    "costa_waste": dict(
        idea="Our store managers throw away a lot of food at the end of the day. I want something that helps them order better and see where the waste is.",
        truth="Mostly sandwiches and pastries. Store managers order each morning ~6:45am on the back-office tablet, copying last week. No waste tracking today; you guess about 30 items binned per store per day. You'd love 20% less waste on the top 10 fresh lines within 8 weeks. They'd accept or tweak a suggested order. Worry: managers won't trust a suggestion and will order by habit."),
    "costa_ap": dict(
        idea="AP clerks spend hours chasing invoices that don't match the PO. I want a tool that flags mismatches and duplicates before we pay.",
        truth="Team of 6 AP clerks, each morning working an exceptions queue on laptops. Duplicates slip through maybe twice a month (one was £14k). Goal: zero duplicate payments and the queue cleared by noon. Clerk decides hold or release per invoice. Worry: false positives burying them."),
    "account_rep": dict(
        idea="Field reps manage 80 accounts and only notice one slipping once orders drop. Catch the early signs, explain why, tell them what to do.",
        truth="B2B beverage reps, Monday planning on their phone in the car. Early signs: order frequency dropping, fewer SKUs. Goal: cut lost accounts 25% this year. Rep picks which 3 accounts to visit this week. They have order history; call notes live in a CRM text field. Worry: reps ignore alerts if too many."),
    "store_labor": dict(
        idea="Let store managers see labor efficiency across their stores and get alerted when a store misses break compliance or goes over budget.",
        truth="Area managers (not store managers) with 12 stores each, checking Friday afternoon at their desk. Missed breaks are a legal risk; labour runs ~4% over budget. Goal: zero missed-break incidents and labour within 1% of budget. They'd call the store manager to adjust next week's rota. Worry: rota data is messy."),
    "fraud_review": dict(
        idea="Flag risky transactions closer to real time instead of the nightly batch, and give the ops team a place to review and mark what they investigated.",
        truth="Fraud ops team of 4 working shifts, reviewing a queue all day. Today they find out next morning. Goal: review high-risk ones within 1 hour. Analyst marks investigated / escalated / cleared. Note: it is a one-day workshop, so real-time ingestion is not realistic; you accept sample data. Worry: duplicate work between analysts."),
    "clinical_ka": dict(
        idea="Help care coordinators quickly find the right clinical guideline and prior notes for a patient so they spend less time digging through documents.",
        truth="Care coordinators at a clinic, between patient calls on a desktop. They spend ~20 minutes per case searching PDFs. Goal: under 5 minutes. They decide the next care step and log it. Documents are guideline PDFs plus prior visit notes. Worry: outdated guidelines being surfaced."),
    "plant_genie": dict(
        idea="Let a plant supervisor ask questions about downtime and output in plain English instead of waiting on a report.",
        truth="Shift supervisor at a bottling plant, start of shift on a shared terminal. Weekly report arrives too late. Goal: spot the worst line within the first 15 minutes of a shift. They'd reassign a maintenance tech. Data: line output and downtime logs. Worry: people not trusting the numbers."),
    "thin_sales": dict(
        idea="I want to build something with my sales data.",
        truth="You're a regional sales analyst; honestly not sure. If pushed: your boss asks every Monday which regions missed target and why, and you spend half a day in Excel. Goal: answer it in 10 minutes. Worry: you don't know what's possible."),
    "exec_loyalty": dict(
        idea="I want to understand what drives customer loyalty, which products, regions, and times of year, so my team can act on it faster.",
        truth="VP of marketing, quarterly planning, wants a simple view her team checks monthly. Loyalty = repeat purchase within 60 days. Goal: lift repeat rate 3 points this year. Team decides which promotions to run where. Worry: correlation mistaken for cause."),
    "aa_crew": dict(
        idea="American Airlines: our crew schedulers scramble when flights get delayed. I want something that predicts which crews will time out and suggests swaps.",
        truth="Crew schedulers in the integrated operations center at DFW, during irregular operations, on two monitors. A bad IROP day has 40-60 crews at risk of timing out; today it takes 30-45 minutes per swap decision using lagged dashboards and phone calls. Goal: under 10 minutes per decision and 20% fewer crew-caused cancellations this summer. They approve or reject a suggested reserve swap. Worry: a suggestion that breaks FAA duty-time rules."),
    "sa_pov": dict(
        idea="I want something for Databricks Solution Architects to be able to develop rich point of view docs that are executive ready, tailored, authoritative, and aesthetic.",
        truth="You're a Databricks SA. You write POV docs at pivotal account moments: a new exec arrives, or you hear a concern secondhand and can't get to that exec, or you want a first meeting. Account facts are in Salesforce; the rest is research. Today it takes 2 to 3 days per doc. Goal: a few hours, and track whether docs land the exec meeting. The SA sends it to the exec or to their manager for review first. Worry: weak, generic docs going out under the Databricks name."),
    "hotel_rfp": dict(
        idea="Our hotel group sales team spends forever answering wedding and conference RFPs. I want something that helps them respond faster with better proposals.",
        truth="You run group sales for 14 hotels. Each hotel gets 30 to 50 RFPs a month; reps take about 4 hours per proposal and answer only the first 60%. Goal: respond within 24 hours to 90% of RFPs this season. The rep decides which RFPs to pursue and sends the proposal. Rates and room blocks are in the property system. Worry: quoting dates or rates that aren't actually available."),
    "ai_roi": dict(
        idea="Leadership wants to know if the AI tools we pay for are actually being used and are worth it.",
        truth="You're in IT finance. ~1,200 seats across 3 tools. Renewal decision in 3 months. Goal: cut unused seats 30%. The CIO decides keep/cut per tool, quarterly. Usage logs exist; value is fuzzy. Worry: measuring value, not just logins."),
}

PERSONAS = {
    "engaged": "Engaged and thoughtful. You answer in a sentence or two with real detail when asked.",
    "clicker": "Not opinionated. You almost always just pick one of the offered cards (sometimes two). Rarely type.",
    "vague": "Unsure and vague. Short hedging answers ('not sure', 'maybe', 'I guess'). You reveal truth details only if asked very directly.",
    "rambler": "You ramble in long run-on messages that mix two or three points, some off to the side, with typos.",
    "drifter": "Mostly on topic, but on your 3rd and 6th replies you wander into a different problem (e.g. staffing, a different team's pain). Accept being steered back.",
    "contrarian": "You often reject the offered options ('none of these, it's more like...') and type your own framing. Never rude.",
    "technical": "A technical data person. You use jargon (SLA, schema, CDC, dashboards) and ask how things will actually be built.",
    "impatient": "In a hurry. Short answers. After 4 replies you want to skip ahead (you will press the quick-finish button).",
}

# Diverse pairing: every persona twice, every idea at least once.
MATRIX = [
    ("costa_waste", "engaged"), ("costa_ap", "clicker"), ("account_rep", "rambler"), ("store_labor", "drifter"),
    ("fraud_review", "technical"), ("clinical_ka", "contrarian"), ("plant_genie", "impatient"), ("thin_sales", "vague"),
    ("exec_loyalty", "engaged"), ("ai_roi", "drifter"), ("costa_waste", "contrarian"), ("costa_ap", "technical"),
    ("account_rep", "clicker"), ("aa_crew", "engaged"), ("thin_sales", "impatient"), ("aa_crew", "clicker"),
]

_c = None
_lock = threading.Lock()


def client():
    global _c
    with _lock:
        if _c is None:
            _c = llm.client()
        return _c


def sim_reply(idea, persona_key, transcript, sa_text, ui, n_replies):
    opts = []
    for u in ui:
        if u["type"] in ("options", "stakeholder"):
            opts = [o["label"] for o in u.get("options", [])]
    if any(u["type"] == "open" for u in ui):
        opts = "(none: this is an open question, answer in your own words)"
    who = next((f"{u['name']} ({u['role']})" for u in ui if u["type"] == "stakeholder"), "your SA")
    drift = next((u for u in ui if u["type"] == "drift"), None)
    prompt = f"""You are role-playing a workshop participant at a Databricks build workshop.
Your idea: {idea['idea']}
HIDDEN FACTS about your situation (reveal only what you're asked about, in your own words): {idea['truth']}
Your style: {PERSONAS[persona_key]}
This is your reply number {n_replies + 1}.
Recent conversation:
{transcript[-1800:]}
{who} just said: "{sa_text}"
Cards offered: {opts}
{'A drift card is showing asking whether to stay on your original idea.' if drift else ''}
Reply as the participant, ONE message, plain text, no quotes. To pick cards write exactly 'PICK: <label>; <label>'
using the card labels verbatim. Otherwise just write your message."""
    r = client().chat.completions.create(model=SIM_MODEL, messages=[{"role": "user", "content": prompt}], max_tokens=200)
    t = llm.text_of(r.choices[0].message.content).strip()
    if t.upper().startswith("PICK:"):
        return t[5:].strip(), True
    return t, False


def call(session, text, meta):
    t0 = time.perf_counter()
    sa, out, err = "", None, None
    try:
        with requests.post(API, json={"session": session, "text": text, "meta": meta}, stream=True, timeout=240) as r:
            for line in r.iter_lines():
                if not line:
                    continue
                m = json.loads(line)
                if m["type"] == "text_delta":
                    sa += m["text"]
                elif m["type"] == "done":
                    out = m
                elif m["type"] == "error":
                    err = m["message"]
    except Exception as e:
        err = str(e)
    return sa, out, err, time.perf_counter() - t0


def run_session(idea_key, persona_key, max_turns=24):
    idea = IDEAS[idea_key]
    S, text, meta = None, idea["idea"], {}
    turns, transcript, n_replies = [], f"PARTICIPANT: {idea['idea']}\n", 0
    for i in range(max_turns):
        sa, out, err, dt = call(S, text, meta)
        if err or not out:
            turns.append({"i": i, "error": err or "no done"})
            break
        S = out["session"]
        ui = out["ui"]
        turns.append({"i": i, "sent": text, "meta": meta, "sa": sa, "ui": ui, "events": out["events"],
                      "stage": S["stage"], "first_ms": out.get("first_ms"), "ms": out.get("ms"),
                      "dropped": (out.get("debug") or {}).get("dropped")})
        summ = "; ".join(f"[{u['type']}{': ' + (u.get('question') or u.get('line') or '')[:70] if u['type'] in ('options', 'stakeholder', 'open') else ''}]" for u in ui)
        transcript += f"SA: {sa}\n{summ}\n"
        types = [u["type"] for u in ui]
        if "readback" in types:
            break
        sh = next((u for u in ui if u["type"] == "shapes"), None)
        if sh and sh.get("shapes"):
            pick = next((x for x in sh["shapes"] if x.get("key") == sh.get("recommended")), sh["shapes"][0])
            text, meta = f"Let's build: {pick['name']}", {"shape_key": pick["key"]}
            transcript += f"PARTICIPANT: {text}\n"
            continue
        if "scope" in types:
            text, meta = "Scope looks good", {"scope_done": True}
            transcript += f"PARTICIPANT: {text}\n"
            continue
        if persona_key == "impatient" and n_replies >= 4 and S["stage"] not in ("shapes", "scope", "readback"):
            text, meta = "I'm ready, let's see how to build it.", {"wrap_up": True}
            transcript += f"PARTICIPANT: {text}\n"
            n_replies += 1
            continue
        text, picked = sim_reply(idea, persona_key, transcript, sa, ui, n_replies)
        meta = {"picked": picked}
        transcript += f"PARTICIPANT: {text}\n"
        n_replies += 1
    return {"idea": idea_key, "persona": persona_key, "turns": turns, "transcript": transcript,
            "final": {k: S.get(k) for k in ("brief", "grades", "north_star", "parked", "stage", "readback",
                                            "how_used", "how_asked", "open_questions", "genie_dropped",
                                             "cast_seen", "cast_tones", "features", "shape", "facts", "decisions",
                                             "idea", "context", "dataset_schema", "cast")} if S else None}


# ── deterministic metrics ─────────────────────────────────────────────────────

def _tok(t):
    return set(re.findall(r"[a-z]{4,}", (t or "").lower()))


def metrics(s):
    T = [t for t in s["turns"] if "error" not in t]
    f = s["final"] or {}
    brief = f.get("brief") or {}
    sharpen = [t for t in T if t["stage"] in DIMS[:3] + ["decision", "data", "risk"] or
               any(u["type"] in ("options", "stakeholder") for u in t["ui"])]
    qs = [u.get("question") or u.get("line") for t in T for u in t["ui"] if u["type"] in ("options", "stakeholder")]
    rep = sum(1 for i, q in enumerate(qs) for p in qs[:i]
              if _tok(q) and _tok(p) and len(_tok(q) & _tok(p)) / len(_tok(q) | _tok(p)) > 0.6)
    empty = sum(1 for t in T if t["stage"] in ("problem", "user_moment", "objective", "decision", "data", "risk")
                and not any(u["type"] in ("options", "stakeholder", "drift", "shapes", "open") for u in t["ui"]))
    cast = [u for t in T for u in t["ui"] if u["type"] == "stakeholder"]
    drifts = sum(1 for t in T for u in t["ui"] if u["type"] == "drift")
    return {
        "turns": len(T), "reached_readback": bool(f.get("readback")), "errors": sum(1 for t in s["turns"] if "error" in t),
        "coverage": sum(1 for d in DIMS if brief.get(d)), "repeat_q": rep, "empty_turns": empty,
        "cast": len(cast), "cast_unique": len({c["persona"] for c in cast}), "tones": sorted({c["tone"] for c in cast}),
        "consider": sum(1 for t in T for u in t["ui"] if u["type"] == "options" for o in u.get("options", []) if o.get("consider")),
        "drift_cards": drifts, "dropped_calls": sum(len(t.get("dropped") or []) for t in T),
        "first_p50": statistics.median([t["first_ms"] for t in T if t.get("first_ms")] or [0]) / 1000,
        "ms_p50": statistics.median([t["ms"] for t in T if t.get("ms")] or [0]) / 1000,
        "ms_p90": sorted([t["ms"] for t in T if t.get("ms")] or [0])[int(0.9 * (len(T) - 1))] / 1000 if T else 0,
    }


# ── judge ─────────────────────────────────────────────────────────────────────

JUDGE_SYS = """You are an exacting reviewer of an AI coaching conversation. An AI "Solutions Architect" (SA), sometimes
bringing in colleague characters, interviews a workshop participant to sharpen a build idea into a clear one-day
plan. You are shown the full transcript, the participant's HIDDEN FACTS (what they would say if asked well), their
persona, and the final brief. The workshop host is Costa Coffee (UK); for ideas from another company or
industry the SA should use THAT context (their currency, terms, roles). Colleague characters are part of
the design. Score strictly; 3 = acceptable, 5 = what an excellent human SA would do."""


def judge(s):
    idea = IDEAS[s["idea"]]
    f = s["final"] or {}
    prompt = f"""PERSONA: {s['persona']}: {PERSONAS[s['persona']]}
IDEA: {idea['idea']}
HIDDEN FACTS: {idea['truth']}

TRANSCRIPT:
{s['transcript'][-14000:]}

FINAL BRIEF: {json.dumps(f.get('brief'), ensure_ascii=False)}
FINAL GRADES: {json.dumps(f.get('grades'))}
READBACK: {json.dumps(f.get('readback'), ensure_ascii=False)[:2500]}

Score 1-5 each:
- question_quality: do the questions efficiently draw out what makes the idea clear and buildable (would they surface the hidden facts)?
- responsiveness: does the SA actually engage with what the participant said (incl. typed/combined/contrarian answers)?
- context: does it remember and build on earlier answers, no re-asking settled things?
- momentum: does the conversation keep moving toward a plan, without loops, stalls or dragging?
- engagement: is it lively and human (colleague characters add something, varied tone), not mundane or robotic?
- persona_fit: did it adapt well to this participant's style (draw out the vague, condense the rambler, steer the drifter, respect the impatient)?
- brief_fidelity: is the final brief faithful to what the participant said / hidden facts surfaced, with no invented facts (suggestions clearly marked)?
- plan_quality: is the final plan clear, realistic for a one-day build, and something they could build?
Also: overall 1-10, the single biggest issue (<=25 words), the best moment (<=20 words), and up to 3 specific fixes to the SA's behaviour (each <=20 words).
Reply ONLY JSON: {{"question_quality":n,"responsiveness":n,"context":n,"momentum":n,"engagement":n,"persona_fit":n,
"brief_fidelity":n,"plan_quality":n,"overall":n,"biggest_issue":"","best_moment":"","fixes":["",""]}}"""
    for attempt in range(3):
        try:
            r = client().chat.completions.create(model=JUDGE_MODEL, max_tokens=4000,
                                                 messages=[{"role": "system", "content": JUDGE_SYS}, {"role": "user", "content": prompt}])
            t = llm.text_of(r.choices[0].message.content)
            m = re.search(r"\{.*\}", t, re.S)
            if m:
                return json.loads(m.group(0))
        except Exception:
            time.sleep(3 * (attempt + 1))
    return None


def report(sessions, out_dir, tag):
    keys = ["question_quality", "responsiveness", "context", "momentum", "engagement", "persona_fit", "brief_fidelity", "plan_quality"]
    J = [s["judge"] for s in sessions if s.get("judge")]
    M = [s["metrics"] for s in sessions]
    mean = lambda xs: statistics.mean(xs) if xs else 0
    md = [f"# Sit-Down conversation eval · {tag}", f"_{datetime.now():%Y-%m-%d %H:%M}_ · {len(sessions)} sessions · judge {JUDGE_MODEL}", "",
          "## Overall", "",
          f"- Judge overall: **{mean([j['overall'] for j in J]):.2f}/10**",
          "- " + " · ".join(f"{k} {mean([j[k] for j in J]):.2f}" for k in keys),
          f"- Reached readback {sum(m['reached_readback'] for m in M)}/{len(M)} · coverage avg {mean([m['coverage'] for m in M]):.1f}/7 · turns avg {mean([m['turns'] for m in M]):.1f}",
          f"- Repeated questions {sum(m['repeat_q'] for m in M)} · empty sharpening turns {sum(m['empty_turns'] for m in M)} · errors {sum(m['errors'] for m in M)} · dropped tool calls {sum(m['dropped_calls'] for m in M)}",
          f"- Cast per session {mean([m['cast'] for m in M]):.1f} (unique {mean([m['cast_unique'] for m in M]):.1f}) · consider lines/session {mean([m['consider'] for m in M]):.1f}",
          f"- Latency: first token p50 {mean([m['first_p50'] for m in M]):.1f}s · turn p50 {mean([m['ms_p50'] for m in M]):.1f}s · p90 {mean([m['ms_p90'] for m in M]):.1f}s", "",
          "## Per session", "", "| idea | persona | overall | QQ | resp | ctx | mom | eng | fit | fidelity | plan | turns | cov | readback | cast | biggest issue |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for s in sessions:
        j, m = s.get("judge") or {}, s["metrics"]
        md.append(f"| {s['idea']} | {s['persona']} | {j.get('overall', '-')} | " + " | ".join(str(j.get(k, '-')) for k in keys) +
                  f" | {m['turns']} | {m['coverage']} | {'y' if m['reached_readback'] else 'n'} | {m['cast']} | {j.get('biggest_issue', '')} |")
    md += ["", "## Suggested fixes (judge)", ""]
    for s in sessions:
        for fx in (s.get("judge") or {}).get("fixes", []):
            md.append(f"- ({s['idea']}/{s['persona']}) {fx}")
    (out_dir / "report.md").write_text("\n".join(md))
    return "\n".join(md)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sessions", type=int, default=len(MATRIX))
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--tag", default="run")
    ap.add_argument("--only", default="", help="comma list of idea:persona")
    a = ap.parse_args()
    jobs = [tuple(x.split(":")) for x in a.only.split(",")] if a.only else MATRIX[:a.sessions]
    out_dir = ROOT / "results" / f"conv-{a.tag}-{datetime.now():%Y%m%d-%H%M%S}"
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"{len(jobs)} sessions → {out_dir}", flush=True)
    sessions, lock = [], threading.Lock()

    def one(job):
        s = run_session(*job)
        s["metrics"] = metrics(s)
        s["judge"] = judge(s)
        with lock:
            sessions.append(s)
            (out_dir / "sessions.jsonl").open("a").write(json.dumps(s, ensure_ascii=False) + "\n")
            print(f"  {job[0]:13s} {job[1]:11s} turns={s['metrics']['turns']:2d} cov={s['metrics']['coverage']} "
                  f"rb={s['metrics']['reached_readback']} overall={(s['judge'] or {}).get('overall')}", flush=True)

    with cf.ThreadPoolExecutor(a.workers) as ex:
        list(ex.map(one, jobs))
    print(report(sessions, out_dir, a.tag))


if __name__ == "__main__":
    main()
