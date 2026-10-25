import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Pencil, RotateCw, X } from "lucide-react";
import type { SessionInfo } from "../../shared/types";
import { useStore } from "../store";
import { closeSession, retrySession } from "../actions";
import { attachPinchZoom, fitEntry, focusEntry, getSearch, mount } from "../terminals";
import { STATE_LABEL } from "./StateDot";

function SearchBar({ id }: { id: string }) {
  const set = useStore((s) => s.set);
  const [q, setQ] = useState("");
  const search = getSearch(id);
  const opts = { decorations: { matchOverviewRuler: "#a78bfa", activeMatchColorOverviewRuler: "#5eead4", matchBackground: "#7c6cf655", activeMatchBackground: "#5eead488" } };

  const close = () => {
    search?.clearDecorations();
    set({ searchOpen: false });
    focusEntry(id);
  };

  return (
    <div className="term-search">
      <input
        autoFocus
        value={q}
        placeholder="ค้นหาในจอ…"
        onChange={(e) => { setQ(e.target.value); search?.findNext(e.target.value, { ...opts, incremental: true }); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.shiftKey ? search?.findPrevious(q, opts) : search?.findNext(q, opts));
          if (e.key === "Escape") close();
        }}
      />
      <button className="icon-btn ghost" aria-label="ก่อนหน้า" onClick={() => search?.findPrevious(q, opts)}><ChevronUp size={16} /></button>
      <button className="icon-btn ghost" aria-label="ถัดไป" onClick={() => search?.findNext(q, opts)}><ChevronDown size={16} /></button>
      <button className="icon-btn ghost" aria-label="ปิด" onClick={close}><X size={16} /></button>
    </div>
  );
}

function StatusOverlay({ session }: { session: SessionInfo }) {
  const host = useStore((s) => s.hosts.find((h) => h.id === session.hostId));
  const set = useStore((s) => s.set);

  if (session.state === "connected") return null;
  if (session.state === "connecting" || session.state === "reconnecting") {
    return (
      <div className="term-banner">
        <Loader2 size={15} className="spin" />
        {STATE_LABEL[session.state]}
        {session.state === "reconnecting" && session.reconnectAttempt > 0 && <span className="muted"> · ครั้งที่ {session.reconnectAttempt}/5</span>}
      </div>
    );
  }
  return (
    <div className="term-overlay">
      <div className={`overlay-card ${session.state}`}>
        <div className="overlay-title">{STATE_LABEL[session.state]}</div>
        {session.error && <div className="overlay-error">{session.error}</div>}
        <div className="overlay-actions">
          <button className="btn primary" onClick={() => retrySession(session.id)}><RotateCw size={16} />เชื่อมต่อใหม่</button>
          {host && <button className="btn" onClick={() => set({ editor: { mode: "edit", host } })}><Pencil size={16} />แก้ไขโฮสต์</button>}
          <button className="btn ghost" onClick={() => closeSession(session.id, false)}><X size={16} />ปิดแท็บ</button>
        </div>
      </div>
    </div>
  );
}

export function TerminalPane({ session }: { session: SessionInfo }) {
  const ref = useRef<HTMLDivElement>(null);
  const searchOpen = useStore((s) => s.searchOpen);

  useEffect(() => {
    if (!ref.current) return;
    mount(session.id, ref.current);
    // ปุ่มที่ถูกกด (เช่นการ์ดโฮสต์) อาจถูกถอดออกจาก DOM ในเฟรมเดียวกันแล้วดึงโฟกัสหาย — โฟกัสซ้ำเฟรมถัดไป
    const raf = requestAnimationFrame(() => focusEntry(session.id));
    const ro = new ResizeObserver(() => fitEntry(session.id));
    ro.observe(ref.current);
    const detachPinch = attachPinchZoom(session.id, ref.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); detachPinch(); };
  }, [session.id]);

  return (
    <div className="term-wrap">
      <div className="term" ref={ref} />
      {searchOpen && <SearchBar id={session.id} />}
      <StatusOverlay session={session} />
    </div>
  );
}
