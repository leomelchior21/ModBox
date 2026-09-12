import { useEffect, useRef } from 'react';
import type { Mission } from '../learning/missions/types';
import type { MissionValidation } from '../learning/validation';

export function MissionPanel({ mission, validation, complete, collapsed: detailsOpen, onToggleCollapsed, onPlay, onNext, hasNext, playLabel }: {
  mission: Mission; validation: MissionValidation; complete: boolean; collapsed: boolean;
  onToggleCollapsed: () => void; onPlay: () => void; onNext: () => void; hasNext: boolean; playLabel: string;
}): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (detailsOpen) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [detailsOpen]);
  const badge = mission.kind === 'sandbox' ? 'SANDBOX' : `MISSION ${String(mission.order).padStart(2, '0')}`;
  return <section className={`mission ${complete ? 'mission--complete' : ''}`} aria-label={`${badge} ${mission.code}`}>
    <div className="mission__copy">
      <h2 className="mission__badge">{badge} <span aria-hidden="true">—</span> {mission.code}</h2>
      <p className="mission__concept">{mission.concept?.tagline ?? mission.brief}</p>
      <p className="mission__action">{complete ? 'Mod applied. Mission complete!' : mission.action}</p>
    </div>
    <div className="mission__actions">
      <button className="mission__help" onClick={onToggleCollapsed}>BRIEFING & HINTS <span aria-hidden="true">+</span></button>
      {complete && hasNext ? <button className="mission__next" onClick={onNext}>NEXT MISSION →</button> : <button className="mission__play" onClick={onPlay}>{playLabel} ▷</button>}
    </div>
    <dialog ref={dialog} className="mission-dialog" onCancel={event => { event.preventDefault(); onToggleCollapsed(); }} onClose={() => { if (detailsOpen) onToggleCollapsed(); }}>
      <header><h2>{badge} — {mission.code}</h2><button onClick={onToggleCollapsed} aria-label="Close mission briefing">✕</button></header>
      <h3>{mission.title}</h3><p>{mission.brief}</p>
      {complete && mission.appliedCopy ? <p>{mission.appliedCopy}</p> : null}
      {mission.concept ? <><p>{mission.concept.explanation}</p><pre><code>{mission.concept.example}</code></pre></> : null}
      <strong>{mission.action}</strong>
      {mission.hint ? <p>Hint: {mission.hint}</p> : null}
      <ul className="checklist" aria-label="Mission requirements">{validation.results.map(result => <li key={result.id} className={result.done ? 'checklist__item--done' : ''}>{result.done ? '✓' : '○'} {result.label}</li>)}</ul>
    </dialog>
  </section>;
}
