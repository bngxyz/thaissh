import type { ClientMessage, ServerMessage, SessionInfo } from "../shared/types";
import { useStore } from "./store";
import { allEntryIds, disposeEntry, ensureEntry, resyncAll, writeData, writeReplay } from "./terminals";

let socket: WebSocket | null = null;
let retryDelay = 500;
let everConnected = false;

export function wsSend(msg: ClientMessage): void {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function syncSessions(list: SessionInfo[]): void {
  const st = useStore.getState();
  const ids = new Set(list.map((s) => s.id));
  for (const id of allEntryIds()) if (!ids.has(id)) disposeEntry(id);
  for (const s of list) ensureEntry(s.id);

  let activeId = st.activeId;
  if (activeId && !ids.has(activeId)) activeId = null;
  if (!activeId && list.length > 0 && !st.ready) activeId = list[list.length - 1].id;
  if (!activeId && list.length > 0 && st.activeId) {
    // แท็บที่เปิดอยู่ถูกปิด -> ไปแท็บข้างเคียง
    const oldIdx = st.sessions.findIndex((s) => s.id === st.activeId);
    activeId = list[Math.min(Math.max(oldIdx, 0), list.length - 1)].id;
  }

  // แจ้งเตือนเมื่อสถานะเปลี่ยนเป็น failed ขณะผู้ใช้ไม่ได้ดูแท็บนั้น
  for (const s of list) {
    const before = st.sessions.find((x) => x.id === s.id);
    if (before && before.state !== "failed" && s.state === "failed" && s.id !== activeId) {
      const host = st.hosts.find((h) => h.id === s.hostId);
      st.toast("error", `${host ? host.label : "เซสชัน"} (${s.seq}) เชื่อมต่อไม่สำเร็จ`);
    }
  }
  st.set({ sessions: list, activeId, ready: true });
}

function onMessage(msg: ServerMessage): void {
  const st = useStore.getState();
  switch (msg.t) {
    case "sessions": syncSessions(msg.list); break;
    case "data": writeData(msg.id, msg.data); break;
    case "replay": writeReplay(msg.id, msg.data); break;
    case "hostkey":
      if (!st.hostKeyQueue.some((r) => r.reqId === msg.req.reqId)) st.set({ hostKeyQueue: [...st.hostKeyQueue, msg.req] });
      break;
    case "hostkey-done":
      st.set({ hostKeyQueue: st.hostKeyQueue.filter((r) => r.reqId !== msg.reqId) });
      break;
    case "hosts-changed":
      st.loadHosts().catch((e: Error) => st.toast("error", e.message));
      break;
  }
}

export function connectWs(): void {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  socket = ws;
  ws.onopen = () => {
    retryDelay = 500;
    useStore.getState().set({ wsOnline: true });
    if (everConnected) {
      resyncAll();
      useStore.getState().loadHosts().catch((e: Error) => useStore.getState().toast("error", e.message));
    }
    everConnected = true;
  };
  ws.onmessage = (ev) => onMessage(JSON.parse(ev.data as string) as ServerMessage);
  ws.onclose = () => {
    if (socket !== ws) return;
    useStore.getState().set({ wsOnline: false, hostKeyQueue: [] });
    setTimeout(connectWs, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 8000);
  };
}
