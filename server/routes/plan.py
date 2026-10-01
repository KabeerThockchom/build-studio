"""Build Studio v2 plan jobs: drafted in the background while the participant learns."""
from fastapi import APIRouter
from pydantic import BaseModel

from .. import plan

router = APIRouter()


class PlanStart(BaseModel):
    idea: str = ""
    answers: dict = {}
    capabilities: list = []
    project_name: str = ""
    adjust: str = ""
    previous: dict | None = None


@router.post("/plan/start")
def start(req: PlanStart):
    sd = {"idea": req.idea, "answers": req.answers, "capabilities": req.capabilities, "project_name": req.project_name}
    return {"job_id": plan.start(sd, req.previous, req.adjust)}


@router.get("/plan/{job_id}")
def get(job_id: str):
    return plan.status(job_id)
