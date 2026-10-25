import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, FileKey2, KeyRound, Lock, Server, SlidersHorizontal, Upload } from "lucide-react";
import type { AuthMethod, HostInput, HostProfile } from "../../shared/types";
import { useStore } from "../store";
import { api } from "../api";
import { HOST_COLORS, newSession, toInput } from "../actions";
import { Modal } from "./Modal";

const CHARSETS = ["UTF-8", "TIS-620", "windows-874", "ISO-8859-1", "Shift_JIS", "GBK", "Big5", "EUC-KR"];

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field${wide ? " wide" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Secret({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="input-wrap">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="new-password" />
      <button type="button" className="icon-btn ghost small" aria-label={show ? "ซ่อน" : "แสดง"} onClick={() => setShow((v) => !v)}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </span>
  );
}

function initialForm(editor: { mode: "edit"; host: HostProfile } | { mode: "create"; draft: Partial<HostProfile> }): HostInput {
  if (editor.mode === "edit") return toInput(editor.host);
  const d = editor.draft;
  // ค่าตั้งต้นของฟอร์มใหม่ตามแอปเดิม: พอร์ต 22, รหัสผ่าน, UTF-8
  return {
    label: "", host: d.host ?? "", port: d.port ?? 22, username: d.username ?? "",
    authMethod: "password", password: null, privateKey: null, passphrase: null,
    charset: "UTF-8", initialCommand: null,
    color: HOST_COLORS[Math.floor(Math.random() * HOST_COLORS.length)],
  };
}

export function HostEditor() {
  const editor = useStore((s) => s.editor)!;
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  const [form, setForm] = useState<HostInput>(() => initialForm(editor));
  const [portText, setPortText] = useState(String(form.port));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = editor.mode === "edit";

  const upd = <K extends keyof HostInput>(k: K, v: HostInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const close = () => set({ editor: null });

  const loadKeyFile = async (file: File) => {
    if (file.size > 64 * 1024) {
      setError("ไฟล์ใหญ่เกินไปสำหรับ private key");
      return;
    }
    const text = await file.text();
    if (!/PRIVATE KEY|PuTTY-User-Key-File/.test(text)) {
      setError(`${file.name} ไม่ใช่ไฟล์ private key`);
      return;
    }
    upd("privateKey", text);
    setError(null);
  };

  const submit = async (e: FormEvent, connect: boolean) => {
    e.preventDefault();
    const port = Number(portText);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setError("พอร์ตต้องเป็นตัวเลข 1-65535");
      return;
    }
    if (!form.host.trim() || !form.username.trim()) {
      setError("ต้องระบุโฮสต์และชื่อผู้ใช้");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, port };
      const saved = isEdit ? await api.updateHost(editor.host.id, payload) : await api.createHost(payload);
      await useStore.getState().loadHosts();
      close();
      toast("success", isEdit ? "บันทึกแล้ว" : `เพิ่ม ${saved.label} แล้ว`);
      if (connect) await newSession(saved.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const auth = (m: AuthMethod) => upd("authMethod", m);

  return (
    <Modal
      title={isEdit ? `แก้ไข ${editor.host.label}` : "การเชื่อมต่อใหม่"}
      icon={<Server size={18} />}
      onClose={close}
      width={620}
      footer={
        <>
          {error && <div className="form-error">{error}</div>}
          <button type="button" className="btn ghost" onClick={close}>ยกเลิก</button>
          <button type="submit" form="host-form" className="btn" disabled={saving}>บันทึก</button>
          <button type="button" className="btn primary" disabled={saving} onClick={(e) => void submit(e, true)}>บันทึกและเชื่อมต่อ</button>
        </>
      }
    >
      <form id="host-form" className="host-form" onSubmit={(e) => void submit(e, false)}>
        <section className="card">
          <h3><Server size={15} />การเชื่อมต่อ</h3>
          <div className="grid">
            <Field label="ชื่อที่แสดง" hint="เว้นว่างเพื่อใช้ชื่อโฮสต์" wide>
              <input value={form.label} onChange={(e) => upd("label", e.target.value)} placeholder="เช่น เซิร์ฟเวอร์บ้าน" autoFocus={!isEdit} />
            </Field>
            <Field label="โฮสต์">
              <input value={form.host} onChange={(e) => upd("host", e.target.value)} placeholder="192.168.1.10 หรือ example.com" spellCheck={false} required />
            </Field>
            <Field label="พอร์ต">
              <input value={portText} onChange={(e) => setPortText(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
            </Field>
            <Field label="ชื่อผู้ใช้" wide>
              <input value={form.username} onChange={(e) => upd("username", e.target.value)} placeholder="root" spellCheck={false} autoCapitalize="off" required />
            </Field>
            <div className="field wide">
              <span className="field-label">สีประจำโฮสต์</span>
              <div className="swatches">
                {HOST_COLORS.map((c) => (
                  <button type="button" key={c} className={`swatch${form.color === c ? " is-on" : ""}`} style={{ background: c }} aria-label={c} onClick={() => upd("color", c)} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <h3><Lock size={15} />การยืนยันตัวตน</h3>
          <div className="segmented">
            <button type="button" className={form.authMethod === "password" ? "is-on" : ""} onClick={() => auth("password")}><KeyRound size={15} />รหัสผ่าน</button>
            <button type="button" className={form.authMethod === "publickey" ? "is-on" : ""} onClick={() => auth("publickey")}><FileKey2 size={15} />Public key</button>
          </div>
          {form.authMethod === "password" ? (
            <Field label="รหัสผ่าน" hint="เว้นว่างได้ถ้าเซิร์ฟเวอร์ไม่ต้องใช้" wide>
              <Secret value={form.password ?? ""} onChange={(v) => upd("password", v === "" ? null : v)} placeholder="••••••••" />
            </Field>
          ) : (
            <>
              <div
                className="field wide dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void loadKeyFile(f); }}
              >
                <span className="field-label">
                  Private key (OpenSSH / PEM / PPK)
                  <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}><Upload size={13} />เลือกไฟล์</button>
                </span>
                <textarea
                  rows={6}
                  value={form.privateKey ?? ""}
                  onChange={(e) => upd("privateKey", e.target.value === "" ? null : e.target.value)}
                  placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n…\n\nหรือลากไฟล์ key มาวางที่นี่"}
                  spellCheck={false}
                />
                <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadKeyFile(f); e.target.value = ""; }} />
              </div>
              <Field label="Passphrase" hint="ถ้า key ไม่มีรหัส ให้เว้นว่าง" wide>
                <Secret value={form.passphrase ?? ""} onChange={(v) => upd("passphrase", v === "" ? null : v)} placeholder="ไม่บังคับ" />
              </Field>
            </>
          )}
        </section>

        <section className="card">
          <h3><SlidersHorizontal size={15} />ขั้นสูง</h3>
          <div className="grid">
            <Field label="Charset" hint="UTF-8 รองรับภาษาไทยเต็มรูปแบบ">
              <input list="charsets" value={form.charset} onChange={(e) => upd("charset", e.target.value)} spellCheck={false} />
              <datalist id="charsets">{CHARSETS.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="คำสั่งเริ่มต้น" hint="รันอัตโนมัติหลังเปิด shell">
              <input value={form.initialCommand ?? ""} onChange={(e) => upd("initialCommand", e.target.value === "" ? null : e.target.value)} placeholder="เช่น tmux attach || tmux" spellCheck={false} />
            </Field>
          </div>
        </section>
      </form>
    </Modal>
  );
}
