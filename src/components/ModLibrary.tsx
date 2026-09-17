import { useEffect, useRef, useState } from 'react';
import { ModOptions } from './ModOptions';
import { beginModDrag, endModDrag, MOD_DRAG_TYPE, type ModInsertMode } from '../editor/modEditing';
import { useTouchModDrag } from './useTouchModDrag';
import type { ModDefinition } from '../interpreter/core/mods';
import { modGlyph } from './modGlyph';
import type { LanguageId } from '../interpreter/core/adapter';
import { typeLabelForLanguage } from '../interpreter/languageSyntax';

/* ============================================================================
   MODBOX — MOD LIBRARY
   Shows only what the student has discovered. Undiscovered modules stay
   encrypted, which makes progression feel like unlocking a dev console
   (spec §15 / §16). Every card is scannable: glyph, name, type, effect.
   ========================================================================== */

export function ModLibrary({
  open,
  onClose,
  unlocked,
  totalMods,
  onInsert,
  language,
}: {
  open: boolean;
  onClose: () => void;
  unlocked: ModDefinition[];
  totalMods: number;
  onInsert: (code: string, mode?: ModInsertMode) => void;
  language: LanguageId;
}): JSX.Element | null {
  const locked = Math.max(0, totalMods - unlocked.length);
  const [options, setOptions] = useState<{ mod: ModDefinition; anchor: HTMLElement } | null>(null);
  const drag = useTouchModDrag(onInsert);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true });
  }, [open]);

  if (!open) return null;

  return (
    <aside className={open ? 'modlib modlib--open' : 'modlib'} aria-label="Available mods" aria-hidden={!open} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    }}>
      <header className="modlib__head">
        <div className="modlib__title">
          <span className="modlib__glyph" aria-hidden="true">
            ▣
          </span>
          <div>
            <p className="eyebrow eyebrow--flare">MOD LIBRARY</p>
            <p className="modlib__sub">
              {unlocked.length} UNLOCKED{locked ? ` · ${locked} UNDISCOVERED` : ' · COMPLETE'}
            </p>
          </div>
        </div>
        <button ref={closeRef} type="button" className="btn btn--ghost btn--chip" onClick={onClose} aria-label="Close the Mod Library">
          Close
        </button>
      </header>

      <p className="modlib__hint">Drag a mod into your code. Tap ⑂ to explore its options and replace its value.</p>

      <div className="modlib__list scroll-y">
        {unlocked.map((mod) => (
          <article key={mod.id} className={`modcard modcard--${mod.type}`}>
            <header className="modcard__head">
              <span className={`modcard__icon modcard__icon--${mod.type}`} aria-hidden="true">
                {modGlyph(mod)}
              </span>
              <div className="modcard__id">
                <h3 className="modcard__name">{mod.label}</h3>
                <span className="modcard__var mono">{mod.name}</span>
              </div>
              <span className={`tag tag--${mod.type}`}>{typeLabelForLanguage(mod.type, language)}</span>
            </header>
            <p className="modcard__blurb">{mod.blurb}</p>
            <dl className="modcard__spec">
              {mod.values ? (
                <>
                  <dt>values</dt>
                  <dd className="mono">{mod.values.map((value) => `"${value}"`).join(' · ')}</dd>
                </>
              ) : null}
              {mod.range ? (
                <>
                  <dt>range</dt>
                  <dd className="mono">{mod.range}</dd>
                </>
              ) : null}
            </dl>
            <button type="button" className="btn btn--ghost btn--chip modcard__insert" {...drag.handlers(mod.example)} draggable onDragStart={event => { beginModDrag(mod.example); event.dataTransfer.setData(MOD_DRAG_TYPE, mod.example); event.dataTransfer.setData('text/plain', mod.example); }} onDragEnd={() => { endModDrag(); onClose(); }}>
              ⠿ Add / replace
            </button>
            <button type="button" className="btn btn--ghost btn--chip" onClick={event => setOptions({ mod, anchor: event.currentTarget })} aria-label={`Explore ${mod.name} options`}>⑂ Options</button>
          </article>
        ))}

        {locked ? (
          <div className="modlib__locked">
            <p className="mono">{locked} MORE MODULE{locked > 1 ? 'S' : ''} ENCRYPTED</p>
            <p>Keep finishing missions and they unlock themselves.</p>
          </div>
        ) : null}

        <div className="modlib__foot">
          <p className="eyebrow">LIVE VALUES INSIDE A RULE</p>
          <p className="modlib__runtime">
            <span className="mono">score</span>, <span className="mono">health</span>,{' '}
            <span className="mono">wave</span>, <span className="mono">enemiesRemaining</span>
          </p>
        </div>
      </div>
      {options ? <ModOptions mod={options.mod} anchor={options.anchor} onClose={() => setOptions(null)} onInsert={(snippet, mode) => { setOptions(null); onInsert(snippet, mode); }} language={language} /> : null}
      {drag.ghost}
    </aside>
  );
}
