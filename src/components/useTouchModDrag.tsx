import { useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';

/** Native HTML drag handles mice; pointer capture gives tablets the same operation. */
export function useTouchModDrag(onInsert: (code: string) => void) {
  const gesture = useRef<{ x: number; y: number; id: number; dragging: boolean } | null>(null);
  const suppressClickUntil = useRef(0);
  const [preview, setPreview] = useState<{ x: number; y: number; code: string; over: boolean } | null>(null);
  const overEditor = (x: number, y: number) => {
    const rect = document.querySelector('.cm-editor')?.getBoundingClientRect();
    return Boolean(rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
  };
  const reset = () => { gesture.current = null; setPreview(null); };
  const handlers = (code: string) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'mouse') return;
      gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId, dragging: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const active = gesture.current;
      if (!active || active.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 8) active.dragging = true;
      if (active.dragging) setPreview({ x: event.clientX, y: event.clientY, code, over: overEditor(event.clientX, event.clientY) });
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      if (gesture.current?.id !== event.pointerId) return;
      if (gesture.current.dragging) {
        suppressClickUntil.current = performance.now() + 600;
        if (overEditor(event.clientX, event.clientY)) onInsert(code);
      }
      reset();
    },
    onPointerCancel: reset,
    onLostPointerCapture: reset,
    onClick: () => { if (performance.now() >= suppressClickUntil.current) onInsert(code); },
  });
  const ghost = preview ? createPortal(<div className={`mod-drag-ghost ${preview.over ? 'mod-drag-ghost--ready' : ''}`} style={{ left: preview.x, top: preview.y }}><span>{preview.over ? 'RELEASE TO APPLY' : 'DRAG INTO CODE'}</span><code>{preview.code}</code></div>, document.querySelector('.lab') ?? document.body) : null;
  return { handlers, ghost };
}
