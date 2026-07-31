import { useStudio, type Phase } from "./lib/store";
import { api } from "./lib/api";
import { LeftRail } from "./components/LeftRail";
import { ShapeScreen } from "./components/ShapeScreen";
import { PlanningScreen } from "./components/PlanningScreen";
import { DesignScreen } from "./components/DesignScreen";
import { AssembleScreen } from "./components/AssembleScreen";
import { BlueprintScreen } from "./components/BlueprintScreen";
import { BuildScreen } from "./components/BuildScreen";

export default function App() {
  const { state, dispatch } = useStudio();
  const go = (phase: Phase, i?: number) => {
    dispatch({ t: "phase", phase });
    if (phase === "design" && i != null) dispatch({ t: "designIdx", i });
  };

  // --- Shape -> plan the design conversation (the SA call) ---
  async function startPlanning() {
    dispatch({ t: "phase", phase: "planning" });
    dispatch({ t: "planStart" });
    try {
      const { plan } = await api.planDesign({ idea: state.idea, expertise: state.expertise, interests: state.interests });
      dispatch({ t: "planOk", plan });
      dispatch({ t: "designIdx", i: 0 });
      dispatch({ t: "phase", phase: "design" });
    } catch (e: any) {
      dispatch({ t: "planErr", e: e.message || "Something went wrong" });
    }
  }
  function skipToFallbackPlan() {
    // The backend already falls back on its own; this path only triggers if the
    // whole request failed (network). Re-issue — the server returns a curated plan.
    startPlanning();
  }

  const questions = state.plan?.questions ?? [];

  function nextDesign() {
    if (state.designIdx < questions.length - 1) {
      dispatch({ t: "designIdx", i: state.designIdx + 1 });
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
  async function generate() {
    dispatch({ t: "genStart" });
    try {
      const answers: Record<string, string> = {};
      for (const q of questions) {
        const key = state.answers[q.id];
        answers[q.id] = key === "other" ? (state.answersOther[q.id] || "other") : (key || "");
      }
      const bp = await api.generateBlueprint({
        idea: state.idea, expertise: state.expertise, interests: state.interests,
        design_answers: answers, capabilities: state.capabilities,
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
            onNext={startPlanning} />
        )}
        {state.phase === "planning" && (
          <PlanningScreen idea={state.idea} error={state.planError}
            onRetry={startPlanning} onSkip={skipToFallbackPlan} />
        )}
        {state.phase === "design" && curQ && (
          <DesignScreen q={curQ}
            readBack={state.designIdx === 0 ? state.plan?.read_back : undefined}
            selected={state.answers[curQ.id]}
            otherText={state.answersOther[curQ.id] || ""}
            onSelect={(key) => dispatch({ t: "answer", q: curQ.id, key })}
            onOther={(v) => dispatch({ t: "answerOther", q: curQ.id, v })}
            onBack={backDesign} onNext={nextDesign}
            nextLabel={lastQ ? "See what fits →" : "Next →"} />
        )}
        {state.phase === "assemble" && (
          <AssembleScreen picks={state.plan?.capabilities ?? []} selected={state.capabilities}
            onToggle={(name) => dispatch({ t: "toggleCap", v: name })}
            onBack={() => { dispatch({ t: "phase", phase: "design" }); dispatch({ t: "designIdx", i: questions.length - 1 }); }}
            onNext={toBlueprint} />
        )}
        {state.phase === "blueprint" && (
          <BlueprintScreen blueprint={state.blueprint} generating={state.generating} error={state.error}
            onRetry={generate} onBack={() => dispatch({ t: "phase", phase: "assemble" })}
            onNext={() => dispatch({ t: "phase", phase: "build" })} />
        )}
        {state.phase === "build" && <BuildScreen blueprint={state.blueprint} onBack={() => dispatch({ t: "phase", phase: "blueprint" })} />}
      </main>
    </div>
  );
}
