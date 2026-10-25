import { randomUUID } from "node:crypto";
import iconv from "iconv-lite";
import { JsonFile } from "./jsonFile.ts";
import {
  FONT_SIZE_MAX, FONT_SIZE_MIN, KEY_IDS,
  type AppSettings, type HistoryEntry, type HostInput, type HostProfile, type KeyId, type KnownHostEntry,
} from "../shared/types.ts";

export class ValidationError extends Error {}

function req(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new ValidationError(msg);
}

const isStr = (v: unknown): v is string => typeof v === "string";
const optStr = (v: unknown, name: string): string | null => {
  if (v === null) return null;
  req(isStr(v), `${name} must be a string or null`);
  return v === "" ? null : v;
};

// ---------------------------------------------------------------- hosts

const hostsFile = new JsonFile<HostProfile[]>("hosts.json", () => []);

function validateHostInput(body: unknown): HostInput {
  req(body && typeof body === "object", "body must be an object");
  const b = body as Record<string, unknown>;
  req(isStr(b.host) && b.host.trim() !== "", "ต้องระบุโฮสต์");
  req(isStr(b.username) && b.username.trim() !== "", "ต้องระบุชื่อผู้ใช้");
  req(isStr(b.label), "label must be a string");
  req(Number.isInteger(b.port) && (b.port as number) > 0 && (b.port as number) < 65536, "พอร์ตต้องอยู่ระหว่าง 1-65535");
  req(b.authMethod === "password" || b.authMethod === "publickey", "authMethod must be 'password' or 'publickey'");
  req(isStr(b.charset) && iconv.encodingExists(b.charset.trim()), `ไม่รู้จัก charset "${String(b.charset)}"`);
  req(isStr(b.color) && /^#[0-9a-fA-F]{6}$/.test(b.color), "color must be #RRGGBB");
  const privateKey = optStr(b.privateKey, "privateKey");
  if (b.authMethod === "publickey") req(privateKey, "ต้องใส่ private key เมื่อใช้ Public key");
  const host = b.host.trim();
  return {
    label: b.label.trim() === "" ? host : b.label.trim(),
    host,
    port: b.port as number,
    username: b.username.trim(),
    authMethod: b.authMethod,
    password: optStr(b.password, "password"),
    privateKey,
    passphrase: optStr(b.passphrase, "passphrase"),
    charset: b.charset.trim(),
    initialCommand: optStr(b.initialCommand, "initialCommand"),
    color: b.color.toLowerCase(),
  };
}

export const hosts = {
  all(): HostProfile[] {
    return hostsFile.read();
  },
  get(id: string): HostProfile {
    const h = hostsFile.read().find((x) => x.id === id);
    if (!h) throw new ValidationError(`ไม่พบโฮสต์ ${id}`);
    return h;
  },
  create(body: unknown): HostProfile {
    const input = validateHostInput(body);
    const profile: HostProfile = { ...input, id: randomUUID(), osId: null, createdAt: Date.now(), lastUsedAt: null };
    hostsFile.write([...hostsFile.read(), profile]);
    return profile;
  },
  update(id: string, body: unknown): HostProfile {
    const input = validateHostInput(body);
    const list = hostsFile.read();
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) throw new ValidationError(`ไม่พบโฮสต์ ${id}`);
    // เปลี่ยนปลายทาง -> OS เดิมอาจไม่ถูกแล้ว ให้ตรวจใหม่รอบหน้า
    const moved = list[idx].host !== input.host || list[idx].port !== input.port;
    list[idx] = { ...list[idx], ...input, osId: moved ? null : list[idx].osId };
    hostsFile.write(list);
    return list[idx];
  },
  patch(id: string, fields: Partial<Pick<HostProfile, "osId" | "lastUsedAt">>): void {
    const list = hostsFile.read();
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return; // โฮสต์ถูกลบไประหว่างที่ session ยังทำงาน — ไม่มีอะไรให้อัปเดต
    list[idx] = { ...list[idx], ...fields };
    hostsFile.write(list);
  },
  reorder(ids: unknown): void {
    req(Array.isArray(ids) && ids.every(isStr), "ids must be string[]");
    const list = hostsFile.read();
    req(ids.length === list.length && list.every((h) => ids.includes(h.id)), "ids must contain every host exactly once");
    hostsFile.write(ids.map((id) => list.find((h) => h.id === id)!));
  },
  remove(id: string): void {
    hostsFile.write(hostsFile.read().filter((x) => x.id !== id));
  },
};

// ---------------------------------------------------------------- settings

export const KEYBAR_PRESETS: Record<"default" | "minimal" | "arrows" | "power", KeyId[]> = {
  default: ["LEFT", "UP", "DOWN", "RIGHT", "SHIFT_TAB", "CTRL", "ESC", "ALT", "TAB", "HOME", "END", "PGUP", "PGDN", "IME"],
  minimal: ["ESC", "TAB", "CTRL", "IME"],
  arrows: ["LEFT", "UP", "DOWN", "RIGHT", "ESC", "TAB", "CTRL", "ALT", "IME"],
  power: ["ESC", "TAB", "CTRL", "ALT", "CTRL_C", "CTRL_D", "PIPE", "SLASH", "DASH", "TILDE", "LEFT", "UP", "DOWN", "RIGHT", "IME"],
};

