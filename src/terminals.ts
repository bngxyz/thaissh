import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { FONT_SIZE_MAX, FONT_SIZE_MIN, type AppSettings, type FontFamily, type KeyId } from "../shared/types";
import { useStore } from "./store";
import { wsSend } from "./ws";

/**
 * ทะเบียน xterm หนึ่งตัวต่อหนึ่ง session — อยู่นอก React เพื่อให้สลับแท็บแล้วจอ/scrollback ไม่หาย
 * (เทียบได้กับ TerminalEmulator ที่ LiveSession ถือไว้ในแอป Android เดิม)
 */

// ฟอนต์ไทยต่อท้ายทุกชุด เพื่อให้สระ/วรรณยุกต์แสดงถูกแม้ฟอนต์หลักไม่มี glyph ไทย
export const FONT_STACKS: Record<FontFamily, string> = {
  monospace: "'JetBrains Mono', 'Noto Sans Thai Looped', ui-monospace, Consolas, monospace",
  sans: "'IBM Plex Sans Thai', 'Noto Sans Thai Looped', system-ui, sans-serif",
  serif: "Georgia, 'Noto Sans Thai Looped', 'Times New Roman', serif",
};

const BASE_THEME: ITheme = {
  background: "#0d0f14",
  cursor: "#a78bfa",
  cursorAccent: "#0d0f14",
  selectionBackground: "#7c6cf655",
  black: "#1b1e27", red: "#f7768e", green: "#9ece6a", yellow: "#e0af68",
  blue: "#7aa2f7", magenta: "#bb9af7", cyan: "#7dcfff", white: "#c0caf5",
  brightBlack: "#565f89", brightRed: "#ff8ea3", brightGreen: "#b5e890", brightYellow: "#f5c98a",
  brightBlue: "#9cbcff", brightMagenta: "#d4b8ff", brightCyan: "#a6e3ff", brightWhite: "#ffffff",
};

interface Entry {
  term: Terminal;
  fit: FitAddon;
  search: SearchAddon;
  el: HTMLDivElement;
  opened: boolean;
  /** รอ replay จาก server — ระหว่างนี้ทิ้ง data สด เพราะ replay จะรวมไว้แล้ว */
  awaitingReplay: boolean;
  /** บรรทัดที่ผู้ใช้พิมพ์ (CommandTracker) */
  line: string;
  /** บรรทัดนี้ถูกแก้ด้วยลูกศร/ประวัติของ shell — ข้อความที่เราเห็นไม่ตรงกับคำสั่งจริง */
  lineDirty: boolean;
  /** ท้าย output ล่าสุด ใช้ดูว่ากำลังถามรหัสผ่านหรือไม่ (จะได้ไม่เก็บรหัสลงประวัติ) */
  outputTail: string;
}

const entries = new Map<string, Entry>();

function termOptions(s: AppSettings) {
  return {
    fontSize: s.fontSize,
    fontFamily: FONT_STACKS[s.fontFamily],
    cursorBlink: s.cursorBlink,
    scrollback: s.scrollback,
    theme: { ...BASE_THEME, foreground: s.fontColor },
  };
}

function requireSettings(): AppSettings {
  const s = useStore.getState().settings;
  if (!s) throw new Error("settings must be loaded before creating terminals");
  return s;
}

export function hasEntry(id: string): boolean {
  return entries.has(id);
}

