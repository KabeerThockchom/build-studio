/* Learning-during-waits content. Build steps run in Genie Code for minutes at a time;
   this fills that wait with something that makes the concept stick (Akil's ask).

   Hybrid content model: hand-curated evergreen concept cards keyed by capability
   (the "what/why" a newcomer wouldn't get from the step alone) + a quick check.
   The step itself already carries idea-specific "concept/verify/teach" from the SA;
   this is the durable background knowledge.

   `links` are curated per concept. Verify / swap for your preferred videos before a
   workshop — a facilitator can tailor these. Kept small and high-confidence. */

export interface LearnQuiz {
  q: string;
  options: string[];
  answer: number;   // index of correct option
  why: string;
}
export interface LearnLink { label: string; url: string; kind: "docs" | "watch"; }
export interface ConceptCard {
  title: string;
  tagline: string;  // one plain line: what this piece IS, for the card face
  deeper: string;   // 2-3 sentence go-deeper, plain language
  demo?: "genie-chat";  // an inline product-style mini-demo to render (visual grounding)
  // A short product walkthrough video. IDs are TODO — see the morning notes for which
  // product lines need capture. When set, the Learn panel renders it; when absent, nothing
  // breaks (concept + demo + quiz carry the learning).
  video?: { id: string; title: string; sub?: string };
  quiz: LearnQuiz;
  links: LearnLink[];
}

// The end-of-Assemble quiz: one question per locked capability, pitched at the same
// difficulty as the post-Shape primer quiz (plausible distractors, a real decision to
// reason through — not leading-the-witness). Answer positions are varied on purpose.
export const FINAL_QUIZ: Record<string, LearnQuiz> = {
  Zerobus: {
    q: "Your store events are landing in the lakehouse a few seconds after they happen, with no Kafka cluster in sight. What's doing that?",
    options: ["Zerobus, which lets producers push events straight into a Delta table with no message bus to run", "A nightly batch job you scheduled", "Genie, which pulls the events in when someone asks a question"],
    answer: 0,
    why: "Zerobus is a direct-write ingest API: producers push events straight into a managed Delta table in near real time, so there's no separate message bus to stand up and run.",
  },
  "SDP medallion": {
    q: "Your raw Zerobus events are messy and you need clean, analytics-ready tables. What does the SDP pipeline do for you?",
    options: ["Nothing; you query the raw events directly and hope they're clean", "Declares bronze → silver → gold transforms once, and the pipeline handles the ordering, retries, and data quality", "Copies the raw table five times under different names"],
    answer: 1,
    why: "Spark Declarative Pipelines let you declare the bronze/silver/gold transforms and the quality rules; the pipeline works out dependencies, incremental updates, and retries so gold stays trustworthy.",
  },
  Genie: {
    q: "Your Genie space keeps using the wrong column when someone asks about revenue. What most likely fixes it?",
    options: ["Give each column a clear description (meaning, units, allowed values) and define revenue as a metric", "Delete the space and create it again", "Switch the app to a different foundation model"],
    answer: 0,
    why: "Genie answers from the setup you give it. Clear column descriptions and defined metrics are what let it pick the right field.",
  },
  Lakebase: {
    q: "Where should the app store the approve / reject decisions people click, and why?",
    options: ["In the main data tables, overwriting the original rows", "Nowhere, recompute them from the raw data every time", "In Lakebase, because it's a fast database for what the app records as people use it"],
    answer: 2,
    why: "What people do as they use the app belongs in Lakebase, the app's live database. Your original tables stay a clean source of truth.",
  },
  "Databricks Apps": {
    q: "Your deploy shows SUCCEEDED, but a colleague sees a blank screen. What do you check first?",
    options: ["Nothing, SUCCEEDED means it works for everyone", "Open the URL yourself and watch the logs; confirm its data calls return real rows", "Redeploy a few more times and hope it clears"],
    answer: 1,
    why: "A green deploy isn't a working app. Open it, watch the logs, and confirm the data calls actually return rows.",
  },
};

