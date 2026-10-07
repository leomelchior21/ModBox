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
  const size = cells * 4 + 1, height = cells * 6 + 1;
  const tiles = Array.from({ length: height }, () => Array<boolean>(size).fill(false));
  const start = { x: cells * 2 - 1, y: cells * 3 % 2 ? cells * 3 : cells * 3 - 1 }, stack = [start];
  tiles[start.y][start.x] = true;
  while (stack.length) {
    const current = stack.at(-1)!;
    const choices = Object.values(DIRECTIONS).map(d => ({ x: current.x + d.x * 2, y: current.y + d.y * 2 }))
      .filter(c => c.x > 0 && c.y > 0 && c.x < size - 1 && c.y < height - 1 && !tiles[c.y][c.x]);
    if (!choices.length) { stack.pop(); continue; }
    const next = choices[Math.floor(random() * choices.length)];
    tiles[(next.y + current.y) / 2][(next.x + current.x) / 2] = true;
    tiles[next.y][next.x] = true; stack.push(next);
  }
  // Braid dead ends into loops, then add junctions so every chase offers route choices.
  for (let y = 1; y < height - 1; y += 2) for (let x = 1; x < size - 1; x += 2) {
    const exits = Object.values(DIRECTIONS).filter(d => tiles[y + d.y][x + d.x]);
    if (exits.length === 1) {
      const choices = Object.values(DIRECTIONS).filter(d => {
        const nx = x + d.x * 2, ny = y + d.y * 2;
        return nx > 0 && ny > 0 && nx < size - 1 && ny < height - 1 && !tiles[y + d.y][x + d.x];
      });
      if (choices.length) { const d = choices[Math.floor(random() * choices.length)]; tiles[y + d.y][x + d.x] = true; }
    }
    for (const d of [DIRECTIONS.right, DIRECTIONS.down]) {
      if (x + d.x * 2 < size - 1 && y + d.y * 2 < height - 1 && random() < 0.22) tiles[y + d.y][x + d.x] = true;
    }
  }
  const maze: Maze = { size, tiles, start, exit: start, cores: [] };
  const ordered = [...distances(maze, start)].sort((a, b) => b[1] - a[1]);
  const fromKey = (key: string): Cell => { const [x, y] = key.split(',').map(Number); return { x, y }; };
  maze.exit = fromKey(ordered[0][0]);
  const candidates = ordered.filter(([key, distance]) => key !== cellKey(maze.exit) && distance >= 5);
  for (const fraction of [0.15, 0.45, 0.8]) maze.cores.push(fromKey(candidates[Math.floor((candidates.length - 1) * fraction)][0]));
  return maze;
}

export interface MazeLine { from: Cell; to: Cell }

/** Only corridor boundaries become walls. Merge adjacent edges into neon lines. */
export function mazeLines(maze: Maze): MazeLine[] {
  const horizontal = new Map<number, number[]>(), vertical = new Map<number, number[]>();
  const edge = (lines: Map<number, number[]>, axis: number, start: number) => {
    const starts = lines.get(axis) ?? []; starts.push(start); lines.set(axis, starts);
  };
  for (let y = 0; y < maze.tiles.length; y++) for (let x = 0; x < maze.size; x++) {
    if (!walkable(maze, { x, y })) continue;
    if (!walkable(maze, { x, y: y - 1 })) edge(horizontal, y, x);
    if (!walkable(maze, { x, y: y + 1 })) edge(horizontal, y + 1, x);
    if (!walkable(maze, { x: x - 1, y })) edge(vertical, x, y);
    if (!walkable(maze, { x: x + 1, y })) edge(vertical, x + 1, y);
  }
  const result: MazeLine[] = [];
  const merge = (lines: Map<number, number[]>, horizontal: boolean) => {
    for (const [axis, starts] of lines) {
      starts.sort((a, b) => a - b);
      let from = starts[0], to = from + 1;
      const push = () => result.push(horizontal
        ? { from: { x: from, y: axis }, to: { x: to, y: axis } }
        : { from: { x: axis, y: from }, to: { x: axis, y: to } });
      for (const start of starts.slice(1)) {
        if (start === to) to++; else { push(); from = start; to = start + 1; }
      }
      push();
    }
  };
  merge(horizontal, true); merge(vertical, false); return result;
}
