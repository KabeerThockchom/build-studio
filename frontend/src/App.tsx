import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio, persistable, type Phase, type SitDownProgress } from "./lib/store";
import { api } from "./lib/api";
import { specFor } from "./lib/diagram";
import type { Blueprint, StudioHandoff } from "./lib/types";
import { LeftRail, type RailTarget } from "./components/LeftRail";
import { OverviewScreen } from "./components/OverviewScreen";
import { SitDown, SD_KEY, type SitDownBlob } from "./components/sitdown/SitDown";
import { CapabilityLearning } from "./components/CapabilityLearning";
import { PlanScreen } from "./components/PlanScreen";
import { BuildScreen } from "./components/BuildScreen";
import { AdminConsole } from "./components/AdminConsole";

const PHASE_LABEL: Record<string, string> = { overview: "start", sitdown: "Sit-Down", learn: "Learn", plan: "plan", build: "build" };
const POLL_MS = 2000;

function localSitdown(): SitDownBlob | null {
  try { const raw = localStorage.getItem(SD_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export default function App() {
  const { state, dispatch } = useStudio();
  const sessionId = useRef<string | null>(null);
  const restored = useRef(false);
  const [admin, setAdmin] = useState<{ email: string; is_admin: boolean } | null>(null);
  const [inConsole, setInConsole] = useState(false);
  const [resume, setResume] = useState<{ session_id: string; phase: string; idea: string; project_name: string } | null>(null);
  const [focusStage, setFocusStage] = useState<{ stage: string; nonce: number } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    api.adminMe().then((r) => {
      setAdmin(r);
      if (r.is_admin && new URLSearchParams(location.search).get("admin") === "1") setInConsole(true);
    }).catch(() => {});
  }, []);

  // Restore: an explicit ?s=<id> rehydrates that session (incl. a saved Sit-Down);
  // otherwise offer to resume this user's latest in-progress session.
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
      .then((r) => { if (r.found && r.session_id) setResume({ session_id: r.session_id, phase: r.phase || "", idea: r.idea || "", project_name: r.project_name || "" }); })
      .catch(() => {})
      .finally(() => { restored.current = true; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function doResume() {
    if (!resume) return;
    sessionId.current = resume.session_id;
    const url = new URL(location.href);
    url.searchParams.set("s", resume.session_id);
    history.replaceState(null, "", url.toString());
    api.loadSession(resume.session_id).then((r) => { if (r?.state) dispatch({ t: "hydrate", s: r.state }); }).catch(() => {});
    setResume(null);
  }

  // Save to the server whenever something worth keeping changes (debounced: the Sit-Down
  // saves after every turn and that blob can be large).
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!restored.current || state.phase === "overview") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api.saveSession(sessionId.current, persistable(stateRef.current))
        .then((r) => {
          if (r.session_id && r.session_id !== sessionId.current) {
            sessionId.current = r.session_id;
            const url = new URL(location.href);
            url.searchParams.set("s", r.session_id);
            history.replaceState(null, "", url.toString());
          }
        })
        .catch(() => {});
    }, 800);
  }, [state.phase, state.sitdown, state.learnIdx, state.planJob?.id, state.planJob?.status, state.blueprint,
      state.buildPlan, state.buildEntered, state.buildStepIdx, state.buildDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- the plan job: drafted in the background while they learn ---
  const startPlan = useCallback(async (src: { idea: string; answers: Record<string, string>; capabilities: string[]; projectName: string },
    adjust = "", previous: Blueprint | null = null) => {
    try {
      const { job_id } = await api.planStart({ idea: src.idea, answers: src.answers, capabilities: src.capabilities,
        project_name: src.projectName, adjust, previous });
      dispatch({ t: "planJob", job: { id: job_id, status: "running", stage: "drafting" } });
    } catch (e: any) {
      dispatch({ t: "planErr", e: e.message || "Could not start the plan" });
    }
  }, [dispatch]);
  const restartedFor = useRef<string | null>(null);
  useEffect(() => {
    const job = state.planJob;
    if (!job || job.status !== "running") return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.planStatus(job.id);
        if (!alive) return;
        if (r.status === "done" && r.blueprint) dispatch({ t: "planDone", bp: r.blueprint });
        else if (r.status === "error" && /unknown job|restarted/i.test(r.error || "") && restartedFor.current !== job.id) {
          // The server lost the job (it restarted): quietly start a fresh one, once per job.
          restartedFor.current = job.id;
          const s = stateRef.current;
          startPlan({ idea: s.idea, answers: s.answers, capabilities: s.capabilities, projectName: s.projectName });
        }
        else if (r.status === "error") dispatch({ t: "planErr", e: r.error || "The plan job failed" });
        else if (r.stage && r.stage !== stateRef.current.planJob?.stage) dispatch({ t: "planJob", job: { ...job, stage: r.stage } });
      } catch {
        // The server lost the job (restart, resumed session): start a fresh one, once.
        if (!alive || restartedFor.current === job.id) return;
        restartedFor.current = job.id;
        const s = stateRef.current;
        startPlan({ idea: s.idea, answers: s.answers, capabilities: s.capabilities, projectName: s.projectName });
      }
    };
    tick();
    const iv = window.setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(iv); };
  }, [state.planJob?.id, state.planJob?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- the Sit-Down hands off: adopt it, land on Learn, start the plan right away ---
  const onSitdownSave = useCallback((blob: SitDownBlob | null, progress: SitDownProgress) => {
    dispatch({ t: "sitdownSave", blob, progress });
  }, [dispatch]);
  const onHandoff = useCallback((studio: StudioHandoff) => {
    dispatch({ t: "handoff", studio });
    startPlan({ idea: studio.idea, answers: studio.answers || {}, capabilities: studio.capabilities || [], projectName: studio.projectName || "" });
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [dispatch, startPlan]);

  // --- build ---
  function publishAssets(steps: unknown[]) {
    const s = stateRef.current;
    api.publishAssets({
      idea: s.idea, prd_markdown: s.blueprint?.prd_markdown || "", capabilities: s.capabilities,
      design_answers: s.answers, decisions: s.blueprint?.decisions || [], steps, project_name: s.projectName,
    }).then((r) => { if (r.ok && r.dir) dispatch({ t: "publishOk", dir: r.dir, host: r.host || "", deepLink: r.deep_link || "" }); })
      .catch(() => {});
  }
  async function toBuild() {
    dispatch({ t: "phase", phase: "build" });
    const s = stateRef.current;
    if (s.buildPlan) { if (!s.publishedDir) publishAssets(s.buildPlan.steps); return; }
    dispatch({ t: "buildStart" });
    try {
      const plan = await api.buildPlan({
        idea: s.idea, capabilities: s.capabilities, design_answers: s.answers,
        prd_markdown: s.blueprint?.prd_markdown || "", project_name: s.projectName,
        app_screens: s.blueprint?.app_screens || [],
      });
      dispatch({ t: "buildOk", plan });
      publishAssets(plan.steps);
    } catch {
      dispatch({ t: "buildErr" });
    }
  }

  // --- rail navigation ---
  const go = (t: RailTarget) => {
    if (t.phase === "sitdown") { dispatch({ t: "phase", phase: "sitdown" }); setFocusStage({ stage: t.stage, nonce: Date.now() }); return; }
    if (t.phase === "learn") { dispatch({ t: "phase", phase: "learn" }); dispatch({ t: "learnIdx", i: t.beat }); return; }
    if (t.phase === "plan") { dispatch({ t: "phase", phase: "plan" }); return; }
    if (t.phase === "build") {
      if (stateRef.current.phase !== "build") { toBuild(); }
      if (t.step != null) dispatch({ t: "buildStep", i: t.step });
    }
  };
  const setPhase = (phase: Phase) => dispatch({ t: "phase", phase });

  if (inConsole && admin?.is_admin) return <AdminConsole email={admin.email} onExit={() => setInConsole(false)} />;

  const fits = Object.fromEntries((state.plan?.capabilities || []).map((c) => [c.name, c.fits]));
  const seeded = !!state.answers["data_seeded (read only)"];
  // The server's spec from the handoff; client-side compute only for old saved sessions without one.
  const spec = state.spec || state.blueprint?.spec || specFor(state.capabilities, seeded ? "Your seeded data" : "Sample data", seeded ? "read-only tables" : "tables we generate for you");
  const sitdownSaved = (state.sitdown as SitDownBlob | null) || localSitdown();
  const full = state.phase === "sitdown";

  return (
    <div className="flex h-screen bg-oat">
      <LeftRail state={state} go={go} onProctor={admin?.is_admin ? () => setInConsole(true) : undefined} />
      <main className={`relative flex-1 ${full ? "overflow-hidden" : "overflow-y-auto px-[72px] py-12"}`}>
        {resume && !full && (
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-[1.5px] border-green bg-green-soft px-6 py-4">
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-bold text-navy">Welcome back. You have a build in progress.</div>
              <div className="mt-0.5 truncate text-[13px] text-navy-2">
                {resume.project_name || resume.idea || "Your project"} · left off at {PHASE_LABEL[resume.phase] || resume.phase}
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
        {state.phase === "overview" && <OverviewScreen onStart={() => setPhase("sitdown")} />}
        {state.phase === "sitdown" && (
          <SitDown saved={sitdownSaved} onSave={onSitdownSave} onHandoff={onHandoff} focusStage={focusStage} />
        )}
        {state.phase === "learn" && (
          <CapabilityLearning capabilities={state.capabilities} fits={fits} spec={spec}
            beat={state.learnIdx} onBeat={(i) => dispatch({ t: "learnIdx", i })}
            planReady={!!state.blueprint && state.planJob?.status !== "running"}
            onBack={() => setPhase("sitdown")} onDone={() => setPhase("plan")} />
        )}
        {state.phase === "plan" && (
          <PlanScreen blueprint={state.blueprint} job={state.planJob} error={state.planError} answers={state.answers}
            onRetry={() => startPlan({ idea: state.idea, answers: state.answers, capabilities: state.capabilities, projectName: state.projectName })}
            onRefine={(note) => startPlan({ idea: state.idea, answers: state.answers, capabilities: state.capabilities, projectName: state.projectName }, note, state.blueprint)}
            onBack={() => { dispatch({ t: "learnIdx", i: Math.max(0, state.learnIdx) }); setPhase("learn"); }}
            onNext={toBuild} />
        )}
        {state.phase === "build" && (
          <BuildScreen plan={state.buildPlan} loading={state.buildLoading}
            stepIdx={state.buildStepIdx} done={state.buildDone}
            publishedDir={state.publishedDir} publishedDeepLink={state.publishedDeepLink}
            entered={state.buildEntered} onEnter={() => dispatch({ t: "buildEnter", v: true })}
            onStep={(i) => dispatch({ t: "buildStep", i })}
            onComplete={(n) => dispatch({ t: "buildComplete", n })}
            onBack={() => setPhase("plan")} />
        )}
      </main>
    </div>
  );
}
