# Contributing

Welcome — this is the Build Studio workshop app (co-built by Ashwin + Akil). Start here.

## Orientation (read in this order)
1. `README.md` — what it is, stack, local dev, tests.
2. `docs/workshop-context.md` — the workshop decisions, feedback backlog, and open
   questions from our planning meetings. This is the "why" behind what we're building.
3. `optimize/README.md` — the Genie Code CLI eval/optimization harness (runs our Build
   moves through the real Genie Code CLI and scores what actually got built).

## Architecture in one paragraph
FastAPI backend (`server/`) + React/Vite/Tailwind frontend (`frontend/`), deployed as a
Databricks App. The shared contract is the `Blueprint` Pydantic model (`server/models.py`)
mirrored in `frontend/src/lib/types.ts`. Flow: Shape → (teach) → Design → Assemble →
Blueprint → Build. The three generation steps live in `server/design_plan.py` (SA-authored
design questions), `server/generate.py` (PRD + diagram spec), and `server/build_plan.py`
(the bite-sized Genie Code "moves"); shared workshop guardrails are in `server/scope.py`.

## Workflow
- Ashwin works on `main` for now; **please branch off and open PRs** so we avoid ugly
  merges while things move fast. Small, focused PRs are easier to review live.
- Run `frontend/` builds and `tests/` before pushing (see below). Keep the `Blueprint`
  contract in sync on both sides if you touch it.
- Deploy target is the Azure `build-studio` workspace (profile `build-studio`).

## Run it
```bash
databricks auth login --profile build-studio          # once
DATABRICKS_PROFILE=build-studio ./dev.sh               # backend :8000 + frontend :5173
```

## Test / build before a PR
```bash
uv run --with-requirements requirements-dev.txt pytest tests/ -q     # backend (LLM mocked)
cd frontend && env -u NODE_OPTIONS npm run build && npx vitest run   # typecheck + build + FE tests
```
(`env -u NODE_OPTIONS` avoids a local preload that can break the Vite build.)

## Deploy
```bash
cd frontend && env -u NODE_OPTIONS npm run build && cd ..
databricks sync . /Workspace/Users/<you>/build-studio --profile build-studio
databricks apps deploy build-studio --source-code-path /Workspace/Users/<you>/build-studio --profile build-studio
```
