import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ModDefinition } from '../interpreter/core/mods';
import { NUMERIC_LIMITS } from '../interpreter/core/limits';
import {
  beginModDrag,
  endModDrag,
  MOD_DRAG_TYPE,
  type ModInsertMode,
} from '../editor/modEditing';
import { useTouchModDrag } from './useTouchModDrag';

interface ModOptionsProps {
  mod: ModDefinition;
  anchor: HTMLElement;
  onClose: () => void;
  onInsert: (code: string, mode?: ModInsertMode) => void;
}

export function ModOptions({ mod, anchor, onClose, onInsert }: ModOptionsProps): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const drag = useTouchModDrag(onInsert);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [value, setValue] = useState(mod.type === 'int' ? '3' : 'Nova');
  onCloseRef.current = onClose;

  const limit = NUMERIC_LIMITS[mod.id as keyof typeof NUMERIC_LIMITS];
  const options =
    mod.values ??
    (mod.type === 'bool'
      ? ['true', 'false']
      : mod.type === 'int'
        ? [...new Set([limit?.min ?? 1, 3, limit?.max ?? 10])].map(String)
        : ['Nova', 'Voyager', 'Apollo']);
  const snippet = (nextValue: string) =>
    `${mod.type} ${mod.name} = ${mod.type === 'string' ? JSON.stringify(nextValue) : nextValue};`;

  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (!node.open) node.show();
    setPosition(null);

    const updatePosition = () => {
      const anchorRect = anchor.getBoundingClientRect();
      const width = node.offsetWidth || 260;
      const height = node.offsetHeight || 260;
      const gap = 10;
      const right = anchorRect.right + gap;
      const left =
        right + width <= window.innerWidth - gap
          ? right
          : Math.max(gap, anchorRect.left - width - gap);
      const top = Math.max(
        gap,
        Math.min(anchorRect.top + (anchorRect.height - height) / 2, window.innerHeight - height - gap),
      );
      setPosition({ left, top });
    };

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      if (node.open) node.close();
    };
  }, [anchor, mod]);

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || dialog.current?.contains(target) || anchor.contains(target)) return;
      onCloseRef.current();
    };
    window.addEventListener('pointerdown', closeFromOutside);
    return () => window.removeEventListener('pointerdown', closeFromOutside);
  }, [anchor]);

  const positionStyle: CSSProperties = position
    ? { left: position.left, top: position.top, visibility: 'visible' }
    : { left: 0, top: 0, visibility: 'hidden' };

  return createPortal(
    <dialog
      ref={dialog}
      className={`mod-options mod-options--${mod.type}`}
      style={positionStyle}
      aria-label={`${mod.name} options`}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') onClose();
      }}
    >
      <header>
        <div>
          <span className="mod-options__type">{mod.type}</span>
          <h2>{mod.name}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close mod options">×</button>
      </header>
      <p className="mod-options__hint">Tap a value to apply it. Drag one into the editor to add another copy.</p>
      <div className="mod-options__tree">
        {options.map((option) => {
          const code = snippet(option);
          return (
            <button
              key={option}
              type="button"
              {...drag.handlers(code)}
              draggable
              onDragStart={(event) => {
                beginModDrag(code);
                event.dataTransfer.setData(MOD_DRAG_TYPE, code);
                event.dataTransfer.setData('text/plain', code);
                event.dataTransfer.effectAllowed = 'copy';
              }}
              onDragEnd={() => {
                endModDrag();
                onClose();
              }}
            >
              <span aria-hidden="true">⠿</span>
              <code>{option}</code>
              <span aria-hidden="true">↵</span>
            </button>
          );
        })}
      </div>
      {mod.type !== 'bool' && !mod.values ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onInsert(snippet(value), 'replace');
          }}
        >
          <label>
            CUSTOM {mod.type === 'int' ? 'VALUE' : 'NAME'}
            <input
              required
              type={mod.type === 'int' ? 'number' : 'text'}
              min={limit?.min}
              max={limit?.max}
              step={1}
              maxLength={32}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <button className="btn btn--primary" type="submit">APPLY</button>
        </form>
      ) : null}
      {drag.ghost}
    </dialog>,
    document.querySelector('.lab') ?? document.body,
  );
}
