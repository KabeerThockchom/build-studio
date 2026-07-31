import { useStudio, type Screen } from "./lib/store";
import { api } from "./lib/api";
import { DESIGN_QUESTIONS } from "./lib/constants";
import { LeftRail } from "./components/LeftRail";
import { ShapeScreen } from "./components/ShapeScreen";
import { DesignScreen } from "./components/DesignScreen";
import { AssembleScreen } from "./components/AssembleScreen";
import { BlueprintScreen } from "./components/BlueprintScreen";
import { BuildScreen } from "./components/BuildScreen";

export default function App() {
  const { state, dispatch } = useStudio();
  const go = (screen: Screen) => dispatch({ t: "go", screen });

  async function generate() {
    dispatch({ t: "genStart" });
    try {
      const answers: Record<string, string> = {};
      for (const q of DESIGN_QUESTIONS) {
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

  function toBlueprint() { go(4); generate(); }

  return (
    <div className="flex h-screen bg-oat">
      <LeftRail screen={state.screen} go={go} />
      <main className="flex-1 overflow-y-auto px-[72px] py-12">
        {state.screen === 0 && (
          <ShapeScreen state={state}
            onIdea={(v) => dispatch({ t: "idea", v })}
            onExpertise={(v) => dispatch({ t: "expertise", v })}
            onToggleInterest={(v) => dispatch({ t: "toggleInterest", v })}
            onNext={() => go(1)} />
        )}
        {state.screen === 1 && (
          <DesignScreen q={DESIGN_QUESTIONS[0]}
            selected={state.answers[DESIGN_QUESTIONS[0].id]}
            otherText={state.answersOther[DESIGN_QUESTIONS[0].id] || ""}
            onSelect={(key) => dispatch({ t: "answer", q: DESIGN_QUESTIONS[0].id, key })}
            onOther={(v) => dispatch({ t: "answerOther", q: DESIGN_QUESTIONS[0].id, v })}
            onBack={() => go(0)} onNext={() => go(2)} />
        )}
        {state.screen === 2 && (
          <DesignScreen q={DESIGN_QUESTIONS[1]}
            selected={state.answers[DESIGN_QUESTIONS[1].id]}
            otherText={state.answersOther[DESIGN_QUESTIONS[1].id] || ""}
            onSelect={(key) => dispatch({ t: "answer", q: DESIGN_QUESTIONS[1].id, key })}
            onOther={(v) => dispatch({ t: "answerOther", q: DESIGN_QUESTIONS[1].id, v })}
            onBack={() => go(1)} onNext={() => go(3)} />
        )}
        {state.screen === 3 && (
          <AssembleScreen selected={state.capabilities}
            onToggle={(name) => dispatch({ t: "toggleCap", v: name })}
            onBack={() => go(2)} onNext={toBlueprint} />
        )}
        {state.screen === 4 && (
          <BlueprintScreen blueprint={state.blueprint} generating={state.generating} error={state.error}
            onRetry={generate} onBack={() => go(3)} onNext={() => go(5)} />
        )}
        {state.screen === 5 && <BuildScreen blueprint={state.blueprint} onBack={() => go(4)} />}
      </main>
    </div>
  );
}
