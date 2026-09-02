# Build Studio × Genie Code CLI — eval & optimization harness

Closes the loop we were missing: Build Studio's Build phase emits plain-language
"moves" a workshop participant pastes into Genie Code. Until now their quality was
best-effort and untestable. This harness **runs the moves through the Genie Code
CLI headlessly against a real workspace and scores what actually got built**, so we
can measure and then optimize the move prompts.

## What's here
- `genie_runner.py` — drives `genie exec` headlessly. Mints a fresh workspace token
  and injects it as env (genie's sandboxed subshell can't read the macOS keyring),
  runs with `--approve-for-me` + `sandbox_workspace_write.network_access=true` +
  `databricks_profile` override. Supports session resume so moves feed sequentially
  into ONE genie session, exactly like a participant pasting them in order.
- `run_build.py` — generates a Build Studio plan for a case, creates a scratch UC
  schema, runs each move in order, and **scores on real artifacts**:
  data→new tables, Databricks Apps→a new app reaching ACTIVE, Genie/KA/agent→genie's
  self-verify. Model-gateway/IP-ACL stream drops are classified INFRA-DROP, not FAIL.

## Setup (proven working)
- Eval workspace: **build-studio** (throwaway FEVM Azure sandbox we admin), catalog
  **build_studio**. genie's MODEL runs on the ai_devtools AI Gateway (its own config);
  we only retarget genie's Databricks TOOL ops at build-studio.
- Run: `DATABRICKS_PROFILE=build-studio uv run --with-requirements requirements.txt \
  python optimize/run_build.py --case genie_app`

## Findings (2026-09-01)
- **A full build completes end-to-end through Genie Code.** `genie_app` (data + Genie
  space + Databricks App): tables created, Genie space created + self-verified with a
  real query ($23k), **app deployed and ACTIVE**. Our generated moves work.
- **Scoring must be artifact-based.** genie reported ok=False on the app move only
  because the model gateway severed the stream via an IP-ACL 403 on our shifting
  egress IP — *after* the app was already built. Trusting genie's exit would have
  false-failed a good build.
- **Real workshop risk: long app builds are fragile to model-stream drops** (app
  deploy ~14 min). Mitigation options: warm/keep the model connection, retry-on-drop,
  or ensure participants' egress IPs are allowlisted on the model-gateway workspace.

## Next (optimization loop — not yet run at scale)
Run the broader persona set (mirror `tests/quality_eval.py` cases: KA-heavy, agent,
existing-data, thin idea) to find *real* (non-infra) move failures, then have an
optimizer read failures → edit `server/build_plan.py` guardrails/prompt → re-run →
keep improvements. Note: each case = ~3 genie sessions (minutes + tokens each) and
the model gateway's IP ACL makes long runs intermittently flaky — budget accordingly.
