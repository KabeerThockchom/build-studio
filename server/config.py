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


# --- Model / resource config (override via env in app.yaml) ---
# Sonnet 5 rejects the `temperature` param — callers must omit it.
SERVING_ENDPOINT = os.environ.get("SERVING_ENDPOINT", "databricks-claude-sonnet-5")
