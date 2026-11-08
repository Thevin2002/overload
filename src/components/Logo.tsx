export function Logo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" className="fill-brand-500" />
      <path d="M14 26v12M20 21v22M44 21v22M50 26v12M20 32h24" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" />
    </svg>
  )
}
