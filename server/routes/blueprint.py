import traceback
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from ..models import GenerateRequest
from .. import generate

router = APIRouter()


@router.post("/generate_blueprint")
def generate_blueprint(req: GenerateRequest):
    try:
        return generate.generate_blueprint(req).model_dump()
    except Exception as e:
        return JSONResponse(status_code=500, content={
            "error": str(e), "detail": traceback.format_exc()[-1400:]})
