import { describe, expect, it } from 'vitest';
import { cellKey, distances, generateMaze, mazeLines, neighbors, sameCell, walkable, type Maze } from './maze';
describe('Neon Maze generation', () => {
  it('keeps every core, exit and corridor reachable across sizes and seeds', () => {
    for (const size of [5, 7, 9]) for (let seed = 1; seed <= 35; seed++) {
      const maze = generateMaze(size, seed), reachable = distances(maze, maze.start);
      const floorCount = maze.tiles.flat().filter(Boolean).length;
      expect(maze.tiles.length).toBeGreaterThan(maze.size);
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
  it('offers loops and frequent junctions instead of trapping the player in dead ends', () => {
    for (const size of [5, 7, 9]) for (let seed = 1; seed <= 20; seed++) {
      const maze = generateMaze(size, seed), rooms = [];
      for (let y = 1; y < maze.tiles.length - 1; y += 2) for (let x = 1; x < maze.size - 1; x += 2) rooms.push({ x, y });
      expect(rooms.every(room => neighbors(maze, room).length >= 2)).toBe(true);
      expect(rooms.filter(room => neighbors(maze, room).length >= 3).length / rooms.length).toBeGreaterThan(0.3);
    }
  });
  it('draws continuous corridor edges without outlining individual wall blocks', () => {
    const maze: Maze = { size: 5, tiles: Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => y === 2 && x >= 1 && x <= 3)), start: { x: 1, y: 2 }, exit: { x: 3, y: 2 }, cores: [] };
    expect(mazeLines(maze)).toEqual([
      { from: { x: 1, y: 2 }, to: { x: 4, y: 2 } }, { from: { x: 1, y: 3 }, to: { x: 4, y: 3 } },
      { from: { x: 1, y: 2 }, to: { x: 1, y: 3 } }, { from: { x: 4, y: 2 }, to: { x: 4, y: 3 } },
    ]);
  });
});
