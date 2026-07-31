import traceback
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from ..models import BuildRequest
from .. import build_plan

router = APIRouter()


@router.post("/build_plan")
def build_plan_route(req: BuildRequest):
    try:
        return build_plan.build_plan(req).model_dump()
    except Exception as e:
        return JSONResponse(status_code=500, content={
            "error": str(e), "detail": traceback.format_exc()[-1200:]})
