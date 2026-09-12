import { useEffect } from 'react';

/* ============================================================================
   MODBOX — MOD UNLOCK ANIMATION
   Quick and satisfying, never blocking play for more than ~1.4s (spec §16).
   ========================================================================== */

export interface UnlockToken {
  id: string;
  label: string;
}

export function UnlockBurst({
  tokens,
  onDone,
}: {
  tokens: UnlockToken[];
  onDone: () => void;
}): JSX.Element | null {
  useEffect(() => {
    if (!tokens.length) return;
    const timer = window.setTimeout(onDone, 1500);
    return () => window.clearTimeout(timer);
  }, [tokens, onDone]);

  if (!tokens.length) return null;

  return (
    <div className="unlock" role="status" aria-live="polite">
      <p className="unlock__title">NEW MOD UNLOCKED</p>
      <ul className="unlock__list">
        {tokens.map((token, index) => (
          <li
            key={token.id}
            className="unlock__token"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <span className="unlock__chip" aria-hidden="true" />
            <span className="unlock__label">{token.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
