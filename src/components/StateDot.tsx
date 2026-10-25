import type { SessionState } from "../../shared/types";

export const STATE_LABEL: Record<SessionState, string> = {
  connecting: "กำลังเชื่อมต่อ",
  connected: "เชื่อมต่อแล้ว",
  reconnecting: "กำลังเชื่อมต่อใหม่",
  disconnected: "ตัดการเชื่อมต่อแล้ว",
  failed: "เชื่อมต่อไม่สำเร็จ",
};

export function StateDot({ state }: { state: SessionState }) {
  return <span className={`dot dot-${state}`} title={STATE_LABEL[state]} />;
}
