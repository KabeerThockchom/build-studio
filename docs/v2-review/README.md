# Build Studio v2 · morning review

Branch `build-studio-v2`, 14 local commits, **not pushed, not deployed**. To run it:

```
cd ~/Documents/v2v-studio && git checkout build-studio-v2
DATABRICKS_PROFILE=build-studio python3 -m uvicorn app:app --port 8000 --reload --reload-dir server
# open http://localhost:8000   (the frontend is prebuilt into frontend/dist)
```

- `screens/`: every step for both test ideas, `costa-` (store food waste) and `aa-` (American Airlines crew timeouts). `before/` holds the pre-polish versions.
- `design-notes.md`: what the design pass changed and why.

## The journey

```
Overview → Sit-Down → Learn → Plan → Build
           your SA and     only the pieces    drafted in the      Genie Code for everything,
           colleagues      your build uses,   background while    Genie App Builder for the app
                           then a quick check you learn
```

The left rail is back and accurate at every step, including inside the Sit-Down. Its sub-steps follow the conversation: Sharpen the idea (N of 7 covered), Ways to build it, Fit it in a day, Your plan.

## What's new

- **No prescribed architecture.** Each build uses whichever of five components its Sit-Down scope needs:
  - Declarative Pipelines (medallion)
  - Genie
  - AI/BI Dashboards
  - Lakebase
  - Databricks Apps

  There's no Supervisor agent and no Knowledge Assistant. One catalog (`server/components.py`) drives all of it: the Sit-Down's building blocks, the architecture diagram, which Learn modules appear, the plan and the build steps. Rules in code keep each build coherent:
  - The data foundation always ships.
  - Every build ships a surface people use. The surface is picked from the build's shape: monitor → dashboard, ask or explore → Genie, review or act → app.
  - Lakebase always comes with an app that writes to it.
  - The build plan can't add a step for a component the build doesn't use.
- **The Sit-Down is ported to React** and matches `/sitdown3`, which is untouched for comparison.
  - Colleagues adapt to any industry. Their roles, the currency and the company come from the idea, generated in the background so there's no wait. The drawings keep fixed names; Priya is now Arjun.
  - Options are concrete answers, with realistic ranges for numbers.
  - The ring grade averages all seven sections, so it starts low and climbs.
  - Scope packages are sized for v2 builds. Lean is usually Comfortable, and nothing comes back "Won't fit today" any more.
- **Learn is dynamic.** It starts with a reveal of *your* architecture, each piece with its job in your build. Then comes one module per piece (three short points plus a small product visual), and a quick check that gives instant feedback and a small celebration at the end.
- **Plan is a three-pass background job.** It drafts the PRD from the whole Sit-Down, then a critic checks it against what the participant actually said, then it fixes what the critic found. The critic also checks:
  - grain and keys
  - time-based metrics on static data
  - Lakebase reads
  - pieces outside the build

  The job starts at "Let's build it". The screen shows the diagram first, Today/Stretch/Later chips, an outlined PRD, decision cards with their tradeoffs, and a refine bar with a "What changed" note when a refine lands.
- **Build:** each step shows a badge saying where you do it.
  - **Genie Code** builds the data, pipelines, Genie, dashboards and Lakebase.
  - **Genie App Builder** builds the app. The step walks through Apps, then the Build tab, then the App Space; notes that App Builder is in Beta; gives the prompt to paste, which describes the screens, the data read and what each action writes; and adds tips for iterating.

  PROJECT.md says the same, so Genie Code stops at the app step instead of hand-building an app. The end of Build has a "You built it" screen.

## How it was tested

| Eval | Measures | Result |
|---|---|---|
| Conversation eval: 16 simulated participants across 8 personas and 11 ideas (including American Airlines), blind Opus judge | question quality, responsiveness, context, momentum, engagement, persona fit, brief fidelity | 6.19 → 6.62 over the Sit-Down rounds; the v2 agent scored **6.38** (within the run-to-run noise). 16/16 reached the plan, all 7 sections covered, 0 errors |
| Plan eval: those finished Sit-Downs pushed through handoff → plan job → build plan, blind judge | fidelity, architecture, buildable today, Genie Code moves, App Builder prompt, clarity | 5.89 → 6.30 → 6.00 → **6.20**; architecture 2.89 → 3.40; deterministic checks **70/70**, 0 errors |
| Unit tests | catalog, packages, handoff, cast, normalisation, step guard | **45 passing**, plus 28 frontend tests, typecheck and a production build |
| Browser end to end (React, Chromium, 1440 to 1200 wide) | the full journey for both ideas, rail accuracy, Sit-Down parity, plan job states, App Builder step | both ideas complete Overview → Build with no page errors |

