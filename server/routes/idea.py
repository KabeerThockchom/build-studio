from fastapi import APIRouter
from ..models import IdeaCheckRequest
from .. import idea_check

router = APIRouter()


@router.post("/check_idea")
def check_idea_route(req: IdeaCheckRequest):
    # Advisory + fail-open by construction (idea_check never raises), so no error
    # branch is needed — a thin idea returns met:false with hints, not a failure.
    return idea_check.check_idea(req).model_dump()
