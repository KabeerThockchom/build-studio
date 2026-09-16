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
- **Permission denied / empty results (the app runs as its Service Principal).** The SP is a fresh
  identity and needs ALL of the following, or a query silently returns nothing:
  - **`USE CATALOG` on the catalog — this is catalog-owner-only. A participant CANNOT grant it.**
  - `USE SCHEMA` + `SELECT` on your schema (you own the schema you created, so you CAN grant these).
  - `CAN USE` on the SQL warehouse and `CAN RUN` on the Genie space (attach both as app resources).

  If your app reads Unity Catalog data and comes up empty, it is almost always the missing
  `USE CATALOG`. **Ask the catalog owner / workspace admin to grant `USE CATALOG` on the workshop
  catalog to `account users`** — a one-time action that covers everyone's app SP. You can't grant it
  yourself (you'll get `User does not have MANAGE on Catalog`).
- **OBO alternative — run queries as the logged-in user instead of the SP.** Read the forwarded
  `X-Forwarded-Access-Token` header and query with it: the user already has `USE CATALOG` via their
  group, so no admin grant is needed. But you must set the app's **`user_api_scopes`** to include what
  you call — `sql` (SQL), `dashboards.genie` (Genie), `workspace.workspace` (Workspace files). Two
  traps: (a) changing scopes forces every user to **re-consent** — test in a **fresh/incognito** window;
  (b) the error names a short scope ("required scopes: sql") but you set the longer settable name. The
  `iam.*` scopes are auto-granted defaults and are not settable. For a workshop the **SP path with the
  admin `USE CATALOG` grant is usually simpler** than OBO (which also has a known consent/redirect
  quirk: `next_url present more than once`).

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
