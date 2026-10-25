// entry สำหรับเดสก์ท็อป: อ่าน config.json แล้วเริ่ม server
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setConfig } from "./config.ts";
import { startServer } from "./app.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(ROOT, "config.json");
const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
if (typeof raw.host !== "string" || raw.host === "") throw new Error(`${path}: 'host' must be a non-empty string`);
if (typeof raw.port !== "number" || !Number.isInteger(raw.port)) throw new Error(`${path}: 'port' must be an integer`);
if (typeof raw.dataDir !== "string" || raw.dataDir === "") throw new Error(`${path}: 'dataDir' must be a non-empty string`);

// มี dist = โหมด production (npm start); ไม่มี = โหมด dev ที่ Vite เสิร์ฟหน้าเว็บเอง
const dist = resolve(ROOT, "dist");
setConfig({
  host: raw.host,
  port: raw.port,
  dataDir: resolve(ROOT, raw.dataDir),
  staticDir: existsSync(dist) ? dist : null,
  token: null,
});
await startServer();
