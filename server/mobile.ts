// entry สำหรับแอป Android: รันใน Node.js ที่ฝังในแอป (capacitor-nodejs)
// bundle เป็น mobile/www/nodejs/index.js ด้วย scripts/build-mobile.mjs
import { resolve } from "node:path";
import { setConfig } from "./config.ts";
import { startServer } from "./app.ts";

interface Bridge {
  channel: { send(event: string, ...args: unknown[]): void };
  getDataPath(): string;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { channel, getDataPath } = require("bridge") as Bridge;

const token = process.env.THAISSH_TOKEN;
if (typeof token !== "string" || token.length < 32) {
  channel.send("server-error", "THAISSH_TOKEN env is missing or too short");
  throw new Error("THAISSH_TOKEN env is missing or too short");
}

setConfig({
  host: "127.0.0.1",
  port: 0, // ให้ OS เลือกพอร์ตว่าง แล้วแจ้งพอร์ตจริงกลับไปทาง bridge
  dataDir: resolve(getDataPath(), "thaissh"),
  staticDir: resolve(__dirname, "web"),
  token,
});

startServer().then(
  (port) => channel.send("server-ready", port),
  (e: Error) => channel.send("server-error", e.message),
);
