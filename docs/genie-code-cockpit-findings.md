# Genie Code cockpit eval — findings & fixes

_Ran a full **in-workspace Genie Code** build in the Costa workshop workspace (real cockpit, not the harness proxy): the "AP Invoice Copilot" sample, agent-actions console, the 4 locked pieces. A headless harness build (same locked architecture, gpt-5.6-sol coder) ran in parallel on the sandbox for a second data point._

## Bottom line
Real Genie Code builds the prescribed architecture end-to-end and largely nails it. Data, Genie grounding, Lakebase, and the **traced** supervisor agent all came out correct with light steering (one top-level prompt per step). The friction points below are places Genie Code *self-recovered* — they'd matter more for a weaker coder model or a participant who gets stuck, so most are now pre-empted in the guardrails, and the rest are facilitator call-outs.

## What validated cleanly (real Genie Code, Costa)
- **Step 1 — data:** created the schema in the `workshop` catalog, 3 related tables (30 POs / 30 receipts / 40 invoices, valid FKs), the **exact tolerance split requested** (30 within / 10 outside, 3.5–9% off), the data-gen notebook saved **inside the project folder** with `# Databricks notebook source` + `# COMMAND ----------` separators, and a verification query. Flawless.
- **Step 2 — Genie:** grounded the space with column comments + AP-term instructions, then ran **6 benchmark questions + 2 "push-past" variants — all correct vs. computed ground truth**, and self-corrected a grounding miss (see #2). Exactly the benchmark-until-right loop the guardrail intends.
- **Step 3 — Lakebase:** stood up a dedicated project, a well-shaped `decision_audit_log` table (approve/override CHECK, agent_recommendation, reason, decided_by, timestamptz), short-lived OAuth token auth (no password), and a confirmed insert + read-back.
- **Step 4 — supervisor agent + MLflow tracing:** a plain Python tool-calling loop via the `databricks-openai` client → `databricks-claude-sonnet-5` (no framework, no temperature), two tools with docstrings (`lookup_invoice_match`, `record_decision`), and an **MLflow experiment (`.../ap-invoice-copilot/agent-traces`) with 6-span traces** — `process_invoice` (@mlflow.trace) → Completions (autolog) → each tool → Completions. Two end-to-end tests correct; audit rows written to Lakebase. **The MLflow tracing guardrail works exactly as designed** — and traces are visible under the user's Experiments (this is why none showed before: no traced build had been run to completion).

## Friction / where Genie Code fell shy
1. **Genie space instructions API (minor).** No direct SDK method to set space instructions; GC fell back to the REST API after a couple of tries. Recovered on its own.
2. **Genie derived-state grounding (medium).** A reworded "which invoices are *on hold*?" initially failed — Genie looked for a literal `status` column instead of computing the tolerance check. GC tightened the instructions to define "on hold" as a computed rule and it passed. → **Fixed in the Genie guardrail** (define derived statuses as rules).
3. **Lakebase shared-project auth wall (medium/high).** Connecting to the shared `workshop` Lakebase project failed auth — the user lacks the Postgres role / manage permission there. GC recovered by **creating its own dedicated project**. → **Fixed in the Lakebase guardrail** (tell GC to create its own project up front). _Provisioning note: this means one Lakebase project per participant build — plan cleanup, and confirm participants can create projects._
4. **"Accept all" on file assets (UX).** GC proposes notebooks/files as pending changes that need an explicit **Accept all**. Not a bug, but a participant could leave work unaccepted. → **Facilitator call-out.**

## App (step 5) — the fragile frontier (most important finding)
- **The app step is a two-agent handoff, and in a long session it HANGS.** Genie Code does not build the React/FastAPI app inline — it reads `design.md` + the logo, **creates the app resource, then tries to hand off to a separate "Apps agent"** to scaffold/build/deploy. In our run (a single ~50-min chat covering all 5 steps) that handoff **wedged in "Thinking…" indefinitely** — the app was created but never got source code, and a follow-up prompt just **queued** behind the stuck turn.
- **Root cause is session degradation.** Genie Code itself surfaced *"New topic? Start fresh for faster, sharper responses."* Long single-session builds get slow/wedged by the app step. **Recovery that worked:** Stop the wedged turn → start a **fresh chat** → tell GC to **build the files and deploy via the databricks CLI itself** (not the create-app-and-handoff flow).
- **Facilitator guidance (important for tomorrow):**
  - Do the **app step in a fresh Genie Code chat**, not the same one used for data/Genie/Lakebase/agent. (Reference PROJECT.md + design.md + the already-built pieces.)
  - Tell Genie Code to **build the app and deploy it itself** (scaffold files → `databricks sync` + `databricks apps deploy`), rather than "create an app and hand off."
  - If a step **hangs in "Thinking…"**, click **Stop generating** and re-prompt; don't wait it out.
  - Budget the **most time** for this step and expect to steer it.
### App-quality assessment (fresh-chat build, deployed live)
The fresh-chat "build & deploy it yourself" approach **worked** — GC scaffolded React+Tailwind+FastAPI, built `dist` (full HTML5 shell, **`costa.png` shipped in dist/**), and deployed via the SDK. The deployed console:
- **Renders cleanly, on-brand**: title "AP Invoice Copilot — Costa", **Costa logo in the header**, the review-queue + stats + "Ask about your invoices" box — the prescribed supervise-the-agent layout. Build-time compiled CSS/JS (not CDN). Root 200, full doctype. **The design.md brief clearly landed.**
- **Data layer is the hard blocker** (the real "doesn't meet requirements"). The queue came up empty; `/api/queue` walked through a chain of failures as GC iterated:
  1. Deploy source included `node_modules` → export failed (GC stripped to an 8-file folder — arrived at our allowlist by hand).
  2. `"No SQL warehouse found"` → the app SP couldn't see a warehouse (GC attached it as an app resource).
  3. `"Request URL is missing http(s):// protocol"` → a connection-URL code bug.
  4. Root cause: **in the Costa workshop account the app service principal can't be granted catalog/warehouse/Genie access by the participant** (grant-authority wall), so GC pivoted the backend to **on-behalf-of-user (OBO) auth** — which then needs specific `user_api_scopes` (sql, genie) declared on the app, which it was still wiring.

### Biggest workshop risk + required decision (app data access)
The app UI builds reliably; **getting it to read data/Genie in the Costa account is the crux.** Neither path is turnkey for a participant:
- **SP path**: needs USE CATALOG + SELECT + warehouse CAN USE + Genie access granted to the app SP — but participants likely **lack authority to grant catalog/warehouse** (same wall as Lakebase). Requires a **facilitator/admin to pre-grant**, or a group the SP is in.
- **OBO path** (what GC fell back to): use the forwarded user token + declare `user_api_scopes` (e.g. `sql`, `dashboards`/genie) on the app. More self-service, but GC had to discover it and get the scopes right.
- **Recommendation for tomorrow**: decide this up front — ideally **pre-provision app SP grants (admin)** OR standardize on **OBO + a known-good `user_api_scopes` set**, and bake the choice into the app guardrail/instructions. Otherwise every participant burns time here. This is the #1 thing to settle before the workshop.

### App-step guardrail improvements (proposed, from this run)
- Tell GC to **build the app files and deploy via CLI/SDK in a fresh chat**, not the create-app+Apps-page handoff (which hung).
- **Never put `node_modules` in the deploy source** — deploy only `dist/**` + backend (reinforce the allowlist for the SDK/CLI deploy path).
- **Attach the SQL warehouse as an app resource** (don't rely on auto-discovery) and settle the SP-vs-OBO data-access approach explicitly.

## Second data point — headless harness (sandbox, gpt-5.6-sol coder)
Ran the same locked architecture through the Genie Code CLI headlessly: **4/5 moves PASS**.
- **PASS:** data (4 tables incl. a `suppliers` table it added), Genie space, **Lakebase — created its OWN dedicated project** (`bs-eval-…-ap-ledger`, `invoice_decisions`, roundtrip verified — same self-recovery as the live build, confirming the dedicated-project fix matches real behavior), Supervisor agent **+ MLflow experiment** (`2768148730142325`).
- **FAIL:** the Databricks App — the app (`ap-console-…`) was created but reached only `STARTING` and the coder's stream cut (empty final). Consistent with the harness's documented fragility: long app deploys on the model-gateway proxy get severed mid-build. Likely an infra/stream artifact of the proxy path, not a move-quality bug — the **live in-workspace build is the truer test of the app step** (no gateway proxy).

### Convergent conclusion
Both an independent coder model (harness) and real in-workspace Genie Code (live) build **data → Genie → Lakebase → traced agent** correctly with the current guardrails. **The Databricks App deploy is the single fragile/long step** — the top workshop risk (time + reliability). Budget the most time here, expect the Apps-page handoff, and consider it the step most likely to need a facilitator assist.

## Fixes applied this session
- **MLflow tracing** guardrails for the agent (autolog + `@mlflow.trace` + experiment + SP grant) — validated live.
- **design.md + `costa.png`** written into each participant's app folder (Costa brand foundation + 3 reference "flavors", one recommended per interaction model; logo packaged into `dist/`). Apps stay on-brand but varied.
- **Lakebase dedicated-project** guardrail (finding #3).
- **Genie derived-state** guardrail (finding #2).
- Removed the synthetic-data design question (always synthetic); added the Costa "Beverage Distribution" sample set; set the Costa catalog config to `workshop`; fixed Assemble-removal UI leftovers.

## Facilitator call-outs for the workshop
- When Genie Code proposes file changes, click **Accept all** to save them.
- **Lakebase:** each build provisions its own Lakebase project — that's expected, not an error.
- If **Genie** answers a "flagged / on-hold / at-risk"-type question wrong, tighten the space **instructions** to define that status as a rule over the columns, then re-ask.
- The agent's **MLflow traces** land under **Experiments → your user folder → &lt;project&gt;/agent-traces** — a trace with a span per tool is proof the pieces actually ran (a missing span = a faked/skipped piece).
