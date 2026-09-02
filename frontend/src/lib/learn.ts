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
  deeper: string;   // 2-3 sentence go-deeper, plain language
  quiz: LearnQuiz;
  links: LearnLink[];
}

// Keyed by BuildStep.capability ("data", "Genie", "Knowledge Assistant",
// "Lakebase", "Supervisor agent", "Databricks Apps").
export const CONCEPTS: Record<string, ConceptCard> = {
  data: {
    title: "Where your data lives",
    deeper: "Everything you build sits on tables in Unity Catalog — Databricks' governed home for data, so permissions and lineage come for free. In a workshop we generate small, realistic sample tables so you can get to the interesting part fast; you'd swap in real tables later.",
    quiz: {
      q: "Why start from generated sample data in a workshop?",
      options: ["It's the only data Databricks supports", "So you skip data wrangling and get to building, with no setup risk", "Because sample data is more accurate than real data"],
      answer: 1,
      why: "Sample data lets you build the interesting parts immediately; you swap in real tables once the shape works.",
    },
    links: [{ label: "Unity Catalog basics", url: "https://docs.databricks.com/aws/en/data-governance/unity-catalog/", kind: "docs" }],
  },
  Genie: {
    title: "What a Genie space really is",
    deeper: "A Genie space is a semantic layer over your tables — it's what lets someone ask a plain-English question and get a real answer. Creating the space isn't enough: it has to be configured with the tables, how they join, and a couple of example questions, or it looks ready but can't answer anything.",
    quiz: {
      q: "You created a Genie space but it can't answer questions. Most likely why?",
      options: ["Genie is down", "It has no tables/joins/example questions configured yet", "You need to write SQL first"],
      answer: 1,
      why: "An empty space looks created but is useless — it needs tables, joins, and 1-2 example questions to work.",
    },
    links: [{ label: "AI/BI Genie", url: "https://docs.databricks.com/aws/en/genie/", kind: "docs" }],
  },
  "Knowledge Assistant": {
    title: "Answering from documents",
    deeper: "Knowledge Assistant lets your app answer from documents and notes with no embedding pipeline to build — you point it at a text source and it indexes it. Key thing to know: indexing runs in the background and can take several minutes, so kick it off and move on rather than waiting on it.",
    quiz: {
      q: "You point Knowledge Assistant at your docs. What should you expect?",
      options: ["An instant answer right away", "Indexing runs in the background for several minutes before it can answer", "You have to build an embedding pipeline first"],
      answer: 1,
      why: "Indexing is async — kick it off, keep building, and verify answers once it's ready.",
    },
    links: [],
  },
  Lakebase: {
    title: "Where your app remembers things",
    deeper: "Lakebase is managed Postgres sitting right next to your data — it's where your app records what people do (a decision marked, an item flagged) so it sticks between sessions. The app connects with a short-lived token minted per connection, so there's no password to manage.",
    quiz: {
      q: "What is Lakebase doing in your build?",
      options: ["Training a model", "Storing what users do/decide so it persists", "Rendering the app's UI"],
      answer: 1,
      why: "Lakebase is fast Postgres for app state — what you record there sticks.",
    },
    links: [],
  },
  "Supervisor agent": {
    title: "What the agent actually does",
    deeper: "The supervisor agent is a small loop that calls the Foundation Model API and routes each question to the right tool you built — Genie for data, Knowledge Assistant for documents, Lakebase to record something. It's not a heavy framework; the skill is giving each tool a clear description so the agent picks the right one.",
    quiz: {
      q: "What's the supervisor agent's job?",
      options: ["To replace Genie and Knowledge Assistant", "To route each question to the right tool and answer", "To store the data"],
      answer: 1,
      why: "It's a router — it picks the right piece (Genie / KA / Lakebase) for each question and responds.",
    },
    links: [{ label: "Agent framework", url: "https://docs.databricks.com/aws/en/generative-ai/agent-framework/", kind: "docs" }],
  },
  "Databricks Apps": {
    title: "The app people actually open",
    deeper: "Databricks Apps hosts the interface your users open, running in your workspace and already governed. One hard-won truth: a green 'SUCCEEDED' deploy does NOT mean a working app — always open the URL and confirm it renders, and glance at the logs if it doesn't.",
    quiz: {
      q: "Your app deploy shows SUCCEEDED. Are you done?",
      options: ["Yes, SUCCEEDED means it works", "No — open the URL and confirm it actually renders", "No — you must redeploy twice"],
      answer: 1,
      why: "A green deploy isn't a working app; always open it in the browser to confirm it renders.",
    },
    links: [{ label: "Databricks Apps", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/", kind: "docs" }],
  },
};
