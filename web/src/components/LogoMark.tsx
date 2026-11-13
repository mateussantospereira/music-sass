export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Riff">
      <rect width="100" height="100" rx="22" fill="#111110" />
      <path d="M38 68V32l26-6v33" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="31" cy="68" r="8" fill="#fff" />
      <circle cx="57" cy="59" r="8" fill="#fff" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight ${className}`}>
      <LogoMark size={32} />
      Riff
    </span>
  );
}
