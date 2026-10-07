import { cellKey, DIRECTIONS, distances, neighbors, sameCell, walkable, type Cell, type Direction, type Maze } from './maze';

export const SENTINEL_COLORS = ['#ff5b9d', '#4feaff', '#ae82ff', '#ffcb69'];
export const sentinelInterval = (speed: number) => 1 / (speed + 2.5);
export const sentinelMode = (elapsed: number): 'chase' | 'scatter' => elapsed % 16 < 12 ? 'chase' : 'scatter';

function closestFloor(maze: Maze, target: Cell): Cell {
  if (walkable(maze, target)) return target;
  return [...distances(maze, maze.start).keys()].map(key => {
    const [x, y] = key.split(',').map(Number); return { x, y };
  }).sort((a, b) => Math.abs(a.x - target.x) + Math.abs(a.y - target.y) - Math.abs(b.x - target.x) - Math.abs(b.y - target.y))[0];
}

/** Each hunter has a different target, but all navigate the actual corridors. */
export function sentinelTargets(maze: Maze, player: Cell, facing: Direction, sentinels: readonly Cell[], collected: ReadonlySet<string>, elapsed: number): Cell[] {
  const corners = [{ x: maze.size - 2, y: 1 }, { x: 1, y: 1 }, { x: maze.size - 2, y: maze.size - 2 }, { x: 1, y: maze.size - 2 }];
  let ahead = { ...player };
  for (let i = 0; i < 4; i++) {
    const next = { x: ahead.x + DIRECTIONS[facing].x, y: ahead.y + DIRECTIONS[facing].y };
    if (!walkable(maze, next)) break;
    ahead = next;
  }
  const runnerPaths = distances(maze, player);
  const core = maze.cores.filter(c => !collected.has(cellKey(c)))
    .sort((a, b) => (runnerPaths.get(cellKey(a)) ?? Infinity) - (runnerPaths.get(cellKey(b)) ?? Infinity))[0] ?? maze.exit;
  return sentinels.map((_, i) => {
    if (sentinelMode(elapsed) === 'scatter') return closestFloor(maze, corners[i % 4]);
    switch (i % 4) {
      case 0: return player;
      case 1: return ahead;
      case 2: return closestFloor(maze, { x: ahead.x * 2 - sentinels[0].x, y: ahead.y * 2 - sentinels[0].y });
      default: return core;
    }
  });
}

export function steerSentinels(maze: Maze, sentinels: readonly Cell[], previous: readonly Cell[], targets: readonly Cell[], allowReverse = false): Cell[] {
  const reserved = new Set<string>();
  return sentinels.map((sentinel, i) => {
    const exits = neighbors(maze, sentinel);
    const forward = exits.filter(cell => !previous[i] || !sameCell(cell, previous[i]));
    const choices = !allowReverse && forward.length ? forward : exits;
    const paths = distances(maze, targets[i]);
    choices.sort((a, b) => {
      const cost = (cell: Cell) => (paths.get(cellKey(cell)) ?? Infinity) + (reserved.has(cellKey(cell)) ? maze.size : 0);
      return cost(a) - cost(b);
    });
    const next = choices[0] ?? sentinel; reserved.add(cellKey(next)); return { ...next };
  });
}
