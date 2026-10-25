import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  title: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "dialog" | "drawer";
  width?: number;
}

export function Modal({ title, icon, onClose, children, footer, variant = "dialog", width }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={`modal-root ${variant}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" style={width ? { maxWidth: width } : undefined}>
        <div className="modal-head">
          {icon && <span className="modal-icon">{icon}</span>}
          <h2>{title}</h2>
          <button className="icon-btn ghost" aria-label="ปิด" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
