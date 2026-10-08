import { describe, expect, it } from 'vitest';
import { DevilFloorRun, LAVA_Y } from './run';
import { floorViewport } from './render';
describe('Devil Floor camera', () => {
  it.each([[760, 830], [344, 345], [416, 286]])('keeps the hero legible and the lava above controls at %sx%s', (width, height) => {
    const run = new DevilFloorRun(), view = floorViewport(run, width, height);
    expect(view.scale).toBeGreaterThanOrEqual(0.65);
    expect(run.player.y * view.scale + view.offsetY).toBeGreaterThanOrEqual(90);
    expect(LAVA_Y * view.scale + view.offsetY).toBeCloseTo(height - 76);
    run.player.x = 2000;
    expect(floorViewport(run, width, height).scrollX).toBeGreaterThan(0);
  });
  it('follows a high jump below the HUD and clamps the camera at the exit', () => {
    const run = new DevilFloorRun(); run.player.y = 150;
    const jump = floorViewport(run, 416, 286);
    expect(run.player.y * jump.scale + jump.offsetY).toBe(90);
    run.player.x = run.cavern.width;
    const end = floorViewport(run, 416, 286);
    expect(end.scrollX + end.viewWidth).toBeCloseTo(run.cavern.width);
  });
});
