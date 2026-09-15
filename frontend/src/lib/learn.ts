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
  demo?: "genie-chat" | "agent-routing";  // an inline product-style mini-demo to render (visual grounding)
  // A short product walkthrough video. When set, the module renders it; when absent,
  // nothing renders in its place (concept + demo + quiz + links carry the learning) —
  // no placeholder is shown, since this is customer-facing.
  video?: { id: string; title: string; sub?: string; short?: boolean };
  quiz: LearnQuiz;
  links: LearnLink[];
}

// The end-of-Assemble quiz: one question per locked capability, pitched at the same
// difficulty as the post-Shape primer quiz (plausible distractors, a real decision to
// reason through — not leading-the-witness). Answer positions are varied on purpose.
export const FINAL_QUIZ: Record<string, LearnQuiz> = {
  Genie: {
    q: "Your Genie space keeps using the wrong column when someone asks about revenue. What most likely fixes it?",
    options: ["Give each column a clear description (meaning, units, allowed values) and define revenue as a metric", "Delete the space and create it again", "Switch the app to a different foundation model"],
    answer: 0,
    why: "Genie answers from the setup you give it. Clear column descriptions and defined metrics are what let it pick the right field.",
  },
  "Knowledge Assistant": {
    q: "You point Knowledge Assistant at 200 documents and a demo starts in two minutes. What's the safe move?",
    options: ["Sit and refresh until indexing finishes", "Cut the documents to zero so it indexes instantly", "Kick off indexing, keep building other pieces, and check answers once it's ready"],
    answer: 2,
    why: "Indexing runs in the background for minutes. Start it, keep moving, and verify answers once it's ready rather than blocking on it.",
  },
  "Supervisor agent": {
    q: "A question that should go to Genie gets answered from your documents instead. Most likely cause?",
    options: ["The foundation model is broken", "The tool descriptions aren't distinct enough for it to route by intent", "Lakebase has run out of space"],
    answer: 1,
    why: "The supervisor routes by each tool's description. Vague or overlapping descriptions make it pick the wrong one.",
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

// Keyed by BuildStep.capability ("data", "Genie", "Knowledge Assistant",
// "Lakebase", "Supervisor agent", "Databricks Apps").
export const CONCEPTS: Record<string, ConceptCard> = {
  data: {
    title: "Where your data lives",
    tagline: "Your tables, governed by Unity Catalog.",
    deeper: "Everything you build sits on tables in Unity Catalog, Databricks' governed home for data, so permissions and lineage come for free. In a workshop we generate small, realistic sample tables so you can get to the interesting part fast, then swap in real tables later.",
    quiz: {
      q: "Why start a workshop build on generated sample data?",
      options: ["Sample data is more accurate than a company's real data", "It's the only kind of data Databricks can read", "You skip data wrangling and start building now, then swap in real tables later"],
      answer: 2,
      why: "Sample data lets you build the interesting parts right away. You swap in real tables once the shape works.",
    },
    links: [{ label: "Unity Catalog basics", url: "https://docs.databricks.com/aws/en/data-governance/unity-catalog/", kind: "docs" }],
  },
  Genie: {
    title: "What a Genie space really is",
    tagline: "Ask your data questions in plain English.",
    demo: "genie-chat",
    deeper: "A Genie space sits on top of your tables and learns what each column means, so someone can ask a plain-English question and get a real answer back. Creating the space isn't enough. It has to be set up with the tables, how they connect, and a couple of example questions, or it looks ready but can't answer anything.",
    video: { id: "7eSOvPsSjgU", title: "Building a Genie Agent with Genie Code",
             sub: "How the space you'll build comes together.", short: true },
    quiz: {
      q: "You created a Genie space but it can't answer questions. Most likely why?",
      options: ["It has no tables, joins, or example questions set up yet", "Genie is down for everyone", "You have to write the SQL by hand first"],
      answer: 0,
      why: "An empty space looks created but can't do anything. It needs tables, how they join, and a couple of example questions.",
    },
    links: [{ label: "AI/BI Genie", url: "https://docs.databricks.com/aws/en/genie/", kind: "docs" }],
  },
  "Knowledge Assistant": {
    title: "Answering from documents",
    tagline: "Answers from your documents and notes.",
    deeper: "Knowledge Assistant lets your app answer from documents and notes with no embedding pipeline to build. You point it at a text source and it indexes it. One thing to know: indexing runs in the background and can take several minutes, so kick it off and move on rather than waiting on it.",
    quiz: {
      q: "You point Knowledge Assistant at your documents. What should you expect?",
      options: ["It answers the moment you point it at them", "It indexes them in the background for a few minutes before it can answer well", "You have to build an embedding pipeline yourself first"],
      answer: 1,
      why: "Indexing runs in the background. Kick it off, keep building, and check answers once it's ready.",
    },
    links: [],
  },
  Lakebase: {
    title: "Where your app remembers things",
    tagline: "A fast place for your app to save what people do.",
    deeper: "Lakebase is a fast database that sits right next to your data. It's where your app saves what people do, like a decision they marked or an item they flagged, so it sticks between visits. Your app signs in to it automatically, so there's no password to manage.",
    video: { id: "ed2WJ5YayQ4", title: "What is Lakebase",
             sub: "The fast database your app writes to.", short: true },
    quiz: {
      q: "What is Lakebase for in your app?",
      options: ["Training a machine learning model", "Drawing the charts on the screen", "Saving what people do, like a decision they made, so it sticks between visits"],
      answer: 2,
      why: "Lakebase is fast Postgres for app state. What you record there sticks.",
    },
    links: [{ label: "Lakebase (Postgres projects)", url: "https://learn.microsoft.com/en-us/azure/databricks/oltp/projects/", kind: "docs" }],
  },
  "Supervisor agent": {
    title: "What the agent actually does",
    tagline: "One place to ask; it routes to the right piece.",
    demo: "agent-routing",
    deeper: "The supervisor is the reasoning layer behind your app's ask box: a language model that reads a plain question, decides which piece can answer it, calls that piece, and replies. Why it's there: so the person asks in one place instead of having to pick the right tool themselves. In your app that means a single question like \"which stores are slipping, and mark store 4 as handled\" can pull the numbers from Genie and save the decision to Lakebase in one turn. It's tool-calling, not a heavy framework, and the skill is giving each tool a clear, distinct description so it routes by intent without guessing.",
    quiz: {
      q: "What is the supervisor agent's job?",
      options: ["Picking the right tool for each question and replying", "Replacing Genie and Lakebase entirely", "Storing the app's data"],
      answer: 0,
      why: "It's a router. A model reads the question and picks the right piece (Genie, Lakebase, or another tool) for each one, then responds.",
    },
    links: [{ label: "What is an AI agent?", url: "https://docs.databricks.com/aws/en/getting-started/gen-ai-llm-agent", kind: "docs" }],
  },
  "Databricks Apps": {
    title: "The app people actually open",
    tagline: "The interface people open and use.",
    deeper: "Databricks Apps hosts the interface your users open, running in your workspace and already governed. One hard-won truth: a green 'SUCCEEDED' deploy does not mean a working app. Always open the URL and confirm it loads, and glance at the logs if it doesn't.",
    video: { id: "_nMgCvsCcns", title: "Vibe-coding an AI app",
             sub: "The idea behind what you're about to build.", short: true },
    quiz: {
      q: "Your app deploy shows SUCCEEDED. Are you done?",
      options: ["Yes, SUCCEEDED means it's working", "No, you always have to deploy a second time", "No, open the URL and confirm it loads with real data"],
      answer: 2,
      why: "A green deploy isn't a working app. Always open it in the browser and confirm it loads with real data.",
    },
    links: [{ label: "Databricks Apps", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/", kind: "docs" }],
  },
};
