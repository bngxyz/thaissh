export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
      <path d="M9 11.5 14 16l-5 4.5" fill="none" stroke="#0b0d12" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 21h6.5" stroke="#0b0d12" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
