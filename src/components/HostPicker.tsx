import { useMemo, useState, type FormEvent } from "react";
import { MonitorUp, Plus, Search, Zap } from "lucide-react";
import { useStore } from "../store";
import { newSession, parseQuickConnect } from "../actions";
import { Modal } from "./Modal";
import { OsLogo, osName } from "./OsLogo";

/** ปุ่ม + บนแถบแท็บ: เลือกเครื่องที่จะเปิดแท็บใหม่ */
export function HostPicker() {
  const hosts = useStore((s) => s.hosts);
  const sessions = useStore((s) => s.sessions);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  const [query, setQuery] = useState("");

  const close = () => set({ pickerOpen: false });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter((h) => `${h.label} ${h.username}@${h.host}`.toLowerCase().includes(q));
  }, [hosts, query]);

  const connect = (hostId: string) => {
    close();
    void newSession(hostId);
  };

  // Enter: ถ้าตรงโฮสต์เดียวให้เชื่อมเลย ถ้าเป็นรูปแบบ user@host ที่ยังไม่มีให้เปิดฟอร์มเพิ่มโฮสต์
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (filtered.length === 1) return connect(filtered[0].id);
    const draft = parseQuickConnect(query);
    if (filtered.length === 0 && draft && query.includes("@")) {
      close();
      set({ editor: { mode: "create", draft } });
      return;
    }
    if (filtered.length === 0) toast("error", "ไม่พบโฮสต์ — พิมพ์ user@host:port เพื่อเพิ่มใหม่");
  };

  return (
    <Modal title="เชื่อมต่อเครื่อง" icon={<MonitorUp size={18} />} onClose={close} width={520}>
      <form className="picker-search" onSubmit={onSubmit}>
        <Search size={16} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาโฮสต์ หรือพิมพ์ user@host:port"
          spellCheck={false}
          autoCapitalize="off"
        />
      </form>

      <div className="picker-list">
        {filtered.map((h) => {
          const open = sessions.filter((s) => s.hostId === h.id).length;
          return (
            <button key={h.id} className="picker-item" style={{ ["--host" as string]: h.color }} onClick={() => connect(h.id)}>
              <OsLogo osId={h.osId} size={38} fallbackColor={h.color} />
              <span className="host-text">
                <span className="host-label">{h.label}</span>
                <span className="host-sub">{h.username}@{h.host}{h.port !== 22 ? `:${h.port}` : ""} · {osName(h.osId)}</span>
              </span>
              {open > 0 && <span className="picker-open">เปิดอยู่ {open}</span>}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="empty-hint">
            {query.includes("@")
              ? <><Zap size={14} /> กด Enter เพื่อเพิ่ม {query}</>
              : "ไม่พบโฮสต์"}
          </div>
        )}
      </div>

      <button className="btn block picker-add" onClick={() => { close(); set({ editor: { mode: "create", draft: {} } }); }}>
        <Plus size={17} />เพิ่มโฮสต์ใหม่
      </button>
    </Modal>
  );
}
