/* Learn content for the five components a build can use. Learn is dynamic: a build only
   teaches the components its Sit-Down scope actually needs, in the order given, followed by
   a quick check with one question per component.

   Each card: what the piece is (tagline), a plain go-deeper, a quiz with plausible
   distractors (answer positions vary on purpose) and one or two docs links. How the piece is
   used in THIS build comes from the Sit-Down handoff (plan.capabilities[].fits).

   Publix customization: the data-engineering-to-app stack uses Zerobus for streaming ingest,
   SDP medallion for bronze/silver/gold shaping, then Genie, Lakebase, and Apps. */
import { ZEROBUS, SDP_MEDALLION, PIPELINES, GENIE, LAKEBASE, APPS, COMPONENT_ORDER } from "./constants";

export interface LearnQuiz {
  q: string;
  options: string[];
  answer: number;   // index of the correct option
  why: string;
}
export interface LearnLink { label: string; url: string; kind: "docs" | "watch"; }
export interface ConceptCard {
  title: string;
  short: string;    // short label for the rail
  tagline: string;  // one plain line: what this piece IS
  deeper: string;   // 2-3 sentences, plain language
  demo?: "genie-chat" | "medallion" | "app-builder" | "decision-log";
  // A short verified YouTube walkthrough (rendered with VideoEmbed). Leave unset rather
  // than guess an id: a missing video renders nothing.
  video?: { id: string; title: string; sub?: string; short?: boolean };
  quiz: LearnQuiz;       // the headline question for this piece
  more: LearnQuiz[];     // extra questions, used to fill the 5-question quick check
  links: LearnLink[];
}

