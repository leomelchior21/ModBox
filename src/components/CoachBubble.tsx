import { useLayoutEffect, useRef } from 'react';

export function CoachBubble({
  message,
  className = '',
  onDismiss,
}: {
  message: string;
  hint?: string;
  className?: string;
  onDismiss: () => void;
}): JSX.Element {
  const anchor = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const node = bubble.current;
    const target = anchor.current;
    if (!node || !target) return;
    node.setAttribute('popover', 'manual');
    // Manual popovers escape panel filters and clipping without taking focus
    // or blocking editor and library interaction.
    if (typeof node.showPopover === 'function') node.showPopover();
    else node.setAttribute('data-layer-fallback', '');
    const sync = () => {
      const rect = target.getBoundingClientRect();
      const gap = 10;
      node.style.left = `${Math.max(gap, Math.min(rect.left, window.innerWidth - node.offsetWidth - gap))}px`;
      node.style.top = `${Math.max(gap, Math.min(rect.top, window.innerHeight - node.offsetHeight - gap))}px`;
    };
    sync();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    observer?.observe(target);
    observer?.observe(node);
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
      if (typeof node.hidePopover === 'function' && node.matches(':popover-open')) node.hidePopover();
    };
  }, [message, className]);

  return <>
    <span ref={anchor} className={`coach-position ${className}`} aria-hidden="true" />
    <aside ref={bubble} className={`coach-bubble coach-bubble--floating ${className}`} role="status" aria-live="polite">
      <span className="coach-bubble__spark" aria-hidden="true">✦</span>
      <span className="coach-bubble__copy">{message}</span>
      <button type="button" className="coach-bubble__close" onClick={event => { event.stopPropagation(); onDismiss(); }} aria-label="Dismiss this tip">
        ×
      </button>
    </aside>
  </>;
}
