import type { AppSettings, HostInput, HostProfile, KeyId, KnownHostEntry, SessionInfo } from "../shared/types";

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
  return json as T;
}

export type KeyBarPresets = Record<"default" | "minimal" | "arrows" | "power", KeyId[]>;

export const api = {
  hosts: () => call<HostProfile[]>("GET", "/hosts"),
  createHost: (h: HostInput) => call<HostProfile>("POST", "/hosts", h),
  updateHost: (id: string, h: HostInput) => call<HostProfile>("PUT", `/hosts/${id}`, h),
  deleteHost: (id: string) => call<{ ok: true }>("DELETE", `/hosts/${id}`),
  reorderHosts: (ids: string[]) => call<{ ok: true }>("PUT", "/hosts/order", { ids }),

  createSession: (hostId: string, cols: number, rows: number) => call<SessionInfo>("POST", "/sessions", { hostId, cols, rows }),
  retrySession: (id: string) => call<{ ok: true }>("POST", `/sessions/${encodeURIComponent(id)}/retry`),
  closeSession: (id: string) => call<{ ok: true }>("DELETE", `/sessions/${encodeURIComponent(id)}`),

  settings: () => call<{ settings: AppSettings; presets: KeyBarPresets }>("GET", "/settings"),
  saveSettings: (s: Partial<AppSettings>) => call<AppSettings>("PUT", "/settings", s),

  history: () => call<string[]>("GET", "/history"),
  addHistory: (cmd: string) => call<{ ok: true }>("POST", "/history", { cmd }),
  clearHistory: () => call<{ ok: true }>("DELETE", "/history"),

  knownHosts: () => call<KnownHostEntry[]>("GET", "/known-hosts"),
  forgetKnownHost: (host: string) => call<{ ok: true }>("DELETE", `/known-hosts/${encodeURIComponent(host)}`),
};
