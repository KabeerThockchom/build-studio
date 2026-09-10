import traceback
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from ..models import PublishRequest
from .. import publish

router = APIRouter()


@router.post("/publish_assets")
def publish_assets_route(req: PublishRequest, request: Request):
    """Write the settled PROJECT.md into the user's workspace. Deployed, we act on behalf
    of the logged-in user via the forwarded token so the doc lands in THEIR home (not the
    app service principal's). Best-effort: a failure never blocks the build (the step-by-step
    backup still works), so we return ok:false with a plain reason rather than a 500."""
    # Databricks Apps forwards the user's identity + OAuth token in these headers (the token
    # requires the app's `files` user-authorization scope). Absent locally → profile identity.
    user_token = request.headers.get("x-forwarded-access-token")
    user_email = request.headers.get("x-forwarded-email", "")
    try:
        return publish.publish_assets(
            idea=req.idea, prd_markdown=req.prd_markdown, capabilities=req.capabilities,
            design_answers=req.design_answers, decisions=req.decisions, steps=req.steps,
            usable_assets=req.usable_assets, project_name=req.project_name,
            user_token=user_token, user_email=user_email)
    except Exception as e:
        print(f"publish_assets failed: {traceback.format_exc()[-1400:]}")
        return JSONResponse(status_code=200, content={
            "ok": False,
            "error": "Couldn't save the project to your workspace this time — you can still "
                     "build from the steps below.", "cause": str(e)})
