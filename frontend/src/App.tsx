import { useState, useEffect } from "react";
import { useStudio, mergedQuestions, shownPicks, type Phase } from "./lib/store";
import { api } from "./lib/api";
import { LeftRail } from "./components/LeftRail";
import { ShapeScreen } from "./components/ShapeScreen";
import { DesignScreen } from "./components/DesignScreen";
import { AssembleScreen } from "./components/AssembleScreen";
import { BlueprintScreen } from "./components/BlueprintScreen";
import { BuildScreen } from "./components/BuildScreen";

export default function App() {
  const { state, dispatch } = useStudio();
  const [waitingForMore, setWaitingForMore] = useState(false);

  // If the user reached the end of the questions we had while the SA plan was
  // still loading, advance them as soon as the follow-ups arrive.
  useEffect(() => {
    if (waitingForMore && !state.planning) {
      setWaitingForMore(false);
      const total = 1 + (state.plan?.questions.length ?? 0);
      if (state.designIdx < total - 1) dispatch({ t: "designIdx", i: state.designIdx + 1 });
      else dispatch({ t: "phase", phase: "assemble" });
    }
  }, [waitingForMore, state.planning]); // eslint-disable-line

  const go = (phase: Phase, i?: number) => {
    dispatch({ t: "phase", phase });
    if (phase === "design" && i != null) dispatch({ t: "designIdx", i });
  };

  // --- Shape -> show Q1 instantly, generate the SA follow-ups in the background ---
  function startDesign() {
    dispatch({ t: "designIdx", i: 0 });
    dispatch({ t: "phase", phase: "design" });
    loadPlan();
  }
  async function loadPlan() {
    dispatch({ t: "planStart" });
    try {
      const { plan } = await api.planDesign({ idea: state.idea, expertise: state.expertise, interests: state.interests });
      dispatch({ t: "planOk", plan });
    } catch (e: any) {
      dispatch({ t: "planErr", e: e.message || "Something went wrong" });
    }
  }

  const questions = mergedQuestions(state);   // [hard-coded Q1, ...SA follow-ups]

  function nextDesign() {
    // If more questions are still loading and we're at the end of what we have,
    // wait rather than jumping to Assemble prematurely.
    if (state.designIdx < questions.length - 1) {
      dispatch({ t: "designIdx", i: state.designIdx + 1 });
    } else if (state.planning) {
      setWaitingForMore(true);   // handled by an effect once the plan lands
    } else {
      dispatch({ t: "phase", phase: "assemble" });
    }
  }
  function backDesign() {
    if (state.designIdx > 0) dispatch({ t: "designIdx", i: state.designIdx - 1 });
    else dispatch({ t: "phase", phase: "shape" });
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

  const curQ = questions[state.designIdx];
  const lastQ = state.designIdx === questions.length - 1;

  return (
    <div className="flex h-screen bg-oat">
      <LeftRail state={state} go={go} />
      <main className="flex-1 overflow-y-auto px-[72px] py-12">
        {state.phase === "shape" && (
          <ShapeScreen state={state}
            onIdea={(v) => dispatch({ t: "idea", v })}
            onExpertise={(v) => dispatch({ t: "expertise", v })}
            onToggleInterest={(v) => dispatch({ t: "toggleInterest", v })}
            onNext={startDesign} />
        )}
        {state.phase === "design" && curQ && (
          <DesignScreen q={curQ}
            readBack={state.designIdx === 0 ? (state.plan?.read_back || undefined) : undefined}
            selected={state.answers[curQ.id]}
            otherText={state.answersOther[curQ.id] || ""}
            onSelect={(key) => dispatch({ t: "answer", q: curQ.id, key })}
            onOther={(v) => dispatch({ t: "answerOther", q: curQ.id, v })}
            onBack={backDesign} onNext={nextDesign}
            nextLabel={waitingForMore ? "Thinking…" : (lastQ && !state.planning ? "See what fits →" : "Next →")}
            nextBusy={waitingForMore} />
        )}
        {state.phase === "assemble" && (
          <AssembleScreen picks={shownPicks(state)} selected={state.capabilities}
            onToggle={(name) => dispatch({ t: "toggleCap", v: name })}
            onBack={() => { dispatch({ t: "phase", phase: "design" }); dispatch({ t: "designIdx", i: questions.length - 1 }); }}
            onNext={toBlueprint} />
        )}
        {state.phase === "blueprint" && (
          <BlueprintScreen blueprint={state.blueprint} generating={state.generating} error={state.error}
            onRetry={() => generate()} onRefine={(note) => generate(note)}
            onBack={() => dispatch({ t: "phase", phase: "assemble" })}
            onNext={() => dispatch({ t: "phase", phase: "build" })} />
        )}
        {state.phase === "build" && <BuildScreen blueprint={state.blueprint} onBack={() => dispatch({ t: "phase", phase: "blueprint" })} />}
      </main>
    </div>
  );
}
