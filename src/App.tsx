import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useStore } from "./store";
import { applySettingsToAll } from "./terminals";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { TerminalPane } from "./components/TerminalPane";
import { KeyBar, SuggestionBar } from "./components/KeyBar";
import { HostEditor } from "./components/HostEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { KeyBarEditor } from "./components/KeyBarEditor";
import { ConfirmDialog, HostKeyDialog, Toasts } from "./components/Dialogs";
import { Welcome } from "./components/Welcome";
import { HostPicker } from "./components/HostPicker";

function useTheme(mode: "system" | "light" | "dark") {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = mode === "dark" || (mode === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);
}

export function App() {
  const settings = useStore((s) => s.settings)!;
  const sessions = useStore((s) => s.sessions);
  const activeId = useStore((s) => s.activeId);
  const wsOnline = useStore((s) => s.wsOnline);
  const editor = useStore((s) => s.editor);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const keyBarEditorOpen = useStore((s) => s.keyBarEditorOpen);
  const pickerOpen = useStore((s) => s.pickerOpen);
  const active = sessions.find((s) => s.id === activeId);

  useTheme(settings.theme);
  useEffect(() => applySettingsToAll(settings), [settings]);

  return (
    <div className={`app${active ? " has-session" : ""}`}>
      <Sidebar />
      <main className="main">
        <TabBar />
        {!wsOnline && (
          <div className="offline"><WifiOff size={15} />ขาดการติดต่อกับเซิร์ฟเวอร์ ThaiSSH — กำลังลองใหม่…</div>
        )}
        {active ? (
          <>
            <TerminalPane session={active} />
            {settings.showSuggestions && <SuggestionBar sessionId={active.id} />}
            {settings.showKeyBar && <KeyBar sessionId={active.id} />}
          </>
        ) : (
          <Welcome />
        )}
      </main>
      {editor && <HostEditor key={editor.mode === "edit" ? editor.host.id : "new"} />}
      {pickerOpen && <HostPicker />}
      {settingsOpen && <SettingsPanel />}
      {keyBarEditorOpen && <KeyBarEditor />}
      <HostKeyDialog />
      <ConfirmDialog />
      <Toasts />
    </div>
  );
}
