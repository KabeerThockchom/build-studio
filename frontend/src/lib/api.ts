import type { Blueprint, GenerateRequest, DesignPlan, BuildPlan, IdeaCheck } from "./types";

async function j<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  health: () => j<{ status: string; mode: string }>("/api/health"),
  checkIdea: (req: { idea: string }) =>
    j<IdeaCheck>("/api/check_idea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  planDesign: (req: { idea: string; expertise?: string; interests?: string[]; industry?: string }) =>
    j<{ plan: DesignPlan; source: string }>("/api/plan_design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  generateBlueprint: (req: GenerateRequest) =>
    j<Blueprint>("/api/generate_blueprint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  saveSession: (session_id: string | null, state: unknown) =>
    j<{ ok: boolean; session_id: string; persisted: boolean }>("/api/session/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, state }),
    }),
  loadSession: (id: string) => j<{ state: any }>(`/api/session/${id}`),
  latestSession: () => j<{ found: boolean; session_id?: string; phase?: string; idea?: string; project_name?: string; updated_at?: string }>("/api/session/latest"),
  buildPlan: (req: { idea: string; expertise?: string; capabilities?: string[]; design_answers?: Record<string, string>; prd_markdown?: string; project_name?: string }) =>
    j<BuildPlan>("/api/build_plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  // Persist the settled plan into the user's workspace. Best-effort: the route always
  // returns 200 (ok:true|false), so this never throws and never blocks the build.
  publishAssets: (req: {
    idea: string; prd_markdown?: string; capabilities?: string[];
    design_answers?: Record<string, string>; decisions?: unknown[]; steps?: unknown[];
    usable_assets?: string; project_name?: string;
  }) =>
    j<{ ok: boolean; dir?: string; doc?: string; files?: string[]; host?: string; deep_link?: string; wrote_as?: string; error?: string }>("/api/publish_assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),

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