export function ensureEntry(id: string): Entry {
  const existing = entries.get(id);
  if (existing) return existing;

  const term = new Terminal({
    ...termOptions(requireSettings()),
    allowProposedApi: true,
    lineHeight: 1.15,
    macOptionIsMeta: true,
    rightClickSelectsWord: true,
  });
  const fit = new FitAddon();
  const search = new SearchAddon();
  term.loadAddon(fit);
  term.loadAddon(search);
  term.loadAddon(new Unicode11Addon());
  term.unicode.activeVersion = "11"; // ความกว้างอักขระไทย/CJK/emoji ที่ถูกต้อง
  term.loadAddon(new WebLinksAddon((_e, uri) => window.open(uri, "_blank", "noopener")));

  const el = document.createElement("div");
  el.className = "xterm-host";

  const entry: Entry = { term, fit, search, el, opened: false, awaitingReplay: true, line: "", lineDirty: false, outputTail: "" };
  entries.set(id, entry);

  term.onData((data) => handleUserInput(id, data));
  term.onResize(({ cols, rows }) => wsSend({ t: "resize", id, cols, rows }));
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== "keydown") return true;
    // Shift+Tab เปิดตัวแก้ไขแถบปุ่ม (เหมือนแอปเดิม)
    if (e.shiftKey && e.key === "Tab" && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      useStore.getState().set({ keyBarEditorOpen: true });
      return false;
    }
    if (e.ctrlKey && e.shiftKey && e.code === "KeyC") {
      const sel = term.getSelection();
      if (sel) navigator.clipboard.writeText(sel).catch(() => useStore.getState().toast("error", "คัดลอกไม่สำเร็จ"));
      return false;
    }
    if (e.ctrlKey && e.shiftKey && e.code === "KeyV") {
      navigator.clipboard.readText().then((t) => term.paste(t), () => useStore.getState().toast("error", "อ่านคลิปบอร์ดไม่ได้"));
      return false;
    }
    if (e.ctrlKey && e.shiftKey && e.code === "KeyF") {
      useStore.getState().set({ searchOpen: true });
      return false;
    }
    return true;
  });

  wsSend({ t: "replay", id });
  return entry;
}

export function disposeEntry(id: string): void {
  const e = entries.get(id);
  if (!e) return;
  e.term.dispose();
  e.el.remove();
  entries.delete(id);
}

export function writeData(id: string, data: string): void {
  const e = entries.get(id);
  if (!e || e.awaitingReplay) return;
  e.term.write(data);
  e.outputTail = (e.outputTail + data).slice(-160);
}

export function writeReplay(id: string, data: string): void {
  const e = entries.get(id);
  if (!e) return;
  e.term.reset();
  e.term.write(data);
  e.outputTail = data.slice(-160);
  e.awaitingReplay = false;
}

/** หลัง websocket ต่อใหม่ (เช่น server restart) ให้ทุกจอขอ replay ใหม่ */
export function resyncAll(): void {
  for (const [id, e] of entries) {
    e.awaitingReplay = true;
    wsSend({ t: "replay", id });
  }
}

export function allEntryIds(): string[] {
  return [...entries.keys()];
}

export function applySettingsToAll(s: AppSettings): void {
  const opts = termOptions(s);
  for (const e of entries.values()) {
    Object.assign(e.term.options, opts);
    if (e.opened && e.el.isConnected) e.fit.fit();
  }
}

/** ย้าย element ของจอเข้า container ที่มองเห็น แล้ว fit ให้พอดี */
export function mount(id: string, container: HTMLElement): void {
  const e = ensureEntry(id);
  if (e.el.parentElement !== container) {
    container.replaceChildren(e.el);
  }
  if (!e.opened) {
    e.term.open(e.el);
    e.opened = true;
    if (IS_ANDROID) attachAndroidInput(id, e);
  }
  fitEntry(id);
  e.term.focus();
}

export function fitEntry(id: string): void {
  const e = entries.get(id);
  if (!e || !e.opened || !e.el.isConnected || e.el.clientWidth === 0) return;
  e.fit.fit();
}

/**
 * ใช้สองนิ้วถ่าง/หุบบนจอ terminal เพื่อขยาย/ย่อตัวอักษร — ปรับสดระหว่างนิ้วขยับ แล้วบันทึกลงการตั้งค่าเมื่อปล่อยนิ้ว
 * ฟังใน capture phase เพื่อไม่ให้ xterm เอาการแตะสองนิ้วไปเลื่อน scrollback
 */
