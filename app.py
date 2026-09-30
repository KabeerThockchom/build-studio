"""Build Studio — FastAPI entry point.

Serves the API and the built React SPA. Reuses the North Star SPA-serving pattern.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from server import sessions


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        sessions.init_schema()          # no-op if Lakebase env not configured
        sessions.init_config_schema()   # workshop config store
    except Exception as e:
        print(f"session init warning: {e}")
    yield
    sessions.close()


app = FastAPI(title="Build Studio", lifespan=lifespan)

from server.routes import health, blueprint, design, session, build, admin, publish, idea  # noqa: E402
app.include_router(health.router, prefix="/api")
app.include_router(blueprint.router, prefix="/api")
app.include_router(design.router, prefix="/api")
app.include_router(session.router, prefix="/api")
app.include_router(build.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(publish.router, prefix="/api")
app.include_router(idea.router, prefix="/api")

# Serve the built React SPA (frontend/dist) when present.
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dir):
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Serve real static files at the dist root (logo, favicon); else index.html
        candidate = os.path.normpath(os.path.join(frontend_dir, full_path))
        if full_path and candidate.startswith(frontend_dir) and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(frontend_dir, "index.html"))
