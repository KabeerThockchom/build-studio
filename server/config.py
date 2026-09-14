"""Dual-mode config: runs in Databricks Apps (ambient SP auth) or locally (CLI profile).

Reused pattern from the North Star app (cona-rgm-copilot) — proven in production.
"""
import os
from databricks.sdk import WorkspaceClient

IS_DATABRICKS_APP = bool(os.environ.get("DATABRICKS_APP_NAME"))


def get_workspace_client() -> WorkspaceClient:
    if IS_DATABRICKS_APP:
        return WorkspaceClient()
    profile = os.environ.get("DATABRICKS_CONFIG_PROFILE") or os.environ.get("DATABRICKS_PROFILE", "build-studio")
    return WorkspaceClient(profile=profile)


def get_oauth_token() -> str:
    """Bearer token that works for OAuth (U2M/M2M) and PAT profiles alike."""
    client = get_workspace_client()
    tok = client.config.token
    if tok:
        return tok
    auth = client.config.authenticate()
    return auth.get("Authorization", "").removeprefix("Bearer ").strip()


def get_workspace_host() -> str:
    if IS_DATABRICKS_APP:
        host = os.environ.get("DATABRICKS_HOST", "")
        if host and not host.startswith("http"):
            host = f"https://{host}"
        return host
    return get_workspace_client().config.host


# --- Model / resource config ---
# Some models (e.g. Sonnet) reject the `temperature` param — callers must omit it.
# SERVING_ENDPOINT is the per-deploy default (env, set in app.yaml); a facilitator can
# override it per workshop via config (e.g. a workspace where Claude isn't available).
SERVING_ENDPOINT = os.environ.get("SERVING_ENDPOINT", "databricks-claude-sonnet-5")


def get_serving_endpoint() -> str:
    """The model endpoint to use. Workshop config wins over the deploy default, so a
    facilitator can point at a workspace-appropriate model without a redeploy. Lazy import
    + best-effort: a missing or unreachable config store falls back to the env default."""
    try:
        from . import workshop
        m = (workshop.effective_config().get("serving_endpoint") or "").strip()
        if m:
            return m
    except Exception:
        pass
    return SERVING_ENDPOINT
