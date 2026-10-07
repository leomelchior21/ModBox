export interface Cell { x: number; y: number }
export interface Maze { size: number; tiles: boolean[][]; start: Cell; exit: Cell; cores: Cell[] }
export const DIRECTIONS = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } } as const;
export type Direction = keyof typeof DIRECTIONS;
export const cellKey = (cell: Cell) => `${cell.x},${cell.y}`;
export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export const walkable = (maze: Maze, cell: Cell) => maze.tiles[cell.y]?.[cell.x] === true;
export function neighbors(maze: Maze, cell: Cell): Cell[] {
  return Object.values(DIRECTIONS).map(d => ({ x: cell.x + d.x, y: cell.y + d.y })).filter(c => walkable(maze, c));
}
export function distances(maze: Maze, start: Cell): Map<string, number> {
  const result = new Map([[cellKey(start), 0]]), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const next of neighbors(maze, current)) {
      if (result.has(cellKey(next))) continue;
      result.set(cellKey(next), result.get(cellKey(current))! + 1); queue.push(next);
    }
  }
  return result;
}

/** Seeded carving keeps every sector connected and tests reproducible. */
export function generateMaze(cells = 7, seed = 1): Maze {
  let state = seed >>> 0 || 1;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  cells = Math.max(5, Math.min(9, Math.trunc(cells)));
  const size = cells * 2 + 1, tiles = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const start = { x: 1, y: 1 }, stack = [start]; tiles[1][1] = true;
  while (stack.length) {
    const current = stack.at(-1)!;
    const choices = Object.values(DIRECTIONS).map(d => ({ x: current.x + d.x * 2, y: current.y + d.y * 2 }))
      .filter(c => c.x > 0 && c.y > 0 && c.x < size - 1 && c.y < size - 1 && !tiles[c.y][c.x]);
    if (!choices.length) { stack.pop(); continue; }
    const next = choices[Math.floor(random() * choices.length)];
    tiles[(next.y + current.y) / 2][(next.x + current.x) / 2] = true;
    tiles[next.y][next.x] = true; stack.push(next);
  }
  // A few cross-links give the runner escape routes around pursuing sentinels.
  for (let i = 0; i < cells * 3; i++) {
    const x = 1 + Math.floor(random() * (size - 2)), y = 1 + Math.floor(random() * (size - 2));
    if (!tiles[y][x] && ((tiles[y][x - 1] && tiles[y][x + 1]) || (tiles[y - 1][x] && tiles[y + 1][x]))) tiles[y][x] = true;
  }
  const maze: Maze = { size, tiles, start, exit: start, cores: [] };
  const ordered = [...distances(maze, start)].sort((a, b) => b[1] - a[1]);
  const fromKey = (key: string): Cell => { const [x, y] = key.split(',').map(Number); return { x, y }; };
  maze.exit = fromKey(ordered[0][0]);
  const candidates = ordered.filter(([key, distance]) => key !== cellKey(maze.exit) && distance >= 5);
  for (const fraction of [0.15, 0.45, 0.8]) maze.cores.push(fromKey(candidates[Math.floor((candidates.length - 1) * fraction)][0]));
  return maze;
}
