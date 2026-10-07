import { describe, expect, it } from 'vitest';
import { cellKey, distances, generateMaze, sameCell, walkable } from './maze';
describe('Neon Maze generation', () => {
  it('keeps every core, exit and corridor reachable across sizes and seeds', () => {
    for (const size of [5, 7, 9]) for (let seed = 1; seed <= 35; seed++) {
      const maze = generateMaze(size, seed), reachable = distances(maze, maze.start);
      const floorCount = maze.tiles.flat().filter(Boolean).length;
      expect(reachable.size).toBe(floorCount);
      expect(walkable(maze, maze.exit)).toBe(true);
      expect(reachable.get(cellKey(maze.exit))).toBeGreaterThan(5);
      expect(maze.cores).toHaveLength(3);
      expect(new Set(maze.cores.map(cellKey)).size).toBe(3);
      expect(maze.cores.every(c => reachable.has(cellKey(c)) && !sameCell(c, maze.start) && !sameCell(c, maze.exit))).toBe(true);
      expect(maze.tiles[0].every(tile => !tile) && maze.tiles.at(-1)!.every(tile => !tile)).toBe(true);
    }
  });
  it('reproduces a sector from its seed and changes between sectors', () => {
    expect(generateMaze(7, 12)).toEqual(generateMaze(7, 12));
    expect(generateMaze(7, 12).tiles).not.toEqual(generateMaze(7, 13).tiles);
  });
});
