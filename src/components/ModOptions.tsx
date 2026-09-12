import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ModDefinition } from '../interpreter/core/mods';
import { NUMERIC_LIMITS } from '../interpreter/core/limits';
import { MOD_DRAG_TYPE } from '../editor/modEditing';
import { useTouchModDrag } from './useTouchModDrag';

export function ModOptions({ mod, onClose, onInsert }: { mod: ModDefinition; onClose: () => void; onInsert: (code: string) => void }): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useTouchModDrag(onInsert);
  const [value, setValue] = useState(mod.type === 'int' ? '3' : 'Nova');
  const limit = NUMERIC_LIMITS[mod.id as keyof typeof NUMERIC_LIMITS];
  const options = mod.values ?? (mod.type === 'bool' ? ['true', 'false'] : mod.type === 'int' ? [...new Set([limit?.min ?? 1, 3, limit?.max ?? 10])].map(String) : ['Nova', 'Voyager', 'Apollo']);
  const snippet = (v: string) => `${mod.type} ${mod.name} = ${mod.type === 'string' ? JSON.stringify(v) : v};`;
  useEffect(() => { dialog.current?.show(); dialog.current?.querySelector('button')?.focus({ preventScroll: true }); }, []);
  return createPortal(<dialog ref={dialog} className="mod-options mission-dialog" aria-label={`${mod.name} options`} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}>
    <header><h2><span aria-hidden="true">⑂</span> {mod.name}</h2><button onClick={onClose} aria-label="Close mod options">✕</button></header>
    <p>{mod.blurb}</p><p className="mod-options__hint">Pick a branch to add or replace this mod. Drag a branch into your code, too.</p>
    <div className="mod-options__tree">{options.map(option => <button key={option} {...drag.handlers(snippet(option))} draggable onDragStart={e => { e.dataTransfer.setData(MOD_DRAG_TYPE, snippet(option)); e.dataTransfer.setData('text/plain', snippet(option)); e.dataTransfer.effectAllowed = 'copy'; }} onDragEnd={onClose}><span aria-hidden="true">⠿</span><code>{option}</code><span aria-hidden="true">↵</span></button>)}</div>
    {mod.type !== 'bool' && !mod.values ? <form onSubmit={e => { e.preventDefault(); onInsert(snippet(value)); }}><label>YOUR {mod.type === 'int' ? 'VALUE' : 'NAME'}<input required type={mod.type === 'int' ? 'number' : 'text'} min={limit?.min} max={limit?.max} step={1} maxLength={32} value={value} onChange={e => setValue(e.target.value)} /></label><button className="btn btn--primary" type="submit">APPLY →</button></form> : null}
    <p className="mod-options__hint">Existing mod? Its line is replaced. New mod? It joins the correct code section.</p>
    {drag.ghost}
  </dialog>, document.querySelector('.lab') ?? document.body);
}
