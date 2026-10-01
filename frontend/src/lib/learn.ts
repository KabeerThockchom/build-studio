/* Learn content for the five components a build can use. Learn is dynamic: a build only
   teaches the components its Sit-Down scope actually needs, in the order given, followed by
   a quick check with one question per component.

   Each card: what the piece is (tagline), a plain go-deeper, a quiz with plausible
   distractors (answer positions vary on purpose) and one or two docs links. How the piece is
   used in THIS build comes from the Sit-Down handoff (plan.capabilities[].fits). */
import { PIPELINES, GENIE, DASHBOARDS, LAKEBASE, APPS, COMPONENT_ORDER } from "./constants";

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
  demo?: "genie-chat" | "medallion" | "app-builder";
  quiz: LearnQuiz;
  links: LearnLink[];
}

export const CONCEPTS: Record<string, ConceptCard> = {
  [PIPELINES]: {
    title: "Declarative Pipelines",
    short: "Declarative Pipelines",
    tagline: "Turn raw data into clean, ready-to-use tables, one layer at a time.",
    deeper:
      "With Lakeflow Declarative Pipelines you describe what each table should contain and Databricks works out how to build and refresh it. " +
      "Data moves through layers: bronze keeps it as it arrived, silver cleans and joins it, and gold is shaped for the people and tools that use it. " +
      "Any rule your build needs, like scoring, flagging or ranking items, lives in the gold layer so everything reads the same answer.",
    demo: "medallion",
    quiz: {
      q: "Your build needs a ranked list of items to act on each morning. Where should the ranking rule live?",
      options: [
        "In the gold layer of the pipeline, so every tool reads the same ranked table",
        "Inside the app, recalculated each time someone opens a screen",
        "In the bronze layer, next to the raw data as it arrived",
      ],
      answer: 0,
      why: "Gold is the shared, ready-to-use layer. Put the rule there and Genie, dashboards and the app all see the same ranking.",
    },
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
    links: [{ label: "Genie docs", url: "https://docs.databricks.com/aws/en/genie/", kind: "docs" }],
  },
  [DASHBOARDS]: {
    title: "AI/BI Dashboards",
    short: "AI/BI Dashboards",
    tagline: "The key numbers and trends on one page, at a glance.",
    deeper:
      "An AI/BI dashboard reads the same gold tables and turns them into counters, charts and filters people can scan in seconds. " +
      "You can describe the visual you want in plain words and refine it from there. A Genie space can sit alongside it for the questions nobody planned for.",
    quiz: {
      q: "A manager wants to see this week's trend first thing every morning, without typing anything. Which piece fits best?",
      options: [
        "A Genie space they type a question into",
        "A Lakebase table they query by hand",
        "An AI/BI dashboard over the gold tables",
      ],
      answer: 2,
      why: "Dashboards are for the numbers you look at every time. Genie is for the questions you did not plan for.",
    },
    links: [{ label: "AI/BI dashboards docs", url: "https://docs.databricks.com/aws/en/dashboards/", kind: "docs" }],
  },
  [LAKEBASE]: {
    title: "Lakebase",
    short: "Lakebase",
    tagline: "A Postgres database that records what people decide.",
    deeper:
      "Analytics tables are great for reading lots of history, but an app also needs to save small things the moment they happen: an approval, a change, a note. " +
      "Lakebase is a managed Postgres database inside your Databricks workspace for exactly that, governed alongside the rest of your data.",
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
    quiz: {
      q: "How will you create the app screen in this build?",
      options: [
        "Write the React and Python code by hand in Genie Code",
        "Export a dashboard and rename it as an app",
        "Describe the screens to Genie App Builder from the Apps Build tab",
      ],
      answer: 2,
      why: "Genie App Builder turns a plain-language description of your screens into a working app in an App Space. You iterate by asking for one change at a time.",
    },
    links: [
      { label: "Databricks Apps docs", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/", kind: "docs" },
      { label: "Genie App Builder docs", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/genie-app-builder", kind: "docs" },
    ],
  },
};

// The components a build teaches, in the order given, limited to ones we have content for.
export function learnComponents(capabilities: string[]): string[] {
  const known = (capabilities || []).filter((c) => CONCEPTS[c]);
  return known.length ? known : COMPONENT_ORDER.filter((c) => c === PIPELINES || c === GENIE);
}

// Learn beats: 0 = the architecture overview, 1..n = one per component, n+1 = the quick check.
export const learnBeatCount = (capabilities: string[]) => learnComponents(capabilities).length + 2;
