import { useEffect, useRef, useState } from 'react';
import { createRock } from '../games/vector-zero/engine/asteroids';
import { FIELD, PALETTE } from '../games/vector-zero/engine/constants';
import type { Rock, RockSize, Ship } from '../games/vector-zero/engine/types';
import { drawRock, drawShip } from '../games/vector-zero/rendering/entities';
import { createStars, drawStars, drawVignette } from '../games/vector-zero/rendering/starfield';

/* ============================================================================
   MODBOX — LANDING PREVIEW
   A tiny, real slice of VECTOR ZERO: the three lines of code on the left
   actually control the scene on the right (spec §29).
   ========================================================================== */

export interface DemoState {
  enemy: 'small-rock' | 'medium-rock' | 'big-rock';
  enemies: number;
  shield: boolean;
}

const ENEMY_CYCLE: DemoState['enemy'][] = ['small-rock', 'medium-rock', 'big-rock'];
const COUNT_CYCLE = [1, 2, 4, 6];
const SIZE_BY_KIND: Record<DemoState['enemy'], RockSize> = {
  'small-rock': 'small',
  'medium-rock': 'medium',
  'big-rock': 'big',
};

export function LandingPreview({ state, paused = false }: { state: DemoState; paused?: boolean }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars = createStars();
    let rocks: Rock[] = [];
    let signature = '';
    let raf = 0;
    let elapsed = 0;
    let last = performance.now();
    let nextId = 1;
    let width = 320;
    let height = 220;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const ship: Ship = {
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      angle: -Math.PI / 2,
      radius: FIELD.shipRadius,
      thrusting: false,
      recoil: 0,
      invuln: 0,
      alive: true,
      hitFlash: 0,
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      signature = '';
    };

    const rebuild = () => {
      const current = stateRef.current;
      const key = `${current.enemy}-${current.enemies}`;
      if (key === signature) return;
      signature = key;
      rocks = [];
      for (let i = 0; i < current.enemies; i += 1) {
        rocks.push(
          createRock({
            id: nextId++,
            size: SIZE_BY_KIND[current.enemy],
            pos: {
              x: ((i + 0.6) / Math.max(1, current.enemies)) * width,
              y: height * (0.18 + ((i * 0.23) % 0.6)),
            },
            speedFactor: 0.7,
            phaseIn: 1,
          }),
        );
      }
    };

    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      const still = pausedRef.current || motionQuery.matches;
      const dt = still ? 0 : Math.min(0.05, Math.max(0, (time - last) / 1000));
      last = time;
      elapsed += dt;
      rebuild();

      ctx.fillStyle = PALETTE.space;
      ctx.fillRect(0, 0, width, height);
      drawStars(ctx, stars, width, height, elapsed, 8, 0, still);
      drawVignette(ctx, width, height);

      for (const rock of rocks) {
        rock.angle += rock.spin * dt;
        rock.pos.x += rock.vel.x * dt;
        rock.pos.y += rock.vel.y * dt;
        if (rock.pos.x < -rock.radius) rock.pos.x = width + rock.radius;
        if (rock.pos.x > width + rock.radius) rock.pos.x = -rock.radius;
        if (rock.pos.y < -rock.radius) rock.pos.y = height + rock.radius;
        if (rock.pos.y > height + rock.radius) rock.pos.y = -rock.radius;
        drawRock(ctx, rock, still);
      }

      ship.angle = -Math.PI / 2 + Math.sin(elapsed * 0.5) * 0.5;
      ship.thrusting = true;
      ship.pos = { x: width * 0.5, y: height * 0.74 + Math.sin(elapsed * 1.2) * 6 };
      drawShip(ctx, ship, {
        shield: stateRef.current.shield,
        shieldRatio: 1,
        power: 1,
        time: elapsed,
        thrusting: !still,
        reducedMotion: still,
      });
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return <canvas className="demo__canvas" ref={canvasRef} aria-label="Vector Zero live preview" />;
}

export function LandingDemo(): JSX.Element {
  const [state, setState] = useState<DemoState>({ enemy: 'small-rock', enemies: 2, shield: false });
  const [paused, setPaused] = useState(false);

  const cycleEnemy = () =>
    setState((prev) => ({
      ...prev,
      enemy: ENEMY_CYCLE[(ENEMY_CYCLE.indexOf(prev.enemy) + 1) % ENEMY_CYCLE.length],
    }));

  const cycleCount = () =>
    setState((prev) => ({
      ...prev,
      enemies: COUNT_CYCLE[(COUNT_CYCLE.indexOf(prev.enemies) + 1) % COUNT_CYCLE.length],
    }));

  return (
    <div className="demo">
      <div className="demo__code mono">
        <div className="demo__line">
          <span className="demo__kw">string</span> enemy ={' '}
          <button
            type="button"
            className="demo__value"
            onClick={cycleEnemy}
            title="Change the rock type"
          >
            "{state.enemy}"
          </button>
          ;
        </div>
        <div className="demo__line">
          <span className="demo__kw">int</span> enemies ={' '}
          <button
            type="button"
            className="demo__value"
            onClick={cycleCount}
            title="Change the rock count"
          >
            {state.enemies}
          </button>
          ;
        </div>
        <div className="demo__line">
          <span className="demo__kw">bool</span> shield ={' '}
          <button
            type="button"
            className="demo__value"
            onClick={() => setState((prev) => ({ ...prev, shield: !prev.shield }))}
            title="Switch the shield"
          >
            {state.shield ? 'true' : 'false'}
          </button>
          ;
        </div>
        <p className="demo__hint">Tap an orange value. Watch your world change.</p>
      </div>
      <div className="demo__view">
        <LandingPreview state={state} paused={paused} />
        <span className="demo__badge mono">VECTOR ZERO · LIVE</span>
        <button type="button" className="demo__pause" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Resume preview animation' : 'Pause preview animation'} aria-pressed={paused}>{paused ? '▶' : 'Ⅱ'}</button>
        <span className="demo__feedback" role="status" aria-live="polite">{state.enemies} {state.enemies === 1 ? 'asteroid' : 'asteroids'} · Shield {state.shield ? 'ON' : 'OFF'}</span>
      </div>
    </div>
  );
}
