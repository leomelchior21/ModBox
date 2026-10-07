import { describe, expect, it } from 'vitest';
import { mazeViewport } from './render';
import { NeonMazeRun } from './run';

describe('Rolling maze camera', () => {
  it.each([[700, 600], [600, 350], [330, 240]])('tracks the runner while showing many corridors at %sx%s', (width, height) => {
    const run = new NeonMazeRun(4);
    const before = mazeViewport(run, width, height, false);
    run.playerFrom = { x: 14, y: 25 }; run.player = { x: 14, y: 26 }; run.moveAge = 0.1;
    const after = mazeViewport(run, width, height, false);
    expect(after.cell).toBeGreaterThanOrEqual(12); expect(after.cell).toBeLessThanOrEqual(22);
    expect(after.viewWidth / after.cell).toBeGreaterThan(20);
    expect(after.viewHeight / after.cell).toBeGreaterThan(10);
    expect(after.scrollY).toBeGreaterThan(before.scrollY);
    expect(after.cell * run.maze.tiles.length).toBeGreaterThan(after.viewHeight);
    expect((after.player.x + 0.5) * after.cell - after.scrollX).toBeCloseTo(after.viewWidth / 2);
    expect((after.player.y + 0.5) * after.cell - after.scrollY).toBeCloseTo(after.viewHeight / 2);
  });
  it('smooths movement and phase jumps, with immediate tracking for reduced motion', () => {
    const run = new NeonMazeRun(1); run.playerFrom = { x: 2, y: 2 }; run.player = { x: 2, y: 5 }; run.moveAge = 0.06;
    expect(mazeViewport(run, 700, 600, false).player).toEqual({ x: 2, y: 3.5 });
    expect(mazeViewport(run, 700, 600, true).player).toEqual(run.player);
  });
  it('keeps the maze filling the viewport at its borders instead of revealing empty space', () => {
    const run = new NeonMazeRun(2);
    for (const position of [{ x: 1, y: 1 }, { x: run.maze.size - 2, y: run.maze.tiles.length - 2 }]) {
      run.player = position; run.playerFrom = position;
      const view = mazeViewport(run, 330, 400, true);
      expect(view.scrollX).toBeGreaterThanOrEqual(0); expect(view.scrollY).toBeGreaterThanOrEqual(0);
      expect(view.scrollX + view.viewWidth).toBeLessThanOrEqual(run.maze.size * view.cell);
      expect(view.scrollY + view.viewHeight).toBeLessThanOrEqual(run.maze.tiles.length * view.cell);
      expect((position.x + 0.5) * view.cell - view.scrollX).toBeGreaterThan(0);
      expect((position.y + 0.5) * view.cell - view.scrollY).toBeLessThan(view.viewHeight);
    }
  });
});
