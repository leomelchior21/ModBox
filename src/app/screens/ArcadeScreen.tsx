import { CrtGlass } from '../../components/CrtGlass';
import { useId, useRef, useState, useEffect } from 'react';
import { Logo } from '../../brand/Logo';
import { GameTeaser } from '../../components/GameTeaser';
import { MISSIONS } from '../../learning/missions';
import type { Mission } from '../../learning/missions/types';

/* ============================================================================
   MODBOX — ARCADE LIBRARY
   Cabinets, not course cards. VECTOR ZERO is live; the rest are promised
   without pretending to exist (spec §30).
   ========================================================================== */

const FUTURE_CABINETS = [
  { id: 'runner', title: 'RUNNER', genre: 'endless runner', note: 'IN DEVELOPMENT' },
  { id: 'maze', title: 'NEON MAZE', genre: 'labyrinth chase', note: 'IN DEVELOPMENT' },
  { id: 'platform', title: 'DEVIL FLOOR', genre: 'vector platformer', note: 'IN DEVELOPMENT' },
] as const;

export function ArcadeScreen({
  onPlay,
  onContinue,
  onFreeMod,
  onBack,
  onSettings,
  completed,
  currentMission,
  bestScore,
  freeModeUnlocked,
}: {
  onPlay: () => void;
  onContinue: () => void;
  onFreeMod: () => void;
  onBack: () => void;
  onSettings: () => void;
  completed: string[];
  currentMission: Mission;
  bestScore: number;
  freeModeUnlocked: boolean;
}): JSX.Element {
  const rail = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ index: 1, end: false });
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () => {
      const card = el.firstElementChild as HTMLElement | null;
      setScroll({ index: Math.min(4, 1 + Math.round(el.scrollLeft / ((card?.offsetWidth ?? 1) + 20))), end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 3 });
    };
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update); observer.observe(el); update();
    return () => { el.removeEventListener('scroll', update); observer.disconnect(); };
  }, []);
  const browse = (direction: number) => {
    const el = rail.current;
    if (el) el.scrollBy({ left: direction * ((el.firstElementChild as HTMLElement).offsetWidth + 20), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const learningMissions = MISSIONS.filter(mission => mission.kind !== 'sandbox');
  const learningCount = learningMissions.length;
  const cleared = completed.filter(id => learningMissions.some(mission => mission.id === id)).length;
  const showContinue = cleared > 0 || completed.includes('final') || freeModeUnlocked;

  return (
    <main className="screen arcade crt-cabinet">
      <CrtGlass />
      <header className="screen__top">
        <button type="button" className="btn btn--ghost btn--chip" onClick={onBack}>
          ← Home
        </button>
        <Logo height={26} />
        <div className="row">
          <span className="tag tag--blue">C# · PLAY</span>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onSettings}
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      <div className="arcade__intro">
        <h1 className="arcade__title">THE ARCADE</h1>
        <p className="arcade__sub">
          Pick a cabinet. Play it. Then open the code behind it and change the rules of the world.
        </p>
        <p className="arcade__meta mono">
          {cleared}/{learningCount} MISSIONS CLEARED · BEST {bestScore}
          {freeModeUnlocked ? ' · FREE MOD OPEN' : ''}
        </p>
      </div>

      <div className="arcade__browse"><span>SCROLL OR SWIPE TO EXPLORE →</span><div><button aria-label="Previous games" disabled={scroll.index === 1} onClick={() => browse(-1)}>←</button><span aria-live="polite">{scroll.index} / 4</span><button aria-label="Next games" disabled={scroll.end} onClick={() => browse(1)}>→</button></div></div>
      <div className="arcade__grid" ref={rail} tabIndex={0} role="region" aria-label="Game carousel, scroll horizontally for more games" onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); browse(event.key === 'ArrowLeft' ? -1 : 1); } }}>
        <article className="cabinet cabinet--live">
          <div className="cabinet__art">
            <VectorZeroCover />
            <span className="cabinet__live mono">C# · LIVE</span>
          </div>
          <div className="cabinet__body">
            <h2 className="cabinet__title">VECTOR ZERO</h2>
            <p className="cabinet__genre">original vector asteroid survival</p>
            <ul className="cabinet__tags">
              <li className="tag">STRINGS</li>
              <li className="tag">INTS</li>
              <li className="tag">BOOLS</li>
              <li className="tag">OPERATORS</li>
              <li className="tag">CONDITIONS</li>
            </ul>
            <div className="cabinet__actions">
              {showContinue ? (
                <>
                  <button type="button" className="btn btn--primary btn--block" onClick={onContinue}>
                    CONTINUE · {currentMission.code}
                  </button>
                  <button type="button" className="btn btn--ghost btn--block" onClick={onPlay}>
                    RESTART CAMPAIGN
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn--primary btn--block" onClick={onPlay}>
                  START
                </button>
              )}
              {freeModeUnlocked ? (
                <button type="button" className="btn btn--flare btn--block" onClick={onFreeMod}>
                  FREE MOD MODE
                </button>
              ) : null}
            </div>
          </div>
        </article>

        {FUTURE_CABINETS.map((cabinet) => (
          <article key={cabinet.id} className={`cabinet cabinet--locked cabinet--${cabinet.id}`}>
            <div className="cabinet__art cabinet__art--locked">
              <GameTeaser kind={cabinet.id} />
              <span className="cabinet__lock mono">LOCKED</span>
            </div>
            <div className="cabinet__body">
              <h2 className="cabinet__title">{cabinet.title}</h2>
              <p className="cabinet__genre">{cabinet.genre}</p>
              <p className="cabinet__note mono">{cabinet.note}</p>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

const COVER_STARS: [number, number][] = [
  [30, 40],
  [90, 22],
  [150, 58],
  [210, 30],
  [268, 52],
  [330, 26],
  [370, 70],
  [58, 120],
  [128, 140],
  [196, 108],
  [300, 132],
  [356, 160],
  [24, 200],
  [110, 224],
  [250, 210],
  [340, 226],
];

/** Original cover art, drawn with vectors — no external sprites (spec §37). */
export function VectorZeroCover(): JSX.Element {
  const glowId = useId();
  return <svg className="cover" viewBox="0 0 400 260" role="img" aria-label="Vector Zero cover art">
    <defs><radialGradient id={glowId}><stop stopColor="#092927"/><stop offset="1" stopColor="#020e0a"/></radialGradient></defs>
    <rect width="400" height="260" fill={`url(#${glowId})`} />
    {COVER_STARS.map(([x,y],i) => <g key={i} fill="#d8ffff"><circle cx={x} cy={y} r={i%3===0?1.8:1} opacity=".8"/>{i%4===0?<path d={`M${x-4} ${y}h8m-4-4v8`} stroke="#c5ffff" opacity=".6"/>:null}</g>)}
    <g fill="none" stroke="#d5fff2" strokeWidth="2">
      <path d="m55 46 12-6 11 5 6 11-3 12-12 6-13-3-8-11zM321 48l12-7 12 4 9 11-4 14-13 6-14-5-7-11zM58 192l14-8 14 6 7 13-7 15-15 2-13-8-4-12zM317 187l15-6 13 8 4 15-9 13-16 1-11-11z" />
      <path opacity=".4" d="M61 53h2m10 10h2m253-8h2m10 9h2M64 201h2m15 7h2m244-12h2m8 9h2" />
    </g>
    <g transform="translate(206 135) rotate(10)">
      <path d="m-38-22-76 15 72 1m-2 18-81 20 88-5" fill="#2adfff" opacity=".65"/>
      <path d="m-38-16-58 9h57m-2 28-53 9 58-2" stroke="#a4ffff" strokeWidth="3"/>
      <path d="M95 0 15-25-29-71h-22l21 55-24-4-13 20 13 20 24-4-21 55h22l44-46z" fill="#061f25" stroke="#d9ffff" strokeWidth="2.5"/>
      <path d="m95 0-69-10-11-15-12 25 12 25 11-15zM3 0h-43m10-16 15-13m-15 45 15 13m-27-93 23 5m-23 121 23-5" fill="none" stroke="#a1e8ed" strokeWidth="2"/>
      <path d="m26-10 7 20m15-14 5 8m-94-17v26" stroke="#fff" strokeWidth="2"/>
    </g>
  </svg>;
}