// ค่าเริ่มต้นตามสเปกของแอปเดิม (AppSettings.kt) — ใช้เมื่อยังไม่เคยบันทึกเท่านั้น
const INITIAL_SETTINGS: AppSettings = {
  fontSize: 14,
  fontColor: "#e0e0e0",
  fontFamily: "monospace",
  autoReconnect: true,
  keyBarLayout: KEYBAR_PRESETS.default,
  showKeyBar: true,
  showSuggestions: true,
  theme: "system",
  cursorBlink: true,
  scrollback: 5000,
};

const settingsFile = new JsonFile<AppSettings>("settings.json", () => INITIAL_SETTINGS);

function validateSettings(b: Record<string, unknown>): AppSettings {
  req(typeof b.fontSize === "number" && b.fontSize >= FONT_SIZE_MIN && b.fontSize <= FONT_SIZE_MAX,
    `fontSize must be ${FONT_SIZE_MIN}-${FONT_SIZE_MAX}`);
  req(isStr(b.fontColor) && /^#[0-9a-fA-F]{6}$/.test(b.fontColor), "fontColor must be #RRGGBB");
  req(b.fontFamily === "monospace" || b.fontFamily === "sans" || b.fontFamily === "serif", "invalid fontFamily");
  req(typeof b.autoReconnect === "boolean", "autoReconnect must be boolean");
  req(Array.isArray(b.keyBarLayout) && b.keyBarLayout.length > 0, "keyBarLayout must be a non-empty array");
  for (const k of b.keyBarLayout) req((KEY_IDS as readonly string[]).includes(k), `unknown key id ${String(k)}`);
  req(new Set(b.keyBarLayout).size === b.keyBarLayout.length, "keyBarLayout has duplicates");
  req(typeof b.showKeyBar === "boolean", "showKeyBar must be boolean");
  req(typeof b.showSuggestions === "boolean", "showSuggestions must be boolean");
  req(b.theme === "system" || b.theme === "light" || b.theme === "dark", "invalid theme");
  req(typeof b.cursorBlink === "boolean", "cursorBlink must be boolean");
  req(Number.isInteger(b.scrollback) && (b.scrollback as number) >= 100 && (b.scrollback as number) <= 100000,
    "scrollback must be 100-100000");
  return b as unknown as AppSettings;
}

export const settings = {
  get(): AppSettings {
    return validateSettings(settingsFile.read() as unknown as Record<string, unknown>);
  },
  update(body: unknown): AppSettings {
    req(body && typeof body === "object", "body must be an object");
    const next = validateSettings({ ...settingsFile.read(), ...(body as object) });
    settingsFile.write(next);
    return next;
  },
};

// ---------------------------------------------------------------- command history

const HISTORY_MAX = 500;
const HISTORY_DAYS = 7;
const historyFile = new JsonFile<HistoryEntry[]>("history.json", () => []);

export const history = {
  add(cmd: unknown): void {
    req(isStr(cmd), "cmd must be a string");
    const trimmed = cmd.trim();
    if (trimmed === "") return;
    const list = historyFile.read();
    const last = list[list.length - 1];
    if (last && last.cmd === trimmed) last.ts = Date.now();
    else list.push({ cmd: trimmed, ts: Date.now() });
    historyFile.write(list.slice(-HISTORY_MAX));
  },
  /** รายการล่าสุดก่อน ไม่ซ้ำ — client กรอง prefix เองเพื่อให้ตอบสนองทันที */
  recent(): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const list = historyFile.read();
    for (let i = list.length - 1; i >= 0; i--) {
      if (!seen.has(list[i].cmd)) {
        seen.add(list[i].cmd);
        out.push(list[i].cmd);
      }
    }
    return out;
  },
  clear(): void {
    historyFile.write([]);
  },
  prune(): void {
    const cutoff = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000;
    const list = historyFile.read();
    const kept = list.filter((e) => e.ts >= cutoff);
    if (kept.length !== list.length) historyFile.write(kept);
  },
};

// ---------------------------------------------------------------- known hosts

interface KnownHostRecord { host: string; keyType: string; key: string }
const knownFile = new JsonFile<KnownHostRecord[]>("known_hosts.json", () => []);

export const knownHosts = {
  lookup(host: string): KnownHostRecord | undefined {
    return knownFile.read().find((r) => r.host === host);
  },
  save(host: string, keyType: string, key: Buffer): void {
    const list = knownFile.read().filter((r) => r.host !== host);
    list.push({ host, keyType, key: key.toString("base64") });
    knownFile.write(list);
  },
  list(fingerprint: (key: Buffer) => string): KnownHostEntry[] {
    return knownFile.read().map((r) => ({ host: r.host, keyType: r.keyType, fingerprint: fingerprint(Buffer.from(r.key, "base64")) }));
  },
  remove(host: string): void {
    knownFile.write(knownFile.read().filter((r) => r.host !== host));
  },
};
