import { create } from "zustand";
import type { AppSettings, HostKeyRequest, HostProfile, SessionInfo } from "../shared/types";
import { api, type KeyBarPresets } from "./api";

export interface Toast {
  id: number;
  kind: "info" | "error" | "success";
  text: string;
}

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  danger: boolean;
  onConfirm: () => void;
}

/** สถานะฟอร์มโฮสต์: null = ปิด, host = แก้ไข, draft = สร้างใหม่ (อาจมีค่าเติมไว้จาก quick connect) */
export type EditorState = null | { mode: "edit"; host: HostProfile } | { mode: "create"; draft: Partial<HostProfile> };

interface State {
  ready: boolean;
  wsOnline: boolean;
  hosts: HostProfile[];
  sessions: SessionInfo[];
  settings: AppSettings | null;
  presets: KeyBarPresets | null;
  history: string[];
  activeId: string | null;
  hostKeyQueue: HostKeyRequest[];
  toasts: Toast[];
  confirm: ConfirmRequest | null;
  editor: EditorState;
  settingsOpen: boolean;
  pickerOpen: boolean;
  keyBarEditorOpen: boolean;
  sidebarOpen: boolean;
  searchOpen: boolean;
  /** ปุ่ม CTRL/ALT แบบ sticky — กดค้างไว้หนึ่งครั้งแล้วมีผลกับปุ่มถัดไป */
  mods: { ctrl: boolean; alt: boolean };
  /** บรรทัดที่ผู้ใช้กำลังพิมพ์ของแต่ละ session — ใช้กรองคำแนะนำ */
  lineBuffer: Record<string, string>;

  set: (p: Partial<State>) => void;
  toast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
  loadHosts: () => Promise<void>;
  updateSettings: (p: Partial<AppSettings>) => Promise<void>;
  rememberCommand: (cmd: string) => void;
}

let toastSeq = 0;

export const useStore = create<State>((set, get) => ({
  ready: false,
  wsOnline: false,
  hosts: [],
  sessions: [],
  settings: null,
  presets: null,
  history: [],
  activeId: null,
  hostKeyQueue: [],
  toasts: [],
  confirm: null,
  editor: null,
  settingsOpen: false,
  pickerOpen: false,
  keyBarEditorOpen: false,
  sidebarOpen: false,
  searchOpen: false,
  mods: { ctrl: false, alt: false },
  lineBuffer: {},

  set: (p) => set(p),

  toast: (kind, text) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
    setTimeout(() => get().dismissToast(id), kind === "error" ? 6000 : 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  loadHosts: async () => {
    set({ hosts: await api.hosts() });
  },

  updateSettings: async (p) => {
    const prev = get().settings;
    if (!prev) throw new Error("settings not loaded");
    set({ settings: { ...prev, ...p } }); // optimistic เพื่อให้พรีวิวสด
    try {
      set({ settings: await api.saveSettings(p) });
    } catch (e) {
      set({ settings: prev });
      get().toast("error", `บันทึกการตั้งค่าไม่สำเร็จ: ${(e as Error).message}`);
    }
  },

  rememberCommand: (cmd) => {
    const trimmed = cmd.trim();
    if (trimmed === "") return;
    set((s) => ({ history: [trimmed, ...s.history.filter((c) => c !== trimmed)] }));
    api.addHistory(trimmed).catch((e: Error) => get().toast("error", `บันทึกประวัติไม่สำเร็จ: ${e.message}`));
  },
}));

export const hostById = (hosts: HostProfile[], id: string) => hosts.find((h) => h.id === id);
