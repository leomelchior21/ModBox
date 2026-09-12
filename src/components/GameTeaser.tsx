/** Small cabinet illustrations extend the arcade's existing vector cover style. */
export function GameTeaser({ kind }: { kind: 'runner' | 'maze' | 'platform' }): JSX.Element {
  return (
    <svg className="game-teaser" viewBox="0 0 280 260" fill="none" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => <rect key={i} x={(i * 73 + 12) % 280} y={(i * 37 + 19) % 240} width={i % 3 === 0 ? 2 : 1} height={i % 3 === 0 ? 2 : 1} fill="currentColor" opacity=".35" />)}
      {kind === 'maze' ? <>
        <path className="game-teaser__glow" d="M22 89h72v30H53v66h48v-33h35v53h42v-59h35v38h41M22 145v77h96m18-133h51v30h67V78h-42m-76 150h79m-3-110v-29M254 206v25h-23" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
        <path d="M69 151v20h19m64 13v-49h42" stroke="#60dfff" strokeWidth="3" />
        <circle cx="69" cy="139" r="5" fill="#fff3b0" /><circle cx="194" cy="135" r="4" fill="#ff8759" />
      </> : kind === 'runner' ? <>
        <path d="M0 211h65v23h73v-42h58v-29h53v18h31M0 221h49m93-15h38m19-31h38" stroke="currentColor" strokeWidth="4" />
        <path d="m66 184 17-18 23 9 14 24m-32-31 9-28 24 6 15 17m-35-18-18 10-16-7m34-24 1-14h17v16z" stroke="currentColor" strokeWidth="7" strokeLinejoin="miter" />
        <path d="M28 160h26m-38 14h38m-29 14h22" stroke="#ffc27a" strokeWidth="2" opacity=".7" />
        <rect x="170" y="119" width="28" height="29" stroke="currentColor" strokeWidth="3" />
      </> : <>
        <path d="M10 226h260M12 207v-35h35v35m189 0v-35h32v35" stroke="currentColor" strokeWidth="3" />
        <path d="m42 225 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28 11-28 11 28" fill="currentColor" />
        <path d="M120 112 96 95 88 71l6-20 5 26 25 19h32l25-19 5-26 6 20-8 24-24 17 9 14-3 25-16 12v14h-8v-11h-7v11h-8v-14l-16-12-3-25z" fill="currentColor" />
        <path d="m118 124 19 11-19 3zm44 0-19 11 19 3zm-22 18-5 10h10z" fill="#160500" />
      </>}
    </svg>
  );
}
