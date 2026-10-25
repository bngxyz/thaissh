import { EventEmitter } from "node:events";
import { createHash, randomUUID } from "node:crypto";
import { Client, type ClientChannel, type ConnectConfig } from "ssh2";
import iconv from "iconv-lite";
import { hosts, knownHosts, settings } from "./stores.ts";
import { detectOs } from "./osDetect.ts";
import type { HostKeyRequest, HostProfile, SessionInfo, SessionState } from "../shared/types.ts";

const REPLAY_LIMIT = 512 * 1024; // จำนวนตัวอักษรที่เก็บไว้ replay ให้ browser ที่เพิ่งเปิดมา
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000]; // เหมือนแอปเดิม: ~5 ครั้ง

export function fingerprintOf(key: Buffer): string {
  return "SHA256:" + createHash("sha256").update(key).digest("base64").replace(/=+$/, "");
}

/** host key แบบ wire format ขึ้นต้นด้วย string ชื่อ algorithm (uint32 length + bytes) */
function keyTypeOf(key: Buffer): string {
  const len = key.readUInt32BE(0);
  return key.subarray(4, 4 + len).toString("ascii");
}

const knownHostName = (p: HostProfile) => (p.port === 22 ? p.host : `[${p.host}]:${p.port}`);

/** ข้อความสถานะที่แทรกลงจอ terminal (สีเทา/สีตามประเภท) */
function notice(text: string, color: "dim" | "red" | "green" | "yellow"): string {
  const code = { dim: "90", red: "91", green: "92", yellow: "93" }[color];
  return `\r\n\x1b[${code}m● ${text}\x1b[0m\r\n`;
}

class LiveSession {
  state: SessionState = "connecting";
  error: string | null = null;
  reconnectAttempt = 0;
  readonly startedAt = Date.now();
  cols = 80;
  rows = 24;

  private replay: string[] = [];
  private replayLen = 0;
  private client: Client | null = null;
  private stream: ClientChannel | null = null;
  private encode: (s: string) => Buffer = (s) => Buffer.from(s, "utf8");
  private userClosed = false;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(
    readonly id: string,
    readonly hostId: string,
    readonly seq: number,
    private readonly mgr: SessionManager,
  ) {}

  info(): SessionInfo {
    return {
      id: this.id, hostId: this.hostId, seq: this.seq, state: this.state,
      error: this.error, reconnectAttempt: this.reconnectAttempt, startedAt: this.startedAt,
    };
  }

  replayText(): string {
    return this.replay.join("");
  }

  private emitData(text: string): void {
    this.replay.push(text);
    this.replayLen += text.length;
    while (this.replayLen > REPLAY_LIMIT && this.replay.length > 1) {
      this.replayLen -= this.replay.shift()!.length;
    }
    this.mgr.emit("data", this.id, text);
  }

  private setState(state: SessionState, error: string | null): void {
    this.state = state;
    this.error = error;
    this.mgr.changed();
  }

  connect(): void {
    if (this.userClosed) return;
    const profile = hosts.get(this.hostId); // อ่านใหม่ทุกครั้ง เผื่อผู้ใช้แก้รหัสผ่านแล้วกด retry
    const first = this.reconnectAttempt === 0;
    this.setState(first ? "connecting" : "reconnecting", null);
    if (first) this.emitData(notice(`กำลังเชื่อมต่อ ${profile.username}@${profile.host}:${profile.port} ...`, "dim"));

    const client = new Client();
    this.client = client;
    let shellOpened = false;
    let shellExited = false;
    let finished = false;

    const finish = (err: Error | null) => {
      if (finished || this.client !== client) return;
      finished = true;
      this.stream = null;
      this.client = null;
      client.end();
      if (this.userClosed) return;

      if (shellExited) {
        this.emitData(notice("เซสชันจบการทำงาน", "dim"));
        this.setState("disconnected", null);
        return;
      }
      const msg = err ? err.message : "การเชื่อมต่อถูกปิด";
      const canRetry = shellOpened || this.reconnectAttempt > 0;
      if (canRetry && settings.get().autoReconnect && this.reconnectAttempt < BACKOFF_MS.length) {
        const delay = BACKOFF_MS[this.reconnectAttempt];
        this.reconnectAttempt++;
        this.emitData(notice(`${msg} — เชื่อมต่อใหม่ใน ${delay / 1000}s (ครั้งที่ ${this.reconnectAttempt}/${BACKOFF_MS.length})`, "yellow"));
        this.setState("reconnecting", msg);
        this.retryTimer = setTimeout(() => this.connect(), delay);
        return;
      }
      this.emitData(notice(`เชื่อมต่อไม่สำเร็จ: ${msg}`, "red"));
      this.setState("failed", msg);
    };

    client.on("ready", () => {
      client.shell({ term: "xterm-256color", cols: this.cols, rows: this.rows }, (err, stream) => {
        if (err) return finish(err);
        shellOpened = true;
        this.stream = stream;
        const decoder = iconv.getDecoder(profile.charset); // stateful: รองรับ multibyte ที่ถูกตัดข้าม chunk
        this.encode = (s) => iconv.encode(s, profile.charset);
        if (this.reconnectAttempt > 0) this.emitData(notice("เชื่อมต่อใหม่สำเร็จ", "green"));
        this.reconnectAttempt = 0;
        this.setState("connected", null);

        stream.on("data", (d: Buffer) => this.emitData(decoder.write(d)));
        stream.stderr.on("data", (d: Buffer) => this.emitData(decoder.write(d)));
        stream.on("exit", () => { shellExited = true; });
        stream.on("close", () => finish(null));

        if (profile.initialCommand) stream.write(this.encode(profile.initialCommand + "\r"));
        hosts.patch(profile.id, { lastUsedAt: Date.now() });
        this.mgr.emit("hosts-changed");
        if (profile.osId === null) {
          detectOs(client)
            .then((osId) => { hosts.patch(profile.id, { osId }); this.mgr.emit("hosts-changed"); })
            .catch((e: Error) => console.warn(`[os-detect] ${profile.host}: ${e.message}`));
        }
      });
    });
    client.on("error", (err) => finish(err));
    client.on("close", () => finish(null));
    client.on("keyboard-interactive", (_name, _instr, _lang, prompts, reply) => {
      // เซิร์ฟเวอร์ที่ปิด password auth แต่เปิด keyboard-interactive: ตอบทุก prompt ด้วยรหัสผ่าน
      if (profile.password === null) return reply([]);
      reply(prompts.map(() => profile.password!));
    });

    const cfg: ConnectConfig = {
      host: profile.host,
      port: profile.port,
      username: profile.username,
      readyTimeout: 20000,
      keepaliveInterval: 15000,
      keepaliveCountMax: 3,
      tryKeyboard: profile.authMethod === "password",
      hostVerifier: (key: Buffer, verify: (ok: boolean) => void) => {
        this.verifyHostKey(profile, key).then(verify, () => verify(false));
      },
    };
    if (profile.authMethod === "password") {
      if (profile.password !== null) cfg.password = profile.password;
    } else {
      cfg.privateKey = profile.privateKey!;
      if (profile.passphrase !== null) cfg.passphrase = profile.passphrase;
    }
    try {
      client.connect(cfg);
    } catch (e) {
      // ssh2 throw แบบ synchronous เมื่อ parse private key ไม่ได้ / passphrase ผิด
      finish(e as Error);
    }
  }

