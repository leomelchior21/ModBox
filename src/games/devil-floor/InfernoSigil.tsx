/** The same carved flame mark appears on the title card and the expedition HUD. */
export function InfernoSigil({ compact = false }: { compact?: boolean }): JSX.Element {
  return <svg className={`floor__sigil ${compact ? 'floor__sigil--compact' : ''}`} viewBox="0 0 120 120" fill="none" aria-hidden="true">
    <circle cx="60" cy="60" r="54" stroke="currentColor" strokeOpacity=".25" />
    <circle cx="60" cy="60" r="45" stroke="currentColor" strokeOpacity=".45" strokeDasharray="1 7" />
    <path d="m60 4 4 8-4 8-4-8zm0 96 4 8-4 8-4-8zM4 60l8-4 8 4-8 4zm96 0 8-4 8 4-8 4z" fill="currentColor" />
    <path d="M36 36 25 24l5 25m54-13 11-12-5 25M38 87l22 14 22-14" stroke="currentColor" strokeWidth="1.5" />
    <path d="M60 25c6 19 20 21 20 39 0 14-9 25-22 25-15 0-24-12-21-25 2-9 8-13 7-23 7 4 10 11 10 16 8-10 11-20 6-32Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="1.5" />
    <path d="M60 52c5 9 12 13 12 21 0 7-5 12-12 12s-12-5-12-12c0-7 6-9 12-21Z" fill="currentColor" />
    <path d="m56 73 4-8 4 8-4 7z" fill="#162219" />
    <path d="M32 95h12m32 0h12M17 42l5-3m76 0 5 3" stroke="currentColor" strokeWidth="1.5" />
  </svg>;
}
