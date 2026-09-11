import { useEffect, useRef, useState } from "react";
import { useStudio, mergedQuestions, shownPicks, persistable, type Phase } from "./lib/store";
import { api } from "./lib/api";
import { LeftRail } from "./components/LeftRail";
import { OverviewScreen } from "./components/OverviewScreen";
import { ShapeScreen } from "./components/ShapeScreen";
import { TeachingLoader } from "./components/TeachingLoader";
import { DesignScreen } from "./components/DesignScreen";
import { AssembleScreen } from "./components/AssembleScreen";
import { CapabilityLearning } from "./components/CapabilityLearning";
import { BlueprintScreen } from "./components/BlueprintScreen";
import { BuildScreen } from "./components/BuildScreen";
import { AdminConsole } from "./components/AdminConsole";

const PHASE_LABEL: Record<string, string> = {
  overview: "start", shape: "idea", teach: "learning", design: "design",
  assemble: "assemble", learn: "learning", blueprint: "blueprint", build: "build",
};
const phaseLabel = (p: string) => PHASE_LABEL[p] || p;

export default function App() {
  const { state, dispatch } = useStudio();
  const sessionId = useRef<string | null>(null);
  const restored = useRef(false);
  const [admin, setAdmin] = useState<{ email: string; is_admin: boolean } | null>(null);
  const [inConsole, setInConsole] = useState(false);
  // "Welcome back" offer when they land on the base URL (no ?s=) but have a session in progress.
  const [resume, setResume] = useState<{ session_id: string; phase: string; idea: string; project_name: string } | null>(null);

  // Am I a proctor? (CAN_MANAGE). Deep-link ?admin=1 opens the console directly.
  useEffect(() => {
    api.adminMe().then((r) => {
      setAdmin(r);
      if (r.is_admin && new URLSearchParams(location.search).get("admin") === "1") setInConsole(true);
    }).catch(() => {});
  }, []);

  // Restore on first mount. Priority: (1) an explicit ?s=<id> in the URL (refresh / shared
  // link) rehydrates that exact session; (2) no ?s — ask the server for this user's latest
  // in-progress session and OFFER to resume it (so returning to the base URL isn't a dead
  // end); (3) if there's nothing to resume, fall back to any shape typing cached in this
  // browser, so a refresh while writing the idea (before the first server save) isn't lost.
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("s");
    if (id) {
      sessionId.current = id;
      api.loadSession(id)
        .then((r) => { if (r?.state) dispatch({ t: "hydrate", s: r.state }); })
        .catch(() => {})
        .finally(() => { restored.current = true; });
      return;
    }
    api.latestSession()
      .then((r) => {
        if (r.found && r.session_id) {
          setResume({ session_id: r.session_id, phase: r.phase || "", idea: r.idea || "", project_name: r.project_name || "" });
        } else {
          restoreShapeCache();   // nothing on the server for this user — recover local typing
        }
      })
      .catch(() => { restoreShapeCache(); })
      .finally(() => { restored.current = true; });
  }, []);

  function restoreShapeCache() {
    try {
      const cached = localStorage.getItem("bs_shape");
      if (cached) dispatch({ t: "hydrate", s: JSON.parse(cached) });
    } catch { /* private mode / blocked storage — fine, just start empty */ }
  }

  // Resume the offered session: adopt its id, put it back in the URL, rehydrate its state.
  function doResume() {
    if (!resume) return;
    sessionId.current = resume.session_id;
    const url = new URL(location.href);
    url.searchParams.set("s", resume.session_id);
    history.replaceState(null, "", url.toString());
    api.loadSession(resume.session_id)
      .then((r) => { if (r?.state) dispatch({ t: "hydrate", s: r.state }); })
      .catch(() => {});
    setResume(null);
  }

  // Cache the shape inputs in this browser as a pre-first-save safety net (the server
  // doesn't save until they leave shape). Cheap, per-browser, best-effort. Gated on
  // `restored` so the empty initial state on mount can't wipe the cache before we read it.
  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem("bs_shape", JSON.stringify({
        idea: state.idea, projectName: state.projectName,
        expertise: state.expertise, interests: state.interests }));
    } catch { /* ignore */ }
  }, [state.idea, state.projectName, state.expertise, state.interests]);

  // Auto-save whenever the phase changes (and once restored, not during restore).
  useEffect(() => {
    if (!restored.current || state.phase === "overview" || state.phase === "shape") return;
    api.saveSession(sessionId.current, persistable(state))
      .then((r) => {
        if (r.session_id && r.session_id !== sessionId.current) {
          sessionId.current = r.session_id;
          const url = new URL(location.href);
          url.searchParams.set("s", r.session_id);
          history.replaceState(null, "", url.toString());
        }
      })
      .catch(() => {});
    // Save on discrete choices too (a design answer, a capability toggle), not just phase
    // changes — so a refresh right after a click doesn't lose it. These are clicks, not
    // keystrokes, so the extra saves are cheap.
  }, [state.phase, state.designIdx, state.blueprint, state.buildStepIdx, state.buildDone, state.answers, state.capabilities]); // eslint-disable-line

  const go = (phase: Phase, i?: number) => {
    dispatch({ t: "phase", phase });
    if (phase === "design" && i != null) dispatch({ t: "designIdx", i });
  };

  // --- Shape -> teaching loader ---
  // Two background jobs, staged to hide their latency behind the teaching:
  //   1. On entering teach, the idea stress-test runs (covered by the first beats).
  //   2. Design-question generation is deferred until the user passes the criteria
  //      beat (covered by the quiz), so we don't build questions for an idea they're
  //      about to rewrite. Akil's sequencing: learning covers the check, quiz covers the plan.
  function startDesign() {
    dispatch({ t: "phase", phase: "teach" });
    // Kick off BOTH on entering the primer: the quick rubric check (~5s, shown at the
    // criteria beat) AND design-question generation (the slow one, ~50s). Running the
    // slow one from the start means the WHOLE primer hides it, not just the quiz — the
    // measured 53s wait was the main friction. If the idea is edited at the criteria
    // beat, regenPlan re-runs it for the new idea.
    runIdeaCheck(state.idea);
    requestPlan();
  }
  async function runIdeaCheck(idea: string) {
    dispatch({ t: "checkStart" });
    try {
      const check = await api.checkIdea({ idea });
      dispatch({ t: "checkOk", check });
    } catch {
      dispatch({ t: "checkErr" });  // advisory — a failure just means no nudges shown
    }
  }
  function requestPlan() {
    if (state.planRequested) return;   // fire design-question generation exactly once
    loadPlan();
  }
  // Regenerate questions for an idea edited at the criteria beat — bypasses the
  // once-only guard because the idea genuinely changed under us.
  function regenPlan(idea: string) { loadPlan(idea); }
  async function loadPlan(ideaOverride?: string) {
    dispatch({ t: "planStart" });
    try {
      const { plan } = await api.planDesign({ idea: ideaOverride ?? state.idea, expertise: state.expertise, interests: state.interests, industry: state.industry });
      dispatch({ t: "planOk", plan });
    } catch (e: any) {
      dispatch({ t: "planErr", e: e.message || "Something went wrong" });
    }
  }
  // Leave the teaching loader for the (now-ready) tailored questions.
  function enterDesign() {
    dispatch({ t: "designIdx", i: 0 });
    dispatch({ t: "phase", phase: "design" });
  }

  const questions = mergedQuestions(state);   // all SA-authored, tailored to the idea

  function nextDesign() {
    if (state.designIdx < questions.length - 1) dispatch({ t: "designIdx", i: state.designIdx + 1 });
    else {
      // Kick off blueprint generation as they leave the questions, so it runs in the
      // background through Assemble + Meet the Pieces and is ready by the time they finish
      // the learning (toLearn keeps a guarded fallback in case they arrive another way).
      if (!state.blueprint && !state.generating) generate();
      dispatch({ t: "phase", phase: "assemble" });
    }
  }
  function backDesign() {
    if (state.designIdx > 0) dispatch({ t: "designIdx", i: state.designIdx - 1 });
    else dispatch({ t: "phase", phase: "teach" });
  }

  // --- Assemble -> Learn -> Blueprint ---
  // Entering the learning phase kicks off blueprint generation in the background, so the
  // ~50s generation is hidden behind the per-piece modules + quiz (same pattern as the
  // design-question generation during the primer). The learn phase's CTA just switches to
  // the Blueprint screen, which shows the result (or its own generating panel if not done).
  function toLearn() {
    dispatch({ t: "phase", phase: "learn" });
    if (!state.blueprint && !state.generating) generate();
  }
  async function generate(adjust = "") {
    dispatch({ t: "genStart" });
    try {
      const answers: Record<string, string> = {};
      for (const q of questions) {
        const key = state.answers[q.id];
        answers[q.id] = key === "other" ? (state.answersOther[q.id] || "other") : (key || "");
      }
      const bp = await api.generateBlueprint({
        idea: state.idea, expertise: state.expertise, interests: state.interests,
        design_answers: answers, capabilities: state.capabilities, adjust,
      });
      dispatch({ t: "genOk", bp });
    } catch (e: any) {
      dispatch({ t: "genErr", e: e.message || "Something went wrong" });
    }
  }

  // Persist the settled plan (PRD + build steps) into the user's workspace, so the
  // build move can be "read this doc and build" and so a mid-workshop app crash doesn't
  // lose their work. Fire-and-forget + best-effort: the endpoint always 200s (ok:false
  // on failure), so this never blocks the build — the copy-paste path still stands.
  function publishAssets(steps: unknown[]) {
    const answers: Record<string, string> = {};
    for (const q of questions) answers[q.id] = state.answers[q.id] || "";
    api.publishAssets({
      idea: state.idea, prd_markdown: state.blueprint?.prd_markdown || "",
      capabilities: state.capabilities, design_answers: answers,
      decisions: state.blueprint?.decisions || [], steps, project_name: state.projectName,
    }).then((r) => { if (r.ok && r.dir) dispatch({ t: "publishOk", dir: r.dir, host: r.host || "", deepLink: r.deep_link || "" }); })
      .catch(() => {});
  }

  // --- Blueprint -> Build (fetch the guided build plan once) ---
  async function toBuild() {
    dispatch({ t: "phase", phase: "build" });
    if (state.buildPlan) {                                    // already have it
      if (!state.publishedDir) publishAssets(state.buildPlan.steps);  // ensure it's persisted
      return;
    }
    dispatch({ t: "buildStart" });
    try {
      const answers: Record<string, string> = {};
      for (const q of questions) answers[q.id] = state.answers[q.id] || "";
      const plan = await api.buildPlan({
        idea: state.idea, expertise: state.expertise,
        capabilities: state.capabilities, design_answers: answers,
        // The blueprint's PRD is authoritative — it reflects any refinements/pivots,
        // so the build steps follow what the user actually approved, not the raw idea.
        prd_markdown: state.blueprint?.prd_markdown || "",
        project_name: state.projectName,   // isolates their schema/tables in the build prompts
      });
      dispatch({ t: "buildOk", plan });
      publishAssets(plan.steps);   // persist PRD + guide now that we have the full context
    } catch {
      dispatch({ t: "buildErr" });
    }
  }

  const curQ = questions[state.designIdx];
  const lastQ = state.designIdx === questions.length - 1;

  if (inConsole && admin?.is_admin) {
    return <AdminConsole email={admin.email} onExit={() => setInConsole(false)} />;
  }

  return (
    <div className="flex h-screen bg-oat">
      <LeftRail state={state} go={go} />
      <main className="relative flex-1 overflow-y-auto px-[72px] py-12">
        {admin?.is_admin && (
          <button onClick={() => setInConsole(true)}
            className="absolute right-5 top-4 z-10 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-bold text-navy-2 shadow-sm hover:border-green hover:text-green-ink">
            Proctor console →
          </button>
        )}
        {resume && (
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-[1.5px] border-green bg-green-soft px-6 py-4">
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-bold text-navy">Welcome back — you have a build in progress.</div>
              <div className="mt-0.5 truncate text-[13px] text-navy-2">
                {resume.project_name || resume.idea || "Your project"} · left off at the {phaseLabel(resume.phase)} step
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <button onClick={() => setResume(null)}
                className="rounded-xl border border-line bg-white px-4 py-2 text-[13.5px] font-semibold text-navy-2 hover:border-navy-3">Start fresh</button>
              <button onClick={doResume}
                className="rounded-xl bg-green px-5 py-2 text-[13.5px] font-bold text-white hover:bg-green-l">Pick up where I left off →</button>
            </div>
          </div>
        )}
        {state.phase === "overview" && (
          <OverviewScreen onStart={() => dispatch({ t: "phase", phase: "shape" })} />
        )}
        {state.phase === "shape" && (
          <ShapeScreen state={state}
            onIdea={(v) => dispatch({ t: "idea", v })}
            onProjectName={(v) => dispatch({ t: "projectName", v })}
            onPickSample={(idea, name, industry, components, interests) => dispatch({ t: "pickSample", idea, name, industry, components, interests })}
            onExpertise={(v) => dispatch({ t: "expertise", v })}
            onToggleInterest={(v) => dispatch({ t: "toggleInterest", v })}
            onNext={startDesign} />
        )}
        {state.phase === "teach" && (
          <TeachingLoader idea={state.idea} expertise={state.expertise} planning={state.planning}
            ready={!state.planning && (state.plan?.questions.length ?? 0) > 0}
            ideaChecking={state.ideaChecking} ideaCheck={state.ideaCheck}
            onReviseIdea={(v) => dispatch({ t: "idea", v })}
            onRecheck={(v) => { runIdeaCheck(v); regenPlan(v); }}
            onProceed={requestPlan}
            onEnter={enterDesign} />
        )}
        {state.phase === "design" && curQ && (
          <DesignScreen q={curQ} idea={state.idea}
            selected={state.answers[curQ.id]}
            otherText={state.answersOther[curQ.id] || ""}
            onSelect={(key) => dispatch({ t: "answer", q: curQ.id, key })}
            onOther={(v) => dispatch({ t: "answerOther", q: curQ.id, v })}
            onBack={backDesign} onNext={nextDesign}
            nextLabel={lastQ ? "See what fits →" : "Next →"} />
        )}
        {state.phase === "assemble" && (
          <AssembleScreen picks={shownPicks(state)}
            onBack={() => { dispatch({ t: "phase", phase: "design" }); dispatch({ t: "designIdx", i: questions.length - 1 }); }}
            onNext={toLearn} />
        )}
        {state.phase === "learn" && (
          <CapabilityLearning capabilities={state.capabilities}
            onBack={() => dispatch({ t: "phase", phase: "assemble" })}
            onDone={() => dispatch({ t: "phase", phase: "blueprint" })} />
        )}
        {state.phase === "blueprint" && (
          <BlueprintScreen blueprint={state.blueprint} generating={state.generating} error={state.error}
            onRetry={() => generate()} onRefine={(note) => generate(note)}
            onBack={() => dispatch({ t: "phase", phase: "learn" })}
            onNext={toBuild} />
        )}
        {state.phase === "build" && (
          <BuildScreen plan={state.buildPlan} loading={state.buildLoading}
            stepIdx={state.buildStepIdx} done={state.buildDone}
            publishedDir={state.publishedDir} publishedDeepLink={state.publishedDeepLink}
            onStep={(i) => dispatch({ t: "buildStep", i })}
            onComplete={(n) => dispatch({ t: "buildComplete", n })}
            onBack={() => dispatch({ t: "phase", phase: "blueprint" })} />
        )}
      </main>
    </div>
  );
}