// Keyed by BuildStep.capability ("Zerobus", "SDP medallion", "Genie",
// "Lakebase", "Databricks Apps") — the Publix data-engineering-to-app stack.
// Every `video` id below is a verified, real Databricks YouTube video (checked before
// wiring; content updated after speaking with Ashwin).
export const CONCEPTS: Record<string, ConceptCard> = {
  Zerobus: {
    title: "How your events get in",
    tagline: "Stream events straight into the lakehouse, no message bus.",
    deeper: "Zerobus is a direct-write ingest API: whatever produces your events (a register, a sensor, an app) pushes them straight into a governed Delta table, landing in seconds. There's no Kafka cluster to size or run in the middle. You create the table first, grant the producer access, and start streaming; Zerobus never changes your table's shape, so the table stays the source of truth.",
    video: { id: "wrH5wWmFT94", title: "Zerobus: real-time ingest, no message bus",
             sub: "Databricks PMs on pushing events straight into the lakehouse with Zerobus." },
    quiz: {
      q: "What does Zerobus save you compared with a traditional streaming setup?",
      options: ["Nothing; you still run and size a Kafka cluster yourself", "Standing up and operating a separate message bus, since producers push events straight into a Delta table", "The need to have any tables at all"],
      answer: 1,
      why: "Zerobus is a direct-to-lakehouse write API. Producers push events straight into a managed Delta table, so there's no separate message bus to run.",
    },
    links: [{ label: "Zerobus Ingest", url: "https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/zerobus", kind: "docs" }],
  },
  "SDP medallion": {
    title: "How raw events become clean data",
    tagline: "Declare bronze → silver → gold, once.",
    deeper: "Spark Declarative Pipelines (SDP) is how you turn the raw Zerobus events into trustworthy tables. You declare the layers: bronze keeps the raw stream, silver cleans and enriches it, gold is the analytics-ready shape everyone reads. You describe WHAT each table should be and the quality rules it must meet; the pipeline figures out the ordering, runs it incrementally, retries on failure, and keeps it fresh, so you don't hand-write the orchestration.",
    video: { id: "BIxwoO65ylY", title: "Declarative pipelines: bronze to gold",
             sub: "A Databricks walkthrough of a declarative medallion ETL pipeline." },
    quiz: {
      q: "In a bronze/silver/gold pipeline, what is the gold layer for?",
      options: ["The untouched raw events exactly as they landed", "The clean, analytics-ready tables the rest of the app reads", "A backup copy you never query"],
      answer: 1,
      why: "Bronze is the raw landing, silver is cleaned and enriched, and gold is the curated, analytics-ready shape Genie and the app read from.",
    },
    links: [{ label: "Lakeflow Declarative Pipelines", url: "https://docs.databricks.com/aws/en/dlt/", kind: "docs" }],
  },
  Genie: {
    title: "What a Genie space really is",
    tagline: "Ask your gold data questions in plain English.",
    demo: "genie-chat",
    deeper: "A Genie space sits on top of your gold tables and learns what each column means, so someone can ask a plain-English question and get a real answer back. Creating the space isn't enough. It has to be set up with the tables, how they connect, clear column descriptions, and a couple of example questions, or it looks ready but can't answer anything.",
    video: { id: "3_TpRj3z_Gs", title: "What is AI/BI Genie?",
             sub: "How Genie lets business users ask governed data questions in plain English." },
    quiz: {
      q: "You created a Genie space but it can't answer questions. Most likely why?",
      options: ["It has no tables, joins, or example questions set up yet", "Genie is down for everyone", "You have to write the SQL by hand first"],
      answer: 0,
      why: "An empty space looks created but can't do anything. It needs tables, how they join, and a couple of example questions.",
    },
    links: [{ label: "AI/BI Genie", url: "https://docs.databricks.com/aws/en/genie/", kind: "docs" }],
  },
  Lakebase: {
    title: "Where your app remembers things",
    tagline: "A fast place for your app to save what people do.",
    deeper: "Lakebase is a fast Postgres database that sits right next to your data. It's where your app saves what people do, like a decision they marked or an item they flagged, so it sticks between visits. Your gold tables stay a clean source of truth; Lakebase holds what the app itself records. Your app signs in to it automatically, so there's no password to manage.",
    video: { id: "_nMgCvsCcns", title: "The app database: Lakebase",
             sub: "Databricks on the vibe stack: a Lakebase Postgres backend for your app." },
    quiz: {
      q: "What is Lakebase for in your app?",
      options: ["Training a machine learning model", "Drawing the charts on the screen", "Saving what people do, like a decision they made, so it sticks between visits"],
      answer: 2,
      why: "Lakebase is fast Postgres for app state. What you record there sticks, while your gold tables stay the clean source of truth.",
    },
    links: [{ label: "Lakebase", url: "https://docs.databricks.com/aws/en/oltp/", kind: "docs" }],
  },
  "Databricks Apps": {
    title: "The app people actually open",
    tagline: "The interface people open and use.",
    deeper: "Databricks Apps hosts the interface your users open, running in your workspace and already governed. It's the front door onto everything upstream: the gold tables, Genie, and Lakebase. One hard-won truth: a green 'SUCCEEDED' deploy does not mean a working app. Always open the URL and confirm it loads with real data, and glance at the logs if it doesn't.",
    video: { id: "85sbR06ZyKE", title: "Build apps natively on Databricks",
             sub: "A Databricks session on building and deploying data & AI apps on the platform." },
    quiz: {
      q: "Your app deploy shows SUCCEEDED. Are you done?",
      options: ["Yes, SUCCEEDED means it's working", "No, you always have to deploy a second time", "No, open the URL and confirm it loads with real data"],
      answer: 2,
      why: "A green deploy isn't a working app. Always open it in the browser and confirm it loads with real data.",
    },
    links: [{ label: "Databricks Apps", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/", kind: "docs" }],
  },
};
