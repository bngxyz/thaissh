import { AlertTriangle, CheckCircle2, Info, ShieldAlert, ShieldQuestion, XCircle } from "lucide-react";
import { useStore } from "../store";
import { wsSend } from "../ws";
import { hostLabel } from "../actions";
import { Modal } from "./Modal";

export function HostKeyDialog() {
  const req = useStore((s) => s.hostKeyQueue[0]);
  const sessions = useStore((s) => s.sessions);
  const set = useStore((s) => s.set);
  if (!req) return null;

  const session = sessions.find((s) => s.id === req.sessionId);
  const answer = (accept: boolean) => {
    wsSend({ t: "hostkey-reply", reqId: req.reqId, accept });
    set({ hostKeyQueue: useStore.getState().hostKeyQueue.filter((r) => r.reqId !== req.reqId) });
  };

  return (
    <Modal
      title={req.isNew ? "ยืนยันโฮสต์ใหม่" : "Host key เปลี่ยนไป!"}
      icon={req.isNew ? <ShieldQuestion size={18} /> : <ShieldAlert size={18} />}
      onClose={() => answer(false)}
      width={520}
      footer={
        <>
          <button className="btn ghost" onClick={() => answer(false)}>ปฏิเสธ</button>
          <button className={`btn ${req.isNew ? "primary" : "danger"}`} onClick={() => answer(true)}>
            {req.isNew ? "ยอมรับและเชื่อมต่อ" : "ยอมรับ key ใหม่"}
          </button>
        </>
      }
    >
      <div className={`hostkey ${req.isNew ? "new" : "changed"}`}>
        {req.isNew ? (
          <p>ยังไม่เคยเชื่อมต่อกับ <b>{req.host}</b>{session && <> ({hostLabel(session.hostId)})</>} มาก่อน ตรวจสอบ fingerprint ให้ตรงกับเซิร์ฟเวอร์ก่อนยอมรับ</p>
        ) : (
          <p className="warn-text">
            <AlertTriangle size={16} /> host key ของ <b>{req.host}</b> ไม่ตรงกับที่บันทึกไว้ อาจมีผู้ดักกลางทาง (MITM) หรือเซิร์ฟเวอร์ถูกติดตั้งใหม่
          </p>
        )}
        <div className="fp">
          <div className="fp-label">{req.keyType}</div>
          <code>{req.fingerprint}</code>
        </div>
        {req.previousFingerprint && (
          <div className="fp old">
            <div className="fp-label">key เดิม</div>
            <code>{req.previousFingerprint}</code>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ConfirmDialog() {
  const c = useStore((s) => s.confirm);
  const set = useStore((s) => s.set);
  if (!c) return null;
  const close = () => set({ confirm: null });
  return (
    <Modal
      title={c.title}
      onClose={close}
      width={420}
      footer={
        <>
          <button className="btn ghost" onClick={close}>ยกเลิก</button>
          <button autoFocus className={`btn ${c.danger ? "danger" : "primary"}`} onClick={() => { close(); c.onConfirm(); }}>{c.confirmLabel}</button>
        </>
      }
    >
      <p>{c.body}</p>
    </Modal>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          {t.kind === "error" ? <XCircle size={17} /> : t.kind === "success" ? <CheckCircle2 size={17} /> : <Info size={17} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
