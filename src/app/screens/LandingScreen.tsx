import { CrtGlass } from '../../components/CrtGlass';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '../../brand/Logo';
import type { GameDefinition, PlayableGame } from '../../games/types';
import type { GameProgress } from '../../state/gameProgress';

function Icon({ code = false }: { code?: boolean }): JSX.Element {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{code ? <path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18" /> : <path d="M7 7h10l3 3 2 9-3 1-4-4H9l-4 4-3-1 2-9zm0 3v6m-3-3h6m5-2h2m1 3h2" />}</svg>;
}
export function LandingScreen({ games: catalog, onSelectGame, getProgress, onArcade, onProfile, studentName }: {
  games: readonly GameDefinition[];
  onSelectGame: (game: PlayableGame) => void;
  getProgress: (game: PlayableGame) => GameProgress;
  onArcade: () => void; onProfile: () => void; studentName: string;
}): JSX.Element {
  const games = useRef<HTMLElement>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const hero = catalog[heroIndex % catalog.length];
  useEffect(() => {
    const preload = catalog.map(game => { const image = new window.Image(); image.src = game.hero.src; return image; });
    const timer = window.setInterval(() => setHeroIndex(index => (index + 1) % Math.max(1, catalog.length)), 5200);
    return () => { window.clearInterval(timer); preload.forEach(image => { image.src = ''; }); };
  }, [catalog]);
  const scrollTo = (element: HTMLElement | null) => element?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  return <main className="home crt-cabinet">
      <CrtGlass />
    <a className="home__skip" href="#games" onClick={event => { event.preventDefault(); scrollTo(games.current); games.current?.focus(); }}>Skip to games</a>
    <header className="home__nav">
      <span className="home__navSpacer" aria-hidden="true" />
      <nav aria-label="Main navigation">
        <button onClick={onArcade}><Icon /> Games</button>
        <button onClick={onArcade}><Icon code /> Learn</button>
      </nav>
      <button className="home__player" onClick={onProfile} aria-label="Your profile and settings"><span className="signal-dot" />{studentName || 'PLAYER 01'}</button>
    </header>
    <section className="home__hero" aria-label="Welcome to MODBOX">
      <img key={hero?.hero.src} className="home__heroArt home__heroArt--glitch" src={hero?.hero.src} alt={hero?.hero.alt ?? "MODBOX arcade"} loading="eager" />
      <div className="home__heroCopy">
        <span className="home__eyebrow"><span className="signal-dot" /> A PROGRAMMABLE ARCADE</span>
        <Logo height={200} className="home__wordmark" layout="hero" />
        <h1>MOD IT. CODE IT. PLAY IT.</h1>
        <p>Your code. Your rules. Your next high score.</p>
        <button className="home__enter" onClick={() => scrollTo(games.current)}>ENTER MODBOX <span aria-hidden="true">↗</span></button>
      </div>
      <span className="home__sector" aria-hidden="true">ARCADE SIGNAL / {hero?.title}</span>
    </section>
    <section className="home__games crt-panel" id="games" ref={games} tabIndex={-1} aria-label="Our games">
      <header className="home__sectionHead"><h2><button onClick={onArcade}><Icon /> GAMES</button></h2><button onClick={onArcade}>VIEW ALL <span aria-hidden="true">→</span></button></header>
      <div className="home__gameGrid">
        {catalog.map(game => {
          const Cover = game.Cover;
          const className = `home-game home-game--${game.cardStyle ?? game.id}`;
          if (game.status !== 'play') return <article key={game.id} className={className} aria-label={`${game.title}, coming soon`}><h3>{game.title}</h3><Cover /><span className="home-game__status">COMING SOON</span></article>;
          const saved = getProgress(game);
          const hasProgress = saved.completed.length > 0 || Object.values(saved.codes).some(code => code.trim());
          return <button key={game.id} className={className} onClick={() => onSelectGame(game)} aria-label={`Play ${game.title.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())}`}>
            <h3>{game.title}</h3><Cover /><span className="home-game__status">{hasProgress ? 'CONTINUE MISSION' : 'AVAILABLE NOW'} <span aria-hidden="true">&#x2197;</span></span>
          </button>;
        })}
      </div>
    </section>
  </main>;
}