## Changes in this iteration (Build Studio v2 polish)

1. **First load and Sit-Down tour improvements:** A calm waiting state ("Your SA is reading your idea") appears during the first API call before any text streams, so the tour never shows an empty page. The tour starts with the first words and Next is enabled once text streaming ends, not blocked by card rendering delays.

2. **Learn videos restored:** Walkthrough videos embedded on matching modules as YouTube iframes (privacy-friendly nocookie domain):
   - Genie: "Building a Genie Agent with Genie Code" (7eSOvPsSjgU)
   - Lakebase: "What is Lakebase" (ed2WJ5YayQ4)
   - Databricks Apps: "Vibe-coding an AI app" (_nMgCvsCcns)
   - Declarative Pipelines and AI/BI Dashboards have no verified videos yet (marked with TODO).

3. **Five-question quiz tailored to the build:** The quick check always shows exactly 5 questions: one headline question per component first, then general "how the pieces fit together" questions, then each piece's bonus questions to fill to 5. No repeats within a session.

4. **One architecture source of truth:** Learn and Plan both render `studio.spec`, computed server-side and passed in the Sit-Down handoff. Fall back to client-side compute only for old saved sessions without it.

5. **Plan refine can change components:** When a refine job completes with a blueprint that has `refine_note`, the studio state adopts the blueprint's new `capabilities` and `spec`. Added and removed pieces display as green and muted chips next to the change note. The diagram and all downstream steps use the updated component list.

6. **Gamification foundations:** The Sit-Down's grade system already animates dot fills when sections improve (staggered per dot, with fill animations) and shows a ring flash + slight grow when the overall letter advances. These animations use prefers-reduced-motion to respect accessibility.

## Decisions for you

1. **Generic ideas default to the workshop host.** If an idea names no company, the colleagues and context assume Costa (UK, £). That's right for a Costa workshop, but the judge flags it as invented on generic test ideas. Keep it, or make the host a facilitator setting that can be left blank?
2. **The grade journey starts at F.** The ceremony reads "F → C-" or similar, because the first letter is taken with only one section covered.
   - Keep it: the climb is the story.
   - Start from the grade after turn 2.
   - Show "1 of 7 covered → 7 of 7" instead of a starting letter.
3. **"Let's build it" is below the fold on the ceremony** (`costa-06`). Pin it as a sticky primary button, as the Plan does with "Looks good, let's build"?
4. **Concrete range cards or an open question.** You chose concrete ranges because they're faster. The cost is that a card-clicker accepts our assumed numbers. Keep that, or bring back one open question just for the success target?
5. **Genie Code prompts are always visible** in Build, which makes copy-paste the easy path. The old design hid them to encourage people to write their own.
   - Keep them visible.
   - Collapse them behind "Show an example".
   - Keep them visible, with a nudge to reword.
6. **Plan length.** The full PRD is long, even with the outline. Keep it all inline, or show Summary, First screen, Scope and Success measure, with the rest expandable?
7. **Plan generation time.** The three passes take about 2.5 minutes in the background. Learn usually covers it; someone who rushes Learn sees the live "Drafting, Checking, Tightening" state. Keep the critic pass, or trade it for speed?
8. **Characters outside the Sit-Down.** They currently appear on the Overview and the Build finish. Keep that, or also add a "who weighed in" strip to the Plan?

## Known gaps

- **Plan quality has levelled off around 6.2/10.** The remaining critiques are about data-modelling depth: per-user scoping, invented "ordered" quantities where no order data exists, metric definitions. The critic catches some of these. Further gains likely need a short data-modelling step in the Sit-Down, or a schema sketch in the plan.
- **Resume isn't tested end to end.** Session save and resume need Lakebase, which isn't available locally, so `?s=` resume was checked with a mocked session only.
- **Background jobs live in server memory.** A restart loses a running plan job. The app restarts it once automatically. That's fine for a single-instance workshop app, but persist the jobs before scaling out.
- **Genie App Builder is in Beta.** A workspace admin has to enable "Governed agentic app-building" under Previews. Confirm that in the target workspace before running a workshop.
- **Not deployed**, as you asked.
