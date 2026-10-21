import { TomatinaRun, BOT_INFO, CELL, EYE, type Bot } from './run';

/**
 * Test helper: a fiesta player that uses only what a student can do. It turns and walks with the arrow keys and
 * throws with a tap on screen (a yaw/pitch inside the view). It proves every street can be finished.
 */
interface Brain { goal: string; stuck: number; lastX: number; lastZ: number; wiggle: number }
const brains = new WeakMap<TomatinaRun, Brain>();
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const FOV = .55;

function face(run: TomatinaRun, x: number, z: number): number { const want = Math.atan2(z - run.pz, x - run.px), diff = wrap(want - run.yaw); run.input.left = diff < -.06; run.input.right = diff > .06; return diff; }
/** Taps the screen where a point appears (only when it is inside the view). */
function tapAt(run: TomatinaRun, x: number, y: number, z: number): boolean {
  const diff = wrap(Math.atan2(z - run.pz, x - run.px) - run.yaw); if (Math.abs(diff) > FOV) return false;
  return run.aimAt(diff, Math.atan2(y - EYE, Math.hypot(x - run.px, z - run.pz)));
}
function walkTo(run: TomatinaRun, x: number, z: number, brain: Brain): boolean {
  const [gc, gr] = run.cellOf(x, z), step = run.stepToward(run.px, run.pz, gc, gr) ?? { x, z }, d = Math.hypot(x - run.px, z - run.pz);
  if (d < .35) { run.input.up = false; return true; }
  const diff = face(run, step.x, step.z); run.input.up = Math.abs(diff) < .5; run.input.down = false;
  // Unstick: back off and turn a little if the feet have not moved for a while.
  if (Math.hypot(run.px - brain.lastX, run.pz - brain.lastZ) < .002 && run.input.up) brain.stuck += 1 / 60; else brain.stuck = 0;
  brain.lastX = run.px; brain.lastZ = run.pz;
  if (brain.stuck > .6) { brain.wiggle = .35; brain.stuck = 0; }
  if (brain.wiggle > 0) { brain.wiggle -= 1 / 60; run.input.up = false; run.input.down = true; run.input.right = true; run.input.left = false; }
  return false;
}
const visible = (run: TomatinaRun, b: Bot, range: number) => Math.hypot(b.x - run.px, b.z - run.pz) < range && run.lineOfSight(run.px, run.pz, b.x, b.z);
function nearest<T extends { x: number; z: number }>(run: TomatinaRun, list: readonly T[]): T | undefined {
  let best: T | undefined, bestD = Infinity; for (const p of list) { const d = run.walkCells(run.px, run.pz, p.x, p.z); if (d >= 0 && d < bestD) { bestD = d; best = p; } } return best;
}
/** A wide line of sight: a tomato thrown from the hand clears every corner on the way. */
function clearShot(run: TomatinaRun, x0: number, z0: number, x1: number, z1: number) {
  const d = Math.hypot(x1 - x0, z1 - z0), nx = -(z1 - z0) / d * .45, nz = (x1 - x0) / d * .45;
  return [-1, 0, 1].every(k => run.lineOfSight(x0 + nx * k, z0 + nz * k, x1 + nx * k * .3, z1 + nz * k * .3));
}
/** A floor spot from which a target face can be hit, and the point on the face to aim at. */
function targetSpot(run: TomatinaRun, cell: number) {
  const col = cell % run.cols, row = Math.floor(cell / run.cols);
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (run.blocks(col + dc, row + dr)) continue;
    const fx = (col + .5 + dc * .5) * CELL, fz = (row + .5 + dr * .5) * CELL, aim = { x: fx, y: 1.7, z: fz };
    const spots: { x: number; z: number }[] = [];
    for (let k = 1; k <= 5; k++) for (let s = -2; s <= 2; s++) { const c = col + dc * k + (dr ? s : 0), r = row + dr * k + (dc ? s : 0), p = run.center(c, r); if (!run.blocks(c, r) && clearShot(run, p.x, p.z, fx + dc * .3, fz + dr * .3)) spots.push(p); }
    const spot = nearest(run, spots); if (spot) return { spot, aim };
  }
  return null;
}

