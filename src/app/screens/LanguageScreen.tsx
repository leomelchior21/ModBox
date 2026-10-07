import { CrtGlass } from '../../components/CrtGlass';
import { Logo } from '../../brand/Logo';
import { LANGUAGES } from '../../interpreter/core/adapter';
import type { LanguageId } from '../../interpreter/core/adapter';
import type { PlayableGame } from '../../games/types';
import { GameArtwork, GameAvailability } from '../../components/GameArtwork';

const LANGUAGE_LOOK: Record<LanguageId, { icon?: string; detail: string; sample: string }> = {
  python: { icon: '/brand/python.svg', detail: 'Start with readable code and simple syntax.', sample: 'print("Ready!")' },
  swift: { icon: '/brand/swift.svg', detail: 'Write clear variables and expressive rules.', sample: 'print("Ready!")' },
  csharp: { detail: 'Try typed variables and familiar game syntax.', sample: 'Console.WriteLine(\n    "Ready!"\n);' },
};

/* ============================================================================
   MODBOX — LANGUAGE SELECT
   Every supported language enters the same game through its own adapter.
   ========================================================================== */

export function LanguageScreen({
  onSelect,
  onBack,
  game,
}: {
  onSelect: (id: LanguageId) => void;
  onBack: () => void;
  game: PlayableGame;
}): JSX.Element {
  return (
    <main className="screen languages crt-cabinet">
      <CrtGlass />
      <header className="screen__top">
        <button type="button" className="btn btn--ghost btn--chip" onClick={onBack}>
          ← Back
        </button>
        <Logo height={26} />
        <span className="languages__step">GAME SELECTED <span aria-hidden="true">→</span> LANGUAGE <span aria-hidden="true">→</span> PLAY</span>
      </header>

      <div className="languages__content">
        <aside className="languages__game" aria-label={`Selected game: ${game.title}`}>
          <div className="languages__gameArt">
            <GameArtwork game={game} eager />
            <GameAvailability ready />
          </div>
          <div className="languages__gameCopy">
            <span className="languages__selected">YOUR GAME</span>
            <h2>{game.title}</h2>
            <p>{game.genre}</p>
            <span className="languages__gameNote">Play it. Mod it. Make it yours.</span>
          </div>
        </aside>
        <section className="languages__choices" aria-labelledby="language-title">
          <div className="languages__intro">
            <p className="eyebrow">ONE GAME. YOUR WAY TO CODE.</p>
            <h1 id="language-title">Choose your language.</h1>
            <p>Pick the code you’ll use to make {game.title} your own.</p>
          </div>
          <div className="languages__grid">
            {LANGUAGES.filter(language => game.languages.includes(language.id)).map((language) => {
              const playable = language.status === 'play';
              const look = LANGUAGE_LOOK[language.id];
              return (
                <article
                  key={language.id}
                  className={`langcard langcard--${language.id} ${playable ? 'langcard--live' : 'langcard--soon'}`}
                >
                  <div className="langcard__top">
                    <span className="langcard__icon" aria-hidden="true">
                      {look.icon ? <img src={look.icon} alt="" /> : <b>C#</b>}
                    </span>
                    <span className="langcard__availability">{playable ? 'Ready' : 'Coming soon'}</span>
                  </div>
                  <h2 className="langcard__title">{language.label}</h2>
                  <p className="langcard__blurb">{look.detail}</p>
                  <div className="langcard__example">
                    <span>YOUR FIRST LINE</span>
                    <pre><code>{look.sample}</code></pre>
                  </div>
                  {playable ? (
                    <button
                      type="button"
                      className="btn btn--primary btn--block"
                      onClick={() => onSelect(language.id)}
                      aria-label={`Play ${game.title} in ${language.label}`}
                    >
                      Play with {language.label} <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button type="button" className="btn btn--ghost btn--block" disabled>
                      Coming soon
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="languages__foot">
        <p className="mono">
          No coding experience needed. Your progress is saved on this device.
        </p>
      </footer>
    </main>
  );
}
