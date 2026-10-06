import { CrtGlass } from '../../components/CrtGlass';
import { Logo } from '../../brand/Logo';
import { LANGUAGES } from '../../interpreter/core/adapter';
import type { LanguageId } from '../../interpreter/core/adapter';

/* ============================================================================
   MODBOX — LANGUAGE SELECT
   Every supported language enters the same game through its own adapter.
   ========================================================================== */

export function LanguageScreen({
  onSelect,
  onBack,
}: {
  onSelect: (id: LanguageId) => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <main className="screen languages crt-cabinet">
      <CrtGlass />
      <header className="screen__top">
        <button type="button" className="btn btn--ghost btn--chip" onClick={onBack}>
          ← Back
        </button>
        <Logo height={26} />
        <span className="eyebrow">VECTOR ZERO · PICK A LANGUAGE</span>
      </header>

      <div className="languages__intro"><p className="eyebrow">VECTOR ZERO</p><h1>CHOOSE YOUR FLIGHT LANGUAGE.</h1><p>Which language do you want to use to mod this game?</p></div>
      <div className="languages__grid">
        {LANGUAGES.map((language) => {
          const playable = language.status === 'play';
          return (
            <article
              key={language.id}
              className={playable ? 'langcard langcard--live' : 'langcard langcard--soon'}
            >
              <div className="langcard__top">
                <span className="langcard__short">{language.short}</span>
                <span className={`tag ${playable ? 'tag--ok' : ''}`}>
                  {playable ? 'PLAY' : 'COMING SOON'}
                </span>
              </div>
              <h2 className="langcard__title">{language.label}</h2>
              <p className="langcard__blurb">{language.detail}</p>
              <div className="langcard__meter" aria-hidden="true">
                <span style={{ width: `${Math.round(language.support * 100)}%` }} />
              </div>
              {playable ? (
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  onClick={() => onSelect(language.id)}
                >
                  PLAY VECTOR ZERO
                </button>
              ) : (
                <button type="button" className="btn btn--ghost btn--block" onClick={() => onSelect(language.id)}>
                  EXPLORE THE ARCADE
                </button>
              )}
            </article>
          );
        })}
      </div>

      <footer className="languages__foot">
        <p className="mono">
          No coding experience needed. Your progress is saved on this device.
        </p>
      </footer>
    </main>
  );
}