export function tomatoBot(run: TomatinaRun): void {
  if (run.phase !== 'playing') return;
  const brain = brains.get(run) ?? { goal: '', stuck: 0, lastX: run.px, lastZ: run.pz, wiggle: 0 }; brains.set(run, brain);
  run.input.left = run.input.right = run.input.up = run.input.down = false;
  const progress = run.goalProgress(), need = (kind: string) => progress.some(g => g.kind === kind && g.value < g.count);
  const pickups = run.pickups.filter(p => !p.gone && p.away === 0);
  if (run.config.overdrive && run.live.filter(b => Math.hypot(b.x - run.px, b.z - run.pz) < 12).length >= 2) run.action('ability');
  // 1. Stay dry and stocked.
  if (run.dry < 40) { const c = nearest(run, pickups.filter(p => p.kind === 'churros')); if (c) { walkTo(run, c.x, c.z, brain); attack(run, true); return; } }
  if (run.ammo === 0) { const c = nearest(run, pickups.filter(p => p.kind === 'crate' || p.kind === 'drop')); if (c) { walkTo(run, c.x, c.z, brain); return; } }
  // 2. Splat any robot in sight (always worth it: they clean paint and soak you).
  if (attack(run, false)) return;
  // 3. Work on the goals.
  if (need('targets')) {
    const cell = run.targets.filter(t => !run.targetsHit.has(t)).map(t => ({ t, s: targetSpot(run, t) })).find(e => e.s);
    if (cell?.s) { const { spot, aim } = cell.s; if (walkTo(run, spot.x, spot.z, brain) || Math.hypot(spot.x - run.px, spot.z - run.pz) < 1) { const diff = face(run, aim.x, aim.z); if (Math.abs(diff) < .25) tapAt(run, aim.x, aim.y, aim.z); } return; }
  }
  if (need('zone')) {
    // Throw at a clean patch of plaza a few metres away; walk into the plaza when none is in sight.
    const tw = run.cols * 2; let shot: { x: number; z: number } | null = null, shotScore = Infinity, near: { x: number; z: number } | null = null, nearD = Infinity;
    for (let i = 0; i < run.zone.length; i++) if (run.zone[i] && !run.paint[i]) {
      const x = (i % tw + .5), z = (Math.floor(i / tw) + .5), d = Math.hypot(x - run.px, z - run.pz);
      if (d < nearD) { nearD = d; near = { x, z }; }
      const turn = Math.abs(wrap(Math.atan2(z - run.pz, x - run.px) - run.yaw));
      if (d > 2.5 && d < 9 && Math.abs(d - 5) + turn * 3 < shotScore && clearShot(run, run.px, run.pz, x, z)) { shotScore = Math.abs(d - 5) + turn * 3; shot = { x, z }; }
    }
    if (shot) { const diff = face(run, shot.x, shot.z); if (Math.abs(diff) < .3) tapAt(run, shot.x, 0, shot.z); return; }
    if (near) { walkTo(run, near.x, near.z, brain); return; }
  }
  if (need('golden')) { const g = nearest(run, pickups.filter(p => p.kind === 'golden')); if (g) { walkTo(run, g.x, g.z, brain); return; } }
  if (need('robots') || need('boss') || need('zone')) { const b = nearest(run, run.live); if (b) { walkTo(run, b.x, b.z, brain); return; } }
  if (run.exitOpen) { for (let r = 0; r < run.rows; r++) for (let c = 0; c < run.cols; c++) if (run.at(c, r) === 'X') { const p = run.center(c, r); walkTo(run, p.x, p.z, brain); return; } }
}
/** Faces the nearest robot in sight and throws at it. Returns true when busy fighting. */
function attack(run: TomatinaRun, moving: boolean): boolean {
  const targets = run.live.filter(b => visible(run, b, b.kind === 'boss' ? 22 : 15)).sort((a, b) => Math.hypot(a.x - run.px, a.z - run.pz) - Math.hypot(b.x - run.px, b.z - run.pz));
  const b = targets[0]; if (!b) return false;
  if (b.kind === 'boss' && !b.open) { if (!moving) { face(run, b.x, b.z); run.input.down = Math.hypot(b.x - run.px, b.z - run.pz) < 7; } return true; }
  if (!moving) { const diff = face(run, b.x, b.z); if (Math.abs(diff) > FOV) return true; }
  tapAt(run, b.x, BOT_INFO[b.kind].h * .55, b.z); return !moving;
}

/** Plays a street with a bot for up to `limit` seconds of game time. */
export function playStage(level: number, bot: (run: TomatinaRun) => void = tomatoBot, limit = 420, setup?: (run: TomatinaRun) => void) {
  const run = new TomatinaRun(); setup?.(run); run.level = level; run.launch(); run.level = level;
  let t = 0; for (; t < limit && run.phase === 'playing'; t += 1 / 60) { bot(run); run.step(1 / 60); }
  return { won: run.phase === 'cleared', time: t, shirts: run.config.lives - run.lives, run };
}
