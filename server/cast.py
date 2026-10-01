"""Per-idea cast + context for the Sit-Down, generated in the BACKGROUND.

The six character drawings are fixed (the frontend owns the art); who they are is not. From the
participant's idea we generate the colleagues who would really weigh in on it (an airline idea gets
crew scheduling and revenue management, not store ops), plus the context the SA should speak in
(org, industry, currency, wording) and whether the idea is about the workshop host's own business
(if not, the host's seeded tables are irrelevant and we plan generated data instead).

It runs on a fast model in parallel with the opening reply, which never uses a colleague, so it adds
no wait. Fails soft to the generic cast.
"""
import json
import re
import threading
import time

from . import llm
from .scope import VOICE

CAST_MODEL = "databricks-claude-haiku-4-5"
DIMS = ["problem", "user_moment", "objective", "decision", "data", "risk"]
# Each drawing is a recurring character with a fixed name; only their role adapts to the idea.
NAMES = {"data_engineer": "Arjun", "finance": "Marcus", "store_manager": "Jo",
         "governance": "Amara", "platform": "Tom", "regional_ops": "Sam"}
AVATARS = {
    "data_engineer": "a technical builder (data, analytics, engineering)",
    "finance": "a numbers person (finance, commercial, revenue, pricing)",
    "store_manager": "a frontline doer (the person who uses it day to day)",
    "governance": "a careful guardian (compliance, legal, safety, privacy, quality)",
    "platform": "a systems owner (IT, platform, tooling, maintenance)",
    "regional_ops": "an operations leader (runs many sites, teams or routes)",
}

PROMPT = """A workshop participant described something they want to build:
"{idea}"

1. Work out THEIR context from the idea: the organisation (only if named or clearly implied), the industry,
   the currency and the wording locale. If the idea gives no clue, use the workshop host: Costa Coffee,
   coffee retail, £, UK.
2. host_business: true only if the idea is about Costa Coffee's own business (stores, coffee, food,
   retail, its finance/HR/AP functions). False for any other company or industry.
3. Invent the 6 colleagues who would genuinely weigh in on THIS idea in THEIR organisation: real job
   titles for that industry (e.g. an airline: crew scheduling lead, revenue manager, FAA compliance lead).
   Give each a short voice (how they talk and what they always ask,
   <=14 words, in their industry's terms and currency), the 2-3 rubric areas they care about from
   {dims}, and the ONE character drawing that fits their vibe, using each drawing exactly once:
{avatars}

{voice}
Reply with ONLY JSON:
{{"org": "", "industry": "", "currency": "", "locale": "", "host_business": true|false,
  "cast": [{{"key": "<slug of role>", "role": "<=5 words", "voice": "", "dims": ["..."], "avatar": "<drawing key>"}}, ...6]}}"""


def _valid(d: dict) -> dict | None:
    cast, used = {}, set()
    for c in d.get("cast") or []:
        if not isinstance(c, dict) or not c.get("role"):
            continue
        av = c.get("avatar") if c.get("avatar") in AVATARS and c.get("avatar") not in used else \
            next((a for a in AVATARS if a not in used), None)
        if not av:
            break
        used.add(av)
        key = re.sub(r"[^a-z0-9]+", "_", (c.get("key") or c["role"]).lower()).strip("_")[:30] or av
        while key in cast:
            key += "_2"
        cast[key] = {"avatar": av, "name": NAMES[av], "role": str(c["role"])[:40],
                     "voice": str(c.get("voice", ""))[:140],
                     "dims": [x for x in (c.get("dims") or []) if x in DIMS] or ["problem"]}
    if len(cast) < 4:
        return None
    ctx = {k: str(d.get(k, ""))[:40] for k in ("org", "industry", "currency", "locale")}
    # Decided in code, not by the model: it's the host's business only if the org IS the host.
    org = ctx["org"].lower()
    host = "costa" in org or (not org and "coffee" in ctx["industry"].lower())
    return {"context": ctx, "host_business": host, "cast": cast}


def generate(idea: str) -> dict | None:
    prompt = PROMPT.format(idea=idea[:1200], dims=", ".join(DIMS), voice=VOICE,
                           avatars="\n".join(f"   - {k}: {v}" for k, v in AVATARS.items()))
    for _ in range(2):
        try:
            r = llm.client().chat.completions.create(model=CAST_MODEL, max_tokens=1200,
                                                     messages=[{"role": "user", "content": prompt}])
            t = llm.text_of(r.choices[0].message.content)
            m = re.search(r"\{.*\}", t, re.S)
            out = _valid(json.loads(m.group(0))) if m else None
            if out:
                return out
        except Exception:
            time.sleep(0.5)
    return None


# ── background jobs: started on the first message, picked up when ready ─────
_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def start(sid: str, idea: str):
    job = {"done": threading.Event(), "result": None, "t": time.time()}
    with _lock:
        _jobs[sid] = job
        for k in [k for k, j in _jobs.items() if time.time() - j["t"] > 3600]:
            _jobs.pop(k, None)                   # tidy: jobs older than an hour

    def run():
        job["result"] = generate(idea)
        job["done"].set()
    threading.Thread(target=run, daemon=True).start()


def collect(sid: str, wait: float = 0.0) -> dict | None:
    """The finished cast for this session, if ready (optionally waiting a little). Consumed once."""
    with _lock:
        job = _jobs.get(sid)
    if not job:
        return None
    if job["done"].wait(wait):
        with _lock:
            _jobs.pop(sid, None)
        return job["result"] or {"failed": True}
    return None
