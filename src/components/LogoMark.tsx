export function LogoMark({ className = "mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="hp-mark" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1aa36c" />
          <stop offset="1" stopColor="#0b4d33" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#hp-mark)" />
      <rect x="8" y="7" width="16" height="18" rx="2" fill="#f4fbf7" />
      <rect x="8" y="7" width="3.5" height="18" rx="1.2" fill="#0b4d33" />
      <rect x="14" y="12" width="8" height="1.7" rx="0.85" fill="#12855a" />
      <rect x="14" y="16.2" width="6" height="1.4" rx="0.7" fill="#b7c4bc" />
      <rect x="14" y="20.2" width="7" height="1.4" rx="0.7" fill="#b7c4bc" />
    </svg>
  );
}