export function attachPinchZoom(id: string, target: HTMLElement): () => void {
  let startDist = 0;
  let startSize = 0;
  let size = 0;

  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onStart = (ev: TouchEvent) => {
    if (ev.touches.length !== 2) return;
    const e = entries.get(id);
    if (!e) return;
    startDist = dist(ev.touches);
    startSize = e.term.options.fontSize!;
    size = startSize;
    ev.stopPropagation();
  };
  const onMove = (ev: TouchEvent) => {
    if (startDist === 0 || ev.touches.length !== 2) return;
    ev.preventDefault();
    ev.stopPropagation();
    const next = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(startSize * (dist(ev.touches) / startDist))));
    if (next === size) return;
    size = next;
    const e = entries.get(id);
    if (!e) return;
    e.term.options.fontSize = size;
    fitEntry(id);
  };
  const onEnd = (ev: TouchEvent) => {
    if (startDist === 0 || ev.touches.length >= 2) return;
    startDist = 0;
    if (size !== startSize) void useStore.getState().updateSettings({ fontSize: size });
  };

  target.addEventListener("touchstart", onStart, { capture: true, passive: true });
  target.addEventListener("touchmove", onMove, { capture: true, passive: false });
  target.addEventListener("touchend", onEnd, { capture: true });
  target.addEventListener("touchcancel", onEnd, { capture: true });
  return () => {
    target.removeEventListener("touchstart", onStart, { capture: true });
    target.removeEventListener("touchmove", onMove, { capture: true });
    target.removeEventListener("touchend", onEnd, { capture: true });
    target.removeEventListener("touchcancel", onEnd, { capture: true });
  };
}

export function proposeSize(): { cols: number; rows: number } {
  // ขนาดเริ่มต้นตอนขอ shell ครั้งแรก: ใช้ขนาดจอที่เปิดอยู่ ถ้ามี
  for (const e of entries.values()) {
    if (e.opened && e.el.isConnected) return { cols: e.term.cols, rows: e.term.rows };
  }
  return { cols: 100, rows: 30 };
}

export function focusEntry(id: string): void {
  entries.get(id)?.term.focus();
}

export function blurEntry(id: string): void {
  entries.get(id)?.term.blur();
}

export function isFocused(id: string): boolean {
  const e = entries.get(id);
  return !!e && e.el.contains(document.activeElement);
}

export function getSearch(id: string): SearchAddon | null {
  return entries.get(id)?.search ?? null;
}

export function clearScreen(id: string): void {
  entries.get(id)?.term.clear();
}

// ------------------------------------------------------------------ input

const PASSWORD_PROMPT = /(password|passphrase|รหัสผ่าน|verification code|pin)[^\n]*:\s*$/i;

/** ติดตามบรรทัดคำสั่งที่ผู้ใช้พิมพ์ — กด Enter แล้วเก็บเข้าประวัติ (CommandTracker เดิม) */
function trackCommand(id: string, e: Entry, data: string): void {
  if (data.startsWith("\x1b")) {
    // ลูกศร/Home/End/ประวัติของ shell — เราไม่รู้แล้วว่าบรรทัดจริงเป็นอะไร
    if (data.length > 1) e.lineDirty = true;
    return;
  }
  for (const ch of data) {
    if (ch === "\r" || ch === "\n") {
      const cmd = e.line.trim();
      if (cmd && !e.lineDirty && !PASSWORD_PROMPT.test(e.outputTail)) useStore.getState().rememberCommand(cmd);
      e.line = "";
      e.lineDirty = false;
    } else if (ch === "\x7f" || ch === "\b") {
      e.line = [...e.line].slice(0, -1).join("");
    } else if (ch === "\x03" || ch === "\x15" || ch === "\x04") {
      e.line = "";
      e.lineDirty = false;
    } else if (ch === "\t") {
      e.lineDirty = true; // tab completion เติมข้อความที่เราไม่เห็น
    } else if (ch >= " ") {
      e.line += ch;
    }
  }
  const st = useStore.getState();
  if (st.lineBuffer[id] !== e.line) st.set({ lineBuffer: { ...st.lineBuffer, [id]: e.lineDirty ? "" : e.line } });
}

