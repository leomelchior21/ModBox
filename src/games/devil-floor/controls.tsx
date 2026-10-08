import { useEffect, useRef } from 'react';
import type { FloorInput } from './run';

function HoldButton({ label, glyph, action, input, onEngage }: { label: string; glyph: string; action: keyof FloorInput; input: FloorInput; onEngage: () => void }): JSX.Element {
  const pointer = useRef<number | null>(null);
  const release = () => { pointer.current = null; input[action] = false; };
  useEffect(() => { window.addEventListener('blur', release); return () => { window.removeEventListener('blur', release); release(); }; }, [input, action]);
  return <button type="button" className={`floor__control floor__control--${action}`} aria-label={label}
    onPointerDown={e => { if (pointer.current !== null) return; e.preventDefault(); onEngage(); pointer.current = e.pointerId; input[action] = true; e.currentTarget.setPointerCapture?.(e.pointerId); }}
    onPointerUp={e => { if (pointer.current === e.pointerId) release(); }} onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
    onKeyDown={e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) { onEngage(); input[action] = true; } } }}
    onKeyUp={e => { if (e.code === 'Space' || e.code === 'Enter') release(); }} onContextMenu={e => e.preventDefault()}>
    <span aria-hidden="true">{glyph}</span><small>{label}</small>
  </button>;
}
export function FloorControls({ input, onEngage }: { input: FloorInput; onEngage: () => void }): JSX.Element {
  return <div className="floor__controls" role="group" aria-label="Platformer touch controls">
    <div className="floor__directions"><HoldButton label="LEFT" glyph="←" action="left" input={input} onEngage={onEngage} /><HoldButton label="RIGHT" glyph="→" action="right" input={input} onEngage={onEngage} /></div>
    <HoldButton label="JUMP" glyph="↑" action="jump" input={input} onEngage={onEngage} />
  </div>;
}
