import { NeonMazeRun, type Sentinel } from './run';
import { DIRS, OPPOSITE, distances, exits, isOpen, step, type Dir, type Tile } from './grid';

/**
 * Test helper: a player that only steers (arrows or swipes) and dashes (SPACE), like a student.
 * It runs for the gems while keeping away from awake sentinels, chases frozen ones, dashes into sealed rooms and
 * out of trouble, then rolls into the exit. It proves every sector can be cleared.
 */
const near = (s: Sentinel) => { const dx = s.at.x - s.from.x, dy = s.at.y - s.from.y; return Math.abs(dx) + Math.abs(dy) > 1 ? s.at : { x: s.from.x + dx * s.t, y: s.from.y + dy * s.t }; };
function route(run: NeonMazeRun, goal: (t: Tile) => boolean, avoid: Set<number>): Dir | null {
  const g = run.grid, start = run.runner.t >= 1 ? run.runner.at : run.runner.at, prev = new Map<number, { k: number; d: Dir }>(), sk = start.y * g.w + start.x, queue = [start]; prev.set(sk, { k: -1, d: 'up' });
  for (let i = 0; i < queue.length; i++) {
    const t = queue[i]; if (goal(t) && i > 0 || goal(t) && run.runner.t < 1 && i === 0) { let k = t.y * g.w + t.x, first: Dir | null = null; while (k !== sk) { const p = prev.get(k)!; first = p.d; k = p.k; } return first ?? run.runner.dir; }
    for (const d of exits(g, t)) { const n = step(g, t, d), k = n.y * g.w + n.x; if (prev.has(k) || avoid.has(k)) continue; prev.set(k, { k: t.y * g.w + t.x, d }); queue.push(n); }
  }
  return null;
}
export function mazeBot(run: NeonMazeRun): void {
  if (run.phase !== 'playing') return;
  run.input.up = run.input.down = run.input.left = run.input.right = false;
  const g = run.grid, here = run.tile, threats = run.sentinels.filter(s => s.state === 'active' && !s.scared && s.kind !== 'drone');
  // Keep out of every tile a hunter could reach in the next couple of steps (drones only block their own tile).
  const avoid = new Set<number>();
  for (const s of threats) {
    if (s.kind === 'drone') { avoid.add(s.at.y * g.w + s.at.x); continue; }
    const reach = s.kind === 'warden' ? 2 : 3, dist = distances(g, s.at); for (let k = 0; k < dist.length; k++) if (dist[k] >= 0 && dist[k] <= reach) avoid.add(k);
  }
  avoid.delete(here.y * g.w + here.x);
  const go = (goal: (t: Tile) => boolean) => { const d = route(run, goal, avoid) ?? route(run, goal, new Set()); if (d) run.steer(d); return d; };
  // A hunter within three steps: take the exit that keeps the most distance from all of them.
  const maps = threats.map(s => distances(g, s.t >= .5 ? s.at : s.from)), danger = (t: Tile) => Math.min(99, ...maps.map(m => { const v = m[t.y * g.w + t.x]; return v < 0 ? 99 : v; }));
  if (threats.length && danger(here) <= 3 && run.stun <= 1) {
    const options = exits(g, here).map(d => ({ d, v: danger(step(g, here, d)) })).sort((a, b) => b.v - a.v);
    if (options[0] && options[0].v > danger(here)) { run.steer(options[0].d); if (danger(here) <= 1 && run.dashCool <= 0) { run.want = options[0].d; run.phaseDash(); } return; }
  }
  // Trouble ahead: dash away from a hunter about to touch you.
  const pos = run.position, close = threats.find(s => { const p = near(s); return Math.hypot(p.x - pos.x, p.y - pos.y) < 1.4; });
  if (close && run.dashCool <= 0) { const p = near(close), away = (Object.keys(DIRS) as Dir[]).sort((a, b) => ((pos.x + DIRS[b].x - p.x) ** 2 + (pos.y + DIRS[b].y - p.y) ** 2) - ((pos.x + DIRS[a].x - p.x) ** 2 + (pos.y + DIRS[a].y - p.y) ** 2)); for (const d of away) { run.want = d; if (run.phaseDash()) return; } }
  // Frozen sentinels nearby are points (and, for the Warden, the way out).
  if (run.stun > 1) { const prey = run.sentinels.filter(s => s.state === 'active' && s.scared).map(s => ({ s, p: near(s) })).filter(e => Math.hypot(e.p.x - pos.x, e.p.y - pos.y) < (run.sector.warden && e.s.kind === 'warden' ? 14 : 6)); if (prey.length) { const target = prey.sort((a, b) => Number(b.s.kind === 'warden') - Number(a.s.kind === 'warden'))[0]; if (go(t => Math.abs(t.x - target.p.x) + Math.abs(t.y - target.p.y) < 1)) return; } }
  const gems = g.gems.filter((_, i) => !run.gemsTaken[i]);
  if (!run.exitOpen && gems.length) {
    if (go(t => gems.some(gem => gem.x === t.x && gem.y === t.y))) return;
    // A sealed gem: stand two tiles away across the wall, press toward it and dash.
    for (const gem of gems) for (const d of Object.keys(DIRS) as Dir[]) {
      const spot = { x: gem.x - DIRS[d].x * 2, y: gem.y - DIRS[d].y * 2 }; if (!isOpen(g, spot.x, spot.y) || isOpen(g, gem.x - DIRS[d].x, gem.y - DIRS[d].y)) continue;
      if (here.x === spot.x && here.y === spot.y && run.runner.t >= 1) { run.want = d; if (run.dashCool <= 0) run.phaseDash(); return; }
      if (go(t => t.x === spot.x && t.y === spot.y)) return;
    }
  }
  if (run.exitOpen) { if (!route(run, t => t.x === g.exit.x && t.y === g.exit.y, new Set())) { dashOut(run); return; } go(t => t.x === g.exit.x && t.y === g.exit.y); return; }
  // Waiting for a gem to come back on the Warden's sector: keep moving, away from trouble.
  const d = route(run, t => Math.abs(t.x - here.x) + Math.abs(t.y - here.y) > 6, avoid); if (d) run.steer(d); else run.steer(OPPOSITE[run.runner.dir]);
}
/** Inside a sealed room: press toward a wall with open floor behind it, and dash. */
function dashOut(run: NeonMazeRun) {
  const g = run.grid, here = run.tile;
  for (const d of Object.keys(DIRS) as Dir[]) { const to = { x: here.x + DIRS[d].x * 2, y: here.y + DIRS[d].y * 2 }; if (isOpen(g, to.x, to.y) && !isOpen(g, here.x + DIRS[d].x, here.y + DIRS[d].y)) { run.want = d; if (run.runner.t >= 1) run.phaseDash(); return; } }
}
export function playSector(level: number, bot: (run: NeonMazeRun) => void = mazeBot, limit = 300, setup?: (run: NeonMazeRun) => void) {
  const run = new NeonMazeRun(); setup?.(run); run.launch(true); if (level > 1) { run.level = level; (run as unknown as { setup(): void }).setup(); }
  let t = 0; for (; t < limit && run.phase === 'playing'; t += 1 / 60) { bot(run); run.step(1 / 60); }
  return { won: run.phase === 'cleared', time: t, lost: run.config.lives - run.lives, run };
}
