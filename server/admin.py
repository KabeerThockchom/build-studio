"""Who's an admin/proctor? The console is gated on the app's CAN_MANAGE grantees.

Primary gate: the viewer's forwarded email is a CAN_MANAGE grantee on this app
(fetched from the app permissions API, cached). Break-glass so proctors can't be
locked out mid-workshop: an ADMIN_EMAILS env list and the workshop config's
admin_emails. Locally (no forwarded identity) admin is open so dev/proctor testing
works.
"""
import os
import time
from fastapi import Request

_cache: dict = {"emails": None, "ts": 0.0}
_TTL = 300.0


def viewer_email(req: Request) -> str:
    return (req.headers.get("x-forwarded-email")
            or req.headers.get("x-forwarded-user")
            or req.headers.get("x-forwarded-preferred-username") or "").lower()


def _manage_grantees() -> set[str]:
    """CAN_MANAGE user emails on this app, via the app permissions API (best-effort, cached)."""
    now = time.time()
    if _cache["emails"] is not None and now - _cache["ts"] < _TTL:
        return _cache["emails"]
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        app_name = os.environ.get("DATABRICKS_APP_NAME", "build-studio")
        # App permissions are keyed by the app NAME: GET /api/2.0/permissions/apps/{name}.
        acl = w.api_client.do("GET", f"/api/2.0/permissions/apps/{app_name}")
        emails = set()
        for entry in (acl or {}).get("access_control_list", []):
            un = (entry.get("user_name") or "").lower()
            levels = {p.get("permission_level") for p in entry.get("all_permissions", [])}
            if un and "CAN_MANAGE" in levels:
                emails.add(un)
        _cache["emails"] = emails      # cache only on success
        _cache["ts"] = now
        return emails
    except Exception as e:
        # Don't poison the cache with an empty set on a transient failure — return the
        # last good set (or empty) and let the next call retry.
        print(f"admin: could not fetch app manage grantees ({e}); using break-glass lists")
        return _cache["emails"] or set()


def is_admin(req: Request) -> bool:
    email = viewer_email(req)
    if not email:
        # No forwarded identity. In the deployed app the platform always injects the
        # viewer's email, so a missing one means non-user/edge traffic → deny (fail
        # closed). Only genuine local dev (not a Databricks App) is open for testing.
        return not bool(os.environ.get("DATABRICKS_APP_NAME"))
    env_admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
    if email in env_admins:
        return True
    try:
        from . import workshop
        cfg_admins = {e.strip().lower() for e in workshop.effective_config().get("admin_emails", []) if e}
        if email in cfg_admins:
            return True
    except Exception:
        pass
    return email in _manage_grantees()
