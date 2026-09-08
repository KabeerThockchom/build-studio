import { useEffect, useRef, useState } from "react";
import { useStudio, mergedQuestions, shownPicks, persistable, type Phase } from "./lib/store";
import { api } from "./lib/api";
import { LeftRail } from "./components/LeftRail";
import { OverviewScreen } from "./components/OverviewScreen";
import { ShapeScreen } from "./components/ShapeScreen";
import { TeachingLoader } from "./components/TeachingLoader";
import { DesignScreen } from "./components/DesignScreen";
import { AssembleScreen } from "./components/AssembleScreen";
import { BlueprintScreen } from "./components/BlueprintScreen";
import { BuildScreen } from "./components/BuildScreen";
import { AdminConsole } from "./components/AdminConsole";

export default function App() {
  const { state, dispatch } = useStudio();
  const sessionId = useRef<string | null>(null);
  const restored = useRef(false);
  const [admin, setAdmin] = useState<{ email: string; is_admin: boolean } | null>(null);
  const [inConsole, setInConsole] = useState(false);

  // Am I a proctor? (CAN_MANAGE). Deep-link ?admin=1 opens the console directly.
  useEffect(() => {
    api.adminMe().then((r) => {
      setAdmin(r);
      if (r.is_admin && new URLSearchParams(location.search).get("admin") === "1") setInConsole(true);
    }).catch(() => {});
  }, []);

  // Restore a saved session from ?s=<id> on first mount.
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("s");
    if (!id) { restored.current = true; return; }
    sessionId.current = id;
    api.loadSession(id)
      .then((r) => { if (r?.state) dispatch({ t: "hydrate", s: r.state }); })
      .catch(() => {})
      .finally(() => { restored.current = true; });
  }, []);

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
  }, [state.phase, state.designIdx, state.blueprint, state.buildStepIdx, state.buildDone]); // eslint-disable-line

  const go = (phase: Phase, i?: number) => {
    dispatch({ t: "phase", phase });
    if (phase === "design" && i != null) dispatch({ t: "designIdx", i });
  };

  // --- Shape -> teaching loader, generate ALL tailored questions in background ---
  function startDesign() {
    dispatch({ t: "phase", phase: "teach" });
    loadPlan();
  }
  async function loadPlan() {
    dispatch({ t: "planStart" });
    try {
      const { plan } = await api.planDesign({ idea: state.idea, expertise: state.expertise, interests: state.interests, industry: state.industry });
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
    else dispatch({ t: "phase", phase: "assemble" });
  }
  function backDesign() {
    if (state.designIdx > 0) dispatch({ t: "designIdx", i: state.designIdx - 1 });
    else dispatch({ t: "phase", phase: "teach" });
  }

  // --- Assemble -> Blueprint (generate) ---
  async function toBlueprint() {
    dispatch({ t: "phase", phase: "blueprint" });
    generate();
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

  // --- Blueprint -> Build (fetch the guided build plan once) ---
  async function toBuild() {
    dispatch({ t: "phase", phase: "build" });
    if (state.buildPlan) return;  // already have it
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
      });
      dispatch({ t: "buildOk", plan });
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
        {state.phase === "overview" && (
          <OverviewScreen onStart={() => dispatch({ t: "phase", phase: "shape" })} />
        )}
        {state.phase === "shape" && (
          <ShapeScreen state={state}
            onIdea={(v) => dispatch({ t: "idea", v })}
            onPickSample={(idea, industry, components, interests) => dispatch({ t: "pickSample", idea, industry, components, interests })}
            onExpertise={(v) => dispatch({ t: "expertise", v })}
            onToggleInterest={(v) => dispatch({ t: "toggleInterest", v })}
            onNext={startDesign} />
        )}
        {state.phase === "teach" && (
          <TeachingLoader idea={state.idea} planning={state.planning}
            ready={!state.planning && (state.plan?.questions.length ?? 0) > 0}
            onEnter={enterDesign} />
        )}
        {state.phase === "design" && curQ && (
          <DesignScreen q={curQ}
            readBack={state.designIdx === 0 ? (state.plan?.read_back || undefined) : undefined}
            selected={state.answers[curQ.id]}
            otherText={state.answersOther[curQ.id] || ""}
            onSelect={(key) => dispatch({ t: "answer", q: curQ.id, key })}
            onOther={(v) => dispatch({ t: "answerOther", q: curQ.id, v })}
            onBack={backDesign} onNext={nextDesign}
            nextLabel={lastQ ? "See what fits →" : "Next →"} />
        )}
        {state.phase === "assemble" && (
          <AssembleScreen picks={shownPicks(state)} selected={state.capabilities} fromSample={state.capsPinned}
            onToggle={(name) => dispatch({ t: "toggleCap", v: name })}
            onBack={() => { dispatch({ t: "phase", phase: "design" }); dispatch({ t: "designIdx", i: questions.length - 1 }); }}
            onNext={toBlueprint} />
        )}
        {state.phase === "blueprint" && (
          <BlueprintScreen blueprint={state.blueprint} generating={state.generating} error={state.error}
            onRetry={() => generate()} onRefine={(note) => generate(note)}
            onBack={() => dispatch({ t: "phase", phase: "assemble" })}
            onNext={toBuild} />
        )}
        {state.phase === "build" && (
          <BuildScreen plan={state.buildPlan} loading={state.buildLoading}
            stepIdx={state.buildStepIdx} done={state.buildDone}
            onStep={(i) => dispatch({ t: "buildStep", i })}
            onComplete={(n) => dispatch({ t: "buildComplete", n })}
            onBack={() => dispatch({ t: "phase", phase: "blueprint" })} />
        )}
      </main>
    </div>
  );
}
