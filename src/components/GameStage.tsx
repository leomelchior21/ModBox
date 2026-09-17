import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef } from 'react';
import type { EngineSnapshot, Phase } from '../games/vector-zero/engine/types';
import type { VectorZeroEngine } from '../games/vector-zero/engine/gameEngine';
import { CoachBubble } from './CoachBubble';

/* ============================================================================
   VECTOR ZERO — GAME STAGE
   The canvas plus everything that sits on top of it. Overlays are DOM so they
   are keyboard and screen-reader friendly; the HUD itself is drawn in canvas so
   gameplay never triggers a React render.
   ========================================================================== */

export interface GameStageProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  engine: VectorZeroEngine | null;
  phase: Phase;
  snapshot: EngineSnapshot;
  showTouchControls: boolean;
  onLaunch: () => void;
  onResume: () => void;
  onRestart: () => void;
  onFocusGame: () => void;
  children?: ReactNode;
  overlayExtras?: ReactNode;
  statusNote?: string;
  missionName?: string;
  coach?: { message: string; hint?: string; onDismiss: () => void };
}

function HoldButton({
  label,
  hint,
  onPress,
  onRelease,
  variant = 'ghost',
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  onRelease: () => void;
  variant?: 'ghost' | 'fire' | 'thrust';
}): JSX.Element {
  const active = useRef(false);
  const stop = () => {
    if (!active.current) return;
    active.current = false;
    onRelease();
  };

  const release = (event: React.PointerEvent<HTMLButtonElement>) => {
    const target = event.currentTarget;
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    stop();
  };

  return (
    <button
      type="button"
      className={`touch touch--${variant}`}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        active.current = true;
        onPress();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={stop}
      onBlur={stop}
      onKeyDown={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (!active.current) { active.current = true; onPress(); }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); stop(); }
      }}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={hint ?? label}
    >
      <span className="touch__label">{label}</span>
      {hint ? <span className="touch__hint">{hint}</span> : null}
    </button>
  );
}

function Joystick({ engine }: { engine: VectorZeroEngine | null }): JSX.Element {
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const reset = () => {
    pointer.current = null;
    if (engine) engine.input.left = engine.input.right = engine.input.thrust = engine.input.brake = false;
    base.current?.style.setProperty('--stick-x', '0px');
    base.current?.style.setProperty('--stick-y', '0px');
  };
  useEffect(() => {
    const blur = () => reset();
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('blur', blur); reset(); };
  }, [engine]);
  const update = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width * .29;
    const dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(dx, dy), scale = Math.min(1, radius / (distance || 1));
    event.currentTarget.style.setProperty('--stick-x', `${dx * scale}px`);
    event.currentTarget.style.setProperty('--stick-y', `${dy * scale}px`);
    if (!engine) return;
    engine.input.left = dx < -radius * .3;
    engine.input.right = dx > radius * .3;
    engine.input.thrust = dy < -radius * .3;
    engine.input.brake = dy > radius * .3;
  };
  return <div ref={base} className="touchbar__cluster touchbar__cluster--left joystick" role="group" aria-label="Flight joystick: drag up to thrust, left or right to turn, down to brake" tabIndex={0}
    onPointerDown={event => { if (pointer.current !== null) return; event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); update(event); }}
    onPointerMove={update} onPointerUp={event => { if (pointer.current === event.pointerId) reset(); }} onPointerCancel={reset} onLostPointerCapture={reset} onBlur={reset}
    onKeyDown={event => { const key = ({ ArrowUp: 'thrust', ArrowDown: 'brake', ArrowLeft: 'left', ArrowRight: 'right' } as const)[event.key as 'ArrowUp']; if (key && engine) { event.preventDefault(); engine.input[key] = true; } }}
    onKeyUp={event => { if (event.key.startsWith('Arrow')) { event.preventDefault(); reset(); } }} onContextMenu={event => event.preventDefault()}>
    <span className="joystick__north" aria-hidden="true">▲</span><span className="joystick__west" aria-hidden="true">◀</span><span className="joystick__east" aria-hidden="true">▶</span><span className="joystick__south" aria-hidden="true">▼</span><span className="joystick__stick" aria-hidden="true" />
  </div>;
}

export function TouchControls({ engine, onEngage }: { engine: VectorZeroEngine | null; onEngage?: () => void }): JSX.Element {
  useEffect(() => () => {
    if (engine) {
      engine.input.left = engine.input.right = engine.input.thrust = engine.input.fire = engine.input.brake = false;
    }
  }, [engine]);
  const set = (key: 'left' | 'right' | 'thrust' | 'fire' | 'brake', value: boolean) => {
    if (!engine) return;
    engine.input[key] = value;
  };

  return (
    <div className="touchbar" aria-label="Touch flight controls" onPointerDownCapture={onEngage}>
      <Joystick engine={engine} />
      <div className="touchbar__cluster touchbar__cluster--right">
        <HoldButton
          label="✷"
          hint="FIRE"
          variant="fire"
          onPress={() => set('fire', true)}
          onRelease={() => set('fire', false)}
        />
      </div>
    </div>
  );
}

