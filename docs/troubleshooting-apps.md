# App troubleshooting — when your app isn't working

Your build (see PROJECT.md) is a React + FastAPI Databricks App. Genie Code builds it well, but a few
things reliably trip people up — especially **data access**. Work top-down: first SEE the real error,
then match the symptom.

## 0. See the real error first
- A green "SUCCEEDED" deploy and a 200 on the root page do **not** mean the app works — the page can
  render while its data calls fail. **Open the app in your browser, logged in, and confirm the
  list/queue actually shows real rows.**
- The UI usually shows a generic message; the real error is in the logs:
  `databricks apps logs <app-name> --follow -p <profile>` (needs OAuth, not a PAT), or the app's
  **Logs** tab in the workspace.
- If the backend does `resp.json()` without checking the HTTP status, a 403/HTML error turns into a
  confusing `Expecting value: line 1 column 1`. Make the backend return the real status + body.

## 1. App won't build or deploy
- **Genie Code created the app but never built/deployed it, or hung on "Thinking…".** The in-chat
  "create app → hand off to the Apps agent" flow can wedge. Fix: do the **app step in a fresh Genie
  Code chat**, and tell it to **build the files and deploy them itself** (scaffold → build the frontend
  → `databricks sync` + `databricks apps deploy`), not to hand off. If a turn hangs, click **Stop** and
  re-send.
- **Deploy fails: "Failed to export …/node_modules/…".** You shipped `node_modules`. Deploy ONLY the
  built `dist/` + the backend. In `databricks.yml`:
  `sync.include: ["dist/**","main.py","requirements.txt","app.yaml"]`. A healthy deploy is ~8–15 files.
- **"No dependencies file found" / pip timeout during build.** Use a plain `requirements.txt` — never a
  `uv.lock` (it bakes in internal proxy URLs the build environment can't reach). For Lakebase, list
  `psycopg` AND `psycopg-binary` explicitly. Pin `databricks-sdk>=0.121`.
- **App crashes on start / "not a valid integer" for the port.** The `app.yaml` command must hardcode
  `--port 8000` — never a `${VAR}` (Apps runs the command with no shell expansion).
- **Blank page / broken layout.** The built `index.html` must be a full HTML5 document
  (`<!DOCTYPE html>`, `<head>`, `<body>`). Compile Tailwind at build time (Vite), not a browser CDN.

## 2. App renders but shows NO data  ← most common
Check the logs, then match the error:
- **`No SQL warehouse found`.** Attach the SQL warehouse as an app **resource** in `app.yaml`
  (`sql_warehouse` with the id + `CAN_USE`). Don't auto-discover — the app service principal sees none
  by default. Take the warehouse id from the resource/env, not a lookup.
- **`Request URL is missing an 'http://' or 'https://' protocol`.** In Apps, `DATABRICKS_HOST` is a
  **bare hostname**. Prepend `https://` before building any API URL, or use the SDK
  (`WorkspaceClient().statement_execution.execute_statement(...)`) which resolves the host for you.
- **Permission denied / empty results — and you're reading the SHARED workshop data
  (`workshop.finance_ap`, `retail_commercial`, `hr_people`, `ai_productivity`, `docs_corpus`).** By
  default the app runs as its **Service Principal**, a fresh identity that is NOT in your workshop group,
  so it has no access to the shared catalog — and you **cannot grant it `USE CATALOG` yourself** (that's
  catalog-owner-only; you'll get `User does not have MANAGE on Catalog`). **The fix is on-behalf-of-user
  (OBO) auth — this is the default for the shared data and needs no admin grant.** YOU already have
  `USE CATALOG` + `SELECT` on the shared schemas and `CAN USE` on the workshop warehouse via your group,
  so run the queries as yourself:
  - Read the forwarded **`X-Forwarded-Access-Token`** header on each request and use that token for the
    SQL warehouse and Genie Conversation API calls.
  - Declare the scopes in `app.yaml`: **`user_api_scopes: [sql, dashboards.genie]`** (add
    `workspace.workspace` only if you read Workspace files). Two traps: (a) changing scopes forces every
    user to **re-consent** — test in a **fresh/incognito** window; (b) the runtime error names a short
    scope ("required scopes: sql") but you set the longer settable name; the `iam.*` scopes are
    auto-granted and not settable. Known quirk: an OBO redirect can show `next_url present more than once`
    on first consent — reload once.
- **Permission denied on YOUR OWN tables (a supplementary schema you created, e.g.
  `workshop.<you>_<project>`).** These you own, so the SP path works: grant the app SP `USE SCHEMA` +
  `SELECT` on that schema (and `CAN USE` on the warehouse / `CAN RUN` on your Genie space, attached as app
  resources). You don't need OBO for your own data — but if the app ALSO reads the shared data, keep it
  simple and use OBO for everything. Lakebase writes always use the app's own identity regardless (you own
  the Lakebase project and grant its Postgres role — see §3).
- **`No SQL warehouse found` under OBO too.** The user token still needs a warehouse to run on: attach the
  workshop warehouse as an app **resource** and take its id from the resource/env, not auto-discovery.

## 3. Lakebase (recording decisions) issues
- **Auth failed / can't create a table on a shared Lakebase project.** You lack manage rights there.
  Create your **own dedicated Lakebase project** for your build — it auto-provisions an endpoint.
- **App SP can't write to your Lakebase table.** Grant the SP's Postgres role: connect as yourself and
  `GRANT USAGE ON SCHEMA public` + `GRANT ALL ON <table>` + `GRANT USAGE, SELECT ON ALL SEQUENCES IN
  SCHEMA public` to the role named after the SP's client id. (`CAN_CONNECT_AND_CREATE` alone does not
  grant `CREATE` on `public`.)
- **First request after idle is slow / times out.** Autoscaling Lakebase scales to zero; open the
  connection with a generous timeout and retry the first attempt.

## 4. Genie & model
- **Genie answers the wrong thing for a derived status** ("on hold", "at risk", "flagged"). Genie looks
  for a literal column. Define the status as a **computed rule** in the space instructions (e.g.
  "'on hold' means the invoice differs from its PO by more than the 2% tolerance"), then re-ask.
- **Genie / first query takes ~2 minutes or times out.** Cold serverless warehouse. Pre-warm it (run
  one query) before a demo and use a generous client timeout (>120s).
- **`Model … does not support the temperature parameter`.** Omit `temperature` (Claude Sonnet rejects it).
- **Genie answers show literal `**` / `#` instead of bold/headings.** Genie returns **Markdown** —
  render it with a Markdown component (e.g. `react-markdown`), don't inject the text as plain text.

## 5. Things PROJECT.md already says that are easy to skip
Genie Code sometimes shortcuts these — double-check:
- **Wire Genie for real**: a free-text ask box that calls the Genie Conversation API for ANY question —
  not a hardcoded SQL string dressed up as a sentence, and not one canned question. An instant answer is
  the tell that Genie was never actually called.
- **Persist to Lakebase** (the attached Postgres DB), not a Unity Catalog table.
- **Deploy with the allowlist** (`dist/**` + backend only), literal port 8000, `requirements.txt`.
- **Verify BOTH**: the root page renders AND the primary action returns real data — before calling it done.
