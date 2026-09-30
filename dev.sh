#!/usr/bin/env bash
# Local dev loop: FastAPI (uvicorn :8000) + Vite (:5173, proxies /api -> :8000).
# Requires a valid Databricks CLI profile (default: coke-canada-workshop-dev).
set -euo pipefail
cd "$(dirname "$0")"

PROFILE="${DATABRICKS_PROFILE:-coke-canada-workshop-dev}"
export DATABRICKS_PROFILE="$PROFILE"

echo "→ profile: $PROFILE"

# Backend (uv runs it with deps, no venv to manage)
uv run --with-requirements requirements.txt \
  uvicorn app:app --reload --port 8000 &
BACK=$!

# Frontend
( cd frontend && npm run dev ) &
FRONT=$!

trap "kill $BACK $FRONT 2>/dev/null || true" EXIT
echo "→ backend :8000  frontend :5173  (Ctrl-C to stop)"
wait