function applyMods(data: string): string {
  const st = useStore.getState();
  const { ctrl, alt } = st.mods;
  if (!ctrl && !alt) return data;
  st.set({ mods: { ctrl: false, alt: false } });
  let out = data;
  if (ctrl && out.length === 1) {
    const c = out.toUpperCase().charCodeAt(0);
    if (c >= 64 && c <= 95) out = String.fromCharCode(c - 64); // @A-Z[\]^_ -> 0x00-0x1f
    else if (out === " ") out = "\x00";
    else if (out === "?") out = "\x7f";
  }
  if (alt) out = "\x1b" + out;
  return out;
}

// Android WebView + คีย์บอร์ดบนจอ: กด Enter ครั้งเดียว xterm อาจได้ทั้ง keydown(13) -> "\r"
// และ keyCode 229 ที่ xterm ไปเทียบ textarea แล้วเจอ "\n" — ทำให้ Enter ซ้ำ 2-3 ครั้งภายในไม่กี่ ms
// ช่วงนี้สั้นกว่า key repeat ของการกดค้าง (~33 ms) จึงไม่กิน Enter ที่ผู้ใช้ตั้งใจกดจริง
const NEWLINE_DEDUP_MS = 25;
let lastNewlineAt = 0;

function handleUserInput(id: string, raw: string): void {
  const e = entries.get(id);
  if (!e) return;
  let input = raw;
  if (/^[\r\n]+$/.test(input)) {
    const now = performance.now();
    if (now - lastNewlineAt < NEWLINE_DEDUP_MS) return;
    lastNewlineAt = now;
    input = "\r"; // Enter ของ terminal คือ CR; "\n" / "\r\n" มาจาก IME
  }
  const data = applyMods(input);
  trackCommand(id, e, data);
  wsSend({ t: "input", id, data });
}

const IS_ANDROID = /Android/i.test(navigator.userAgent);

/**
 * คีย์บอร์ดมือถือ (โดยเฉพาะ Samsung) ประสมคำภาษาอังกฤษค้างไว้ (composition) จนกว่าจะเว้นวรรค —
 * xterm จะยังไม่ส่งอะไรเลย ทำให้ Ctrl/Alt แบบค้าง, Tab, Esc, ลูกศร ทำงานผิดลำดับหรือไม่ทำงาน
 * บน Android เราจึงรับ input จาก textarea เองทั้งหมด: ส่งทุกตัวอักษรทันทีที่ประสม
 * (ถ้า IME แก้คำที่ประสมอยู่ ก็ส่ง Backspace แล้วพิมพ์ส่วนที่ต่างให้ตรงกัน)
 * ฟังใน capture phase ที่ element แม่ แล้ว stopPropagation เพื่อไม่ให้ listener ของ xterm บน textarea ทำงานซ้ำ
 */
