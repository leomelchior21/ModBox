import { CrtGlass } from '../../components/CrtGlass';
import { useRef, useState, useEffect } from 'react';
import { Logo } from '../../brand/Logo';
import type { GameDefinition, PlayableGame } from '../../games/types';
import type { GameProgress } from '../../state/gameProgress';
import { GameArtwork, GameAvailability } from '../../components/GameArtwork';

/* ============================================================================
   MODBOX — ARCADE LIBRARY
   Registered playable games come first; upcoming games remain previews.
   ========================================================================== */

export function ArcadeScreen({ games, getProgress, onSelectGame, onBack, onSettings }: {
  games: readonly GameDefinition[];
  getProgress: (game: PlayableGame) => GameProgress;
  onSelectGame: (game: PlayableGame, missionId: string) => void;
  onBack: () => void; onSettings: () => void;
}): JSX.Element {
  const rail = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ index: 1, end: false });
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () => {
      const card = el.firstElementChild as HTMLElement | null;
      setScroll({ index: Math.min(games.length, 1 + Math.round(el.scrollLeft / ((card?.offsetWidth ?? 1) + 20))), end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 3 });
    };
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update); observer.observe(el); update();
    return () => { el.removeEventListener('scroll', update); observer.disconnect(); };
  }, [games.length]);
  const browse = (direction: number) => {
    const el = rail.current;
    if (el) el.scrollBy({ left: direction * ((el.firstElementChild as HTMLElement).offsetWidth + 20), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const playable = games.filter((game): game is PlayableGame => game.status === 'play');
  const learningCount = playable.reduce((total, game) => total + game.missions.filter(mission => mission.kind !== 'sandbox').length, 0);
  const cleared = playable.reduce((total, game) => total + getProgress(game).completed.filter(id => game.missions.some(mission => mission.id === id && mission.kind !== 'sandbox')).length, 0);
  const bestScore = Math.max(0, ...playable.map(game => getProgress(game).bestScore));

  return (
    <main className="screen arcade crt-cabinet">
      <CrtGlass />
      <header className="screen__top">
        <button type="button" className="btn btn--ghost btn--chip" onClick={onBack}>
          ← Home
        </button>
        <Logo height={26} />
        <div className="row">
          <span className="tag tag--blue">PICK A GAME</span>
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
        </p>
      </div>

      <div className="arcade__browse"><span>SCROLL OR SWIPE TO EXPLORE →</span><div><button aria-label="Previous games" disabled={scroll.index === 1} onClick={() => browse(-1)}>←</button><span aria-live="polite">{scroll.index} / {games.length}</span><button aria-label="Next games" disabled={scroll.end} onClick={() => browse(1)}>→</button></div></div>
      <div className="arcade__grid" ref={rail} tabIndex={0} role="region" aria-label="Game carousel, scroll horizontally for more games" onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); browse(event.key === 'ArrowLeft' ? -1 : 1); } }}>
        {games.map(game => {
          if (game.status !== 'play') return <article key={game.id} className={`cabinet cabinet--locked cabinet--${game.id}`}>
            <div className="cabinet__art cabinet__art--locked"><GameArtwork game={game} /><GameAvailability ready={false} /></div>
            <div className="cabinet__body"><h2 className="cabinet__title">{game.title}</h2><p className="cabinet__genre">{game.genre}</p><p className="cabinet__note mono">IN DEVELOPMENT</p></div>
          </article>;
          const saved = getProgress(game);
          const hasProgress = saved.completed.length > 0 || Object.values(saved.codes).some(code => code.trim());
          const currentMission = game.missions.find(mission => mission.id === saved.currentMissionId)?.id ?? game.starterMissionId;
          return <article key={game.id} className={`cabinet cabinet--live cabinet--${game.id}`}>
            <div className="cabinet__art"><GameArtwork game={game} /><GameAvailability ready /></div>
            <div className="cabinet__body">
              <h2 className="cabinet__title">{game.title}</h2><p className="cabinet__genre">{game.genre}</p>
              <p className="cabinet__note mono">{saved.completed.length} MISSIONS CLEARED · BEST {saved.bestScore}</p>
              <div className="cabinet__actions">
                <button className="btn btn--primary btn--block" onClick={() => onSelectGame(game, game.starterMissionId)}>PLAY {game.title}</button>
                {hasProgress ? <button className="btn btn--ghost btn--block" onClick={() => onSelectGame(game, currentMission)}>CONTINUE MISSION</button> : null}
                {saved.freeModeUnlocked && game.sandboxMissionId ? <button className="btn btn--flare btn--block" onClick={() => onSelectGame(game, game.sandboxMissionId!)}>FREE MOD MODE</button> : null}
              </div>
            </div>
          </article>;
        })}
      </div>
    </main>
  );
}
