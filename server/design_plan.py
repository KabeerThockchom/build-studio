"""M2.5 — the SA brain. One call after Shape authors the design questions +
capability preselection from the user's idea. Guardrailed JSON, retried, with a
curated fallback so the flow never dead-ends if the model misbehaves.
"""
from . import llm
from .jsonx import loads_tolerant
from .scope import WORKSHOP_SCOPE, VOICE
from .models import DesignPlan, DesignQuestion, DesignOption, CapabilityPick, PlanRequest

# The fixed capability vocabulary the SA may choose from (no inventing).
# No Lakeflow: a one-day workshop never stands up a new live ingestion source —
# data is sample data, a spreadsheet turned into a table, or an existing table.
CAPABILITIES = [
    "Genie", "Knowledge Assistant", "Supervisor agent",
    "Lakebase", "Databricks Apps",
]
CAP_BLURB = {
    "Genie": "plain-English questions over governed data",
    "Knowledge Assistant": "managed RAG over documents/notes",
    "Supervisor agent": "an agent that routes across the other tools",
    "Lakebase": "Postgres for app state / recording decisions",
    "Databricks Apps": "hosts the interface people open",
}

# The three workshop-realistic data paths. The SA must ask ONE question whose id is
# "data_mode" and whose option keys are exactly these — the rest of the app keys off them.
DATA_MODE_GUIDANCE = """One of your questions MUST be about where the data comes from. Give it id
"data_mode" and use EXACTLY these three option keys (phrase the labels/subs for their idea):
- "synthetic": we generate realistic sample data that fits their idea (no data needed from them)
- "upload": they have a spreadsheet / CSV / file we turn into a Unity Catalog table together
- "existing": they point at a table that already exists in the workspace (may be read-only)
Do NOT offer "connect a live source / ingest a new pipeline" — that is out of scope for one day."""

# The interaction model shapes most of the app's layout and its primary action, so it is a
# REQUIRED question. Fixed option keys the rest of the app keys off, like data_mode.
INTERACTION_MODEL_GUIDANCE = """One of your questions MUST be about how the person interacts with the
build. Give it id "interaction_model". Offer the 2-3 of these fixed option keys that genuinely fit THEIR
idea (never invent new keys; phrase the labels/subs/previews for their subject matter):
- "browse_act": opens on a ranked shortlist of what needs attention; THE PERSON scans it, clicks into one, and decides/acts (a triage/briefing)
- "monitor": opens on a dashboard/overview so they see the whole picture and spot what's off
- "ask": opens on a question box; they type a question in plain English and get an answer back
- "explore": opens on a flexible view they drill through in their own direction
- "agent_actions": AN AGENT does the work first (reads the data + notes, judges each item, drafts/proposes an action), and the person opens on the agent's proposed actions to review its reasoning and APPROVE or OVERRIDE each one; every decision is recorded as an audit trail (a supervise-the-agent console)
Choose "agent_actions" when the idea is about DELEGATING a repeatable judge-and-then-act task to an agent
and staying in control by approving its work, rather than the person doing the scanning/deciding themselves
(tells like "an agent that works through X for me", "reads and decides and drafts", "I approve or override").
This sets the app's entry screen and primary action, so ground the options in their real subject matter."""

