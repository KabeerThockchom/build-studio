"""The Blueprint spec — the single source of truth shared across the app.

Assemble edits `capabilities` -> backend recomputes `spec` -> Blueprint renders it
-> Build walks `spec.nodes`. The frontend mirrors this shape in frontend/src/lib/types.ts.
"""
from typing import Literal, Optional
from pydantic import BaseModel, Field

Band = Literal["data", "capability", "agent", "delivery"]


class Node(BaseModel):
    id: str
    band: Band
    label: str
    sub: str = ""


class FlowStep(BaseModel):
    n: int
    title: str
    sub: str = ""


class Decision(BaseModel):
    tag: str            # e.g. "Genie"
    text: str           # what was decided
    tradeoff: str = ""  # the cost / con


class DiagramSpec(BaseModel):
    nodes: list[Node] = Field(default_factory=list)
    edges: list[tuple[str, str]] = Field(default_factory=list)  # (from_id, to_id)


class Blueprint(BaseModel):
    archetype: str = "agentic_app"
    idea: str = ""
    persona: str = ""
    capabilities: list[str] = Field(default_factory=list)
    spec: DiagramSpec = Field(default_factory=DiagramSpec)
    flow: list[FlowStep] = Field(default_factory=list)
    prd_markdown: str = ""
    decisions: list[Decision] = Field(default_factory=list)
    scope_in: list[str] = Field(default_factory=list)     # what we'll get done today
    scope_later: list[str] = Field(default_factory=list)  # honest "save for later"


class GenerateRequest(BaseModel):
    idea: str
    persona: str = ""
    expertise: str = "New to it"
    interests: list[str] = Field(default_factory=list)
    design_answers: dict[str, str] = Field(default_factory=dict)
    capabilities: list[str] = Field(default_factory=list)
    adjust: str = ""            # optional refinement note ("make it simpler", ...)


# --- Design plan: SA-authored questions + capability preselection (M2.5) ---
class DesignOption(BaseModel):
    key: str            # short slug, unique within the question
    letter: str         # "A" / "B" / "C"
    label: str
    sub: str = ""
    preview: list[str] = Field(default_factory=list)  # [what-this-leads-to x2, tradeoff]


class DesignQuestion(BaseModel):
    id: str             # slug used as the answer key
    eyebrow: str        # e.g. "Design · 1 of 3"
    title: str
    lead: str
    options: list[DesignOption] = Field(default_factory=list)
    other_placeholder: str = "None of these fit? Describe it in your own words…"
    other_preview: list[str] = Field(default_factory=list)


class CapabilityPick(BaseModel):
    name: str           # must be one of the known 6 capabilities
    selected: bool
    fits: str = ""      # one-line rationale ("Fits: ...") or why it's optional


class DesignPlan(BaseModel):
    read_back: str = ""             # SA's one-line reflection of the idea (builds trust)
    questions: list[DesignQuestion] = Field(default_factory=list)
    capabilities: list[CapabilityPick] = Field(default_factory=list)


class PlanRequest(BaseModel):
    idea: str
    expertise: str = "New to it"
    interests: list[str] = Field(default_factory=list)
    industry: str = ""            # silently implied when the idea came from a gallery sample


# --- Build phase: bite-sized guided Genie Code moves (M3) ---
class BuildStep(BaseModel):
    n: int
    title: str                 # e.g. "Stand up a Genie space"
    capability: str = ""       # which capability this step builds
    concept: str               # 2-3 sentences: what you're doing & why it matters
    move: str                  # the compact instruction to paste into Genie Code
    verify: str                # "you'll know it worked when…"
    teach: str = ""            # optional one-liner teaching a Genie Code / Databricks fact


class BuildPlan(BaseModel):
    steps: list[BuildStep] = Field(default_factory=list)


class BuildRequest(BaseModel):
    idea: str
    expertise: str = "New to it"
    capabilities: list[str] = Field(default_factory=list)
    design_answers: dict[str, str] = Field(default_factory=dict)
