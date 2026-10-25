import { mkdirSync } from "node:fs";

export interface ServerConfig {
  host: string;
  /** 0 = ให้ OS เลือกพอร์ตว่าง (ใช้บนมือถือ) */
  port: number;
  dataDir: string;
  /** โฟลเดอร์หน้าเว็บที่ build แล้ว; null = ไม่เสิร์ฟ (โหมด dev ใช้ Vite แทน) */
  staticDir: string | null;
  /** ถ้ากำหนด ทุก request ต้องมี cookie token นี้ (บนมือถือแอปอื่นเข้าถึง 127.0.0.1 ได้เหมือนกัน) */
  token: string | null;
}

let current: ServerConfig | null = null;

export function setConfig(c: ServerConfig): void {
  if (current) throw new Error("server config already set");
  mkdirSync(c.dataDir, { recursive: true });
  current = c;
}

export function getConfig(): ServerConfig {
  if (!current) throw new Error("server config not set — call setConfig() first");
  return current;
}
