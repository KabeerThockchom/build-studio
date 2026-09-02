# Workshop context & decisions

Living context for the Build Studio workshop effort. Source: two meetings on 2026-09-02
(Joy Garnett — interested user; Akil Thomas — workshop co-lead). This doubles as
onboarding for collaborators.

## The bottom line
- **Build Studio is the committed basis for the workshop** (not V2V). V2V is the fallback
  if Build Studio isn't stable enough by workshop day. Akil: "vibe-to-value is already
  done… I like this approach much better. Let's just do it."
- Target customer: the Costa / Coca-Cola-adjacent team (lead referred to as "Matt";
  "Brian" owns parts of the agenda). Persona mix skews **new / business users**, with a
  few sophisticated ones. Details confirmed in a customer call (was "tomorrow" = ~2026-09-03).
- Workshop shape: ~4 hours, agentic-app focus, want to wrap by 5pm. Two co-leads:
  Ashwin + Akil, proctoring live.

## Decisions made
1. **Build Studio over V2V** (hard commit, V2V as fallback).
2. **Staying on Azure** (updated 2026-09-02). The AWS migration was considered to dodge
   the Azure FEVM tenant-guest friction (users must join the FEVM Azure AD tenant via Opal
   before opening the app), but the Opal flow now works reliably (Akil got in via it), so
   Build Studio stays on the Azure `build-studio` workspace and the Genie CLI eval runs
   there too. Participants complete the one-time Opal request + Entra invite before the
   session.
3. **Agentic applications** as the workshop track (steer the customer here since they're
   open / not prescriptive). Possibly drop the "advanced" module.
4. **Synthetic data**, not real customer data — far easier to manage live; real data only
   if the account has a real path-to-production reason, in which case it goes through the
   account team.
5. **Each participant builds their own use case** (diverse apps + pseudo-competition),
   but grounded in a broad, table-shaped domain (e.g. inventory / supply chain) — not
   fanciful ("on Mars"). Single-vs-multi to be confirmed with the customer.
6. **Branding:** child apps participants build should mirror the **target company's**
   branding; the parent (Build Studio) app carries both Databricks + target-company
   branding, so the workshop feels like a real "art of the possible."

## Feedback backlog (from Akil, sized S/M/L)

### Small — safe to implement now, use-case-agnostic
- **Number the left agenda rail** (1…N steps) — intuitive step ordering.
- **Reference the PRD in the Design phase** — name it, frame it as the first milestone
  and explain why it matters (people skipped/never read the PRD in V2V).

### Medium
- **Upfront roadmap / journey overview** before the phases: an infographic-style
  "how do you build an end-to-end agentic app?" screen — each phase (Shape/Design/
  Assemble/Blueprint/Build) with a one-line "why it matters," a taste of the whole day,
  then dive in. Ground the learner before the specifics. (Akil shared a mock; the tagline
  idea: "How do you build an end-to-end agent application?")
- **Mini-quiz after each module** (2–3 questions, e.g. "What is a PRD? Why does it
  matter?") — make them wrestle with the material, not glaze over.
- **Richer learning content during long-running build steps** (steps can take 5–15 min):
  deeper explainers, YouTube links, "what am I doing and why" per step, esp. in the Build
  / Genie Code phase. Turn dead wait-time into learning time. *(This is the core insight
  Akil loved and wants pushed further — Build Studio's teaching-loader is the seed of it.)*
- **Naming** of the phases — Akil has alternative-name ideas for Shape/Design/Assemble/
  Blueprint/Build (not yet specified).

### Large / later (not first iteration)
- **Proctor/admin view:** per-participant telemetry via Lakebase — a dashboard showing
  where each person is in their journey and where they're erroring, so proctors can help
  the quiet/stuck ones. Deep-link to a participant's assets; let proctors debug behind the
  scenes (participants shouldn't watch the "intex debugging" like they did in V2V) and
  write context back into the participant's harness so their next step stays intelligent.
- **Pre-workshop questionnaire → pre-built data:** send a form collecting each
  participant's use-case idea; generate + debug the synthetic data (join keys etc.) and
  seed the workspace ahead of time, so nobody wrestles with data live. Leave "Easter eggs"
  in the data for a challenge/verification element.
- **Per-workshop config** (the parked "brain-dump"): allowed components, prescriptive vs
  open, single vs multi use case, industry focus, data path.

## Open architecture question (decision pending — needs personas from the customer call)
**Embed the Genie Code CLI in the app, or hybrid deep-link to the Databricks UI?**
- Akil wants to keep users *in* Build Studio as much as possible (controlled UX, less
  glaze-over than the Databricks UI's firehose), with the Genie CLI driving workspace
  objects from inside the app; near the end, introduce the Databricks UI with "GPS"
  deep-links mapping each module to a specific UI element.
- Ashwin's counter: if they never touch the Databricks UI / Genie Code directly, they
  don't build the confidence to do it themselves next time — which was the whole point.
- Framing that resolves it: **outcome-based** (richest possible app → keep them in-app)
  **vs. teaching-vibe-coding** (get them fluent in Genie Code itself → have it open).
  Decision hinges on the actual persona mix. Genie Code CLI exists (`go/genie-code-cli`)
  and a headless API is expected, so embedding is technically feasible.

## Genie Code prompt optimization (in progress)
See `optimize/README.md`. We drive the Genie Code CLI headlessly to run Build Studio's
moves against a real workspace and score real artifacts. Baseline finding: every move
type completes a full build EXCEPT Knowledge Assistant, which times out because Vector
Search / KA indexing exceeds the move window — the fix is to treat KA indexing as async
(kick off, tell the user it takes minutes, verify later) rather than a synchronous confirm.

## People
- **Akil Thomas** — workshop co-lead, co-builder (will PR into this repo).
- **Joy Garnett** — interested in using the app; connecting us to Carrie Ross.
- **Carrie Ross** — SA with V2V experience (mature manufacturing + newer accounts); to
  consult for workshop-value insights.
- **Costa/customer team** — "Matt" (lead), "Brian" (agenda). Persona mix TBD.

## Next steps (from the meetings)
- [x] Environment: staying on Azure (Opal flow works; no AWS migration).
- [x] Ashwin: share the GitHub repo with Akil (he'll branch + PR; Ashwin PRs early work in
      to avoid ugly merges).
- [ ] Ashwin: keep both V2V and Build Studio deployable for a dry-run.
- [ ] Ashwin: consult Carrie Ross (Joy to send contact).
- [ ] 2–3 working sessions with Akil next week (Mon/Tue/Wed).
- [ ] Customer call: confirm single-vs-multi use case, prescriptive-vs-open, agentic
      focus, persona mix, and trim Brian's ~2h discussion block so it ends by 5pm.
