/** โลโก้ OS แบบเรียบง่าย (แทน os_*.xml ของแอปเดิม) — สีตามแบรนด์ + สัญลักษณ์ย่อ */

interface OsStyle { bg: string; fg: string; name: string }

const STYLES: Record<string, OsStyle> = {
  ubuntu: { bg: "#e95420", fg: "#fff", name: "Ubuntu" },
  debian: { bg: "#a80030", fg: "#fff", name: "Debian" },
  alpine: { bg: "#0d597f", fg: "#fff", name: "Alpine" },
  fedora: { bg: "#51a2da", fg: "#fff", name: "Fedora" },
  arch: { bg: "#1793d1", fg: "#fff", name: "Arch Linux" },
  centos: { bg: "#932279", fg: "#fff", name: "CentOS" },
  rocky: { bg: "#10b981", fg: "#fff", name: "Rocky Linux" },
  almalinux: { bg: "#0f4266", fg: "#fff", name: "AlmaLinux" },
  opensuse: { bg: "#73ba25", fg: "#fff", name: "openSUSE" },
  windows: { bg: "#0078d4", fg: "#fff", name: "Windows" },
  macos: { bg: "#1f2937", fg: "#fff", name: "macOS" },
  freebsd: { bg: "#ab2b28", fg: "#fff", name: "FreeBSD" },
  linux: { bg: "#2b2f3a", fg: "#fcd34d", name: "Linux" },
};

function Glyph({ os, fg }: { os: string; fg: string }) {
  switch (os) {
    case "ubuntu":
      return (
        <g fill="none" stroke={fg} strokeWidth="2.2">
          <circle cx="12" cy="12" r="5.2" />
          <circle cx="17.6" cy="12" r="1.9" fill={fg} stroke="none" />
          <circle cx="9.2" cy="7.2" r="1.9" fill={fg} stroke="none" />
          <circle cx="9.2" cy="16.8" r="1.9" fill={fg} stroke="none" />
        </g>
      );
    case "debian":
      return <path d="M13.5 6.5a5.6 5.6 0 1 0 3 8.2 4 4 0 0 1-6.3-1.7 3.2 3.2 0 0 1 4.6-3.5" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" />;
    case "alpine":
      return <path d="M4 17l5.5-9 3.5 5.5 2-3L20 17z" fill={fg} />;
    case "fedora":
      return <path d="M12 5a7 7 0 1 0 7 7V12h-4.5M12 19v-7a3 3 0 0 1 3-3h1" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" />;
    case "arch":
      return <path d="M12 4.5 5 19.5c2.2-1.3 4-2 5.6-2.4-.4-1.6.4-3.7 1.4-3.7s1.8 2.1 1.4 3.7c1.6.4 3.4 1.1 5.6 2.4z" fill={fg} />;
    case "windows":
      return (
        <g fill={fg}>
          <rect x="5" y="5" width="6.4" height="6.4" rx=".6" />
          <rect x="12.6" y="5" width="6.4" height="6.4" rx=".6" />
          <rect x="5" y="12.6" width="6.4" height="6.4" rx=".6" />
          <rect x="12.6" y="12.6" width="6.4" height="6.4" rx=".6" />
        </g>
      );
    case "macos":
      return <path d="M15.3 5.2c-.8.1-1.8.6-2.3 1.3-.5.6-.9 1.5-.8 2.3.9 0 1.8-.5 2.3-1.2.5-.6.9-1.5.8-2.4zM18 15.6c-.4 1-.6 1.4-1.1 2.2-.7 1.1-1.7 2.5-2.9 2.5-1.1 0-1.4-.7-2.9-.7s-1.8.7-2.9.7c-1.2 0-2.2-1.3-2.9-2.4-2-3-2.2-6.6-1-8.5.9-1.3 2.2-2.1 3.5-2.1s2.1.7 3.2.7c1 0 1.7-.7 3.2-.7 1.1 0 2.3.6 3.2 1.7-2.8 1.5-2.3 5.5.6 6.6z" fill={fg} />;
    case "linux":
      return <path d="M7 8.5 10.5 12 7 15.5M12.5 16h5" fill="none" stroke={fg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />;
    default: {
      const s = STYLES[os];
      return (
        <text x="12" y="16.2" textAnchor="middle" fontSize="10" fontWeight="700" fill={fg} fontFamily="system-ui, sans-serif">
          {s.name.slice(0, 2)}
        </text>
      );
    }
  }
}

export function osName(osId: string | null): string {
  if (osId === null) return "ยังไม่ทราบ OS";
  const s = STYLES[osId];
  return s ? s.name : "ไม่ทราบ OS";
}

export function OsLogo({ osId, size = 36, fallbackColor }: { osId: string | null; size?: number; fallbackColor: string }) {
  const s = osId ? STYLES[osId] : undefined;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="os-logo" role="img" aria-label={osName(osId)}>
      <rect width="24" height="24" rx="7" fill={s ? s.bg : fallbackColor} />
      {s ? (
        <Glyph os={osId!} fg={s.fg} />
      ) : (
        <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5.5" y="6" width="13" height="5" rx="1.4" />
          <rect x="5.5" y="13" width="13" height="5" rx="1.4" />
          <path d="M8.5 8.5h.01M8.5 15.5h.01" strokeWidth="2.4" />
        </g>
      )}
    </svg>
  );
}
