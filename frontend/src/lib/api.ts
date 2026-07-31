import type { Blueprint, GenerateRequest, DesignPlan } from "./types";

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
  planDesign: (req: { idea: string; expertise?: string; interests?: string[] }) =>
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
};
