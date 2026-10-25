# ThaiSSH Web

SSH client แบบ React + Node ที่รองรับภาษาไทย ใช้ได้ทั้งบนคอมพิวเตอร์และ Android

## เริ่มใช้งาน

```bash
npm install
npm run dev      # server (tsx watch) + Vite → เปิด http://localhost:5173
```

Production (server เสิร์ฟไฟล์ที่ build แล้วที่พอร์ตเดียว):

```bash
npm run build
npm start        # → http://127.0.0.1:7022
```

ตั้งค่า server ใน `config.json` (`host`, `port`, `dataDir`) — ทุกค่าบังคับ ถ้าหายไป server จะไม่ start

## Build APK (Android)

แอป Android ใช้ Capacitor 8 ห่อหน้าเว็บ และฝัง Node.js 18 ไว้ในแอปด้วย [capacitor-nodejs](https://github.com/hampoelz/Capacitor-NodeJS)
server ตัวเดียวกันจึงรันในมือถือได้เลย ไม่ต้องมี PC

ต้องมี: JDK 21, Android SDK (platform 36, build-tools 35, NDK 27.0.12077973, CMake 3.22.1) และ `android/local.properties` ที่ชี้ `sdk.dir`

```bash
npm run apk
# ผลลัพธ์ใน android/app/build/outputs/apk/debug/ แยกตาม CPU (~55 MB ต่อไฟล์):
#   app-arm64-v8a-debug.apk     มือถือทั่วไป (ใช้ไฟล์นี้)
#   app-armeabi-v7a-debug.apk   มือถือ 32-bit รุ่นเก่า
#   app-x86_64-debug.apk        emulator
```

เครื่องที่ตั้ง locale เป็นไทย: `android/gradle.properties` บังคับ JVM เป็น `-Duser.language=en` แล้ว
เพราะปฏิทินพุทธศักราช (ปี 2569) ทำให้ขั้นตอนสร้างไฟล์ zip ของ Gradle ล้ม

`npm run apk` = typecheck → `vite build` → `scripts/build-mobile.mjs` (bundle server เป็น `mobile/www/nodejs/index.js` + คัดลอกหน้าเว็บ) → `cap sync` → `gradlew assembleDebug`

ลำดับตอนเปิดแอป:
1. หน้าบูต (`mobile/index.html`) สุ่ม token แล้วสตาร์ท Node.js (`server/mobile.ts`)
2. Node.js เปิด server ที่ `127.0.0.1:<พอร์ตว่าง>` และส่งพอร์ตกลับผ่าน bridge
3. WebView ไปที่ `/auth?token=…` → ได้ cookie → เข้าแอป (แอปอื่นในเครื่องเรียก API ไม่ได้เพราะไม่มี token)
4. `SessionService` (foreground service + การแจ้งเตือน) ทำให้ SSH session ไม่หลุดเมื่อสลับไปแอปอื่น ปุ่ม back จะพับแอปไว้เบื้องหลังแทนการปิด กด "ปิดแอป" ในการแจ้งเตือนเพื่อจบทุก session

## โครงสร้าง

| ส่วน | ไฟล์ |
| --- | --- |
| REST + WebSocket | `server/app.ts` (entry: `server/index.ts` เดสก์ท็อป, `server/mobile.ts` Android) |
| แอป Android | `mobile/` (หน้าบูต), `android/` (Capacitor + `SessionService`) |
| SSH session, auto-reconnect, host key | `server/sessions.ts` (ssh2 + iconv-lite) |
| ตรวจ OS | `server/osDetect.ts` |
| เก็บข้อมูล (hosts / settings / history / known_hosts) | `server/stores.ts` → `data/*.json` |
| จอ terminal (xterm.js + Unicode 11) | `src/terminals.ts` |
| UI | `src/components/*` |

## ฟีเจอร์ (เทียบกับแอปเดิม)

- โฮสต์: เพิ่ม/แก้/ลบ/ทำสำเนา/ลากจัดลำดับ, รหัสผ่าน หรือ private key (+passphrase, ลากไฟล์วางได้), charset, คำสั่งเริ่มต้น, สีประจำโฮสต์
- หลายเซสชันต่อโฮสต์ (1)(2)… เป็นแท็บ — เซสชันอยู่บน server จึง **ปิดเบราว์เซอร์แล้วยังไม่หลุด** เปิดกลับมาจะ replay จอเดิม
- เชื่อมต่อใหม่อัตโนมัติ backoff 1/2/4/8/16 วินาที, ปุ่ม retry เมื่อล้มเหลว
- ยืนยัน host key (SHA256 fingerprint) แจ้งเตือนเมื่อ key เปลี่ยน, จัดการ known hosts ในหน้าตั้งค่า
- ตรวจ OS อัตโนมัติ + โลโก้
- ตั้งค่า: ขนาด/สี/แบบอักษร (พรีวิวสด), ธีมสว่าง/มืด, auto-reconnect, scrollback
- แถบปุ่มพิเศษ (ESC/TAB/CTRL/ALT sticky/ลูกศร/…) จัดเรียงด้วยการลาก + preset — เปิดด้วย Shift+Tab
- ประวัติคำสั่ง + chip แนะนำตาม prefix, เก็บ 7 วัน/500 คำสั่ง, ไม่บันทึกสิ่งที่พิมพ์ตอนถูกถามรหัสผ่าน
- คีย์ลัด: Ctrl+Shift+C/V คัดลอก/วาง, Ctrl+Shift+F ค้นหาในจอ, คลิกกลางปิดแท็บ

## ความปลอดภัย

รหัสผ่านและ private key เก็บเป็น plain text ใน `data/hosts.json` (เหมือน SharedPreferences ของแอปเดิม)
server ไม่มีระบบล็อกอิน — ค่าเริ่มต้นจึง bind แค่ `127.0.0.1` **อย่าเปลี่ยนเป็น `0.0.0.0` บนเครือข่ายที่ไม่ไว้ใจ**
