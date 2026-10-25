import express, { type NextFunction, type Request, type Response } from "express";
import { createServer, type IncomingMessage } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { getConfig } from "./config.ts";
import { hosts, settings, history, knownHosts, ValidationError, KEYBAR_PRESETS } from "./stores.ts";
import { sessions, fingerprintOf } from "./sessions.ts";
import type { ClientMessage, ServerMessage } from "../shared/types.ts";

const COOKIE = "thaissh_token";

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function cookieToken(req: IncomingMessage): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

function isAuthorized(req: IncomingMessage): boolean {
  const { token } = getConfig();
  if (token === null) return true;
  const got = cookieToken(req);
  return got !== null && sameToken(got, token);
}

const app = express();
app.disable("x-powered-by");

// /auth?token=… : แอปมือถือเปิดหน้านี้ครั้งแรกเพื่อรับ cookie แล้ว redirect ไปหน้าแอป
app.get("/auth", (req, res) => {
  const { token } = getConfig();
  if (token === null) return res.redirect("/");
  const given = req.query.token;
  if (typeof given !== "string" || !sameToken(given, token)) return res.status(403).send("forbidden: invalid token");
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "strict", path: "/" });
  // ไม่ใช้ 302: การเปิด /auth มาจากหน้าบูต (localhost = คนละ site) ถ้า redirect ต่อทันที
  // browser จะไม่ส่ง cookie SameSite=Strict ไปกับ request ถัดไป — ให้หน้านี้พาไปเองแบบ same-site แทน
  res.type("html").send('<!doctype html><meta charset="utf-8"><script>location.replace("/")</script>');
});
app.use((req, res, next) => {
  if (isAuthorized(req)) return next();
  res.status(403).send(cookieToken(req) === null ? "forbidden: no session cookie" : "forbidden: invalid session cookie");
});
app.use(express.json({ limit: "1mb" }));

const api = express.Router();

// ----- hosts
api.get("/hosts", (_req, res) => res.json(hosts.all()));
api.post("/hosts", (req, res) => { res.json(hosts.create(req.body)); broadcast({ t: "hosts-changed" }); });
api.put("/hosts/order", (req, res) => { hosts.reorder(req.body.ids); res.json({ ok: true }); broadcast({ t: "hosts-changed" }); });
api.put("/hosts/:id", (req, res) => { res.json(hosts.update(req.params.id, req.body)); broadcast({ t: "hosts-changed" }); });
api.delete("/hosts/:id", (req, res) => {
  sessions.removeForHost(req.params.id);
  hosts.remove(req.params.id);
  res.json({ ok: true });
  broadcast({ t: "hosts-changed" });
});

// ----- sessions
api.get("/sessions", (_req, res) => res.json(sessions.list()));
api.post("/sessions", (req, res) => {
  const { hostId, cols, rows } = req.body as { hostId: unknown; cols: unknown; rows: unknown };
  if (typeof hostId !== "string") throw new ValidationError("hostId must be a string");
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) throw new ValidationError("cols/rows must be integers");
  res.json(sessions.create(hostId, cols as number, rows as number));
});
api.post("/sessions/:id/retry", (req, res) => { sessions.get(req.params.id).retry(); res.json({ ok: true }); });
api.delete("/sessions/:id", (req, res) => { sessions.remove(req.params.id); res.json({ ok: true }); });

// ----- settings
api.get("/settings", (_req, res) => res.json({ settings: settings.get(), presets: KEYBAR_PRESETS }));
api.put("/settings", (req, res) => res.json(settings.update(req.body)));

// ----- command history
api.get("/history", (_req, res) => res.json(history.recent()));
api.post("/history", (req, res) => { history.add(req.body.cmd); res.json({ ok: true }); });
api.delete("/history", (_req, res) => { history.clear(); res.json({ ok: true }); });

// ----- known hosts
api.get("/known-hosts", (_req, res) => res.json(knownHosts.list(fingerprintOf)));
api.delete("/known-hosts/:host", (req, res) => { knownHosts.remove(req.params.host); res.json({ ok: true }); });

app.use("/api", api);
app.use("/api", (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof ValidationError ? 400 : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message });
});

// ----- websocket: สตรีมข้อมูล terminal + สถานะ + host key prompt
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws", verifyClient: (info: { req: IncomingMessage }) => isAuthorized(info.req) });

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
function broadcast(msg: ServerMessage): void {
  for (const ws of wss.clients) send(ws, msg);
}

sessions.on("sessions", (list) => broadcast({ t: "sessions", list }));
sessions.on("data", (id: string, data: string) => broadcast({ t: "data", id, data }));
sessions.on("hostkey", (req) => broadcast({ t: "hostkey", req }));
sessions.on("hostkey-done", (reqId: string) => broadcast({ t: "hostkey-done", reqId }));
sessions.on("hosts-changed", () => broadcast({ t: "hosts-changed" }));

wss.on("connection", (ws) => {
  send(ws, { t: "sessions", list: sessions.list() });
  for (const req of sessions.pendingHostKeys()) send(ws, { t: "hostkey", req });

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString()) as ClientMessage;
    try {
      switch (msg.t) {
        case "input": sessions.get(msg.id).write(msg.data); break;
        case "resize": sessions.get(msg.id).resize(msg.cols, msg.rows); break;
        case "replay": send(ws, { t: "replay", id: msg.id, data: sessions.get(msg.id).replayText() }); break;
        case "hostkey-reply": sessions.answerHostKey(msg.reqId, msg.accept); break;
      }
    } catch (e) {
      // เซสชันถูกปิดไปแล้วระหว่างที่ข้อความยังวิ่งอยู่ — แจ้งรายการล่าสุดให้ client sync
      console.warn(`[ws] ${msg.t}: ${(e as Error).message}`);
      send(ws, { t: "sessions", list: sessions.list() });
    }
  });
});

/** เริ่ม server ตาม config ที่ setConfig() ไว้ — คืนพอร์ตที่ใช้จริง (สำคัญเมื่อขอพอร์ต 0) */
export function startServer(): Promise<number> {
  const config = getConfig();
  history.prune(); // ลบประวัติคำสั่งที่เก่ากว่า 7 วัน ตอนเริ่ม (เหมือนแอปเดิม)

  // production: เสิร์ฟหน้าเว็บที่ build แล้ว
  if (config.staticDir !== null) {
    const dir = config.staticDir;
    app.use(express.static(dir));
    app.get("*", (_req, res) => res.sendFile(resolve(dir, "index.html")));
  }

  return new Promise((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") return reject(new Error("unexpected server address"));
      console.log(`ThaiSSH server  →  http://${config.host}:${addr.port}`);
      resolvePort(addr.port);
    });
  });
}
