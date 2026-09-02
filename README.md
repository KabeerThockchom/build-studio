# Build Studio

A guided, teaching-first successor to the Databricks Vibe-to-Value workshop app.
Takes a workshop participant from a plain-language idea → a designed architecture
+ PRD → a step-by-step build they run in **Genie Code / Omnigent**.

Build Studio is itself a Databricks App (FastAPI + React) and an agentic app
(hand-rolled tool-loop on the Foundation Model API). The North Star app
(`cona-rgm-copilot`) is an *example of what a Build Studio user builds* — not this app.

## Stack
- **Backend:** FastAPI, OpenAI-compatible client → FMAPI (`databricks-claude-sonnet-5`), Databricks SDK.
- **Frontend:** React 18 + Vite + Tailwind (added in M2).
- **Contract:** the `Blueprint` Pydantic model (`server/models.py`) mirrored in `frontend/src/lib/types.ts`.

## Local dev

Requires a Databricks CLI profile (`build-studio`, on Azure):

```bash
databricks auth login --profile build-studio   # once, when the token expires
DATABRICKS_PROFILE=build-studio ./dev.sh        # uvicorn :8000 + vite :5173
```

Open http://localhost:5173 (Vite proxies `/api` → :8000).

Backend only:
```bash
uv run --with-requirements requirements.txt uvicorn app:app --reload --port 8000
curl localhost:8000/api/health
curl localhost:8000/api/fmapi_ping   # proves FMAPI is reachable with your auth
```

## Tests

```bash
# backend (no network — LLM mocked)
uv run --with-requirements requirements-dev.txt pytest tests/ -q

# opt-in live smoke eval against real FMAPI (M1+)
uv run --with-requirements requirements-dev.txt python tests/smoke_eval.py

# frontend (M2+)
cd frontend && npm run build && npx vitest run
```

## Milestones
- **M0** — scaffold, dual-mode auth, `/api/health` + `/api/fmapi_ping`, test harness. ✅
- **M1** — `/api/generate_blueprint`: FMAPI → PRD + diagram spec + flow + decisions.
- **M2** — React flow (Shape → Design → Assemble → Blueprint). **v0.1 = M0–M2.**
- **M3** — Build phase + guarded Genie Code "moves".
- Later — Lakebase session persistence, more archetypes, dynamic questions, deploy.

## Notes / gotchas (carried from North Star)
- Ship `requirements.txt`, never `uv.lock` (internal proxy leak).
- Sonnet 5 rejects the `temperature` param — omit it.
- Azure AI-Gateway URL doesn't resolve → use `{host}/serving-endpoints` (the default).
- Any Vector Search / managed-RAG client needs a freshly-minted token per call.