SYSTEM_PROMPT = f"""You are a senior Databricks Solutions Architect guiding a workshop
participant. They have just described, in their own words, something they want to build.
Your job is to plan the short design conversation: ask the 2-4 questions that most shape
what they should build, and pre-select which Databricks capabilities fit their idea.

You speak plainly and warmly, like a good SA who respects the person's time. You do NOT
assume their build is an app, or an agent, or anything — you read THEIR idea and adapt.

{WORKSHOP_SCOPE}

{VOICE}

The ONLY capabilities you may pre-select from (never invent others):
{chr(10).join(f'- {c}: {CAP_BLURB[c]}' for c in CAPABILITIES)}

Pre-select CONSERVATIVELY — only mark selected:true for pieces the idea clearly needs. A workshop
build shouldn't accumulate pieces the person never asked for. Guidance:
- Genie and Databricks Apps are the usual core for an interactive build; select them when they fit.
- Do NOT auto-select Lakebase unless the idea implies recording/saving something between sessions
  (a decision log, saved state, a queue). "Just look at data" does not need it.
- Do NOT auto-select a Supervisor agent unless the idea genuinely needs to route across MULTIPLE
  tools. A single-purpose build (one dashboard, one Q&A) does not.
- Do NOT auto-select Knowledge Assistant unless there are documents/notes/text to answer from.
- If the idea reads like a dashboard/report rather than a chat, reflect that — don't assume a chat agent.
  And when you DO select Genie for a dashboard/report build, write its "fits" as powering the numbers
  and charts behind the scenes — NOT "ask follow-up questions" or "chat," which contradicts a person
  who wants a dashboard. Match the "fits" language to how they said they want to interact.
For anything you leave unselected, set a short "fits" saying when they'd add it. The person can always
turn pieces on in the next step; start them with the honest minimum, not the maximum.

Generate ALL of the design questions, every one tailored to THIS specific idea. Do not use
generic templated questions — a question a smart SA wouldn't bother asking for this idea should
not appear. Ground the wording (and the options) in the user's actual subject matter.

Good dimensions to consider for the 0-2 tailored questions (pick only ones that genuinely matter for
this idea; how-they-interact is already covered by the required interaction_model question, so don't
duplicate it):
- audience specifics unique to this idea (a role, a moment, a constraint)
- whether the value is mostly numbers, mostly documents/text, or both
- how the result is delivered (an app they open, a dashboard, just answers)
- the scope/shape specific to their idea
Do NOT ask about things outside Databricks' scope. Do NOT ask about data freshness / live-vs-batch
— a workshop day works off static data, so that choice does not apply.

{DATA_MODE_GUIDANCE}

{INTERACTION_MODEL_GUIDANCE}

The FIRST question should be the required "interaction_model" question (phrased for THIS idea). Also
include the required "data_mode" question. Beyond those two, add 0-2 tailored questions only if they
genuinely matter for this idea (audience specifics, scope). Total 2-4 questions, fewer is better — never pad.

Return ONLY one JSON object (no markdown fence, no prose) with this exact shape:
{{
  "read_back": "<one warm sentence reflecting their idea back, showing you understood>",
  "questions": [
    {{
      "id": "<slug>",
      "concept": "<the design dimension this question is, in 1-2 plain words the participant can
                   anchor on: e.g. 'Audience', 'Interaction model', 'Data & tools', 'Scope'>",
      "title": "<the question, plain language>",
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
    industry = f"Industry context: {req.industry.strip()}\n" if req.industry.strip() else ""
    return (
        f"Their idea (verbatim):\n\"\"\"\n{req.idea.strip()}\n\"\"\"\n\n"
        f"Databricks familiarity: {req.expertise}\n"
        f"Interests they flagged: {', '.join(req.interests) or 'none specified'}\n"
        f"{industry}\n"
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
    return loads_tolerant(t)


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
            concept=(q.get("concept") or "").strip(),
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
    # Per-workshop config shapes the plan: inject its context and constrain the
    # capability palette to what the facilitator allowed.
    try:
        from . import workshop
        cfg = workshop.effective_config()
        allowed = set(cfg.get("allowed_capabilities") or CAPABILITIES)
        ctx = workshop.config_context_for_prompt(cfg)
    except Exception:
        allowed, ctx = set(CAPABILITIES), ""
    user = _user_prompt(req)
    if ctx:
        user += f"\n{ctx}"
    # Always tell the model about a narrowed palette, independent of other config,
    # so its read_back/questions don't reference capabilities we then strip.
    if allowed and allowed != set(CAPABILITIES):
        user += f"\nOnly pre-select capabilities from this allowed set: {sorted(allowed)}."
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]
    last = None
    # Escalate the token budget each retry: a rich or agentic idea produces more questions/
    # options and can truncate the JSON at a fixed budget, then re-truncate identically on retry
    # (the same failure mode fixed in generate.py and build_plan.py).
    budgets = [3200, 6000, 9000]
    for attempt in range(3):
        raw = llm.complete(messages, max_tokens=budgets[attempt])
        try:
            plan = _coerce_plan(_extract_json(raw))
            # Constrain the palette to the workshop's allowed capabilities.
            if allowed and allowed != set(CAPABILITIES):
                plan.capabilities = [c for c in plan.capabilities if c.name in allowed]
            return plan
        except Exception as e:
            last = e
            messages.append({"role": "assistant", "content": raw[:400]})
            messages.append({"role": "user",
                             "content": "That was not valid. Return ONLY the JSON object in the exact shape, no fences."})
    raise ValueError(f"design plan generation failed: {last}")


# --- Curated fallback (mirrors the frontend defaults) if the SA call fails. ---
def fallback_plan(idea: str = "") -> DesignPlan:
    # Echo their idea back even on the fallback path — this line is the "I heard you"
    # moment, and it matters MOST when the input was messy enough to trip generation.
    idea = (idea or "").strip()
    if idea:
        snippet = idea if len(idea) <= 140 else idea[:137].rstrip() + "…"
        read_back = f"Here's what I heard: \"{snippet}\". Let's shape it with a couple of quick choices."
    else:
        read_back = "Let's shape your idea with a couple of quick choices."
    return DesignPlan(
        read_back=read_back,
        questions=[
            DesignQuestion(
                id="interaction_model", eyebrow="Design · 1 of 2", concept="Interaction model",
                title="How will people use this most?",
                lead="This sets what the app opens on and the one thing they do most.",
                options=[
                    DesignOption(key="browse_act", letter="A", label="Scan a shortlist and act",
                                 sub="Busy; want to be told what matters and what to do next.",
                                 preview=["It opens on a ranked shortlist of what needs attention.",
                                          "Click into one to see detail and act.",
                                          "More upfront ranking logic, far less asked of the user."]),
                    DesignOption(key="monitor", letter="B", label="Watch a dashboard for what's off",
                                 sub="Want the big picture and where to focus.",
                                 preview=["It opens on an overview so patterns jump out.",
                                          "Drill into any area to dig deeper.",
                                          "Great for oversight; less immediate for a single next action."]),
                    DesignOption(key="ask", letter="C", label="Ask questions in plain English",
                                 sub="Prefer to type a question and get an answer.",
                                 preview=["It opens on a question box, answers first.",
                                          "No ranking imposed; the person drives.",
                                          "Most flexible, but assumes they know what to ask."]),
                    DesignOption(key="explore", letter="D", label="Explore freely across views",
                                 sub="Want to drill in their own direction.",
                                 preview=["It opens on a flexible view to explore.",
                                          "Many paths, few guardrails.",
                                          "Powerful, but the least guided."]),
                    DesignOption(key="agent_actions", letter="E", label="Delegate to an agent, then approve",
                                 sub="An agent works through items and proposes actions; you approve or override.",
                                 preview=["The agent reads, decides, and drafts an action per item.",
                                          "You review its reasoning and approve or override each one.",
                                          "Every decision is recorded as an audit trail."]),
                ],
                other_preview=["We'll adapt to how you describe using it.",
                               "The rest of the design flexes to match.", "Most tailored."]),
            DesignQuestion(
                id="data_mode", eyebrow="Design · 2 of 2", concept="Data & tools",
                title="Where does the data come from?",
                lead="This sets your very first build step — and we keep it to what fits a workshop day.",
                options=[
                    DesignOption(key="synthetic", letter="A", label="Make realistic sample data",
                                 sub="We generate tables that fit your idea — nothing needed from you.",
                                 preview=["A synthetic dataset shaped to your idea, in Unity Catalog.",
                                          "You skip data wrangling and get to the interesting parts.",
                                          "No setup risk, but the data is made up. Swap in real tables later."]),
                    DesignOption(key="upload", letter="B", label="I have a spreadsheet or file",
                                 sub="A CSV/Excel we turn into a Unity Catalog table together.",
                                 preview=["We walk you through loading your file into a table.",
                                          "Your build runs on your own numbers from the start.",
                                          "A little setup, and the file needs to be reasonably clean."]),
                    DesignOption(key="existing", letter="C", label="Point at a table that already exists",
                                 sub="Read from a Unity Catalog table you already have.",
                                 preview=["Your build reads a real table you already have.",
                                          "Nothing to generate; reflects your actual business.",
                                          "Most realistic; read-only is fine — we won't need to change it."]),
                ],
                other_preview=["We'll adapt the first step to however your data arrives.",
                               "Sample, a file you upload, or an existing table.", "We'll confirm specifics first."]),
        ],
        capabilities=[
            CapabilityPick(name="Genie", selected=True, fits="ask your data in plain English"),
            CapabilityPick(name="Knowledge Assistant", selected=True, fits="understand notes & docs"),
            CapabilityPick(name="Supervisor agent", selected=True, fits="tie the pieces together"),
            CapabilityPick(name="Lakebase", selected=True, fits="record decisions"),
            CapabilityPick(name="Databricks Apps", selected=True, fits="the front door"),
        ],
    )
