"""M2.5 — the SA brain. One call after Shape authors the design questions +
capability preselection from the user's idea. Guardrailed JSON, retried, with a
curated fallback so the flow never dead-ends if the model misbehaves.
"""
import json
from . import llm
from .models import DesignPlan, DesignQuestion, DesignOption, CapabilityPick, PlanRequest

# The fixed capability vocabulary the SA may choose from (no inventing).
CAPABILITIES = [
    "Genie", "Knowledge Assistant", "Supervisor agent",
    "Lakebase", "Databricks Apps", "Lakeflow",
]
CAP_BLURB = {
    "Genie": "plain-English questions over governed data",
    "Knowledge Assistant": "managed RAG over documents/notes",
    "Supervisor agent": "an agent that routes across the other tools",
    "Lakebase": "Postgres for app state / recording decisions",
    "Databricks Apps": "hosts the interface people open",
    "Lakeflow": "managed ingestion + ETL from a source",
}

SYSTEM_PROMPT = f"""You are a senior Databricks Solutions Architect guiding a workshop
participant. They have just described, in their own words, something they want to build.
Your job is to plan the short design conversation: ask the 2-4 questions that most shape
what they should build, and pre-select which Databricks capabilities fit their idea.

You speak plainly and warmly, like a good SA who respects the person's time. You do NOT
assume their build is an app, or an agent, or anything — you read THEIR idea and adapt.

The ONLY capabilities you may pre-select from (never invent others):
{chr(10).join(f'- {c}: {CAP_BLURB[c]}' for c in CAPABILITIES)}

A first question about WHO it's for / how they want it is ALREADY being asked
separately — do NOT repeat it. Generate only the follow-up questions that are
specific to THIS idea. Good dimensions to consider (pick the ones that matter
here, phrase them in plain language, not jargon):
- where the data comes from (generate sample vs use existing tables vs bring a source)
- how fresh the data needs to be (live vs periodic)
- whether the value is mostly numbers, mostly documents/text, or both
- how the result is delivered (an app they open, a dashboard, just answers)
- the scope/shape specific to their idea
Do NOT ask about things outside Databricks' scope. Do NOT ask about who-it's-for.

Ask 1-3 follow-up questions: 1 for a clear, specific idea; up to 3 for a vague or broad one.

Return ONLY one JSON object (no markdown fence, no prose) with this exact shape:
{{
  "read_back": "<one warm sentence reflecting their idea back, showing you understood>",
  "questions": [
    {{
      "id": "<slug>", "title": "<the question, plain language>",
      "lead": "<one sentence on why this matters for their build>",
      "options": [
        {{ "key": "<slug>", "label": "<short choice>", "sub": "<one clarifying line>",
           "preview": ["<what choosing this leads to>", "<a second consequence>",
                       "<the tradeoff / cost of this choice>"] }}
        // 2 to 3 options per question
      ]
    }}
    // 2 to 4 questions
  ],
  "capabilities": [
    {{ "name": "<one of the allowed capabilities>", "selected": true|false,
       "fits": "<if selected: one-line why it fits THEIR idea; if not: why it's optional>" }}
    // include ALL of the allowed capabilities, marking each selected or not
  ]
}}
"""


def _user_prompt(req: PlanRequest) -> str:
    return (
        f"Their idea (verbatim):\n\"\"\"\n{req.idea.strip()}\n\"\"\"\n\n"
        f"Databricks familiarity: {req.expertise}\n"
        f"Interests they flagged: {', '.join(req.interests) or 'none specified'}\n\n"
        "Plan the design conversation now. Return the JSON object only."
    )


def _extract_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1] if t.count("```") >= 2 else t.strip("`")
        if t.lstrip().lower().startswith("json"):
            t = t.lstrip()[4:]
    s, e = t.find("{"), t.rfind("}")
    if s != -1 and e != -1 and e > s:
        t = t[s:e + 1]
    return json.loads(t)


