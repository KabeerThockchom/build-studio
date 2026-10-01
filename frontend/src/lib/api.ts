import type { Blueprint, BuildPlan, PlanStage, StudioHandoff } from "./types";

async function j<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}
const post = (body: unknown): RequestInit => ({
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export interface PlanStatus { status: "running" | "done" | "error"; stage: PlanStage; blueprint?: Blueprint; error?: string; }

export const api = {
  health: () => j<{ status: string; mode: string }>("/api/health"),

  // --- the Sit-Down (the chat itself streams NDJSON; see components/sitdown/useChat) ---
  sitdownApplyPackage: (state: unknown, key: string) =>
    j<{ state: any; packages: any }>("/api/sitdown/apply_package", post({ state, key })),
  sitdownSetFeatures: (state: unknown, features: unknown[]) =>
    j<{ state: any }>("/api/sitdown/set_features", post({ state, features })),
  sitdownHandoff: (state: unknown, readback: unknown) =>
    j<{ studio: StudioHandoff }>("/api/sitdown/handoff", post({ state, readback })),
  sitdownConfig: () => j<{ day_capacity?: number; dims?: { key: string; label: string }[]; grades?: string[] }>("/api/sitdown/config"),

  // --- the plan job, drafted in the background while they learn ---
  planStart: (req: { idea: string; answers: Record<string, string>; capabilities: string[]; project_name: string; adjust?: string; previous?: Blueprint | null }) =>
    j<{ job_id: string }>("/api/plan/start", post(req)),
  planStatus: (id: string) => j<PlanStatus>(`/api/plan/${id}`),

  // --- sessions ---
  saveSession: (session_id: string | null, state: unknown) =>
    j<{ ok: boolean; session_id: string; persisted: boolean }>("/api/session/save", post({ session_id, state })),
  loadSession: (id: string) => j<{ state: any }>(`/api/session/${id}`),
  latestSession: () => j<{ found: boolean; session_id?: string; phase?: string; idea?: string; project_name?: string; updated_at?: string }>("/api/session/latest"),

  // --- build ---
  buildPlan: (req: { idea: string; capabilities?: string[]; design_answers?: Record<string, string>; prd_markdown?: string; project_name?: string; app_screens?: string[] }) =>
    j<BuildPlan>("/api/build_plan", post(req)),
  // Persist the settled plan into the user's workspace. Best-effort: always 200 (ok:true|false).
  publishAssets: (req: {
    idea: string; prd_markdown?: string; capabilities?: string[];
    design_answers?: Record<string, string>; decisions?: unknown[]; steps?: unknown[];
    usable_assets?: string; project_name?: string;
  }) =>
    j<{ ok: boolean; dir?: string; doc?: string; files?: string[]; host?: string; deep_link?: string; wrote_as?: string; error?: string }>("/api/publish_assets", post(req)),

  // --- admin / proctor console ---
  adminMe: () => j<{ email: string; is_admin: boolean; sessions_enabled: boolean }>("/api/admin/me"),
  adminRoster: () => j<{ count: number; by_phase: Record<string, number>; participants: RosterRow[] }>("/api/admin/roster"),
  adminParticipant: (sid: string) => j<{ session_id: string; state: any; progress: Progress; capabilities: string[]; blueprint: any; deep_links: Record<string, string> }>(`/api/admin/participant/${sid}`),
  adminTriage: (sid: string) => j<{ triage: { status: string; likely_blocker?: string; suggested_action?: string } }>(`/api/admin/participant/${sid}/triage`, { method: "POST" }),
  adminGetConfig: () => j<{ config: WorkshopConfig; all_capabilities: string[] }>("/api/admin/config"),
  adminPutConfig: (config: Partial<WorkshopConfig>) =>
    j<{ ok: boolean; config: WorkshopConfig }>("/api/admin/config", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }),
    }),
};

export interface Progress { phase: string; phase_label: string; detail: string; }
export interface RosterRow extends Progress {
  session_id: string; app_user: string; idea: string;
  idle_min: number | null; stuck: boolean; updated_at: string | null;
}
export interface WorkshopConfig {
  workshop_name: string; allowed_capabilities: string[];
  prescribed: boolean; prescribed_use_case: string;
  industry: string; company: string; data_path: string;
  catalog: string;
  admin_emails: string[];
}
