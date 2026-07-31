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
        WorkspaceClient(profile=os.environ.get("DATABRICKS_PROFILE", "coke-canada-workshop-dev"))

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


def close():
    if _pool is not None:
        _pool.close()