def _coerce_plan(parsed: dict) -> DesignPlan:
    n = len(parsed.get("questions", []))
    questions = []
    for i, q in enumerate(parsed.get("questions", [])):
        opts = []
        for j, o in enumerate(q.get("options", [])):
            prev = o.get("preview", [])
            prev = (prev + ["", "", ""])[:3]
            opts.append(DesignOption(
                key=o.get("key") or f"opt{j}", letter=chr(65 + j),
                label=o.get("label", ""), sub=o.get("sub", ""), preview=prev))
        if not opts:
            continue
        questions.append(DesignQuestion(
            id=q.get("id") or f"q{i}", eyebrow=f"Design · {i + 1} of {n}",
            title=q.get("title", ""), lead=q.get("lead", ""), options=opts,
            other_preview=["We'll read your description and adapt to it.",
                           "The rest of the design flexes to match.",
                           "Most tailored — the reason we ask in your words."]))

    # Capabilities: honor the model's picks but constrain to the known vocabulary,
    # and guarantee every known capability appears exactly once.
    picked = {c.get("name"): c for c in parsed.get("capabilities", []) if c.get("name") in CAPABILITIES}
    caps = []
    for name in CAPABILITIES:
        c = picked.get(name)
        if c is not None:
            caps.append(CapabilityPick(name=name, selected=bool(c.get("selected")),
                                       fits=c.get("fits", "")))
        else:
            caps.append(CapabilityPick(name=name, selected=False, fits=""))

    if not questions:
        raise ValueError("no usable questions in plan")
    return DesignPlan(read_back=parsed.get("read_back", ""), questions=questions, capabilities=caps)


def plan_design(req: PlanRequest) -> DesignPlan:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _user_prompt(req)},
    ]
    last = None
    for _ in range(2):
        raw = llm.complete(messages, max_tokens=2600)
        try:
            return _coerce_plan(_extract_json(raw))
        except Exception as e:
            last = e
            messages.append({"role": "assistant", "content": raw[:400]})
            messages.append({"role": "user",
                             "content": "That was not valid. Return ONLY the JSON object in the exact shape, no fences."})
    raise ValueError(f"design plan generation failed: {last}")


# --- Curated fallback (mirrors the frontend defaults) if the SA call fails. ---
def fallback_plan() -> DesignPlan:
    return DesignPlan(
        read_back="Here are a couple of design choices that shape most builds.",
        questions=[
            DesignQuestion(
                id="audience", eyebrow="Design · 1 of 2",
                title="Who is this for, and how do they want it?",
                lead="This shapes how the experience leads.",
                options=[
                    DesignOption(key="act", letter="A", label="People who need to act quickly",
                                 sub="Busy; want to be told what matters and what to do next.",
                                 preview=["It opens on a ranked shortlist of what needs attention.",
                                          "Detail sits one layer in, when they want more.",
                                          "More upfront ranking logic, far less asked of the user."]),
                    DesignOption(key="oversee", letter="B", label="People overseeing a lot at once",
                                 sub="Want the big picture and where to focus.",
                                 preview=["It opens on a grouped overview so patterns jump out.",
                                          "Drill into any group to dig deeper.",
                                          "Great for oversight; less immediate for a single next action."]),
                    DesignOption(key="explore", letter="C", label="People who want to explore",
                                 sub="Prefer to ask their own questions.",
                                 preview=["It opens on an open question box, exploration first.",
                                          "No ranking imposed; the person drives.",
                                          "Most flexible, but assumes they know what to ask."]),
                ],
                other_preview=["We'll adapt to the audience you describe.",
                               "The rest of the design flexes to match.", "Most tailored."]),
            DesignQuestion(
                id="data_mode", eyebrow="Design · 2 of 2",
                title="Where does the data come from?",
                lead="This sets your very first build step.",
                options=[
                    DesignOption(key="synthetic", letter="A", label="Make realistic sample data",
                                 sub="We generate tables that fit your idea.",
                                 preview=["A synthetic dataset shaped to your idea, in Unity Catalog.",
                                          "You skip data wrangling and get to the interesting parts.",
                                          "No setup risk, but the data is made up. Swap in real tables later."]),
                    DesignOption(key="existing", letter="B", label="Use data already in my workspace",
                                 sub="Point at real Unity Catalog tables.",
                                 preview=["Your build reads real tables you already have.",
                                          "Nothing to generate; reflects your actual business.",
                                          "Most realistic, but depends on access and clean tables."]),
                ],
                other_preview=["We'll adapt the first step to however your data arrives.",
                               "Upload, connect a source, or something else.", "We'll confirm specifics first."]),
        ],
        capabilities=[
            CapabilityPick(name="Genie", selected=True, fits="ask your data in plain English"),
            CapabilityPick(name="Knowledge Assistant", selected=True, fits="understand notes & docs"),
            CapabilityPick(name="Supervisor agent", selected=True, fits="tie the pieces together"),
            CapabilityPick(name="Lakebase", selected=True, fits="record decisions"),
            CapabilityPick(name="Databricks Apps", selected=True, fits="the front door"),
            CapabilityPick(name="Lakeflow", selected=False, fits="bring in live data"),
        ],
    )
