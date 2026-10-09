/** Small cabinet illustrations extend the arcade's existing vector cover style. */
export function GameTeaser({ kind }: { kind: 'maze' | 'platform' }): JSX.Element {
  return (
    <svg className="game-teaser" viewBox="0 0 280 260" fill="none" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => <rect key={i} x={(i * 73 + 12) % 280} y={(i * 37 + 19) % 240} width={i % 3 === 0 ? 2 : 1} height={i % 3 === 0 ? 2 : 1} fill="currentColor" opacity=".35" />)}
      {kind === 'maze' ? <>
        <path className="game-teaser__glow" d="M22 89h72v30H53v66h48v-33h35v53h42v-59h35v38h41M22 145v77h96m18-133h51v30h67V78h-42m-76 150h79m-3-110v-29M254 206v25h-23" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
        <path d="M69 151v20h19m64 13v-49h42" stroke="#60dfff" strokeWidth="3" />
        <circle cx="69" cy="139" r="5" fill="#fff3b0" /><circle cx="194" cy="135" r="4" fill="#ff8759" />
      </> : <>
        <path d="M10 226h260M12 207v-35h35v35m189 0v-35h32v35" stroke="currentColor" strokeWidth="3" />
        <path d="m42 225 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28" fill="currentColor" />
        <path d="M120 112 96 95 88 71l6-20 5 26 25 19h32l25-19 5-26 6 20-8 24-24 17 9 14-3 25-16 12v14h-8v-11h-7v11h-8v-14l-16-12-3-25z" fill="currentColor" />
        <path d="m118 124 19 11-19 3zm44 0-19 11 19 3zm-22 18-5 10h10z" fill="#160500" />
      </>}
    </svg>
  );
}
