import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@xterm/xterm/css/xterm.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/noto-sans-thai-looped/400.css";
import "@fontsource/noto-sans-thai-looped/700.css";
import "@fontsource/ibm-plex-sans-thai/400.css";
import "@fontsource/ibm-plex-sans-thai/500.css";
import "@fontsource/ibm-plex-sans-thai/600.css";
import "./styles.css";
import { App } from "./App";
import { api } from "./api";
import { useStore } from "./store";
import { connectWs } from "./ws";

const root = createRoot(document.getElementById("root")!);

async function boot() {
  const [hosts, { settings, presets }, history] = await Promise.all([api.hosts(), api.settings(), api.history()]);
  useStore.getState().set({ hosts, settings, presets, history });
  // รอฟอนต์ก่อนสร้าง terminal เพื่อให้ xterm วัดขนาด cell ถูกตั้งแต่แรก
  await Promise.all([
    document.fonts.load("14px 'JetBrains Mono'"),
    document.fonts.load("14px 'Noto Sans Thai Looped'", "ก"),
  ]);
  connectWs();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot().catch((e: Error) => {
  root.render(
    <div className="boot-error">
      <h1>เริ่มแอปไม่สำเร็จ</h1>
      <p>{e.message}</p>
      <p className="muted">ตรวจสอบว่า server ThaiSSH ทำงานอยู่ (npm run dev) แล้วรีเฟรชหน้า</p>
    </div>,
  );
});
