import { useState } from 'react';
import type { Diagnostic } from '../interpreter/core/types';
import type { CopilotStep } from '../learning/copilot';

export type FeedbackStatus = 'ready' | 'updated' | 'error' | 'complete';

export interface FeedbackPanelProps {
  status: FeedbackStatus;
  diagnostic?: Diagnostic;
  ruleCount: number;
  guidance: CopilotStep;
}

export function FeedbackPanel({
  status,
  diagnostic,
  ruleCount,
  guidance,
}: FeedbackPanelProps): JSX.Element {
  const [showTechnical, setShowTechnical] = useState(false);
  const heading = diagnostic
    ? diagnostic.line
      ? `FIX LINE ${diagnostic.line}`
      : 'LET\'S FIX THIS'
    : status === 'complete'
      ? 'MISSION READY'
      : 'YOUR NEXT STEP';
  const health = diagnostic
    ? diagnostic.title
    : status === 'complete'
      ? 'All checks passed'
      : ruleCount > 0
        ? `${ruleCount} live rule${ruleCount === 1 ? '' : 's'} watching`
        : 'No errors found';
  return (
    <section
      className={`feedback feedback--${status} ${ruleCount > 0 && !diagnostic ? 'feedback--live' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Code co-pilot"
    >
      <header className="feedback__head">
        <span className="feedback__mark" aria-hidden="true">{diagnostic ? '!' : '✓'}</span>
        <span className="feedback__heading">
          <small>CO-PILOT</small>
          <strong>{heading}</strong>
        </span>
        <span className="feedback__line">{health}</span>
      </header>

      {diagnostic ? (
        <div className="feedback__body">
          <p className="feedback__message">{diagnostic.message}</p>
          {diagnostic.hint ? <p className="feedback__hint"><b>TRY THIS</b> {diagnostic.hint}</p> : null}
          {diagnostic.technical ? (
            <div className="feedback__technical">
              <button
                type="button"
                className="feedback__technicalToggle"
                onClick={() => setShowTechnical((current) => !current)}
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
      ) : (
        <div className="feedback__body">
          <p className="feedback__message">{guidance.message}</p>
          {guidance.hint && status !== 'complete' ? (
            <p className="feedback__hint"><b>HOW</b> {guidance.hint}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
