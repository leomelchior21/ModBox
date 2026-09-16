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
  return (
    <aside className={`coach-bubble ${className}`} role="status" aria-live="polite">
      <span className="coach-bubble__spark" aria-hidden="true">✦</span>
      <span className="coach-bubble__copy">{message}</span>
      <button type="button" className="coach-bubble__close" onClick={onDismiss} aria-label="Dismiss this tip">
        ×
      </button>
    </aside>
  );
}
