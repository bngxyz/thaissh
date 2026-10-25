import { useMemo } from "react";
import { History, Keyboard, SlidersHorizontal, X } from "lucide-react";
import type { KeyId } from "../../shared/types";
import { useStore } from "../store";
import { pressKey, typeText } from "../terminals";
import { api } from "../api";

export const KEY_LABELS: Record<KeyId, string> = {
  ESC: "esc", TAB: "tab", SHIFT_TAB: "shift+tab", CTRL: "ctrl", ALT: "alt",
  LEFT: "←", UP: "↑", DOWN: "↓", RIGHT: "→",
  HOME: "home", END: "end", PGUP: "pgup", PGDN: "pgdn", IME: "ime",
  PIPE: "|", SLASH: "/", DASH: "-", TILDE: "~",
  CTRL_C: "^C", CTRL_D: "^D", CTRL_Z: "^Z", CTRL_L: "^L",
};

export const KEY_DESCRIPTIONS: Record<KeyId, string> = {
  ESC: "Escape", TAB: "Tab", SHIFT_TAB: "Shift+Tab", CTRL: "Ctrl (ค้าง)", ALT: "Alt (ค้าง)",
  LEFT: "ลูกศรซ้าย", UP: "ลูกศรขึ้น", DOWN: "ลูกศรลง", RIGHT: "ลูกศรขวา",
  HOME: "Home", END: "End", PGUP: "Page Up", PGDN: "Page Down", IME: "เปิด/ปิดคีย์บอร์ด",
  PIPE: "ไปป์ |", SLASH: "สแลช /", DASH: "ขีด -", TILDE: "ทิลเดอ ~",
  CTRL_C: "Ctrl+C หยุด", CTRL_D: "Ctrl+D ออก", CTRL_Z: "Ctrl+Z พัก", CTRL_L: "Ctrl+L ล้างจอ",
};

export function KeyBar({ sessionId }: { sessionId: string }) {
  const layout = useStore((s) => s.settings!.keyBarLayout);
  const mods = useStore((s) => s.mods);
  const set = useStore((s) => s.set);

  return (
    <div className="keybar">
      <div className="keybar-scroll">
        {layout.map((k) => {
          const on = (k === "CTRL" && mods.ctrl) || (k === "ALT" && mods.alt);
          return (
            <button
              key={k}
              className={`key${on ? " is-on" : ""}${k === "IME" ? " key-ime" : ""}`}
              title={KEY_DESCRIPTIONS[k]}
              // ใช้ pointerdown + preventDefault เพื่อไม่ให้ terminal เสียโฟกัส (คีย์บอร์ดมือถือไม่หุบ)
              onPointerDown={(e) => { e.preventDefault(); pressKey(sessionId, k); }}
            >
              {k === "IME" ? <Keyboard size={16} /> : KEY_LABELS[k]}
            </button>
          );
        })}
      </div>
      <button className="key key-edit" title="ปรับแต่งแถบปุ่ม (Shift+Tab)" onClick={() => set({ keyBarEditorOpen: true })}>
        <SlidersHorizontal size={15} />
      </button>
    </div>
  );
}

export function SuggestionBar({ sessionId }: { sessionId: string }) {
  const history = useStore((s) => s.history);
  const line = useStore((s) => s.lineBuffer[sessionId]);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);

  const prefix = line === undefined ? "" : line.trim().toLowerCase();
  const items = useMemo(
    () => history.filter((c) => c.toLowerCase().startsWith(prefix) && c.toLowerCase() !== prefix).slice(0, 8),
    [history, prefix],
  );

  if (history.length === 0) return null;

  return (
    <div className="suggest">
      <History size={14} className="suggest-icon" />
      <div className="suggest-scroll">
        {items.length === 0 && <span className="muted small">ไม่มีคำสั่งที่ขึ้นต้นด้วย “{prefix}”</span>}
        {items.map((c) => (
          <button
            key={c}
            className="suggest-chip"
            title="แทนที่บรรทัดปัจจุบันด้วยคำสั่งนี้"
            onPointerDown={(e) => { e.preventDefault(); typeText(sessionId, "\x15" + c); }}
          >
            {prefix && c.toLowerCase().startsWith(prefix) ? (
              <><b>{c.slice(0, prefix.length)}</b>{c.slice(prefix.length)}</>
            ) : c}
          </button>
        ))}
      </div>
      <button
        className="icon-btn ghost small"
        aria-label="ล้างประวัติคำสั่ง"
        title="ล้างประวัติคำสั่ง"
        onClick={() => set({
          confirm: {
            title: "ล้างประวัติคำสั่ง",
            body: "ลบคำสั่งที่จำไว้ทั้งหมด?",
            confirmLabel: "ล้าง",
            danger: true,
            onConfirm: () => api.clearHistory().then(() => set({ history: [] }), (e: Error) => toast("error", e.message)),
          },
        })}
      >
        <X size={14} />
      </button>
    </div>
  );
}
