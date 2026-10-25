import { useEffect, useState, type ReactNode } from "react";
import { Fingerprint, History, Keyboard, Monitor, Moon, Plug, Settings, Sun, Trash2, Type } from "lucide-react";
import { FONT_SIZE_MAX, FONT_SIZE_MIN, type FontFamily, type KnownHostEntry, type ThemeMode } from "../../shared/types";
import { useStore } from "../store";
import { api } from "../api";
import { FONT_STACKS } from "../terminals";
import { Modal } from "./Modal";
import { KEY_LABELS } from "./KeyBar";

// สีฟอนต์ชุดเดียวกับ SettingsActivity เดิม
const FONT_COLORS = ["#e0e0e0", "#ffffff", "#00e676", "#00e5ff", "#ffd54f", "#ff7043", "#ff4081", "#b0bec5"];

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-text">
        <div className="set-title">{title}</div>
        {desc && <div className="set-desc">{desc}</div>}
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={`switch${on ? " is-on" : ""}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

function Group({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="set-group">
      <h3>{icon}{title}</h3>
      <div className="card">{children}</div>
    </section>
  );
}

export function SettingsPanel() {
  const s = useStore((st) => st.settings)!;
  const update = useStore((st) => st.updateSettings);
  const set = useStore((st) => st.set);
  const toast = useStore((st) => st.toast);
  const historyCount = useStore((st) => st.history.length);
  const [known, setKnown] = useState<KnownHostEntry[] | null>(null);

  useEffect(() => {
    api.knownHosts().then(setKnown, (e: Error) => toast("error", e.message));
  }, [toast]);

  const forget = (host: string) =>
    api.forgetKnownHost(host).then(() => setKnown((k) => k!.filter((x) => x.host !== host)), (e: Error) => toast("error", e.message));

  const themes: { id: ThemeMode; label: string; icon: ReactNode }[] = [
    { id: "system", label: "ตามระบบ", icon: <Monitor size={15} /> },
    { id: "light", label: "สว่าง", icon: <Sun size={15} /> },
    { id: "dark", label: "มืด", icon: <Moon size={15} /> },
  ];
  const families: { id: FontFamily; label: string }[] = [
    { id: "monospace", label: "Monospace" },
    { id: "sans", label: "Sans" },
    { id: "serif", label: "Serif" },
  ];

  return (
    <Modal title="ตั้งค่า" icon={<Settings size={18} />} onClose={() => set({ settingsOpen: false })} variant="drawer">
      <Group icon={<Monitor size={15} />} title="หน้าตา">
        <Row title="ธีม">
          <div className="segmented small">
            {themes.map((t) => (
              <button key={t.id} className={s.theme === t.id ? "is-on" : ""} onClick={() => void update({ theme: t.id })}>{t.icon}{t.label}</button>
            ))}
          </div>
        </Row>
      </Group>

      <Group icon={<Type size={15} />} title="เทอร์มินัล">
        <div
          className="font-preview"
          style={{ fontFamily: FONT_STACKS[s.fontFamily], fontSize: s.fontSize, color: s.fontColor }}
        >
          <span className="pv-prompt">somchai@server</span>:<span className="pv-path">~</span>$ echo "สวัสดีครับ ภาษาไทย"<br />
          สวัสดีครับ ภาษาไทย ✓ ñ 日本語
        </div>
        <Row title="ขนาดตัวอักษร" desc={`${s.fontSize}px`}>
          <input
            type="range"
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            value={s.fontSize}
            onChange={(e) => void update({ fontSize: Number(e.target.value) })}
          />
        </Row>
        <Row title="สีตัวอักษร">
          <div className="swatches">
            {FONT_COLORS.map((c) => (
              <button key={c} className={`swatch${s.fontColor === c ? " is-on" : ""}`} style={{ background: c }} aria-label={c} onClick={() => void update({ fontColor: c })} />
            ))}
            <label className="swatch custom" title="สีอื่น ๆ" style={{ background: FONT_COLORS.includes(s.fontColor) ? undefined : s.fontColor }}>
              <input type="color" value={s.fontColor} onChange={(e) => void update({ fontColor: e.target.value })} />
            </label>
          </div>
        </Row>
        <Row title="แบบอักษร">
          <div className="segmented small">
            {families.map((f) => (
              <button key={f.id} className={s.fontFamily === f.id ? "is-on" : ""} style={{ fontFamily: FONT_STACKS[f.id] }} onClick={() => void update({ fontFamily: f.id })}>{f.label}</button>
            ))}
          </div>
        </Row>
        <Row title="เคอร์เซอร์กะพริบ">
          <Switch label="เคอร์เซอร์กะพริบ" on={s.cursorBlink} onChange={(v) => void update({ cursorBlink: v })} />
        </Row>
        <Row title="Scrollback" desc="จำนวนบรรทัดที่เลื่อนย้อนดูได้">
          <select value={s.scrollback} onChange={(e) => void update({ scrollback: Number(e.target.value) })}>
            {[1000, 5000, 10000, 50000].map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
          </select>
        </Row>
      </Group>

      <Group icon={<Plug size={15} />} title="การเชื่อมต่อ">
        <Row title="เชื่อมต่อใหม่อัตโนมัติ" desc="เมื่อหลุด จะลองใหม่ 5 ครั้ง (1, 2, 4, 8, 16 วินาที)">
          <Switch label="เชื่อมต่อใหม่อัตโนมัติ" on={s.autoReconnect} onChange={(v) => void update({ autoReconnect: v })} />
        </Row>
      </Group>

      <Group icon={<Keyboard size={15} />} title="แถบปุ่มพิเศษ">
        <Row title="แสดงแถบปุ่ม">
          <Switch label="แสดงแถบปุ่ม" on={s.showKeyBar} onChange={(v) => void update({ showKeyBar: v })} />
        </Row>
        <Row title="ลำดับปุ่ม" desc="กด Shift+Tab ในเทอร์มินัลเพื่อเปิดได้เช่นกัน">
          <button className="btn small" onClick={() => set({ keyBarEditorOpen: true })}>ปรับแต่ง</button>
        </Row>
        <div className="key-preview">
          {s.keyBarLayout.map((k) => <span key={k} className="key mini">{KEY_LABELS[k]}</span>)}
        </div>
      </Group>

      <Group icon={<History size={15} />} title="ประวัติคำสั่ง">
        <Row title="แสดงคำแนะนำคำสั่ง" desc="เก็บไว้ 7 วัน สูงสุด 500 คำสั่ง (ไม่เก็บสิ่งที่พิมพ์ตอนถามรหัสผ่าน)">
          <Switch label="แสดงคำแนะนำคำสั่ง" on={s.showSuggestions} onChange={(v) => void update({ showSuggestions: v })} />
        </Row>
        <Row title="ล้างประวัติ" desc={`${historyCount} คำสั่ง`}>
          <button
            className="btn small danger"
            disabled={historyCount === 0}
            onClick={() => api.clearHistory().then(() => { set({ history: [] }); toast("success", "ล้างประวัติแล้ว"); }, (e: Error) => toast("error", e.message))}
          >
            ล้าง
          </button>
        </Row>
      </Group>

      <Group icon={<Fingerprint size={15} />} title="Known hosts">
        {known === null ? (
          <div className="set-desc pad">กำลังโหลด…</div>
        ) : known.length === 0 ? (
          <div className="set-desc pad">ยังไม่มี host key ที่ยอมรับไว้</div>
        ) : (
          known.map((k) => (
            <div className="known-row" key={k.host}>
              <div>
                <div className="set-title mono">{k.host}</div>
                <div className="set-desc mono">{k.keyType} · {k.fingerprint}</div>
              </div>
              <button className="icon-btn ghost" aria-label={`ลืม ${k.host}`} title="ลืม key นี้" onClick={() => void forget(k.host)}>
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </Group>
    </Modal>
  );
}
