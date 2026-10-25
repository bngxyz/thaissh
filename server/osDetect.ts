import type { Client } from "ssh2";

/**
 * ตรวจชนิด OS ของเครื่องปลายทาง (พอร์ตจาก OsDetector.kt ของแอป Android เดิม)
 * คืนค่า: ubuntu, debian, alpine, fedora, arch, centos, rocky, almalinux, opensuse,
 *         macos, freebsd, windows, linux, unknown
 */
const KNOWN = new Set([
  "ubuntu", "debian", "alpine", "fedora", "arch", "centos", "rocky", "almalinux", "opensuse", "windows", "linux",
]);

const ALIAS: Record<string, string> = {
  raspbian: "debian", linuxmint: "ubuntu", pop: "ubuntu", elementary: "ubuntu",
  archarm: "arch", manjaro: "arch", endeavouros: "arch", rhel: "rocky",
  "opensuse-leap": "opensuse", "opensuse-tumbleweed": "opensuse", sles: "opensuse", suse: "opensuse",
};

function mapId(raw: string): string | null {
  const id = raw.trim().toLowerCase();
  if (id === "") return null;
  if (ALIAS[id]) return ALIAS[id];
  return KNOWN.has(id) ? id : null;
}

function readKey(text: string, key: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith(`${key}=`)) return t.slice(key.length + 1).trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  }
  return null;
}

export function parseOs(raw: string): string {
  const text = raw.trim();
  if (text === "") return "unknown";
  const lower = text.toLowerCase();
  const isOsRelease = text.split(/\r?\n/).some((l) => l.trimStart().startsWith("ID="));
  if (!isOsRelease) {
    if (/microsoft|windows|mingw|cygwin/.test(lower)) return "windows";
    if (lower.includes("darwin")) return "macos";
    if (lower.includes("freebsd")) return "freebsd";
    if (lower.includes("linux")) return "linux";
    return "unknown";
  }
  const id = readKey(text, "ID");
  const mapped = id ? mapId(id) : null;
  if (mapped) return mapped;
  const like = readKey(text, "ID_LIKE");
  if (like) {
    for (const tok of like.split(/\s+/)) {
      const m = mapId(tok);
      if (m) return m;
    }
  }
  return "linux";
}

/** รันคำสั่งบน connection เดิม แล้วอ่าน stdout ทั้งหมด (มี timeout) */
export function execCapture(client: Client, command: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("exec timeout")), timeoutMs);
    client.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }
      const chunks: Buffer[] = [];
      stream.on("data", (d: Buffer) => chunks.push(d));
      stream.stderr.on("data", () => {});
      stream.on("close", () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });
  });
}

export async function detectOs(client: Client): Promise<string> {
  // Windows OpenSSH ใช้ cmd เป็น shell เริ่มต้น: คำสั่ง POSIX จะล้ม -> ลอง ver เพิ่ม
  const out = await execCapture(client, "cat /etc/os-release 2>/dev/null || uname -s 2>/dev/null || ver", 8000);
  return parseOs(out);
}
