import { useState } from 'react';
import type { Diagnostic } from '../interpreter/core/types';

/* ============================================================================
   MODBOX — FEEDBACK STRIP
   Compact. Shortest useful explanation first; formal C# detail stays folded
   away behind "technical details" (spec §9 / §28).
   ========================================================================== */

export type FeedbackStatus = 'ready' | 'updated' | 'error' | 'complete';

export interface FeedbackPanelProps {
  status: FeedbackStatus;
  diagnostic?: Diagnostic;
  notices: string[];
  discoveries: string[];
  ruleCount: number;
}

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  ready: 'READY',
  updated: 'WORLD UPDATED ✓',
  error: 'NEEDS ATTENTION',
  complete: 'MISSION COMPLETE',
};

export function FeedbackPanel({
  status,
  diagnostic,
  notices,
  discoveries,
  ruleCount,
}: FeedbackPanelProps): JSX.Element {
  const [showTechnical, setShowTechnical] = useState(false);

  // a rule that is live reads differently from plain "no errors": it's alive
  const liveRules = ruleCount > 0;
  const label =
    status === 'error'
      ? diagnostic?.line
        ? `LINE ${diagnostic.line} NEEDS ATTENTION`
        : 'NEEDS ATTENTION'
      : status === 'complete'
        ? 'MISSION COMPLETE'
        : status === 'updated'
          ? 'WORLD UPDATED'
          : liveRules
            ? 'LIVE RULE ACTIVE'
            : STATUS_LABEL.ready;

  return (
    <div className={`feedback feedback--${status} ${liveRules && !diagnostic ? 'feedback--live' : ''}`} role="status" aria-live="polite">
      <div className="feedback__head">
        <span className="feedback__dot" aria-hidden="true" />
        <span className="feedback__status">{label}</span>
        {diagnostic ? (
          <span className="feedback__line">{diagnostic.title}</span>
        ) : liveRules ? (
          <span className="feedback__line">
            {ruleCount} RULE{ruleCount > 1 ? 'S' : ''} WATCHING THE GAME
          </span>
        ) : (
          <span className="feedback__line">No errors found</span>
        )}
      </div>

      {!diagnostic && status !== 'error' && !liveRules && notices.length === 0 && discoveries.length === 0 ? (
        <p className="feedback__prompt">Your code is ready to test.</p>
      ) : null}

      {diagnostic ? (
        <div className="feedback__body">
          <p className="feedback__message">{diagnostic.message}</p>
          {diagnostic.hint ? <p className="feedback__hint">{diagnostic.hint}</p> : null}
          {diagnostic.technical ? (
            <div className="feedback__technical">
              <button
                type="button"
                className="feedback__technicalToggle"
                onClick={() => setShowTechnical((value) => !value)}
                aria-expanded={showTechnical}
              >
                {showTechnical ? '− hide technical details' : '+ show technical details'}
              </button>
              {showTechnical ? (
                <pre className="feedback__technicalBody">
                  <code>
                    {diagnostic.technical}
                    {diagnostic.sourceLine ? `\n${diagnostic.line}| ${diagnostic.sourceLine}` : ''}
                  </code>
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!diagnostic && notices.length ? (
        <ul className="feedback__notes">
          {notices.slice(0, 2).map((notice, index) => (
            <li key={index}>{notice}</li>
          ))}
        </ul>
      ) : null}

      {!diagnostic && discoveries.length ? (
        <ul className="feedback__notes feedback__notes--discovery">
          {discoveries.slice(0, 2).map((discovery, index) => (
            <li key={index}>{discovery}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