export const CONCEPTS: Record<string, ConceptCard> = {
  [ZEROBUS]: {
    title: "Zerobus",
    short: "Zerobus",
    tagline: "Stream events straight into the lakehouse, no message bus.",
    deeper:
      "Zerobus is a direct-write ingest API: whatever produces your events (a register, a sensor, an app) pushes them straight into a governed Delta table, landing in seconds. " +
      "There's no Kafka cluster to size or run in the middle. You create the table first, grant the producer access, and start streaming; Zerobus never changes your table's shape, so the table stays the source of truth.",
    video: { id: "wrH5wWmFT94", title: "Zerobus: real-time ingest, no message bus", sub: "Databricks PMs on pushing events straight into the lakehouse with Zerobus." },
    quiz: {
      q: "What does Zerobus save you compared with a traditional streaming setup?",
      options: [
        "Nothing; you still run and size a Kafka cluster yourself",
        "Standing up and operating a separate message bus, since producers push events straight into a Delta table",
        "The need to have any tables at all",
      ],
      answer: 1,
      why: "Zerobus is a direct-to-lakehouse write API. Producers push events straight into a managed Delta table, so there's no separate message bus to run.",
    },
    more: [
      { q: "Your store events are landing in the lakehouse a few seconds after they happen, with no Kafka cluster in sight. What's doing that?",
        options: ["Zerobus, which lets producers push events straight into a Delta table with no message bus to run", "A nightly batch job you scheduled", "Genie, which pulls the events in when someone asks a question"],
        answer: 0, why: "Zerobus is a direct-write ingest API: producers push events straight into a managed Delta table in near real time, so there's no separate message bus to stand up and run." },
      { q: "You want to use Zerobus but your producer sends data in a format your table doesn't match. What do you do?",
        options: ["Change the format at the producer (before it reaches Zerobus)", "Change the table schema in Zerobus", "Zerobus handles the conversion automatically"],
        answer: 0, why: "Zerobus writes exactly what the producer sends. If the format doesn't match the table, the producer has to send it in a shape the table accepts." },
    ],
    links: [{ label: "Zerobus Ingest", url: "https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/zerobus", kind: "docs" }],
  },
  [SDP_MEDALLION]: {
    title: "SDP Medallion",
    short: "SDP medallion",
    tagline: "Declare bronze → silver → gold, once.",
    deeper:
      "Spark Declarative Pipelines (SDP) is how you turn the raw Zerobus events into trustworthy tables. " +
      "You declare the layers: bronze keeps the raw stream, silver cleans and enriches it, gold is the analytics-ready shape everyone reads. " +
      "You describe WHAT each table should be and the quality rules it must meet; the pipeline figures out the ordering, runs it incrementally, retries on failure, and keeps it fresh, so you don't hand-write the orchestration.",
    demo: "medallion",
    video: { id: "BIxwoO65ylY", title: "Declarative pipelines: bronze to gold", sub: "A Databricks walkthrough of a declarative medallion ETL pipeline." },
    quiz: {
      q: "In a bronze/silver/gold pipeline, what is the gold layer for?",
      options: [
        "The untouched raw events exactly as they landed",
        "The clean, analytics-ready tables the rest of the app reads",
        "A backup copy you never query",
      ],
      answer: 1,
      why: "Bronze is the raw landing, silver is cleaned and enriched, and gold is the curated, analytics-ready shape Genie and the app read from.",
    },
    more: [
      { q: "Your raw Zerobus events are messy and you need clean, analytics-ready tables. What does the SDP pipeline do for you?",
        options: ["Nothing; you query the raw events directly and hope they're clean", "Declares bronze → silver → gold transforms once, and the pipeline handles the ordering, retries, and data quality", "Copies the raw table five times under different names"],
        answer: 1, why: "Spark Declarative Pipelines let you declare the bronze/silver/gold transforms and the quality rules; the pipeline works out dependencies, incremental updates, and retries so gold stays trustworthy." },
      { q: "You change a scoring rule in the pipeline. What happens to the gold table?",
        options: ["Nothing until someone rebuilds it by hand", "It's deleted and you start again", "The pipeline refreshes it with the new rule, and everything downstream reads the update"],
        answer: 2, why: "Declarative Pipelines manage the refresh for you. Change the rule, run the pipeline, and every reader sees the same new answer." },
    ],
    links: [
      { label: "Lakeflow Declarative Pipelines", url: "https://docs.databricks.com/aws/en/dlt/", kind: "docs" },
      { label: "The medallion architecture", url: "https://docs.databricks.com/aws/en/lakehouse/medallion", kind: "docs" },
    ],
  },
  [PIPELINES]: {
    title: "Declarative Pipelines",
    short: "Declarative Pipelines",
    tagline: "Turn raw data into clean, ready-to-use tables, one layer at a time.",
    deeper:
      "With Lakeflow Declarative Pipelines you describe what each table should contain and Databricks works out how to build and refresh it. " +
      "Data moves through layers: bronze keeps it as it arrived, silver cleans and joins it, and gold is shaped for the people and tools that use it. " +
      "Any rule your build needs, like scoring, flagging or ranking items, lives in the gold layer so everything reads the same answer.",
    demo: "medallion",
    // TODO(facilitator): no verified walkthrough video for Declarative Pipelines yet. Add one here when chosen.
    quiz: {
      q: "Your build needs a ranked list of items to act on each morning. Where should the ranking rule live?",
      options: [
        "In the gold layer of the pipeline, so every tool reads the same ranked table",
        "Inside the app, recalculated each time someone opens a screen",
        "In the bronze layer, next to the raw data as it arrived",
      ],
      answer: 0,
      why: "Gold is the shared, ready-to-use layer. Put the rule there and Genie and the app see the same ranking.",
    },
    more: [
      { q: "Your source data has duplicate rows and missing values. Which layer cleans that up?",
        options: ["Bronze, so the raw copy is already clean", "Silver, where data is cleaned and joined", "Gold, right before people read it"],
        answer: 1, why: "Bronze keeps exactly what arrived so you can always re-run. Silver is where cleaning and joining happen, so gold starts from data you can trust." },
      { q: "You change a scoring rule in the pipeline. What happens to the gold table?",
        options: ["Nothing until someone rebuilds it by hand", "It's deleted and you start again", "The pipeline refreshes it with the new rule, and everything downstream reads the update"],
        answer: 2, why: "Declarative Pipelines manage the refresh for you. Change the rule, run the pipeline, and every reader sees the same new answer." },
    ],
    links: [
      { label: "Declarative Pipelines docs", url: "https://docs.databricks.com/aws/en/dlt/", kind: "docs" },
      { label: "The medallion architecture", url: "https://docs.databricks.com/aws/en/lakehouse/medallion", kind: "docs" },
    ],
  },
  [GENIE]: {
    title: "Genie",
    short: "Genie",
    tagline: "Ask your data questions in plain English and get a real answer.",
    deeper:
      "A Genie space sits on top of your gold tables. People type a question the way they would ask a colleague, and Genie writes the query, runs it and shows the answer. " +
      "You teach it your vocabulary with instructions and example questions, so it picks the right column every time.",
    demo: "genie-chat",
    video: { id: "7eSOvPsSjgU", title: "Building a Genie Agent with Genie Code", sub: "How the space you'll build comes together.", short: true },
    quiz: {
      q: "Your Genie space keeps using the wrong column when someone asks about a key term. What most likely fixes it?",
      options: [
        "Ask the same question again with more words",
        "Add an instruction or example question to the space that defines the term",
        "Give everyone admin access to the underlying tables",
      ],
      answer: 1,
      why: "Genie learns your terms from the instructions and example questions on the space. Define it once and it is fixed for everyone.",
    },
    more: [
      { q: "Which tables should your Genie space point at?",
        options: ["The gold tables your pipeline builds", "The raw bronze tables, so nothing is hidden", "Every table in the catalog, to be safe"],
        answer: 0, why: "Gold tables are clean and shaped for questions. Pointing Genie at raw or unrelated tables makes its answers slower and less reliable." },
      { q: "Genie answers one question wrongly. What's the most useful next step?",
        options: ["Delete the space and start again", "Tell people to stop using Genie for now", "Add that question as an example with the right answer"],
        answer: 2, why: "Example questions with the right answer teach the space. Each one you add makes the next similar question come out right." },
    ],
    links: [{ label: "Genie docs", url: "https://docs.databricks.com/aws/en/genie/", kind: "docs" }],
  },
  [LAKEBASE]: {
    title: "Lakebase",
    short: "Lakebase",
    tagline: "A Postgres database that records what people decide.",
    demo: "decision-log",
    deeper:
      "Analytics tables are great for reading lots of history, but an app also needs to save small things the moment they happen: an approval, a change, a note. " +
      "Lakebase is a managed Postgres database inside your Databricks workspace for exactly that, governed alongside the rest of your data.",
    video: { id: "ed2WJ5YayQ4", title: "What is Lakebase", sub: "The fast database your app writes to.", short: true },
    quiz: {
      q: "Someone approves a suggestion in your app. Where should that decision be saved?",
      options: [
        "Back into the gold table the pipeline builds",
        "As a new row in a Lakebase table",
        "In the browser, so it loads faster next time",
      ],
      answer: 1,
      why: "Pipelines rebuild gold tables from the source, so a write there would be overwritten. Lakebase is where the app records what people do.",
    },
    more: [
      { q: "A manager wants a list of every decision made this week. Where does it come from?",
        options: ["The app's browser history", "The Genie space's chat log", "The Lakebase table the app writes each decision to"],
        answer: 2, why: "Every approve or change is a row in Lakebase, so you can list them, report on them, and later feed them back into the pipeline." },
      { q: "Why does the app show saved decisions back in its list?",
        options: ["So people can see what's been handled and nothing gets done twice", "Because Lakebase deletes rows nobody looks at", "It doesn't need to; saving is enough"],
        answer: 0, why: "Closing the loop is what makes the app trustworthy: you act, it records it, and the list shows it was handled." },
    ],
    links: [{ label: "Lakebase docs", url: "https://docs.databricks.com/aws/en/oltp/", kind: "docs" }],
  },
  [APPS]: {
    title: "Databricks Apps",
    short: "Databricks Apps",
    tagline: "The screen people open, built with Genie App Builder.",
    deeper:
      "A Databricks App is a web app that runs inside your workspace, so it uses the same sign-in and the same governed data. " +
      "In this build you create it with Genie App Builder: open Apps, go to the Build tab, pick an App Space and describe the screens in plain language. " +
      "It builds the app with AppKit and you refine it in short cycles. Genie App Builder is in Beta, so the preview needs to be turned on in your workspace.",
    demo: "app-builder",
    video: { id: "_nMgCvsCcns", title: "Vibe-coding an AI app", sub: "The idea behind what you're about to build.", short: true },
    quiz: {
      q: "How will you create the app screen in this build?",
      options: [
        "Write the React and Python code by hand in Genie Code",
        "Ask Genie to turn its answers into an app",
        "Describe the screens to Genie App Builder from the Apps Build tab",
      ],
      answer: 2,
      why: "Genie App Builder turns a plain-language description of your screens into a working app in an App Space. You iterate by asking for one change at a time.",
    },
    more: [
      { q: "Your first prompt in Genie App Builder got close but not right. What next?",
        options: ["Rewrite the whole prompt and start over", "Ask for one specific change, check it, then the next", "Accept it as is and refine it another day"],
        answer: 1, why: "Short cycles work best. One clear change at a time keeps what works and fixes what doesn't." },
      { q: "Where does the app get the list on its first screen?",
        options: ["Numbers typed into the prompt", "A file uploaded to the app", "The gold table your pipeline builds"],
        answer: 2, why: "The app reads the same governed gold table everything else reads, so its list stays current and matches what Genie says." },
    ],
    links: [
      { label: "Databricks Apps docs", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/", kind: "docs" },
      { label: "Genie App Builder docs", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/genie-app-builder", kind: "docs" },
    ],
  },
};

// General questions about how the pieces fit together, used after every component is covered.
export const GENERAL_QUIZ: LearnQuiz[] = [
  { q: "Why do Genie and the app both read the gold tables?",
    options: ["Gold tables are the only ones they're allowed to open", "So everyone sees the same cleaned answer, from one place", "Gold tables are the cheapest to store"],
    answer: 1, why: "One shared, cleaned source means a number on an app screen and an answer from Genie always agree." },
  { q: "Your build runs on generated data today. What changes when you move to real data?",
    options: ["You point the pipeline at the real tables; everything else keeps reading gold", "You rebuild every piece from scratch", "Nothing can change once it's built"],
    answer: 0, why: "The pipeline is the only piece that touches the source. Swap its input and everything downstream keeps working." },
  { q: "What is Genie App Builder for in this build?",
    options: ["Training a model on your data", "Writing the pipeline's cleaning rules", "Turning a plain-language description of your screens into a working app"],
    answer: 2, why: "Genie Code builds the data pieces; Genie App Builder builds the screen people open, from a description of what it should show and do." },
];

export interface QuizItem extends LearnQuiz { cap: string | null; }
// The quick check: always 5 questions, tailored to the build. Every component in the build is
// covered first (its headline question), then the general ones, then each piece's extras.
export function quizFor(capabilities: string[], n = 5): QuizItem[] {
  const caps = learnComponents(capabilities);
  const out: QuizItem[] = caps.map((c) => ({ cap: c, ...CONCEPTS[c].quiz }));
  for (const g of GENERAL_QUIZ) if (out.length < n) out.push({ cap: null, ...g });
  for (let round = 0; out.length < n && round < 3; round++)
    for (const c of caps) if (out.length < n && CONCEPTS[c].more[round]) out.push({ cap: c, ...CONCEPTS[c].more[round] });
  return out.slice(0, n);
}

// The components a build teaches, in the order given, limited to ones we have content for.
// Publix: includes Zerobus and SDP medallion in the default stack.
export function learnComponents(capabilities: string[]): string[] {
  const known = (capabilities || []).filter((c) => CONCEPTS[c]);
  return known.length ? known : COMPONENT_ORDER.filter((c) => c === ZEROBUS || c === SDP_MEDALLION || c === GENIE);
}

// Learn beats: 0 = the architecture overview, 1..n = one per component, n+1 = the quick check.
export const learnBeatCount = (capabilities: string[]) => learnComponents(capabilities).length + 2;
