"""Auto-saved sessions backed by Lakebase (managed Postgres).

Stores the whole studio state as JSON, keyed by session_id. The frontend
auto-saves on each section change and can resume via ?s=<id>.

Degrades gracefully: if Lakebase env isn't configured (e.g. local dev without an
instance attached), all operations become no-ops so the app still runs and the
flow is unaffected. Reuses the North Star OAuthConnection pattern (fresh DB
credential minted per connection; pool recycles before token expiry).
"""
import json
import os
import time
import uuid

_ENABLED = bool(os.environ.get("PGHOST") and os.environ.get("ENDPOINT_NAME"))
_pool = None
_init_ok = False


def enabled() -> bool:
    return _ENABLED


def _get_pool():
    global _pool
    if _pool is not None:
        return _pool
    import psycopg
    from psycopg_pool import ConnectionPool
    from databricks.sdk import WorkspaceClient

    ws = WorkspaceClient() if os.environ.get("DATABRICKS_APP_NAME") else \
        WorkspaceClient(profile=os.environ.get("DATABRICKS_CONFIG_PROFILE") or os.environ.get("DATABRICKS_PROFILE", "build-studio"))

    class OAuthConnection(psycopg.Connection):
        @classmethod
        def connect(cls, conninfo="", **kwargs):
            cred = ws.database.generate_database_credential(
                request_id="build-studio", instance_names=[os.environ["ENDPOINT_NAME"]])
            kwargs["password"] = cred.token
            return super().connect(conninfo, **kwargs)

    host = os.environ["PGHOST"]; db = os.environ.get("PGDATABASE", "databricks_postgres")
    user = os.environ["PGUSER"]; port = os.environ.get("PGPORT", "5432")
    ssl = os.environ.get("PGSSLMODE", "require")
    _pool = ConnectionPool(
        conninfo=f"dbname={db} user={user} host={host} port={port} sslmode={ssl}",
        connection_class=OAuthConnection, min_size=1, max_size=4, max_lifetime=2700, open=False)
    _pool.open(wait=True, timeout=30.0)
    return _pool


DDL = """
CREATE TABLE IF NOT EXISTS build_studio_sessions (
    session_id  TEXT PRIMARY KEY,
    app_user    TEXT,
    state       JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


def init_schema():
    global _init_ok
    if not _ENABLED:
        return
    for attempt in range(2):
        try:
            with _get_pool().connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(DDL)
                conn.commit()
            _init_ok = True
            return
        except Exception as e:
            print(f"sessions schema init attempt {attempt} failed: {e}")
            time.sleep(1)


def save(session_id: str | None, app_user: str, state: dict) -> str:
    """Upsert the session state. Returns the session id (new one if none given).
    No-op-safe: raises only for the caller to catch; the route degrades to ok:false."""
    sid = session_id or uuid.uuid4().hex
    if not _ENABLED:
        return sid
    with _get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO build_studio_sessions (session_id, app_user, state)
                   VALUES (%s, %s, %s)
                   ON CONFLICT (session_id)
                   DO UPDATE SET state = EXCLUDED.state, updated_at = now()""",
                (sid, app_user, json.dumps(state)))
        conn.commit()
    return sid


def load(session_id: str) -> dict | None:
    if not _ENABLED:
        return None
    with _get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT state FROM build_studio_sessions WHERE session_id = %s", (session_id,))
            row = cur.fetchone()
    if not row:
        return None
    return row[0] if isinstance(row[0], dict) else json.loads(row[0])


def latest_for_user(app_user: str) -> dict | None:
    """The participant's most recently-updated session, for 'welcome back / resume' when
    they return to the base URL without the ?s= id. Returns {session_id, state, updated_at}
    or None. Safe no-op when Lakebase isn't configured or the user has no sessions."""
    if not _ENABLED or not app_user:
        return None
    try:
        with _get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT session_id, state, updated_at FROM build_studio_sessions
                       WHERE app_user = %s ORDER BY updated_at DESC LIMIT 1""", (app_user,))
                row = cur.fetchone()
        if not row:
            return None
        sid, state, updated = row
        st = state if isinstance(state, dict) else json.loads(state)
        return {"session_id": sid, "state": st,
                "updated_at": updated.isoformat() if updated else None}
    except Exception as e:
        print(f"latest_for_user failed: {e}")
        return None


def list_sessions(limit: int = 200) -> list[dict]:
    """Roster for the proctor board: every session with who, its state, and timing."""
    if not _ENABLED:
        return []
    rows = []
    with _get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT session_id, app_user, state, created_at, updated_at
                   FROM build_studio_sessions ORDER BY updated_at DESC LIMIT %s""", (limit,))
            for sid, user, state, created, updated in cur.fetchall():
                # A single corrupted state row must not 500 the whole proctor roster.
                try:
                    st = state if isinstance(state, dict) else json.loads(state)
                except (json.JSONDecodeError, TypeError):
                    st = {}
                rows.append({"session_id": sid, "app_user": user, "state": st,
                             "created_at": created.isoformat() if created else None,
                             "updated_at": updated.isoformat() if updated else None})
    return rows


# --- Workshop config: a single-row store the harness + console share -----------
_CONFIG_DDL = """
CREATE TABLE IF NOT EXISTS build_studio_config (
    id          TEXT PRIMARY KEY DEFAULT 'default',
    config      JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


def init_config_schema():
    if not _ENABLED:
        return
    try:
        with _get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute(_CONFIG_DDL)
            conn.commit()
    except Exception as e:
        print(f"config schema init failed: {e}")


def get_config() -> dict | None:
    if not _ENABLED:
        return None
    try:
        with _get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT config FROM build_studio_config WHERE id = 'default'")
                row = cur.fetchone()
        if not row:
            return None
        return row[0] if isinstance(row[0], dict) else json.loads(row[0])
    except Exception as e:
        print(f"get_config failed: {e}")
        return None


def set_config(config: dict):
    if not _ENABLED:
        return
    with _get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO build_studio_config (id, config) VALUES ('default', %s)
                   ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_at = now()""",
                (json.dumps(config),))
        conn.commit()


def close():
    if _pool is not None:
        _pool.close()
