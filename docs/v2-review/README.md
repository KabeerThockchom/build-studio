# Build Studio v2 · morning review

Branch `build-studio-v2` (local only, not pushed, not deployed). Run it:

```
cd ~/Documents/v2v-studio
DATABRICKS_PROFILE=build-studio python3 -m uvicorn app:app --port 8000 --reload --reload-dir server
# then open http://localhost:8000   (frontend is prebuilt into frontend/dist)
```

Screens for both test ideas (Costa waste, American Airlines crew) are in `screens/`; the frontend's design notes
are in `design-notes.md`.

## The new journey

```
Overview → Sit-Down (chat with your SA + colleagues) → Learn (only your build's pieces + quick check)
         → Plan (drafted in the background while you learn) → Build (Genie Code, + Genie App Builder for the app)
```

The left rail is back and accurate at every step, including during the Sit-Down (its sub-steps follow the
conversation: Sharpen the idea · N of 7 covered, Ways to build it, Fit it in a day, Your plan).

## What changed

**No prescribed architecture.** A build is made of whichever of five components its Sit-Down scope needs:
Declarative Pipelines (medallion), Genie, AI/BI Dashboards, Lakebase, Databricks Apps. No Supervisor agent, no
Knowledge Assistant. One catalog (`server/components.py`) drives the Sit-Down's building blocks, the
architecture diagram, which Learn modules appear, the plan and the build steps. Rules that keep builds sane:
every build ships a surface people use (picked from the shape: monitor → dashboard, ask/explore → Genie,
review/act → app); Lakebase always comes with an app that writes to it; the data foundation always ships.

**Sit-Down, ported to React** with parity to `/sitdown3` (that page still exists, untouched, for comparison).

**Learn is dynamic.** An architecture reveal of their build, then one module per component it uses, then a
quick check.

**Plan is a background job** with three passes: draft the PRD from the whole Sit-Down, a critic checks it against
what the participant actually said, then a refine pass fixes what the critic found. It starts the moment they
click "Let's build it" and is usually ready before they finish Learn (observed 28 to 60s after Learn).

**Build: Genie Code for everything except the app.** The app step is a Genie App Builder handoff (Apps > Build
tab, App Space, paste the prompt), with the prompt written to describe screens, data read and what each action
writes. PROJECT.md says the same, so Genie Code stops at the app step instead of hand-building one.

## How it was tested

| Eval | What it measures | Result |
|---|---|---|
| Conversation eval (16 simulated participants, 8 personas, 11 ideas incl. American Airlines, blind Opus judge) | Question quality, responsiveness, context, momentum, engagement, persona fit, brief fidelity | 6.19 → 6.62 over the Sit-Down rounds; v2 agent 6.38 (in the noise band); 16/16 reach the plan, 7/7 sections covered, 0 errors |
| Plan eval (finished Sit-Downs pushed through handoff → plan job → build plan, blind judge) | Fidelity, architecture, buildable today, Genie Code moves, App Builder prompt, clarity | 5.89 → 6.30 (round 3 pending at time of writing, see below) |
| Unit tests | Component catalog, packages, handoff, cast, normalisation | 43 passing |
| Browser end to end (React app, Chromium) | Full journey for both ideas, rail accuracy, Sit-Down parity, plan job states, App Builder step | Both ideas complete overview → Build with no page errors |

## Design decisions for you

1. **Generic ideas default to the workshop host.** If an idea names no company, the cast and context assume
   Costa (UK, £). Right for a Costa workshop; the judge flags it as "invented" on generic test ideas. Keep, or make
   the host a facilitator setting that can be blank?
2. **The grade journey starts at F.** The overall letter averages all seven sections with uncovered ones as zero,
   so the ceremony reads "F → B". Honest, but harsh as an opening number. Options: keep; start the journey from
   the first answered turn; or show the journey as sections covered (1 of 7 → 7 of 7) beside the letter.
3. **Concrete range cards vs open questions.** You chose concrete assumed ranges (faster). The cost: a pure
   card-clicker accepts our assumptions, so the brief carries our numbers rather than theirs (fidelity dipped
   slightly). Keep as is, or reintroduce one open question for the success target only?
4. **Plan takes about 2 minutes in the background** (draft, check, refine on Sonnet 5). Learn usually covers it.
   If someone races through Learn they see a live "Drafting / Checking / Tightening" state. Acceptable, or trade
   the check/refine pass for speed?
5. **Jobs live in server memory.** Cast and plan jobs are in-process; a server restart mid-job loses it (the app
   now restarts the job once automatically). Fine for a workshop app with one instance; worth persisting to
   Lakebase if we scale out.
6. **App Builder is Beta** and needs a workspace admin to enable "Governed agentic app-building". The Build
   screen says so on the app step. Worth confirming it's enabled in the target workspace before a workshop.

## Known gaps

- Session save/resume needs Lakebase (not available locally), so `?s=` resume was verified with a mocked session.
- Plan fidelity is the weakest dimension (participant-stated data sometimes regenerated; occasional invented
  details). The critic pass catches some; more to do.
- No deploy tonight, by your call.
