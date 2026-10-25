import type { HostInput, HostProfile } from "../shared/types";
import { api } from "./api";
import { useStore } from "./store";
import { proposeSize } from "./terminals";

const st = () => useStore.getState();
const fail = (prefix: string) => (e: Error) => st().toast("error", `${prefix}: ${e.message}`);

export const HOST_COLORS = ["#8b7cf8", "#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#f472b6", "#a3e635", "#94a3b8"];

export function hostLabel(hostId: string): string {
  const h = st().hosts.find((x) => x.id === hostId);
  return h ? h.label : "(ลบแล้ว)";
}

export async function newSession(hostId: string): Promise<void> {
  const { cols, rows } = proposeSize();
  try {
    const info = await api.createSession(hostId, cols, rows);
    st().set({ activeId: info.id, sidebarOpen: false });
  } catch (e) {
    fail("เปิดเซสชันไม่สำเร็จ")(e as Error);
  }
}

/** คลิกที่การ์ดโฮสต์: ถ้ามีเซสชันอยู่แล้วให้ไปที่อันล่าสุด ไม่งั้นเปิดใหม่ */
export function openHost(hostId: string): void {
  const existing = st().sessions.filter((s) => s.hostId === hostId);
  if (existing.length > 0) st().set({ activeId: existing[existing.length - 1].id, sidebarOpen: false });
  else void newSession(hostId);
}

export function closeSession(id: string, ask: boolean): void {
  const s = st().sessions.find((x) => x.id === id);
  if (!s) return;
  const doClose = () => api.closeSession(id).catch(fail("ปิดเซสชันไม่สำเร็จ"));
  const live = s.state === "connected" || s.state === "connecting" || s.state === "reconnecting";
  if (!ask || !live) {
    void doClose();
    return;
  }
  st().set({
    confirm: {
      title: "ตัดการเชื่อมต่อ",
      body: `ตัดการเชื่อมต่อจาก ${hostLabel(s.hostId)} (${s.seq})?`,
      confirmLabel: "ตัดการเชื่อมต่อ",
      danger: true,
      onConfirm: () => void doClose(),
    },
  });
}

export function retrySession(id: string): void {
  api.retrySession(id).catch(fail("เชื่อมต่อใหม่ไม่สำเร็จ"));
}

export function deleteHost(h: HostProfile): void {
  const n = st().sessions.filter((s) => s.hostId === h.id).length;
  st().set({
    confirm: {
      title: "ลบโฮสต์",
      body: n > 0 ? `ลบ "${h.label}" และปิด ${n} เซสชันที่เปิดอยู่?` : `ลบ "${h.label}" ออกจากรายการ?`,
      confirmLabel: "ลบ",
      danger: true,
      onConfirm: () => {
        api.deleteHost(h.id).then(() => st().toast("success", `ลบ ${h.label} แล้ว`), fail("ลบไม่สำเร็จ"));
      },
    },
  });
}

export function toInput(h: HostProfile): HostInput {
  const { id: _id, createdAt: _c, lastUsedAt: _l, osId: _o, ...rest } = h;
  return rest;
}

export function duplicateHost(h: HostProfile): void {
  api.createHost({ ...toInput(h), label: `${h.label} (สำเนา)` })
    .then(() => st().toast("success", "ทำสำเนาแล้ว"), fail("ทำสำเนาไม่สำเร็จ"));
}

/** แยก "user@host:port" จากช่อง quick connect */
export function parseQuickConnect(text: string): Partial<HostProfile> | null {
  const m = /^\s*(?:([^@\s]+)@)?([^\s:@]+|\[[^\]]+\])(?::(\d{1,5}))?\s*$/.exec(text);
  if (!m) return null;
  const draft: Partial<HostProfile> = { host: m[2].replace(/^\[|\]$/g, "") };
  if (m[1]) draft.username = m[1];
  if (m[3]) draft.port = Number(m[3]);
  return draft;
}
