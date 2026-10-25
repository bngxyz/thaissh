// ชนิดข้อมูลที่ใช้ร่วมกันระหว่าง server (Node) และ client (React)

export type AuthMethod = "password" | "publickey";

export interface HostProfile {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password: string | null;
  privateKey: string | null;
  passphrase: string | null;
  charset: string;
  initialCommand: string | null;
  /** ชนิด OS ที่ตรวจพบ เช่น "ubuntu"; null = ยังไม่เคยตรวจ */
  osId: string | null;
  /** สีประจำโฮสต์ (accent) ที่ผู้ใช้เลือก */
  color: string;
  createdAt: number;
  lastUsedAt: number | null;
}

/** ข้อมูลที่ client ส่งมาตอนสร้าง/แก้ไขโฮสต์ (server เป็นคนกำหนด id/เวลา/osId) */
export type HostInput = Omit<HostProfile, "id" | "createdAt" | "lastUsedAt" | "osId">;

export type SessionState = "connecting" | "connected" | "reconnecting" | "disconnected" | "failed";

export interface SessionInfo {
  id: string;
  hostId: string;
  seq: number;
  state: SessionState;
  error: string | null;
  reconnectAttempt: number;
  startedAt: number;
}

export type FontFamily = "monospace" | "sans" | "serif";
export type ThemeMode = "system" | "light" | "dark";

export const KEY_IDS = [
  "ESC", "TAB", "SHIFT_TAB", "CTRL", "ALT", "LEFT", "UP", "DOWN", "RIGHT",
  "HOME", "END", "PGUP", "PGDN", "IME",
  "PIPE", "SLASH", "DASH", "TILDE", "CTRL_C", "CTRL_D", "CTRL_Z", "CTRL_L",
] as const;
export type KeyId = (typeof KEY_IDS)[number];

export interface AppSettings {
  fontSize: number;
  fontColor: string;
  fontFamily: FontFamily;
  autoReconnect: boolean;
  keyBarLayout: KeyId[];
  showKeyBar: boolean;
  showSuggestions: boolean;
  theme: ThemeMode;
  cursorBlink: boolean;
  scrollback: number;
}

export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 28;

export interface HistoryEntry {
  cmd: string;
  ts: number;
}

export interface KnownHostEntry {
  host: string;
  keyType: string;
  fingerprint: string;
}

export interface HostKeyRequest {
  reqId: string;
  sessionId: string;
  host: string;
  keyType: string;
  fingerprint: string;
  /** true = โฮสต์ใหม่, false = key เปลี่ยนจากที่บันทึกไว้ (อาจเป็น MITM) */
  isNew: boolean;
  previousFingerprint: string | null;
}

// ----- WebSocket protocol -----
export type ClientMessage =
  | { t: "input"; id: string; data: string }
  | { t: "resize"; id: string; cols: number; rows: number }
  | { t: "replay"; id: string }
  | { t: "hostkey-reply"; reqId: string; accept: boolean };

export type ServerMessage =
  | { t: "sessions"; list: SessionInfo[] }
  | { t: "data"; id: string; data: string }
  | { t: "replay"; id: string; data: string }
  | { t: "hostkey"; req: HostKeyRequest }
  | { t: "hostkey-done"; reqId: string }
  | { t: "hosts-changed" };
