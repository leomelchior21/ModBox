import type { Mission } from '../learning/missions/types';
import { CoachBubble } from './CoachBubble';

export function MissionPanel({
  mission,
  complete,
  onBack,
  onNext,
  hasPrevious,
  hasNext,
  coach,
  onDismissCoach,
}: {
  mission: Mission;
  complete: boolean;
  onBack: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  coach?: { message: string; hint?: string };
  onDismissCoach?: () => void;
}): JSX.Element {
  const name = mission.kind === 'sandbox'
    ? mission.code
    : `MISSION ${String(mission.order).padStart(2, '0')} — ${mission.code}`;

  return (
    <section className={`mission ${complete ? 'mission--complete' : ''}`} aria-label={name}>
      <div className="mission__identity">
        {hasPrevious ? (
          <button type="button" className="mission__back" onClick={onBack}>
            <span aria-hidden="true">←</span> BACK
          </button>
        ) : null}
        <h2 className="mission__badge">{name}</h2>
      </div>
      {hasNext ? (
        <div className="mission__next-wrap">
          <button
            type="button"
            className="mission__next"
            onClick={onNext}
            disabled={!complete}
            aria-disabled={!complete}
          >
            NEXT MISSION <span aria-hidden="true">→</span>
          </button>
          {coach && onDismissCoach ? (
            <CoachBubble className="coach-bubble--mission" message={coach.message} hint={coach.hint} onDismiss={onDismissCoach} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
