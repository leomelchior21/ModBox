import { useState } from 'react';
import { useTouchModDrag } from './useTouchModDrag';
import { ModOptions } from './ModOptions';
import { MOD_DRAG_TYPE } from '../editor/modEditing';
import type { ModDefinition } from '../interpreter/core/mods';
import { modGlyph } from './modGlyph';

/* ============================================================================
   MODBOX — MOD DOCK (compact library)
   A single scannable row of everything the student has unlocked. Tapping a
   tile drops its line into the editor; "All mods" opens the full library.
   This keeps the power of the Mod Library visible without crowding the panel.
   ========================================================================== */

export function ModStrip({
  mods,
  totalMods,
  collapsed,
  onToggleCollapsed,
  onInsert,
  onOpenLibrary,
}: {
  mods: ModDefinition[];
  totalMods: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onInsert: (code: string) => void;
  onOpenLibrary: () => void;
}): JSX.Element {
  const [options, setOptions] = useState<ModDefinition | null>(null);
  const drag = useTouchModDrag(onInsert);
  const locked = Math.max(0, totalMods - mods.length);

  return (
    <section className={`modstrip ${collapsed ? 'modstrip--collapsed' : ''}`} aria-label="Mod Library">
      <header className="modstrip__head">
        <button
          type="button"
          className="modstrip__toggle"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? 'Show your Mods' : 'Hide your Mods'}
        >
          <span className="modstrip__glyph" aria-hidden="true">
            ▣
          </span>
          <span className="modstrip__title">MOD LIBRARY</span>
          <span className="modstrip__count mono">
            {mods.length} UNLOCKED{locked ? ` · ${locked} LOCKED` : ''}
          </span>
          <span className="modstrip__chevron" aria-hidden="true">
            {collapsed ? '⌄' : '⌃'}
          </span>
        </button>
        <button type="button" className="modstrip__all" onClick={onOpenLibrary}>
          All mods ▸
        </button>
      </header>

      {!collapsed ? (
        <div className="modstrip__row">
          {mods.slice(-4).map((mod) => (
            <div className="modtile-wrap" key={mod.id}><button
              type="button"
              className={`modtile modtile--${mod.type}`}
              {...drag.handlers(mod.example)}
              draggable
              onDragStart={(event) => { event.dataTransfer.setData(MOD_DRAG_TYPE, mod.example); event.dataTransfer.setData('text/plain', mod.example); event.dataTransfer.effectAllowed = 'copy'; }}
              aria-label={`Insert ${mod.name}: ${mod.blurb}`}
              title={`${mod.blurb}  ·  ${mod.example}`}
            >
              <span className="modtile__grip" aria-hidden="true">⠿</span>
              <span className={`modtile__icon modtile__icon--${mod.type}`} aria-hidden="true">
                {modGlyph(mod)}
              </span>
              <span className="modtile__name mono">{mod.name}</span>
              <span className={`tag tag--${mod.type}`}>{mod.type}</span>
              <span className="modtile__effect">{mod.blurb}</span>
              <span className="modtile__insert">+ INSERT</span>
            </button><button className="modtile__options" aria-label={`Explore ${mod.name} options`} title="Explore options" onClick={() => setOptions(mod)}>⑂</button></div>
          ))}
          {!mods.length ? <p className="modstrip__empty">Finish a mission to unlock your first Mod.</p> : null}
        </div>
      ) : null}
      {options ? <ModOptions mod={options} onClose={() => setOptions(null)} onInsert={snippet => { setOptions(null); onInsert(snippet); }} /> : null}
      {drag.ghost}
    </section>
  );
}
