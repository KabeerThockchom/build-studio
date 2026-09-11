import { useEffect, useState } from "react";
import { LayoutGrid, Settings, RefreshCw, ArrowLeft, AlertTriangle, ExternalLink,
  Sparkles, Check, ChevronRight } from "lucide-react";
import { api, type RosterRow, type WorkshopConfig } from "../lib/api";

/* The proctor + config console. Same app, rendered only for admins (CAN_MANAGE).
   Two tabs: a live board that triages who's stuck + deep-links to debug, and the
   per-workshop config the harness reads. */

export function AdminConsole({ email, onExit }: { email: string; onExit: () => void }) {
  const [tab, setTab] = useState<"board" | "config">("board");
  return (
    <div className="min-h-screen bg-oat">
      <header className="flex items-center gap-4 border-b border-line bg-white px-6 py-3">
        <button onClick={onExit} className="flex items-center gap-1.5 text-[13px] font-semibold text-navy-3 hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> Exit console
        </button>
        <div className="h-4 w-px bg-line" />
        <b className="text-[14px] font-bold text-navy">Proctor console</b>
        <div className="ml-2 flex gap-1">
          {([["board", "Live board", LayoutGrid], ["config", "Workshop config", Settings]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors
                ${tab === k ? "bg-green-soft text-green-ink" : "text-navy-2 hover:bg-oat"}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12px] text-navy-3">{email}</span>
      </header>
      <main className="px-6 py-6">
        {tab === "board" ? <LiveBoard /> : <ConfigEditor />}
      </main>
    </div>
  );
}

function LiveBoard() {
  const [data, setData] = useState<{ count: number; by_phase: Record<string, number>; participants: RosterRow[] } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = () => api.adminRoster().then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []); // auto-refresh

  if (err) return <div className="rounded-xl bg-[#fdecef] px-5 py-4 text-[14px] text-lava">{err}</div>;
  if (!data) return <div className="text-[14px] text-navy-3">Loading the room…</div>;

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="mb-4 flex items-center gap-3">
          <b className="text-[15px] font-bold text-navy">{data.count} in the room</b>
          {Object.entries(data.by_phase).map(([p, n]) => (
            <span key={p} className="rounded-full bg-white border border-line px-2.5 py-0.5 text-[12px] font-semibold text-navy-2">{p}: {n}</span>
          ))}
          <button onClick={load} className="ml-auto flex items-center gap-1.5 text-[12.5px] font-semibold text-green-ink hover:text-green">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        {data.count === 0 && <div className="rounded-xl border border-line bg-white px-5 py-6 text-[14px] text-navy-3">No active sessions yet. Participants appear here once they start.</div>}
        <div className="flex flex-col gap-2">
          {data.participants.map((p) => (
            <button key={p.session_id} onClick={() => setSel(p.session_id)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors
                ${sel === p.session_id ? "border-green bg-green-soft" : p.stuck ? "border-amber/50 bg-[#fffdf7]" : "border-line bg-white hover:border-navy-3"}`}>
              {p.stuck && <AlertTriangle className="h-4 w-4 shrink-0 text-amber" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <b className="text-[13.5px] font-semibold text-navy truncate">{p.app_user}</b>
                  <span className="rounded bg-oat px-1.5 py-0.5 text-[11px] font-semibold text-navy-2">{p.phase_label}{p.detail ? ` · ${p.detail}` : ""}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-navy-3 truncate">{p.idea || "—"}</div>
              </div>
              <span className={`shrink-0 text-[12px] font-semibold ${p.stuck ? "text-amber" : "text-navy-3"}`}>
                {p.idle_min != null ? `${p.idle_min}m idle` : ""}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-line-2" />
            </button>
          ))}
        </div>
      </div>
      {sel && <ParticipantPanel sid={sel}
        appUser={data.participants.find((p) => p.session_id === sel)?.app_user || ""}
        onClose={() => setSel(null)} />}
    </div>
  );
}

function ParticipantPanel({ sid, appUser, onClose }: { sid: string; appUser: string; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [triage, setTriage] = useState<any>(null);
  const [triaging, setTriaging] = useState(false);

  useEffect(() => { setDetail(null); setTriage(null); api.adminParticipant(sid).then(setDetail).catch(() => {}); }, [sid]);
  const runTriage = () => { setTriaging(true); api.adminTriage(sid).then((r) => setTriage(r.triage)).finally(() => setTriaging(false)); };

  return (
    <aside className="w-[380px] shrink-0 self-start rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <b className="text-[14px] font-bold text-navy">Participant</b>
        <button onClick={onClose} className="text-[12px] font-semibold text-navy-3 hover:text-navy">Close</button>
      </div>
      {!detail ? <div className="text-[13px] text-navy-3">Loading…</div> : (
        <>
          <div className="text-[13px] text-navy-2"><b className="text-navy">{appUser}</b></div>
          <div className="mt-1 text-[12.5px] text-navy-3">{detail.progress?.phase_label}{detail.progress?.detail ? ` · ${detail.progress.detail}` : ""}</div>
          <div className="mt-2 rounded-lg bg-oat px-3 py-2 text-[12.5px] leading-snug text-navy-2">{detail.state?.idea || "—"}</div>
          {detail.capabilities?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {detail.capabilities.map((c: string) => <span key={c} className="rounded bg-green-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-green-ink">{c}</span>)}
            </div>
          )}

          <button onClick={runTriage} disabled={triaging}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-bold text-white hover:bg-navy-2 disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {triaging ? "Triaging…" : "Triage: what's blocking them?"}
          </button>
          {triage && (
            <div className="mt-3 rounded-xl border border-line bg-oat/60 p-3 text-[12.5px] leading-snug">
              <div className="text-navy"><b>Status:</b> {triage.status}</div>
              {triage.likely_blocker && <div className="mt-1.5 text-navy-2"><b className="text-amber">Likely blocker:</b> {triage.likely_blocker}</div>}
              {triage.suggested_action && <div className="mt-1.5 text-navy-2"><b className="text-green-ink">Do this:</b> {triage.suggested_action}</div>}
            </div>
          )}

          {detail.deep_links && Object.keys(detail.deep_links).length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-navy-3">Jump into the workspace</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(detail.deep_links).map(([label, url]) => (
                  <a key={label} href={url as string} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold text-navy-2 hover:border-green hover:text-green-ink">
                    <ExternalLink className="h-3 w-3" />{label}
                  </a>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-navy-3">Opens in your browser, under your admin access.</p>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function ConfigEditor() {
  const [cfg, setCfg] = useState<WorkshopConfig | null>(null);
  const [allCaps, setAllCaps] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { api.adminGetConfig().then((r) => { setCfg(r.config); setAllCaps(r.all_capabilities); }).catch((e) => setErr(e.message)); }, []);
  const up = (patch: Partial<WorkshopConfig>) => { setCfg((c) => c ? { ...c, ...patch } : c); setSaved(false); };
  const save = () => { if (!cfg) return; setSaving(true); api.adminPutConfig(cfg).then((r) => { setCfg(r.config); setSaved(true); }).catch((e) => setErr(e.message)).finally(() => setSaving(false)); };

  if (err) return <div className="rounded-xl bg-[#fdecef] px-5 py-4 text-[14px] text-lava">{err}</div>;
  if (!cfg) return <div className="text-[14px] text-navy-3">Loading config…</div>;
  const toggleCap = (c: string) => up({ allowed_capabilities: cfg.allowed_capabilities.includes(c) ? cfg.allowed_capabilities.filter((x) => x !== c) : [...cfg.allowed_capabilities, c] });

  return (
    <div className="max-w-[720px]">
      <p className="mb-6 text-[14px] leading-relaxed text-navy-2">These settings shape what every participant builds — the harness reads them at the start of each session.</p>

      <Field label="Workshop name">
        <input value={cfg.workshop_name} onChange={(e) => up({ workshop_name: e.target.value })}
          className="w-full rounded-lg border border-line px-3 py-2 text-[14px] text-navy outline-none focus:border-green" placeholder="e.g. Costa · Sept" />
      </Field>

      <Field label="Company (branding + context)">
        <input value={cfg.company} onChange={(e) => up({ company: e.target.value })}
          className="w-full rounded-lg border border-line px-3 py-2 text-[14px] text-navy outline-none focus:border-green" placeholder="e.g. Costa Coffee" />
      </Field>
      <Field label="Industry context">
        <input value={cfg.industry} onChange={(e) => up({ industry: e.target.value })}
          className="w-full rounded-lg border border-line px-3 py-2 text-[14px] text-navy outline-none focus:border-green" placeholder="e.g. retail / QSR" />
      </Field>
      <Field label="Build catalog (Unity Catalog participants build into)">
        <input value={cfg.catalog} onChange={(e) => up({ catalog: e.target.value })}
          className="w-full rounded-lg border border-line px-3 py-2 text-[14px] text-navy outline-none focus:border-green" placeholder="e.g. workshop_catalog" />
        <p className="mt-1 text-[12px] text-navy-3">Baked into every build prompt. Each participant gets their own schema inside it. Leave blank to let Genie Code use the workspace default.</p>
      </Field>

      <Field label="Capabilities on the table">
        <div className="flex flex-wrap gap-2">
          {allCaps.map((c) => {
            const on = cfg.allowed_capabilities.includes(c);
            return (
              <button key={c} onClick={() => toggleCap(c)}
                className={`rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-semibold transition-colors
                  ${on ? "border-green bg-green-soft text-green-ink" : "border-line bg-white text-navy-3"}`}>
                {on && <Check className="mr-1 inline h-3 w-3" />}{c}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Data path">
        <div className="flex flex-wrap gap-2">
          {["any", "synthetic", "upload", "existing"].map((d) => (
            <button key={d} onClick={() => up({ data_path: d })}
              className={`rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-semibold transition-colors
                ${cfg.data_path === d ? "border-navy bg-navy text-white" : "border-line bg-white text-navy-2"}`}>{d}</button>
          ))}
        </div>
      </Field>

      <Field label="Use case">
        <label className="flex items-center gap-2 text-[13.5px] text-navy-2">
          <input type="checkbox" checked={cfg.prescribed} onChange={(e) => up({ prescribed: e.target.checked })} />
          Prescribe one use case for everyone
        </label>
        {cfg.prescribed && (
          <textarea value={cfg.prescribed_use_case} onChange={(e) => up({ prescribed_use_case: e.target.value })} rows={2}
            className="mt-2 w-full resize-none rounded-lg border border-line px-3 py-2 text-[13.5px] text-navy outline-none focus:border-green"
            placeholder="The use case all participants build…" />
        )}
      </Field>

      <Field label="Extra proctor emails (break-glass)">
        <input value={cfg.admin_emails.join(", ")} onChange={(e) => up({ admin_emails: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          className="w-full rounded-lg border border-line px-3 py-2 text-[14px] text-navy outline-none focus:border-green" placeholder="comma-separated" />
      </Field>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="rounded-xl bg-green px-6 py-3 text-[15px] font-bold text-white hover:bg-green-l disabled:opacity-50">
          {saving ? "Saving…" : "Save config"}
        </button>
        {saved && <span className="flex items-center gap-1.5 text-[13px] font-semibold text-green-ink"><Check className="h-4 w-4" /> Saved</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-navy-3">{label}</div>
      {children}
    </div>
  );
}
