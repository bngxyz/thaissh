import { useMemo, useState, type FormEvent } from "react";
import {
  DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, MoreHorizontal, Pencil, Plus, Search, Settings, Trash2, X, Zap } from "lucide-react";
import type { HostProfile, SessionInfo } from "../../shared/types";
import { useStore } from "../store";
import { api } from "../api";
import { closeSession, deleteHost, duplicateHost, newSession, openHost, parseQuickConnect } from "../actions";
import { OsLogo, osName } from "./OsLogo";
import { Logo } from "./Logo";
import { StateDot } from "./StateDot";

function HostCard({ host, sessions }: { host: HostProfile; sessions: SessionInfo[] }) {
  const activeId = useStore((s) => s.activeId);
  const set = useStore((s) => s.set);
  const [menu, setMenu] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: host.id });
  const isActiveHost = sessions.some((s) => s.id === activeId);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, ["--host" as string]: host.color }}
      className={`host-card${isActiveHost ? " is-active" : ""}${isDragging ? " is-dragging" : ""}`}
    >
      <button className="host-main" onClick={() => openHost(host.id)} title={`เชื่อมต่อ ${host.username}@${host.host}`}>
        <span className="host-logo" title={osName(host.osId)}>
          <OsLogo osId={host.osId} fallbackColor={host.color} />
        </span>
        <span className="host-text">
          <span className="host-label">{host.label}</span>
          <span className="host-sub">{host.username}@{host.host}{host.port !== 22 ? `:${host.port}` : ""}</span>
        </span>
      </button>
      <div className="host-actions">
        <button className="icon-btn ghost drag-handle" aria-label="ลากเพื่อจัดลำดับ" {...attributes} {...listeners}>
          <GripVertical size={15} />
        </button>
        <button className="icon-btn ghost" aria-label="เมนู" onClick={() => setMenu((v) => !v)}>
          <MoreHorizontal size={16} />
        </button>
        {menu && (
          <>
            <div className="menu-backdrop" onClick={() => setMenu(false)} />
            <div className="menu" role="menu">
              <button role="menuitem" onClick={() => { setMenu(false); void newSession(host.id); }}><Plus size={15} />เซสชันใหม่</button>
              <button role="menuitem" onClick={() => { setMenu(false); set({ editor: { mode: "edit", host } }); }}><Pencil size={15} />แก้ไข</button>
              <button role="menuitem" onClick={() => { setMenu(false); duplicateHost(host); }}><Copy size={15} />ทำสำเนา</button>
              <div className="menu-sep" />
              <button role="menuitem" className="danger" onClick={() => { setMenu(false); deleteHost(host); }}><Trash2 size={15} />ลบ</button>
            </div>
          </>
        )}
      </div>
      {sessions.length > 0 && (
        <div className="chips">
          {sessions.map((s) => (
            <span key={s.id} className={`chip${s.id === activeId ? " is-on" : ""}`}>
              <button className="chip-main" onClick={() => set({ activeId: s.id, sidebarOpen: false })}>
                <StateDot state={s.state} />({s.seq})
              </button>
              <button className="chip-x" aria-label={`ปิดเซสชัน ${s.seq}`} onClick={() => closeSession(s.id, true)}>
                <X size={12} />
              </button>
            </span>
          ))}
          <button className="chip chip-add" aria-label="เซสชันใหม่" onClick={() => void newSession(host.id)}>
            <Plus size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const hosts = useStore((s) => s.hosts);
  const sessions = useStore((s) => s.sessions);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const wsOnline = useStore((s) => s.wsOnline);
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter((h) => `${h.label} ${h.username}@${h.host} ${h.osId ?? ""}`.toLowerCase().includes(q));
  }, [hosts, query]);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = hosts.findIndex((h) => h.id === e.active.id);
    const to = hosts.findIndex((h) => h.id === e.over!.id);
    const next = arrayMove(hosts, from, to);
    set({ hosts: next });
    api.reorderHosts(next.map((h) => h.id)).catch((err: Error) => {
      toast("error", `จัดลำดับไม่สำเร็จ: ${err.message}`);
      set({ hosts });
    });
  };

  const onQuick = (e: FormEvent) => {
    e.preventDefault();
    const draft = parseQuickConnect(quick);
    if (!draft) {
      toast("error", "รูปแบบไม่ถูกต้อง ใช้ user@host:port");
      return;
    }
    const match = hosts.find((h) => h.host === draft.host && (!draft.username || h.username === draft.username) && (!draft.port || h.port === draft.port));
    setQuick("");
    if (match) openHost(match.id);
    else set({ editor: { mode: "create", draft } });
  };

  return (
    <>
      <div className={`sidebar-scrim${sidebarOpen ? " is-open" : ""}`} onClick={() => set({ sidebarOpen: false })} />
      <aside className={`sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="brand">
          <Logo />
          <div className="brand-text">
            <span className="brand-name">ThaiSSH</span>
            <span className={`brand-status${wsOnline ? "" : " off"}`}>{wsOnline ? "พร้อมใช้งาน" : "กำลังเชื่อมต่อเซิร์ฟเวอร์…"}</span>
          </div>
          <button className="icon-btn" aria-label="ตั้งค่า" onClick={() => set({ settingsOpen: true })}>
            <Settings size={18} />
          </button>
        </div>

        <form className="quick" onSubmit={onQuick}>
          <Zap size={15} className="quick-icon" />
          <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="เชื่อมต่อด่วน  user@host:port" spellCheck={false} />
        </form>

        <div className="section-head">
          <span>โฮสต์ <em>{hosts.length}</em></span>
          {hosts.length > 4 && (
            <label className="search">
              <Search size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา" />
            </label>
          )}
        </div>

        <div className="host-list">
          {hosts.length === 0 && (
            <div className="empty-hint">ยังไม่มีโฮสต์<br />กด “เพิ่มโฮสต์” เพื่อเริ่มต้น</div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filtered.map((h) => h.id)} strategy={verticalListSortingStrategy} disabled={query !== ""}>
              {filtered.map((h) => (
                <HostCard key={h.id} host={h} sessions={sessions.filter((s) => s.hostId === h.id)} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <button className="btn primary block add-host" onClick={() => set({ editor: { mode: "create", draft: {} } })}>
          <Plus size={18} />เพิ่มโฮสต์
        </button>
      </aside>
    </>
  );
}
