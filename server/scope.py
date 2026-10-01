"""The workshop-day scope contract — the load-bearing discipline borrowed from the
real Databricks V2V workshop app.

The V2V app encodes "what's achievable in a one-day workshop" as blunt prompt
guardrails (a hard Do-NOT list, happy-path only, keep-it-simple, 2-3 personas).
That discipline is what keeps brand-new users on a path they can actually finish.
We centralize it here so every generation step (design questions, PRD/blueprint,
build moves) speaks the same constraints, and so the app can also SHOW the user
what's in scope for the day vs. what to save for later.

Nothing here introduces a new external data source: a workshop day starts from
sample data, a spreadsheet turned into a table, or an existing table — never a
freshly stood-up ingestion pipeline or a trained model.
"""

# Fed into the SYSTEM prompt of every generation step. Keep it tight and literal —
# the model should not be able to wriggle out of it.
WORKSHOP_SCOPE = """WORKSHOP-DAY SCOPE — this is a build a new user finishes in ONE day. Stay inside it:
- Happy path ONLY. Skip edge cases, error handling, auth flows, and admin tooling.
- Keep it simple. One clear outcome, 1-2 personas, the few high-value steps. Do not over-engineer.
- Data already exists or is generated in-workshop: sample data we make, a spreadsheet/file
  turned into a table, or an existing table we point at. NEVER assume a new live data source is
  ingested, streamed, or connected in a day. NEVER assume a machine-learning model is trained.
- Build only with the capabilities chosen. Do not invent new ones.
- Favor what's demonstrably achievable in a day over what's impressive on a slide. If something
  is bigger than a day, name it as a follow-up rather than folding it into the build."""

# Voice guardrail — the copy the model generates is read by brand-new users, so it
# must sound like a plain-spoken person, not a product deck. Fed into every prompt.
VOICE = """WRITING STYLE — write for someone brand new to this:
- Plain, human language. No hype and no adjectives like powerful, seamless, cutting-edge, intelligent.
- No jargon or internal product terms (do not write "RAG", "LLM", "semantic layer", "vector", "agentic").
  Say what a thing does in everyday words instead.
- Do NOT use em-dashes (—). Use a period, comma, or "like" instead. Keep sentences short."""

# Conversational voice for the Sit-Down agent specifically: react to substance, not with praise.
CHAT_VOICE = """CHAT STYLE: talk like a sharp colleague, not a cheerleader. Never open with praise words (great,
brilliant, love it, smart, exactly right, perfect, good instinct, nice). React to the substance of what
they said: reflect the specific detail back, then move it forward. Vary how you start sentences.
PLAIN WORDS: say what happens in everyday language ("when the app marks a crew as at risk", not "when a flag
fires" or "when a trigger hits"). No data or tech jargon (triggers, flags firing, pipelines, gold tables, joins,
schemas, CDC, SLAs) unless the participant used the word first. Their own industry's terms are fine when they
used them; if you introduce one, say what it means in a few words the first time."""

def clamp_idea(text: str, limit: int = 2000) -> str:
    """Guard generation against a pathologically long pasted idea/PRD. The idea is a
    'seed' of a sentence or two; anything past a sane limit only bloats the prompt and
    pushes the JSON output toward truncation. Keep the head, where the real intent lives."""
    if not text or len(text) <= limit:
        return text
    return text[:limit].rstrip() + " ..."


def strip_em_dashes(s: str) -> str:
    """Belt-and-suspenders enforcement of the no-em-dash rule on GENERATED text. The model
    is told not to use them (VOICE) but still slips them in, and the participant wants zero
    em/en dashes anywhere the user reads. Replace them with plain punctuation."""
    if not s:
        return s
    return (s.replace(" — ", ", ").replace(" – ", ", ")
             .replace("—", ", ").replace("–", "-"))


# Things that routinely feel in-reach to a newcomer but do NOT fit a workshop day.
# Used to guide the "save for later" list the SA surfaces on the blueprint.
COMMON_LATER = [
    "connecting a live/production data source (ingestion, streaming, CDC)",
    "training or fine-tuning a machine-learning model",
    "production hardening: auth, roles, error handling, monitoring",
    "scale/performance tuning and cost optimization",
]
