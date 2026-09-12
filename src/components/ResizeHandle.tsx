import { useCallback, useEffect, useRef } from 'react';

/* ============================================================================
   MODBOX — DRAGGABLE SPLIT HANDLE
   Students never navigate between editor and game: both stay on screen and the
   divider moves within sensible limits (spec §6).
   ========================================================================== */

export function ResizeHandle({
  ratio,
  onChange,
  min = 0.32,
  max = 0.62,
}: {
  ratio: number;
  onChange: (ratio: number) => void;
  min?: number;
  max?: number;
}): JSX.Element {
  const dragging = useRef(false);
  const containerRef = useRef<HTMLElement | null>(null);

  const clamp = (value: number) => Math.min(max, Math.max(min, value));

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging.current) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      onChange(clamp((event.clientX - rect.left) / rect.width));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange],
  );

  const stop = useCallback(() => {
    dragging.current = false;
    document.body.classList.remove('is-resizing');
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [onPointerMove, stop]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const host = event.currentTarget.parentElement;
    containerRef.current = host;
    dragging.current = true;
    document.body.classList.add('is-resizing');
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') onChange(clamp(ratio - 0.02));
    if (event.key === 'ArrowRight') onChange(clamp(ratio + 0.02));
  };

  return (
    <div
      className="split-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize editor and game panels"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={Math.round(min * 100)}
      aria-valuemax={Math.round(max * 100)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onChange(0.42)}
    >
      <span className="split-handle__grip" />
    </div>
  );
}
