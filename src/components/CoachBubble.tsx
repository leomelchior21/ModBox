export function CoachBubble({
  message,
  hint,
  className = '',
  onDismiss,
}: {
  message: string;
  hint?: string;
  className?: string;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <aside className={`coach-bubble ${className}`} role="status" aria-live="polite">
      <span className="coach-bubble__spark" aria-hidden="true">✦</span>
      <div className="coach-bubble__copy">
        <strong>NEXT MOVE</strong>
        <span>{message}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <button type="button" className="coach-bubble__close" onClick={onDismiss} aria-label="Dismiss this tip">
        Got it
      </button>
    </aside>
  );
}
