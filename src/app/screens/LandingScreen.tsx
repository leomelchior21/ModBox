import { CrtGlass } from '../../components/CrtGlass';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '../../brand/Logo';
import { VectorZeroCover } from './ArcadeScreen';
import { GameTeaser } from '../../components/GameTeaser';

function Icon({ code = false }: { code?: boolean }): JSX.Element {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{code ? <path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18" /> : <path d="M7 7h10l3 3 2 9-3 1-4-4H9l-4 4-3-1 2-9zm0 3v6m-3-3h6m5-2h2m1 3h2" />}</svg>;
}
const UPCOMING = [{ title: 'RUNNER', type: 'runner' }, { title: 'NEON MAZE', type: 'maze' }, { title: 'DEVIL FLOOR', type: 'platform' }] as const;
const HERO_SLIDES = [
  { src: '/art/modbox-crt-space.png', title: 'VECTOR ZERO', alt: 'An orange and white starfighter racing past glowing asteroids' },
  { src: '/art/runner-hero.png', title: 'RUNNER', alt: 'A geometric robot courier leaping across a futuristic city' },
  { src: '/art/neon-maze-hero.png', title: 'NEON MAZE', alt: 'A glowing probe racing through a vast neon labyrinth' },
  { src: '/art/devil-floor-hero.png', title: 'DEVIL FLOOR', alt: 'An explorer jumping over a volcanic energy chasm' },
] as const;
export function LandingScreen({ onContinue, onPlay, onArcade, onProfile, hasProgress, studentName }: {
  onContinue: () => void; onPlay: () => void; onArcade: () => void; onProfile: () => void;
  hasProgress: boolean; studentName: string;
}): JSX.Element {
  const games = useRef<HTMLElement>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const hero = HERO_SLIDES[heroIndex];
  useEffect(() => {
    const preload = HERO_SLIDES.slice(1).map(slide => {
      const image = new window.Image();
      image.src = slide.src;
      return image;
    });
    const timer = window.setInterval(() => setHeroIndex(index => (index + 1) % HERO_SLIDES.length), 5200);
    return () => { window.clearInterval(timer); preload.forEach(image => { image.src = ''; }); };
  }, []);
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
      <img key={hero.src} className="home__heroArt home__heroArt--glitch" src={hero.src} alt={hero.alt} loading="eager" />
      <div className="home__heroCopy">
        <span className="home__eyebrow"><span className="signal-dot" /> A PROGRAMMABLE ARCADE</span>
        <Logo height={200} className="home__wordmark" layout="hero" />
        <h1>MOD IT. CODE IT. PLAY IT.</h1>
        <p>Your code. Your rules. Your next high score.</p>
        <button className="home__enter" onClick={() => scrollTo(games.current)}>ENTER MODBOX <span aria-hidden="true">↗</span></button>
      </div>
      <span className="home__sector" aria-hidden="true">ARCADE SIGNAL / {hero.title}</span>
    </section>
    <section className="home__games crt-panel" id="games" ref={games} tabIndex={-1} aria-label="Our games">
      <header className="home__sectionHead"><h2><button onClick={onArcade}><Icon /> GAMES</button></h2><button onClick={onArcade}>VIEW ALL <span aria-hidden="true">→</span></button></header>
      <div className="home__gameGrid">
        <button className="home-game home-game--vector" onClick={hasProgress ? onContinue : onPlay} aria-label="Play Vector Zero">
          <h3>VECTOR ZERO</h3><VectorZeroCover /><span className="home-game__status">{hasProgress ? 'CONTINUE MISSION' : 'AVAILABLE NOW'} <span aria-hidden="true">↗</span></span>
        </button>
        {UPCOMING.map(game => <article key={game.type} className={`home-game home-game--${game.type}`} aria-label={`${game.title}, coming soon`}><h3>{game.title}</h3><GameTeaser kind={game.type} /><span className="home-game__status">COMING SOON</span></article>)}
      </div>
    </section>
  </main>;
}
