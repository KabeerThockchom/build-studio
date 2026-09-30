"""M3 — the idea stress-test. A quick, LLM-based read of the participant's idea
against what a good build description needs: a clear problem, named users, a stated
objective, and what data/knowledge it draws on.

Advisory, never a gate: the UI lets the user proceed regardless (with a visible
nudge when the idea is thin). So this MUST fail open — any error returns an
all-clear result rather than blocking the flow. It runs in the background while the
first teaching beats play, so the result is ready by the time they reach it.
"""
from . import llm
from .jsonx import loads_tolerant
from .scope import strip_em_dashes
from .models import IdeaCheck, IdeaCriterion, IdeaCheckRequest

# The four things a good build description covers (mirrors the Shape guidance).
# "objective" is the deliberate reframe from "what a good result looks like" — the
# goal the app serves (increase sales, cut waste, respond faster) is what actually
# steers the build.
CRITERIA = [
    ("problem", "The problem it solves"),
    ("users", "Who uses it, and when"),
    ("objective", "The objective, what it's trying to move"),
    ("data", "What data or knowledge it draws on"),
]

SYSTEM_PROMPT = """You are a senior Databricks Solutions Architect giving a workshop participant
quick, encouraging feedback on the idea they just described — before you design it together. You are
NOT grading them and NOT gatekeeping; you're helping them sharpen the idea so the build comes out well.

Judge their description against exactly these four things, and be generous — mark something met if it
is reasonably present, even if briefly:
- problem: is the problem/pain clear (what's wrong today)?
- users: is it clear who would use this, and roughly when?
- objective: do they say what they're trying to MOVE — the goal (e.g. increase sales, cut waste,
  respond faster)? This is the most valuable one; a build without a stated objective drifts.
- data: is there a sense of what data or knowledge it draws on (tables, documents, records)?

For each, decide met true/false and, when not met (or thin), give ONE short, warm, concrete hint
phrased as a question or nudge — grounded in THEIR idea, not generic. Keep hints under 15 words.
Then set "strong" true only if at least 3 of the 4 are met AND the objective is met. Write one warm
summary sentence: if strong, affirm it; if not, name the one thing most worth adding, kindly.

WRITING STYLE: plain, warm, human. No jargon. Do NOT use em-dashes (the "—" character); use a comma,
a period, or "like" instead. Short sentences.

Return ONLY one JSON object (no fence, no prose):
{ "strong": true|false,
  "summary": "<one warm sentence>",
  "criteria": [ { "key": "problem|users|objective|data", "met": true|false, "hint": "<short nudge or ''>" }, ... all four ] }
"""


def _extract_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1] if t.count("```") >= 2 else t.strip("`")
        if t.lstrip().lower().startswith("json"):
            t = t.lstrip()[4:]
    s, e = t.find("{"), t.rfind("}")
    if s != -1 and e != -1 and e > s:
        t = t[s:e + 1]
    return loads_tolerant(t)


def _all_clear(summary: str = "") -> IdeaCheck:
    """Fail-open result: everything met, strong. Used when the model ERRORS — this is
    advisory, so a hiccup must never stop the participant or scare them with a false
    'weak idea'. (Not used for a too-short idea — see _thin.)"""
    return IdeaCheck(strong=True, summary=summary,
                     criteria=[IdeaCriterion(key=k, label=lbl, met=True, hint="") for k, lbl in CRITERIA])


def _thin() -> IdeaCheck:
    """An idea too short to judge. Not 'strong' (that reads backwards for an empty idea),
    but no scary red X's either — nothing met, no per-item nags, a gentle ask for more.
    Unreachable from the UI (Shape gates on length) but keeps the API honest."""
    return IdeaCheck(strong=False, summary="Add a sentence or two so we can give you useful feedback.",
                     criteria=[IdeaCriterion(key=k, label=lbl, met=False, hint="") for k, lbl in CRITERIA])


def check_idea(req: IdeaCheckRequest) -> IdeaCheck:
    idea = (req.idea or "").strip()
    if len(idea) < 12:  # too short to judge — ask for a little more rather than call it "strong"
        return _thin()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Their idea:\n\"\"\"\n{idea}\n\"\"\"\n\nReturn the JSON only."},
    ]
    try:
        parsed = _extract_json(llm.complete(messages, max_tokens=600))
    except Exception as e:
        print(f"idea check failed ({e}); returning all-clear (advisory)")
        return _all_clear()

    labels = dict(CRITERIA)
    got = {c.get("key"): c for c in parsed.get("criteria", []) if c.get("key") in labels}
    criteria = [
        IdeaCriterion(key=k, label=lbl,
                      met=bool(got.get(k, {}).get("met", True)),
                      hint=strip_em_dashes((got.get(k, {}).get("hint") or "").strip()))
        for k, lbl in CRITERIA
    ]
    return IdeaCheck(strong=bool(parsed.get("strong", True)),
                     summary=strip_em_dashes((parsed.get("summary") or "").strip()), criteria=criteria)
