import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { getConfig } from "./config.ts";

/**
 * ไฟล์ JSON หนึ่งไฟล์ใน dataDir
 * - ไม่มีไฟล์ = ยังไม่เคยบันทึก -> ใช้ค่าเริ่มต้นตามสเปก (initial) ที่ผู้เรียกระบุชัดเจน
 * - ไฟล์เสีย/parse ไม่ได้ -> throw (ไม่เขียนทับข้อมูลผู้ใช้เงียบ ๆ)
 */
export class JsonFile<T> {
  constructor(private readonly name: string, private readonly initial: () => T) {}

  // คำนวณตอนใช้งาน เพราะ dataDir ถูกกำหนดหลัง import (มือถือรู้ path ตอน runtime)
  get path(): string {
    return resolve(getConfig().dataDir, this.name);
  }

  read(): T {
    const path = this.path;
    if (!existsSync(path)) return this.initial();
    const text = readFileSync(path, "utf8");
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      throw new Error(`Corrupted data file ${path}: ${(e as Error).message}`);
    }
  }

  write(value: T): void {
    // เขียนไฟล์ชั่วคราวแล้ว rename เพื่อกันไฟล์ขาดครึ่งถ้า process ตายกลางทาง
    const path = this.path;
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
    renameSync(tmp, path);
  }
}
