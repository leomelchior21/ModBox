/**
 * Neon labyrinths on a tile grid: true is open floor, false is wall. Corridors are one tile wide, carved on odd
 * coordinates, then braided so there are no dead ends and every chase offers a choice of routes.
 */
export interface Tile { x: number; y: number }
export interface Grid { w: number; h: number; open: boolean[][]; start: Tile; exit: Tile; gems: Tile[]; portals: [Tile, Tile] | null }
export const DIRS = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } } as const;
export type Dir = keyof typeof DIRS;
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const key = (t: Tile) => t.y * 1000 + t.x;
export const isOpen = (g: Grid, x: number, y: number) => g.open[y]?.[x] === true;

export function random(seed: number) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/** Steps from a tile in a direction, wrapping through the side tunnels when a sector has them. */
export function step(g: Grid, t: Tile, d: Dir): Tile {
  const n = { x: t.x + DIRS[d].x, y: t.y + DIRS[d].y };
  if (g.portals) { const [a, b] = g.portals; if (t.x === a.x && t.y === a.y && n.x < 0) return { ...b }; if (t.x === b.x && t.y === b.y && n.x >= g.w) return { ...a }; }
  return n;
}
export function exits(g: Grid, t: Tile): Dir[] { return (Object.keys(DIRS) as Dir[]).filter(d => { const n = step(g, t, d); return isOpen(g, n.x, n.y); }); }
/** Walking distances (in tiles) from one tile to every reachable tile. */
export function distances(g: Grid, from: Tile): Int16Array {
  const dist = new Int16Array(g.w * g.h).fill(-1), queue = [from]; dist[from.y * g.w + from.x] = 0;
  for (let i = 0; i < queue.length; i++) { const t = queue[i]; for (const d of exits(g, t)) { const n = step(g, t, d), k = n.y * g.w + n.x; if (dist[k] < 0) { dist[k] = dist[t.y * g.w + t.x] + 1; queue.push(n); } } }
  return dist;
}
export const distAt = (g: Grid, dist: Int16Array, t: Tile) => dist[t.y * g.w + t.x];

/** Carves a braided maze of `cols × rows` rooms. `loops` adds extra junctions; `portals` opens side tunnels. */
export function carve(cols: number, rows: number, seed: number, loops = .22, portals = false): Grid {
  const rnd = random(seed), w = cols * 2 + 1, h = rows * 2 + 1;
  const open = Array.from({ length: h }, () => Array<boolean>(w).fill(false));
  const start = { x: (cols % 2 ? cols : cols - 1), y: h - 2 }, stack = [start]; open[start.y][start.x] = true;
  while (stack.length) {
    const c = stack.at(-1)!, choices = Object.values(DIRS).map(d => ({ x: c.x + d.x * 2, y: c.y + d.y * 2 })).filter(n => n.x > 0 && n.y > 0 && n.x < w - 1 && n.y < h - 1 && !open[n.y][n.x]);
    if (!choices.length) { stack.pop(); continue; }
    const n = choices[Math.floor(rnd() * choices.length)]; open[(n.y + c.y) / 2][(n.x + c.x) / 2] = true; open[n.y][n.x] = true; stack.push(n);
  }
  for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) {
    const walls = Object.values(DIRS).filter(d => !open[y + d.y][x + d.x] && x + d.x * 2 > 0 && y + d.y * 2 > 0 && x + d.x * 2 < w - 1 && y + d.y * 2 < h - 1);
    const doors = 4 - Object.values(DIRS).filter(d => !open[y + d.y][x + d.x]).length;
    if (doors === 1 && walls.length) { const d = walls[Math.floor(rnd() * walls.length)]; open[y + d.y][x + d.x] = true; }
    for (const d of [DIRS.right, DIRS.down]) if (x + d.x * 2 < w - 1 && y + d.y * 2 < h - 1 && rnd() < loops) open[y + d.y][x + d.x] = true;
  }
  const g: Grid = { w, h, open, start, exit: start, gems: [], portals: null };
  if (portals) { const y = rows % 2 ? rows : rows + 1; open[y][0] = open[y][w - 1] = true; g.portals = [{ x: 0, y }, { x: w - 1, y }]; }
  // The exit is the farthest room; three gems sit along the way, spread out.
  const dist = distances(g, start), rooms: { t: Tile; d: number }[] = [];
  for (let y = 1; y < h; y += 2) for (let x = 1; x < w; x += 2) if (open[y][x]) rooms.push({ t: { x, y }, d: distAt(g, dist, { x, y }) });
  rooms.sort((a, b) => b.d - a.d); g.exit = rooms[0].t;
  const far = rooms.filter(r => r.d >= 6 && (r.t.x !== g.exit.x || r.t.y !== g.exit.y));
  for (const f of [.12, .45, .78]) { const r = far[Math.min(far.length - 1, Math.floor((far.length - 1) * f))]; if (!g.gems.some(t => t.x === r.t.x && t.y === r.t.y)) g.gems.push(r.t); }
  return g;
}
/** Walls a room in on every side, so only a phase dash through the wall reaches it. */
export function seal(g: Grid, t: Tile) { for (const d of Object.values(DIRS)) if (g.open[t.y + d.y]?.[t.x + d.x] !== undefined && t.y + d.y > 0 && t.x + d.x > 0 && t.y + d.y < g.h - 1 && t.x + d.x < g.w - 1) g.open[t.y + d.y][t.x + d.x] = false; }
