import type { EngineSnapshot, Phase } from '../games/vector-zero/engine/types';

/* ============================================================================
   MODBOX — STAGE BAR
   The strip under the game viewport. It answers one question at a glance:
   "what is my build doing right now, and can I fly it?" It also owns the
   primary CTA (§J) and the keyboard-focus switch (§L).
   ========================================================================== */

export type StageTone = 'ready' | 'live' | 'hold' | 'over' | 'complete' | 'error';

export interface StageBarProps {
  phase: Phase;
  snapshot: EngineSnapshot;
  playLabel: string;
  complete: boolean;
  hasError: boolean;
  ruleCount: number;
  editorFocused: boolean;
  onPlay: () => void;
  onFocusGame: () => void;
  onFocusEditor: () => void;
}

interface StageState {
  tone: StageTone;
  label: string;
  detail: string;
}

function readState(
  phase: Phase,
  snapshot: EngineSnapshot,
  complete: boolean,
  hasError: boolean,
  ruleCount: number,
): StageState {
  const config = snapshot.config;

  if (hasError) {
    return { tone: 'error', label: 'CHECK YOUR CODE', detail: 'The editor has a hint for the flagged line.' };
  }
  if (phase === 'playing' || phase === 'respawn') {
    return {
      tone: 'live',
      label: 'IN FLIGHT',
      detail: `WAVE ${snapshot.wave} · ${snapshot.score} PTS${ruleCount ? ` · ${ruleCount} RULE${ruleCount > 1 ? 'S' : ''}` : ''}`,
    };
  }
  if (phase === 'paused') {
    return { tone: 'hold', label: 'PAUSED', detail: 'Signal held — resume when ready.' };
  }
  if (phase === 'gameover') {
    return { tone: 'over', label: 'RUN OVER', detail: `SCORE ${snapshot.score} · BEST ${snapshot.best}` };
  }
  if (complete) {
    return { tone: 'complete', label: 'MISSION COMPLETE', detail: 'Your build flew. Push it further or move on.' };
  }
  return {
    tone: 'ready',
    label: 'LAUNCH READY',
    detail: `${config.enemyCount}× ${config.enemyType.toUpperCase()} · ${config.lives} LIVES · PWR ${config.laserPower}`,
  };
}

export function StageBar({
  phase,
  snapshot,
  playLabel,
  complete,
  hasError,
  ruleCount,
  editorFocused,
  onPlay,
  onFocusGame,
  onFocusEditor,
}: StageBarProps): JSX.Element {
  const state = readState(phase, snapshot, complete, hasError, ruleCount);
  const flying = phase === 'playing' || phase === 'respawn' || phase === 'paused';
  const ctaLabel = phase === 'paused' ? 'RESUME FLIGHT' : flying ? 'RESTART TEST' : phase === 'gameover' ? 'PLAY AGAIN' : 'PLAY TEST';

  return (
    <div className={`stagebar stagebar--${state.tone}`}>
      <div className="stagebar__status" role="status" aria-live="polite">
        <span className="stagebar__pulse" aria-hidden="true" />
        <div className="stagebar__text">
          <p className="stagebar__label">{state.label}</p>
          <p className="stagebar__detail mono">{state.detail}</p>
        </div>
      </div>

      <div className="stagebar__right">
        <div className="focusswitch" role="group" aria-label="Where the keyboard goes">
          <button
            type="button"
            className={`focusswitch__opt ${editorFocused ? 'focusswitch__opt--on' : ''}`}
            onClick={onFocusEditor}
            aria-pressed={editorFocused}
            title="Type code — flight keys pause"
          >
            ⌨ CODE
          </button>
          <button
            type="button"
            className={`focusswitch__opt ${!editorFocused ? 'focusswitch__opt--on' : ''}`}
            onClick={onFocusGame}
            aria-pressed={!editorFocused}
            title="Fly the ship — flight keys live"
          >
            ➤ FLIGHT
          </button>
        </div>

        <button type="button" className={`btn ${phase === 'launch' ? 'btn--ghost' : 'btn--primary'} btn--hero stagebar__cta`} onClick={onPlay} title={playLabel}>
          <span className="btn__icon" aria-hidden="true">
            ▶
          </span>
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
