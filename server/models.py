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


class GenerateRequest(BaseModel):
    idea: str
    persona: str = ""
    expertise: str = "New to it"
    interests: list[str] = Field(default_factory=list)
    design_answers: dict[str, str] = Field(default_factory=dict)
    capabilities: list[str] = Field(default_factory=list)