  private async verifyHostKey(profile: HostProfile, key: Buffer): Promise<boolean> {
    const name = knownHostName(profile);
    const known = knownHosts.lookup(name);
    if (known && known.key === key.toString("base64")) return true;
    const keyType = keyTypeOf(key);
    const ok = await this.mgr.askHostKey({
      reqId: randomUUID(),
      sessionId: this.id,
      host: name,
      keyType,
      fingerprint: fingerprintOf(key),
      isNew: !known,
      previousFingerprint: known ? fingerprintOf(Buffer.from(known.key, "base64")) : null,
    });
    if (ok) knownHosts.save(name, keyType, key);
    else this.emitData(notice("ปฏิเสธ host key", "red"));
    return ok;
  }

  write(data: string): void {
    this.stream?.write(this.encode(data));
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.stream?.setWindow(rows, cols, 0, 0);
  }

  retry(): void {
    if (this.state === "connected" || this.state === "connecting") return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.reconnectAttempt = 0;
    this.emitData(notice("ลองเชื่อมต่อใหม่ ...", "dim"));
    this.connect();
  }

  close(): void {
    this.userClosed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.mgr.cancelHostKeys(this.id);
    this.client?.end();
  }
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, LiveSession>();
  private pendingKeys = new Map<string, { req: HostKeyRequest; resolve: (ok: boolean) => void }>();

  list(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => s.info());
  }

  changed(): void {
    this.emit("sessions", this.list());
  }

  get(id: string): LiveSession {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`ไม่พบเซสชัน ${id}`);
    return s;
  }

  create(hostId: string, cols: number, rows: number): SessionInfo {
    hosts.get(hostId); // throw ถ้าไม่มีโฮสต์นี้
    const used = new Set([...this.sessions.values()].filter((s) => s.hostId === hostId).map((s) => s.seq));
    let seq = 1;
    while (used.has(seq)) seq++;
    const s = new LiveSession(`${hostId}#${seq}#${Date.now().toString(36)}`, hostId, seq, this);
    s.cols = cols;
    s.rows = rows;
    this.sessions.set(s.id, s);
    s.connect();
    return s.info();
  }

  remove(id: string): void {
    this.get(id).close();
    this.sessions.delete(id);
    this.changed();
  }

  removeForHost(hostId: string): void {
    for (const s of [...this.sessions.values()]) if (s.hostId === hostId) this.remove(s.id);
  }

  askHostKey(req: HostKeyRequest): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingKeys.set(req.reqId, { req, resolve });
      this.emit("hostkey", req);
    });
  }

  pendingHostKeys(): HostKeyRequest[] {
    return [...this.pendingKeys.values()].map((p) => p.req);
  }

  answerHostKey(reqId: string, accept: boolean): void {
    const p = this.pendingKeys.get(reqId);
    if (!p) return; // อีกแท็บตอบไปแล้ว
    this.pendingKeys.delete(reqId);
    p.resolve(accept);
    this.emit("hostkey-done", reqId);
  }

  cancelHostKeys(sessionId: string): void {
    for (const [reqId, p] of this.pendingKeys) if (p.req.sessionId === sessionId) this.answerHostKey(reqId, false);
  }
}

export const sessions = new SessionManager();
