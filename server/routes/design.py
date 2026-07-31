from fastapi import APIRouter
from ..models import PlanRequest
from .. import design_plan

router = APIRouter()


@router.post("/plan_design")
def plan_design(req: PlanRequest):
    """SA-authored design questions + capability preselection from the idea.
    Falls back to a curated plan (never dead-ends the flow) if generation fails."""
    try:
        plan = design_plan.plan_design(req)
        return {"plan": plan.model_dump(), "source": "sa"}
    except Exception:
        return {"plan": design_plan.fallback_plan().model_dump(), "source": "fallback"}
