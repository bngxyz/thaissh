import { Menu, Plus, X } from "lucide-react";
import { useStore } from "../store";
import { closeSession } from "../actions";
import { OsLogo } from "./OsLogo";
import { StateDot } from "./StateDot";

export function TabBar() {
  const sessions = useStore((s) => s.sessions);
  const hosts = useStore((s) => s.hosts);
  const activeId = useStore((s) => s.activeId);
  const set = useStore((s) => s.set);

  return (
    <header className={`tabbar${sessions.length === 0 ? " is-empty" : ""}`}>
      <button className="icon-btn only-mobile" aria-label="โฮสต์" title="โฮสต์และการตั้งค่า" onClick={() => set({ sidebarOpen: true })}>
        <Menu size={20} />
      </button>
      <div className="tabs" role="tablist">
        {sessions.map((s) => {
          const h = hosts.find((x) => x.id === s.hostId);
          return (
            <div
              key={s.id}
              role="tab"
              aria-selected={s.id === activeId}
              className={`tab${s.id === activeId ? " is-active" : ""}`}
              style={{ ["--host" as string]: h ? h.color : "#64748b" }}
              onClick={() => set({ activeId: s.id })}
              onAuxClick={(e) => { if (e.button === 1) closeSession(s.id, true); }}
              title={h ? `${h.username}@${h.host}` : ""}
            >
              <OsLogo osId={h ? h.osId : null} size={18} fallbackColor={h ? h.color : "#64748b"} />
              <span className="tab-label">{h ? h.label : "(ลบแล้ว)"}</span>
              <span className="tab-seq">{s.seq}</span>
              <StateDot state={s.state} />
              <button
                className="tab-x"
                aria-label="ปิดแท็บ"
                onClick={(e) => { e.stopPropagation(); closeSession(s.id, true); }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
      {sessions.length > 0 && (
        <button className="icon-btn" aria-label="เชื่อมต่อเครื่องอื่น" title="เชื่อมต่อเครื่อง" onClick={() => set({ pickerOpen: true })}>
          <Plus size={18} />
        </button>
      )}
    </header>
  );
}
