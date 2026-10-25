import { Plus } from "lucide-react";
import { useStore } from "../store";
import { openHost } from "../actions";
import { Logo } from "./Logo";
import { OsLogo, osName } from "./OsLogo";

function timeAgo(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return `${Math.round(h / 24)} วันที่แล้ว`;
}

export function Welcome() {
  const hosts = useStore((s) => s.hosts);
  const set = useStore((s) => s.set);
  const recent = [...hosts].filter((h) => h.lastUsedAt !== null).sort((a, b) => b.lastUsedAt! - a.lastUsedAt!).slice(0, 6);
  const shown = recent.length > 0 ? recent : hosts.slice(0, 6);

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="hero">
          <Logo size={56} />
          <h1>ThaiSSH</h1>
          <p>SSH client ที่พิมพ์และแสดงภาษาไทยได้ถูกต้อง</p>
        </div>

        {shown.length > 0 ? (
          <>
            <div className="welcome-head">{recent.length > 0 ? "ใช้ล่าสุด" : "โฮสต์ของคุณ"}</div>
            <div className="recent-grid">
              {shown.map((h) => (
                <button key={h.id} className="recent-card" style={{ ["--host" as string]: h.color }} onClick={() => openHost(h.id)}>
                  <OsLogo osId={h.osId} size={40} fallbackColor={h.color} />
                  <span className="recent-text">
                    <span className="host-label">{h.label}</span>
                    <span className="host-sub">{h.username}@{h.host}</span>
                    <span className="recent-meta">{osName(h.osId)}{h.lastUsedAt !== null && ` · ${timeAgo(h.lastUsedAt)}`}</span>
                  </span>
                </button>
              ))}
              <button className="recent-card add" onClick={() => set({ editor: { mode: "create", draft: {} } })}>
                <Plus size={22} />
                <span>เพิ่มโฮสต์</span>
              </button>
            </div>
          </>
        ) : (
          <button className="btn primary large" onClick={() => set({ editor: { mode: "create", draft: {} } })}>
            <Plus size={18} />เพิ่มโฮสต์แรกของคุณ
          </button>
        )}

      </div>
    </div>
  );
}
