import { AnominersRun, COPPER, CRYSTAL, GOLD, ICE, TECH } from './run';

/**
 * Test helper: a miner that only uses the controls a student has: the arrow keys (8 directions) and BLAST.
 * It heads for the nearest mineral (the drill beam cuts the way), flies home when the hold is full or the quota is
 * in reach, blasts anomalites that come close and the rift when it is near, and docks to warp.
 */
interface Brain { stuck: number; lx: number; ly: number; jiggle: number; target: number }
const brains = new WeakMap<AnominersRun, Brain>();
function steer(run: AnominersRun, tx: number, ty: number) {
  const dx = tx - run.x, dy = ty - run.y, d = Math.hypot(dx, dy) || 1;
  run.input.right = dx / d > .38; run.input.left = dx / d < -.38; run.input.down = dy / d > .38; run.input.up = dy / d < -.38;
}
export function minerBot(run: AnominersRun): void {
  if (run.phase !== 'playing') return;
  const b = brains.get(run) ?? { stuck: 0, lx: run.x, ly: run.y, jiggle: 0, target: -1 }; brains.set(run, b);
  run.input.left = run.input.right = run.input.up = run.input.down = false;
  // Danger first: blast anything close (and the rift when it is in range).
  if (run.glitches.some(g => Math.hypot(g.x - run.x, g.y - run.y) < 12) || run.rift && Math.hypot(run.rift.x - run.x, run.rift.y - run.y) < 22) run.blast();
  if (b.jiggle > 0) { b.jiggle -= 1 / 60; run.input.up = Math.sin(b.jiggle * 9) > 0; run.input.down = !run.input.up; run.input.left = true; return; }
  const home = () => steer(run, run.baseX, run.baseY);
  const needTech = run.techFound < run.techTotal, need = Math.max(0, run.ast.quota - run.bank);
  if (run.goalsMet || run.cargo >= run.hold || need > 0 && run.cargo >= need && !needTech || run.hull < 35 && run.cargo > 0) { home(); return track(run, b); }
  // The final asteroid: fly at the core and blast it.
  if (run.ast.core && !run.coreDown && run.rift) { const d = Math.hypot(run.rift.x - run.x, run.rift.y - run.y); if (d > 9) steer(run, run.rift.x, run.rift.y); else steer(run, run.rift.x - (run.rift.x - run.x) / d * 12, run.rift.y - (run.rift.y - run.y) / d * 12); return track(run, b); }
  // Loose minerals first, then the nearest ore (tech when it is still missing).
  const loose = run.chunks.filter(c => c.kind !== 'shard').sort((p, q) => Math.hypot(p.x - run.x, p.y - run.y) - Math.hypot(q.x - run.x, q.y - run.y))[0];
  if (loose && Math.hypot(loose.x - run.x, loose.y - run.y) < 8) { steer(run, loose.x, loose.y); return track(run, b); }
  if (b.target < 0 || run.grid[b.target] === 0) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < run.grid.length; i++) { const k = run.grid[i]; if (needTech ? k !== TECH : k !== COPPER && k !== CRYSTAL && k !== GOLD && k !== ICE) continue; const x = i % run.w + .5, y = Math.floor(i / run.w) + .5, d = Math.hypot(x - run.x, y - run.y) - (k === GOLD ? 6 : k === CRYSTAL ? 3 : 0); if (d < bd) { bd = d; best = i; } }
    b.target = best;
  }
  if (b.target >= 0) steer(run, b.target % run.w + .5, Math.floor(b.target / run.w) + .5); else home();
  track(run, b);
}
function track(run: AnominersRun, b: Brain) {
  if (Math.hypot(run.x - b.lx, run.y - b.ly) < .004 && !run.beam && (run.input.left || run.input.right || run.input.up || run.input.down)) b.stuck += 1 / 60; else b.stuck = 0;
  b.lx = run.x; b.ly = run.y; if (b.stuck > 1) { b.jiggle = .6; b.stuck = 0; b.target = -1; }
}
export function playAsteroid(level: number, bot: (run: AnominersRun) => void = minerBot, limit = 420, setup?: (run: AnominersRun) => void) {
  const run = new AnominersRun(); setup?.(run); run.launch(true); if (level > 1) { run.level = level; (run as unknown as { setup(): void }).setup(); }
  let t = 0; for (; t < limit && run.phase === 'playing'; t += 1 / 60) { bot(run); run.step(1 / 60); }
  return { won: run.phase === 'cleared', time: t, lost: run.config.lives - run.lives, run };
}