function attachAndroidInput(id: string, e: Entry): void {
  const ta = e.term.textarea;
  if (!ta) throw new Error("xterm textarea missing after open");
  let composed: string[] = [];

  const sendComposition = (text: string) => {
    const next = [...text];
    let same = 0;
    while (same < composed.length && same < next.length && composed[same] === next[same]) same++;
    const out = "\x7f".repeat(composed.length - same) + next.slice(same).join("");
    composed = next;
    if (out) handleUserInput(id, out);
  };

  const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (ev: HTMLElementEventMap[K]) => void) =>
    e.el.addEventListener(type, (ev) => {
      if (ev.target !== ta) return;
      ev.stopPropagation();
      fn(ev);
    }, true);

  on("compositionstart", () => { composed = []; });
  on("compositionupdate", (ev) => sendComposition(ev.data));
  on("compositionend", (ev) => {
    sendComposition(ev.data);
    composed = [];
    ta.value = "";
  });
  on("beforeinput", (ev) => {
    if (ev.isComposing) return;
    if (ev.inputType === "deleteContentBackward") {
      ev.preventDefault();
      handleUserInput(id, "\x7f");
    } else if (ev.inputType === "insertLineBreak" || ev.inputType === "insertParagraph") {
      ev.preventDefault();
      handleUserInput(id, "\r");
    }
  });
  on("input", (raw) => {
    const ev = raw as InputEvent;
    if (ev.inputType === "insertText" && ev.data) {
      handleUserInput(id, ev.data);
      ta.value = "";
    }
  });
  // keyCode 229 = "IME กำลังจัดการ" — xterm จะไปเทียบ textarea แล้วส่งซ้ำกับที่เราส่งไปแล้ว จึงไม่ให้ถึง xterm
  // ปุ่มจริง (Enter/Backspace ที่คีย์บอร์ดส่งเป็น key event) ยังให้ xterm จัดการตามปกติ
  e.el.addEventListener("keydown", (ev) => {
    if (ev.target === ta && ev.keyCode === 229) ev.stopPropagation();
  }, true);
}

/** ส่งข้อความเข้า terminal ราวกับผู้ใช้พิมพ์ (ใช้กับ chip คำแนะนำ) */
export function typeText(id: string, text: string): void {
  const e = entries.get(id);
  if (!e) return;
  trackCommand(id, e, text);
  wsSend({ t: "input", id, data: text });
  e.term.focus();
}

/** ปุ่มบนแถบปุ่มพิเศษ — คำนวณ escape sequence ตามโหมดเคอร์เซอร์ + modifier ที่ค้างอยู่ */
export function pressKey(id: string, key: KeyId): void {
  const e = entries.get(id);
  if (!e) return;
  const st = useStore.getState();
  const { ctrl, alt } = st.mods;
  const appCursor = e.term.modes.applicationCursorKeysMode;
  const modParam = ctrl && alt ? 7 : ctrl ? 5 : alt ? 3 : 0;

  const arrow = (c: string) => (modParam ? `\x1b[1;${modParam}${c}` : appCursor ? `\x1bO${c}` : `\x1b[${c}`);
  const tilde = (n: number) => (modParam ? `\x1b[${n};${modParam}~` : `\x1b[${n}~`);

  let seq: string | null = null;
  switch (key) {
    case "CTRL": st.set({ mods: { ...st.mods, ctrl: !ctrl } }); return;
    case "ALT": st.set({ mods: { ...st.mods, alt: !alt } }); return;
    case "IME":
      // สลับคีย์บอร์ดบนจอ: โฟกัส = แสดง, blur = ซ่อน
      if (isFocused(id)) e.term.blur();
      else e.term.focus();
      return;
    case "ESC": seq = alt ? "\x1b\x1b" : "\x1b"; break;
    case "TAB": seq = "\t"; break;
    case "SHIFT_TAB": seq = "\x1b[Z"; break;
    case "UP": seq = arrow("A"); break;
    case "DOWN": seq = arrow("B"); break;
    case "RIGHT": seq = arrow("C"); break;
    case "LEFT": seq = arrow("D"); break;
    case "HOME": seq = arrow("H"); break;
    case "END": seq = arrow("F"); break;
    case "PGUP": seq = tilde(5); break;
    case "PGDN": seq = tilde(6); break;
    case "CTRL_C": seq = "\x03"; break;
    case "CTRL_D": seq = "\x04"; break;
    case "CTRL_Z": seq = "\x1a"; break;
    case "CTRL_L": seq = "\x0c"; break;
    case "PIPE": handleUserInput(id, "|"); return;
    case "SLASH": handleUserInput(id, "/"); return;
    case "DASH": handleUserInput(id, "-"); return;
    case "TILDE": handleUserInput(id, "~"); return;
  }
  if (ctrl || alt) st.set({ mods: { ctrl: false, alt: false } });
  trackCommand(id, e, seq);
  wsSend({ t: "input", id, data: seq });
}
