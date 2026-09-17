import { useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTouchModDrag } from './useTouchModDrag';
import { ModOptions } from './ModOptions';
import { beginModDrag, endModDrag, MOD_DRAG_TYPE, type ModInsertMode } from '../editor/modEditing';
import type { ModDefinition } from '../interpreter/core/mods';
import type { CodeToolDefinition, CopilotTargetId } from '../learning/copilot';
import { modGlyph } from './modGlyph';
import { CoachBubble } from './CoachBubble';

/* ============================================================================
   MODBOX — MOD DOCK (compact library)
   Every unlocked Mod stays in one horizontally scrolling row. The co-pilot
   pulses the next useful tile; dragging it reveals its editor destination.
   ========================================================================== */

export function ModStrip({
  mods,
  tools,
  activeTargetId,
  totalMods,
  collapsed,
  onToggleCollapsed,
  onInsert,
  onOpenLibrary,
  coach,
  onDismissCoach,
}: {
  mods: ModDefinition[];
  tools: CodeToolDefinition[];
  activeTargetId?: CopilotTargetId;
  totalMods: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onInsert: (code: string, mode?: ModInsertMode) => void;
  onOpenLibrary: () => void;
  coach?: { message: string; hint?: string };
  onDismissCoach?: () => void;
}): JSX.Element {
  const [options, setOptions] = useState<{ mod: ModDefinition; anchor: HTMLElement } | null>(null);
  const drag = useTouchModDrag(onInsert);
  const guidedTileRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLElement | null>(null);
  const [coachAnchor, setCoachAnchor] = useState<{ left: number; top: number } | null>(null);
  const locked = Math.max(0, totalMods - mods.length);

  useEffect(() => {
    const row = rowRef.current;
    const tile = guidedTileRef.current;
    if (!row || !tile) return;
    const rowBox = row.getBoundingClientRect();
    const tileBox = tile.getBoundingClientRect();
    const left = row.scrollLeft + tileBox.left - rowBox.left - (rowBox.width - tileBox.width) / 2;
    const target = Math.max(0, left);
    if (typeof row.scrollTo === 'function') row.scrollTo({ left: target, behavior: 'smooth' });
    else row.scrollLeft = target;
  }, [activeTargetId, collapsed]);

  useLayoutEffect(() => {
    if (!coach) {
      setCoachAnchor(null);
      return;
    }
    const sync = () => {
      const box = stripRef.current?.getBoundingClientRect();
      if (!box) return;
      setCoachAnchor({ left: Math.min(box.right + 18, window.innerWidth - 300), top: box.top + 8 });
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [coach?.message, collapsed]);

  const beginNativeDrag = (event: DragEvent<HTMLButtonElement>, snippet: string) => {
    beginModDrag(snippet);
    event.dataTransfer.setData(MOD_DRAG_TYPE, snippet);
    event.dataTransfer.setData('text/plain', snippet);
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <section ref={stripRef} className={`modstrip ${collapsed ? 'modstrip--collapsed' : ''} ${coach ? 'modstrip--coaching' : ''}`} aria-label="Mod Library">
      <header className="modstrip__head">
        <button
          type="button"
          className="modstrip__toggle"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? 'Show your Mods' : 'Hide your Mods'}
        >
          <span className="modstrip__glyph" aria-hidden="true">▣</span>
          <span className="modstrip__title">MOD LIBRARY</span>
          <span className="modstrip__count mono">
            {mods.length} UNLOCKED{locked ? ` · ${locked} LOCKED` : ''}
          </span>
          <span className="modstrip__chevron" aria-hidden="true">{collapsed ? '⌄' : '⌃'}</span>
        </button>
        <button type="button" className="modstrip__all" onClick={onOpenLibrary}>All mods ▸</button>
      </header>

      {coach && onDismissCoach && coachAnchor && typeof document !== 'undefined' ? createPortal(
        <div className="coach-portal" style={coachAnchor}>
          <CoachBubble className="coach-bubble--mod" message={coach.message} hint={coach.hint} onDismiss={onDismissCoach} />
        </div>,
        document.querySelector('.lab') ?? document.body,
      ) : null}

      {!collapsed ? (
        <div className="modstrip__row" ref={rowRef}>
          {mods.map((mod) => {
            const guided = activeTargetId === mod.id;
            return (
              <div
                className={`modtile-wrap modtile-wrap--${mod.type}`}
                key={mod.id}
                ref={guided ? guidedTileRef : undefined}
              >
                <button
                  type="button"
                  className={`modtile modtile--${mod.type} ${guided ? 'modtile--required' : ''}`}
                  {...drag.handlers(mod.example, (anchor) => setOptions({ mod, anchor }))}
                  draggable
                  onDragStart={(event) => beginNativeDrag(event, mod.example)}
                  onDragEnd={endModDrag}
                  aria-label={`Explore ${mod.name} options. Drag to add it to the code.`}
                  aria-haspopup="dialog"
                  aria-expanded={options?.mod.id === mod.id}
                  data-guided={guided || undefined}
                  title={`${mod.blurb} · ${mod.example}`}
                >
                  <span className="modtile__grip" aria-hidden="true">⠿</span>
                  <span className={`modtile__icon modtile__icon--${mod.type}`} aria-hidden="true">{modGlyph(mod)}</span>
                  <span className="modtile__name mono">{mod.name}</span>
                  <span className={`tag tag--${mod.type}`}>{mod.type}</span>
                  <span className="modtile__effect">{mod.blurb}</span>
                  <span className="modtile__insert">DRAG TO CODE</span>
                </button>
                <button
                  type="button"
                  className="modtile__options"
                  aria-label={`Explore ${mod.name} options`}
                  title="Explore options"
                  onClick={(event) => setOptions({
                    mod,
                    anchor: event.currentTarget.closest('.modtile-wrap') ?? event.currentTarget,
                  })}
                >⑂</button>
              </div>
            );
          })}

          {tools.map((tool) => {
            const guided = activeTargetId === tool.id;
            return (
              <div
                className={`modtile-wrap modtile-wrap--${tool.type}`}
                key={tool.id}
                ref={guided ? guidedTileRef : undefined}
              >
                <button
                  type="button"
                  className={`modtile modtile--tool modtile--${tool.type} ${guided ? 'modtile--required' : ''}`}
                  {...drag.handlers(tool.example, () => undefined)}
                  draggable
                  onDragStart={(event) => beginNativeDrag(event, tool.example)}
                  onDragEnd={endModDrag}
                  aria-label={`Drag ${tool.label} into the code.`}
                  data-guided={guided || undefined}
                  title={`${tool.blurb} · ${tool.example}`}
                >
                  <span className="modtile__grip" aria-hidden="true">⠿</span>
                  <span className={`modtile__icon modtile__icon--${tool.type}`} aria-hidden="true">{tool.glyph}</span>
                  <span className="modtile__name mono">{tool.name}</span>
                  <span className={`tag tag--${tool.type}`}>{tool.label}</span>
                  <span className="modtile__effect">{tool.blurb}</span>
                  <span className="modtile__insert">DRAG TO CODE</span>
                </button>
              </div>
            );
          })}

          {!mods.length && !tools.length ? (
            <p className="modstrip__empty">Finish a mission to unlock your first Mod.</p>
          ) : null}
        </div>
      ) : null}

      {options ? (
        <ModOptions
          mod={options.mod}
          anchor={options.anchor}
          onClose={() => setOptions(null)}
          onInsert={(snippet, mode) => {
            setOptions(null);
            onInsert(snippet, mode);
          }}
        />
      ) : null}
      {drag.ghost}
    </section>
  );
}
