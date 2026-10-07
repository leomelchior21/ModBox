import { useEffect, useRef } from 'react';
import type { MazeInput } from './run';

export function MazeJoystick({ input, onEngage }: { input: MazeInput; onEngage: () => void }): JSX.Element {
  const node = useRef<HTMLDivElement>(null), pointer = useRef<number | null>(null);
  const reset = () => {
    pointer.current = null;
    input.up = input.down = input.left = input.right = false;
    node.current?.style.setProperty('--stick-x', '0px'); node.current?.style.setProperty('--stick-y', '0px');
  };
  useEffect(() => { window.addEventListener('blur', reset); return () => { window.removeEventListener('blur', reset); reset(); }; }, [input]);
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect(), radius = rect.width * 0.29;
    const dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(dx, dy), scale = Math.min(1, radius / (distance || 1));
    node.current?.style.setProperty('--stick-x', `${dx * scale}px`); node.current?.style.setProperty('--stick-y', `${dy * scale}px`);
    input.up = input.down = input.left = input.right = false;
    if (distance < radius * 0.25) return;
    if (Math.abs(dx) > Math.abs(dy)) input[dx > 0 ? 'right' : 'left'] = true;
    else input[dy > 0 ? 'down' : 'up'] = true;
  };
  return <div ref={node} className="touchbar__cluster touchbar__cluster--right joystick neon__joystick" role="group" tabIndex={0} aria-label="Maze joystick: drag in the direction you want to move"
    onPointerDown={e => { if (pointer.current !== null) return; e.preventDefault(); onEngage(); pointer.current = e.pointerId; e.currentTarget.setPointerCapture?.(e.pointerId); move(e); }}
    onPointerMove={move} onPointerUp={e => { if (pointer.current === e.pointerId) reset(); }} onPointerCancel={reset} onLostPointerCapture={reset} onBlur={reset}
    onContextMenu={e => e.preventDefault()}>
    <span className="joystick__north" aria-hidden="true">▲</span><span className="joystick__west" aria-hidden="true">◀</span><span className="joystick__east" aria-hidden="true">▶</span><span className="joystick__south" aria-hidden="true">▼</span><span className="joystick__stick" aria-hidden="true" />
  </div>;
}

export function PhaseButton({ cooldown, onPhase }: { cooldown: number; onPhase: () => void }): JSX.Element {
  return <button type="button" className="touch touch--fire neon__phase" disabled={cooldown > 0} onClick={onPhase} aria-label={cooldown > 0 ? 'Phase jump recharging' : 'Phase jump'}>
    <span aria-hidden="true">↠</span><small>{cooldown > 0 ? `${cooldown.toFixed(1)}s` : 'PHASE'}</small>
  </button>;
}
