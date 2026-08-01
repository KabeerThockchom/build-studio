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

# Things that routinely feel in-reach to a newcomer but do NOT fit a workshop day.
# Used to guide the "save for later" list the SA surfaces on the blueprint.
COMMON_LATER = [
    "connecting a live/production data source (ingestion, streaming, CDC)",
    "training or fine-tuning a machine-learning model",
    "production hardening: auth, roles, error handling, monitoring",
    "scale/performance tuning and cost optimization",
]
