import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// อ่านพอร์ตของ backend จาก config.json เพื่อให้ dev proxy ชี้ถูกที่เสมอ
const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
if (typeof config.port !== "number") throw new Error("config.json: 'port' must be a number");
const backend = `http://127.0.0.1:${config.port}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": backend,
      "/ws": { target: backend.replace("http", "ws"), ws: true },
    },
  },
  build: { outDir: "dist", chunkSizeWarningLimit: 1500 },
});
