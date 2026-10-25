// หน้าบูตของแอป Android: สตาร์ท Node.js ในแอป แล้วพา WebView ไปหน้า ThaiSSH ที่ server ในเครื่องเสิร์ฟ
import { NodeJS } from "capacitor-nodejs";

const status = document.getElementById("status")!;

function fail(message: string): void {
  document.body.classList.add("error");
  status.textContent = `เริ่มแอปไม่สำเร็จ: ${message}`;
}

// token สุ่มใหม่ทุกครั้งที่เปิดแอป — แอปอื่นในเครื่องจึงเรียก server ที่ 127.0.0.1 ไม่ได้
const bytes = crypto.getRandomValues(new Uint8Array(32));
const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

async function boot(): Promise<void> {
  await NodeJS.addListener("server-ready", (e) => {
    const port = e.args[0];
    if (typeof port !== "number") return fail(`invalid port ${String(port)}`);
    // replace: ไม่ทิ้งหน้าบูตไว้ใน history (กด back แล้วจะไม่กลับมาสตาร์ท Node ซ้ำ)
    location.replace(`http://127.0.0.1:${port}/auth?token=${token}`);
  });
  await NodeJS.addListener("server-error", (e) => fail(String(e.args[0])));
  await NodeJS.start({ env: { THAISSH_TOKEN: token } });
}

boot().catch((e: Error) => fail(e.message));
