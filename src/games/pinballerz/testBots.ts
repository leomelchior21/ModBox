import { PinballRun, closestSegment } from './run';

/** Test helper: a simple player that swings a flipper whenever the ball sits on the striking half of its rubber. */
export function flipBot(run: PinballRun): void {
  if (run.waiting) run.kickOff();
  for (const f of run.flippers) {
    const ex = f.x + Math.cos(f.rest) * f.length, ey = f.y + Math.sin(f.rest) * f.length;
    const near = run.live.some(b => { const p = closestSegment(b.x, b.y, f.x, f.y, ex, ey); return p.t >= .35 && Math.hypot(b.x - p.x, b.y - p.y) < 34 && b.vy > -200; });
    if (f.left) run.input.left = near; else run.input.right = near;
  }
}

const SHARED = new Set(['schema', 'defaults', 'program', 'base']);
/** Deep copy of a run for look-ahead; scripts and schemas are shared because they never change during play. */
export function cloneRun(run: PinballRun): PinballRun {
  const copy = Object.create(PinballRun.prototype) as PinballRun, src = run as unknown as Record<string, unknown>, dst = copy as unknown as Record<string, unknown>;
  for (const key of Object.keys(src)) dst[key] = SHARED.has(key) ? src[key] : structuredClone(src[key]);
  return copy;
}
/** Value of swinging one flipper (or neither) now, then playing on with the simple bot for a moment. */
function outcome(run: PinballRun, side: 'left' | 'right' | null, seconds = 1.5): number {
  const sim = cloneRun(run), goals = sim.tally.goals, lives = sim.lives, lost = sim.balls.filter(b => b.state === 'lost').length; let top = 999;
  for (let t = 0; t < seconds; t += 1 / 60) {
    if (t < .25) { sim.input.left = side === 'left'; sim.input.right = side === 'right'; } else flipBot(sim);
    sim.step(1 / 60); for (const b of sim.live) top = Math.min(top, b.y);
    if (sim.tally.goals > goals) return 1000 - t * 100;
    if (sim.lives < lives || sim.balls.filter(b => b.state === 'lost').length > lost) return -1000;
  }
  return -top * .3;
}
/**
 * Test helper: a player that looks ahead before each swing. It proves a stage can be won with real flipper play,
 * since it only ever presses the same two flippers a person can.
 */
export function aimBot(run: PinballRun): void {
  if (run.waiting) { run.kickOff(); return; }
  const near = (left: boolean) => { const f = run.flippers.find(f => f.left === left)!, ex = f.x + Math.cos(f.rest) * f.length, ey = f.y + Math.sin(f.rest) * f.length; return run.live.some(b => { const p = closestSegment(b.x, b.y, f.x, f.y, ex, ey); return Math.hypot(b.x - p.x, b.y - p.y) < 60 && b.vy > -300; }); };
  const options: ('left' | 'right' | null)[] = [null]; if (near(true)) options.push('left'); if (near(false)) options.push('right');
  if (options.length === 1) { run.input.left = run.input.right = false; return; }
  let best: 'left' | 'right' | null = null, score = -Infinity;
  for (const o of options) { const v = outcome(run, o); if (v > score + (o ? 40 : 0)) { score = v; best = o; } }
  run.input.left = best === 'left'; run.input.right = best === 'right';
}
/** Plays a stage with a bot for up to `limit` seconds of game time; returns whether it was won and how long it took. */
export function playStage(level: number, bot: (run: PinballRun) => void, limit = 400, seed = 0) {
  const run = new PinballRun(); run.level = level; run.launch(); (run as unknown as { seed: number }).seed += seed;
  let t = 0; for (; t < limit && run.phase === 'playing'; t += 1 / 60) { bot(run); run.step(1 / 60); }
  return { won: run.phase === 'cleared', time: t, ballsLost: run.config.lives - run.lives, run };
}
