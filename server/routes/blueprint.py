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
        # Log the real cause for us; show the participant a plain, non-scary message
        # (never a Python traceback — that reads as "I broke it").
        print(f"generate_blueprint failed: {traceback.format_exc()[-1400:]}")
        return JSONResponse(status_code=500, content={
            "error": "The plan didn't come together that time. Give it another go — "
                     "this usually clears on a retry.", "cause": str(e)})
