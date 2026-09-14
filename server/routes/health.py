import traceback
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from .. import config, llm

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "mode": "app" if config.IS_DATABRICKS_APP else "local"}


@router.get("/fmapi_ping")
def fmapi_ping():
    """Proves FMAPI is reachable with current auth. Returns the model's echo."""
    try:
        reply = llm.complete(
            [{"role": "user", "content": "Reply with exactly: pong"}], max_tokens=16)
        return {"ok": True, "model": config.get_serving_endpoint(), "reply": reply.strip()}
    except Exception as e:
        return JSONResponse(status_code=500, content={
            "ok": False, "error": str(e), "detail": traceback.format_exc()[-1200:]})
