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
        print(f"build_plan failed: {traceback.format_exc()[-1200:]}")
        return JSONResponse(status_code=500, content={
            "error": "Couldn't lay out the build steps that time. Try again — "
                     "it usually works on a second pass.", "cause": str(e)})
