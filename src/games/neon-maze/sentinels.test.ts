import { describe, expect, it } from 'vitest';
import { cellKey, neighbors, type Cell, type Maze } from './maze';
import { sentinelInterval, sentinelMode, sentinelTargets, steerSentinels } from './sentinels';

function openMaze(): Maze {
  return { size: 11, tiles: Array.from({ length: 11 }, (_, y) => Array.from({ length: 11 }, (_, x) => x > 0 && y > 0 && x < 10 && y < 10)),
    start: { x: 1, y: 1 }, exit: { x: 9, y: 9 }, cores: [{ x: 5, y: 7 }, { x: 9, y: 1 }, { x: 1, y: 9 }] };
}
describe('Sentinel squad', () => {
  it('targets the runner, the route ahead, the flank and the nearest remaining core', () => {
    const maze = openMaze(), player = { x: 3, y: 3 }, hunters = [{ x: 8, y: 7 }, { x: 1, y: 1 }, { x: 7, y: 8 }, { x: 9, y: 9 }];
    const targets = sentinelTargets(maze, player, 'right', hunters, new Set(), 0);
    expect(targets).toEqual([player, { x: 7, y: 3 }, { x: 6, y: 1 }, maze.cores[0]]);
    expect(sentinelTargets(maze, player, 'right', hunters, new Set([cellKey(maze.cores[0])]), 0)[3]).not.toEqual(maze.cores[0]);
    expect(sentinelTargets(maze, player, 'right', hunters, new Set(maze.cores.map(cellKey)), 0)[3]).toEqual(maze.exit);
  });
  it('projects interception along a corridor without aiming through a wall', () => {
    const maze = openMaze(); maze.tiles[3][5] = false;
    const targets = sentinelTargets(maze, { x: 3, y: 3 }, 'right', [{ x: 1, y: 1 }, { x: 1, y: 2 }], new Set(), 0);
    expect(targets[1]).toEqual({ x: 4, y: 3 });
  });
  it('alternates timed chase and scatter, independent of player movement', () => {
    expect([0, 11.9, 12, 15.9, 16, 28].map(sentinelMode)).toEqual(['chase', 'chase', 'scatter', 'scatter', 'chase', 'scatter']);
    const maze = openMaze(), hunters = Array<Cell>(4).fill({ x: 5, y: 5 });
    expect(sentinelTargets(maze, { x: 3, y: 3 }, 'right', hunters, new Set(), 12)).toEqual([{ x: 9, y: 1 }, { x: 1, y: 1 }, { x: 9, y: 9 }, { x: 1, y: 9 }]);
  });
  it('avoids reversing at junctions, but can reverse at dead ends or on mode changes', () => {
    const maze = openMaze(), hunter = { x: 4, y: 4 }, previous = { x: 3, y: 4 };
    expect(steerSentinels(maze, [hunter], [previous], [previous])[0]).not.toEqual(previous);
    expect(steerSentinels(maze, [hunter], [previous], [previous], true)[0]).toEqual(previous);
    for (const next of neighbors(maze, hunter)) if (cellKey(next) !== cellKey(previous)) maze.tiles[next.y][next.x] = false;
    expect(steerSentinels(maze, [hunter], [previous], [previous])[0]).toEqual(previous);
  });
  it('takes a legal shortest-path step and spreads out hunters competing for the same tile', () => {
    const maze = openMaze(), hunters = [{ x: 3, y: 3 }, { x: 4, y: 2 }], target = { x: 7, y: 3 };
    const moves = steerSentinels(maze, hunters, [], [target, target]);
    expect(moves[0]).toEqual({ x: 4, y: 3 }); expect(moves[1]).not.toEqual(moves[0]);
    expect(moves.every((move, i) => neighbors(maze, hunters[i]).some(cell => cellKey(cell) === cellKey(move)))).toBe(true);
    expect(sentinelInterval(4)).toBeLessThan(sentinelInterval(1));
  });
});