export function GameStage({
  canvasRef,
  engine,
  phase,
  snapshot,
  showTouchControls,
  onLaunch,
  onResume,
  onRestart,
  onFocusGame,
  children,
  overlayExtras,
  statusNote,
  missionName,
  coach,
}: GameStageProps): JSX.Element {
  const config = snapshot.config;

  return (
    <div className="stage" onClick={onFocusGame} role="presentation">
      <canvas ref={canvasRef} className="stage__canvas" tabIndex={0} aria-label="Vector Zero game view. Focus to fly: arrows to steer, space to fire." />

      {phase === 'launch' ? (
        <div className="overlay overlay--launch">
          <div className="overlay__panel overlay__panel--stage">
            {missionName ? <p className="overlay__mission mono">{missionName}</p> : null}
            <div className={`ship-preview ${config.shieldEnabled ? 'ship-preview--shield' : ''}`} aria-hidden="true">
              <svg viewBox="0 0 280 112" fill="none">
                <ellipse cx="140" cy="56" rx="108" ry="45" stroke="currentColor" opacity=".18" strokeDasharray="3 7" />
                <path d="M28 56h48m-33-12h40M42 68h41" stroke="#4f8cff" strokeWidth="2" opacity=".6" />
                <path d="m87 45-30 11 30 11" stroke="#53dfff" strokeWidth="3" />
                <path d="m88 27 103 29-103 29 13-29z" fill="#0b1d35" stroke="#f5f3ec" strokeWidth="2" />
                <path d="m101 56 90 0-77-13z" fill="#1663ed" stroke="#53dfff" />
                <path d="m90 29 27 15m-27 39 27-15" stroke="#ff703b" strokeWidth="3" />
                <circle className="ship-preview__shield" cx="136" cy="56" r="52" stroke="#53dfff" strokeWidth="2" strokeDasharray="12 5" />
                <path d="M223 31h8m-4-4v8M54 86h6m-3-3v6" stroke="#7ba6ff" />
              </svg>
            </div>
            <h2 className="overlay__title">{config.shipName}</h2>
            <p className="overlay__kicker">Here is the world your code built.</p>

            <dl className="stage-spec">
              <div className="stage-spec__cell">
                <dt>ASTEROIDS</dt>
                <dd className="mono">
                  {config.enemyCount}× {config.enemyType.toUpperCase()}
                </dd>
              </div>
              <div className="stage-spec__cell">
                <dt>DRIFT SPEED</dt>
                <dd className="mono">{config.enemySpeed}</dd>
              </div>
              <div className="stage-spec__cell">
                <dt>LASER POWER</dt>
                <dd className="mono">{config.laserPower}</dd>
              </div>
              <div className="stage-spec__cell">
                <dt>LIVES</dt>
                <dd className="mono">{config.lives}</dd>
              </div>
            </dl>

            <div className="stage-powers" aria-label="Core powers enabled">
              <span className={`power ${config.shieldEnabled ? 'power--on' : ''}`}>⬡ SHIELD <b>{config.shieldEnabled ? 'ON' : 'OFF'}</b></span>
              <span className={`power ${config.rapidFireEnabled ? 'power--on' : ''}`}>ϟ RAPID FIRE <b>{config.rapidFireEnabled ? 'ON' : 'OFF'}</b></span>
              <span className={`power ${config.homingEnabled ? 'power--on' : ''}`}>➤ HOMING <b>{config.homingEnabled ? 'ON' : 'OFF'}</b></span>
            </div>

            <button type="button" className="btn btn--primary btn--hero overlay__cta" onClick={onLaunch}>
              <span className="btn__icon" aria-hidden="true">
                ▶
              </span>
              LAUNCH
              <span className="btn__key" aria-hidden="true">
                ENTER
              </span>
            </button>

            <ul className="overlay__keys mono">
              <li>
                <b>A</b> / <b>←</b> rotate left
              </li>
              <li>
                <b>D</b> / <b>→</b> rotate right
              </li>
              <li>
                <b>W</b> / <b>↑</b> thrust
              </li>
              <li>
                <b>SPACE</b> fire
              </li>
              <li>
                <b>S</b> brake
              </li>
              <li>
                <b>P</b> pause
              </li>
            </ul>
            <p className="overlay__note">
              {statusNote ?? 'Your code is already flying this field.'}
            </p>
          </div>
          {overlayExtras}
        </div>
      ) : null}

      {phase === 'paused' ? (
        <div className="overlay overlay--paused">
          <div className="overlay__panel">
            <p className="eyebrow eyebrow--blue">SIGNAL HELD</p>
            <h2 className="overlay__title">PAUSED</h2>
            <div className="overlay__actions">
              <button type="button" className="btn btn--primary" onClick={onResume}>
                RESUME
              </button>
              <button type="button" className="btn btn--ghost" onClick={onRestart}>
                RESTART RUN
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'gameover' ? (
        <div className="overlay overlay--gameover">
          <div className="overlay__panel">
            <p className="eyebrow eyebrow--flare">SIGNAL LOST</p>
            <h2 className="overlay__title">GAME OVER</h2>
            <p className="overlay__stats mono">
              SCORE {snapshot.score} · BEST {snapshot.best} · WAVE {snapshot.wave} · ROCKS{' '}
              {snapshot.metrics.kills}
            </p>
            <div className="overlay__actions">
              <button type="button" className="btn btn--primary" onClick={onRestart}>
                RUN IT AGAIN
              </button>
            </div>
            <p className="overlay__note">
              Your code is not lost — tweak it on the left and launch again.
            </p>
          </div>
          {overlayExtras}
        </div>
      ) : null}

      {showTouchControls && (phase === 'playing' || phase === 'respawn') ? <TouchControls engine={engine} /> : null}
      {coach ? <CoachBubble className="coach-bubble--stage" message={coach.message} hint={coach.hint} onDismiss={coach.onDismiss} /> : null}
      {children}
    </div>
  );
}
