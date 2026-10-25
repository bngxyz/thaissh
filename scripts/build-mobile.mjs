// ประกอบ mobile/www (webDir ของ Capacitor):
//   index.html + boot.js      หน้าบูตที่สตาร์ท Node.js
//   nodejs/index.js           server ทั้งหมด bundle เป็นไฟล์เดียว (Node 18 บนมือถือ)
//   nodejs/web/               หน้าเว็บ React ที่ build แล้ว (server เสิร์ฟเอง)
// ต้องรัน `vite build` ก่อน (npm run build:mobile ทำให้แล้ว)
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const www = resolve(root, "mobile/www");
const dist = resolve(root, "dist");
if (!existsSync(resolve(dist, "index.html"))) throw new Error("dist/ not found — run `vite build` first");

rmSync(www, { recursive: true, force: true });
mkdirSync(resolve(www, "nodejs"), { recursive: true });

cpSync(resolve(root, "mobile/index.html"), resolve(www, "index.html"));
await build({
  entryPoints: [resolve(root, "mobile/boot.ts")],
  outfile: resolve(www, "boot.js"),
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
});

await build({
  entryPoints: [resolve(root, "server/mobile.ts")],
  outfile: resolve(www, "nodejs/index.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18", // capacitor-nodejs ใช้ Node.js for Mobile 18.20
  minify: true,
  // bridge = โมดูลที่ capacitor-nodejs ใส่ให้ตอน runtime
  // ที่เหลือเป็น native addon แบบ optional (ssh2/ws ใช้ try/catch แล้วถอยไปใช้ JS ล้วน)
  external: ["bridge", "cpu-features", "bufferutil", "utf-8-validate", "*.node"],
  logLevel: "warning",
});
writeFileSync(resolve(www, "nodejs/package.json"), JSON.stringify({ name: "thaissh-server", main: "index.js" }, null, 2));
cpSync(dist, resolve(www, "nodejs/web"), { recursive: true });

console.log("mobile/www ready");
