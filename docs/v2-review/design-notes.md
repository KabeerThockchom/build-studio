# Build Studio v2: design QA and polish

Screens are at 1440x900 for both ideas, `costa-` (store food waste) and `aa-` (American Airlines crew timeouts).
`before/` was captured on commit `23a031a`; `screens/` is after this pass. Same names in both folders:
`01-overview`, `02-sitdown-first`, `03-sitdown-stakeholder`, `04-shapes`, `05-scope`, `06-ceremony`,
`07-learn-arch`, `08-learn-module`, `09-quiz`, `10-plan-drafting`, `11-plan`, `12-build-genie-code`,
`13-build-app-builder` (13 exists only in `screens/`; the before run stopped there).

## What I found

The Sit-Down set a clear bar: DM Sans with four sizes (titles 27/600, voice 18, body 15, labels 12/500 sentence case),
12px radii, quiet borders, one accent system, and one obvious next action per moment. Learn, Plan and Build were built
from the older app and didn't match:

- **Type and labels:** uppercase, letter-spaced eyebrows and 800-weight 32px titles. It read as a second product next to the Sit-Down and the rail.
- **Learn architecture (`07`):** a static diagram plus a 2-column grid of uneven cards. Nothing said "this is *your* build", and the Next button didn't say where it led.
- **Learn modules (`08`):** a paragraph wall. The "in your build" line sat beneath it.
- **Quiz (`09`):** worked, but nothing happened when you finished.
- **Plan (`11`):**
  - Section headers in caps.
  - Scope was long sentences in two boxes.
  - The flow strip overflowed and clipped on the right.
  - The PRD had no outline.
  - Decisions were a dense table.
  - The primary button was at the very bottom.
- **Plan drafting (`10`):** three stages, but static and generic.
- **Build (`12`):**
  - Four stacked boxes before the action.
  - The prompt was hidden behind "I need help prompting".
  - Truncated step pills duplicated the rail.
  - "Done when" was a button, not a check.
- **Ceremony lanes (`06`):** three narrow columns wrapped one or two words per line.
- **Bug: blue square around the grade ring (`06`).** The Sit-Down's ring element is class `ring`, which is also a Tailwind utility (a blue focus ring), so it collided. It's renamed `sdring`.
- **Orphan styles:** the retired teaching loader's styles (`tl-*`, `prose-tight`, `pulse-border`) and `GeneratingPanel` were still in the code. All removed.

## What changed, and why

- **One design language** (`components/ui.tsx`): `Label`, `Title`, `Lead` and `Card`, plus `ToolBadge`, `Primary`, `Go` and `Quiet`, all on the Sit-Down's scale. Labels are sentence case, titles are 28/600, every card uses the same 12px radius, the colours are the grade colours plus green for "just changed", and there's one teal for Genie App Builder.
- **Rail:** group headers are sentence case with a small numbered disc. The current group's disc is navy, so the rail and the main area read as one product.
- **Overview (`01`):**
  - A short promise: "Bring an idea. Leave with something real."
  - Four stage cards, with "You start here" on the first.
  - A row of the six colleagues (same animated art as the Sit-Down) with "their roles adapt to your idea".
  - One green primary, "Pull up a chair".
- **Learn:**
  - **Architecture (`07`):** a reveal. The diagram draws in band by band, then each of *their* pieces slides in with its band chip and "In your build: …" line (from the Sit-Down `fits`).
  - **Primary label:** it names where it goes ("Start with Declarative Pipelines").
  - **Progress:** a segmented bar mirrors the rail.
- **Learn modules (`08`):**
  - Header: band chip, title and tagline.
  - A green "Its job in your build" card first.
  - "How it works" as three numbered short points, split from the old paragraph.
  - A small product-style visual: Genie chat, medallion layers, a dashboard, or the App Builder Build tab.
  - Docs links as chips.
- **Quiz (`09`):** "1 of 3" counters, instant Right / Not quite feedback with the reason, and a short confetti burst plus "All right first time. You're ready." once every question is answered.
- **Plan (`11`, `10`):**
  - **Drafting:** the three named stages say what each one does. The live one has a moving bar, there's a seconds-elapsed counter, and a skeleton of what's coming sits below.
  - **Diagram:** it comes first, prominent and drawn in, with the user flow as a chip row underneath (no more clipping).
  - **Scope:** Today / Stretch / Later as coloured chip rows, taken from the Sit-Down lanes.
  - **PRD:** typeset like a document, with a sticky outline that jumps to each section.
  - **App screens and decisions:** app screens as cards, and decisions as cards that show the component and its tradeoff.
  - **Refine:** a chat-bar style refine with suggestion chips. When a refine lands, "What changed" appears at the top and the page scrolls to it.
  - **Primary:** a sticky "Looks good, let's build".
- **Build (`12`, `13`):**
  - **Overview:** "Set up once" and the step list, each step with its tool badge.
  - **Steps:** each one leads with a Genie Code (green) or Genie App Builder (teal) badge, then "Do it in …" as numbered mini-steps.
  - **The move:** it's always visible in a copy box (code font for Genie Code, prose for the app prompt).
  - **Done when:** a checkbox. Ticking it completes the step and moves on.
  - **Progress:** a segmented bar with "n done".
  - **App Builder step:** Apps, then the Build tab, then App Space; a Beta note; the prompt; and the iterate tips.
  - **The finish:** confetti, "You built it.", three cheering colleagues, a list of what was built with tool badges, and where to go next.
- **Ceremony lanes (`06`):** now chip rows in one card, matching the Plan's scope chips.

## Decisions for you

1. **The journey's start grade (ceremony, `06`).** Grading across all seven sections means the first letter is taken when one section is covered, so every run starts at F (shown in red).
   - **(a)** Keep it; the climb is the story.
   - **(b)** Start from the grade after turn 2.
   - **(c)** Show "started at 1 of 7 covered" instead of a letter.
2. **Characters outside the Sit-Down.** They appear on the Overview (all six) and at Build complete (three).
   - **(a)** Keep both.
   - **(b)** Overview only.
   - **(c)** Also add a small "who weighed in" strip to the Plan header, so the plan feels co-authored.
3. **The Genie Code move: copy-paste versus own words.** The move is now always visible, which makes copy-paste the easy path. The old design hid it to encourage writing your own prompt.
   - **(a)** Visible, as now.
   - **(b)** Collapsed with "Show an example".
   - **(c)** Visible, plus a one-line nudge to reword it.
4. **Plan length.** The full PRD is long, even with the outline.
   - **(a)** Keep the full PRD inline.
   - **(b)** Show Summary, First screen, Scope and Success measure, with "Read the full PRD" expanding the rest.
5. **Proctor console button.** For admins it floats top-right on every non-Sit-Down screen and overlaps headers at narrow widths.
   - **(a)** Move it into the rail footer.
   - **(b)** Keep it.

## Backend notes (not changed here)

- The airline run's handoff gave Databricks Apps a `fits` line saying "Not used today; dashboard is the main interface", even though Apps was in `capabilities` (see `before/aa-07-learn-arch.png`). `to_studio` should never emit a negative `fits` for a component that is in the build.
- Scope sizing after `eb64452` is fixed: nothing comes back "Won't fit today" any more. The waste idea gave Lean Comfortable, Recommended Tight, Bold Tight in every run. The airline idea gave Lean Comfortable twice and Lean Tight once (Recommended and Bold Tight each time). Before that commit, the airline idea came back "Won't fit today" for all three.
