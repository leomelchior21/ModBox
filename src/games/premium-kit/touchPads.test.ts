import { describe, expect, it } from 'vitest';
import { touchPads } from './touchPads';
import type { ArcadeControl } from './PremiumScreen';

const labels = (list: readonly ArcadeControl[]) => list.map(c => c.label);
describe('tablet thumb clusters', () => {
  it('mirrors steering into both corners and puts the main action beside the right thumb', () => {
    const pads = touchPads([{ label: 'LEFT', action: 'left' }, { label: 'JUMP', action: 'primary', primary: true }, { label: 'SLIDE', action: 'down' }, { label: 'RIGHT', action: 'right' }, { label: 'BOARD', action: 'ability' }]);
    expect(pads.dpad).toBe(false); expect(labels(pads.left)).toEqual(['LEFT', 'SLIDE']); expect(labels(pads.right)).toEqual(['RIGHT', 'JUMP', 'BOARD']);
  });
  it('gives a single-button game its main action in the right corner', () => {
    const pads = touchPads([{ label: 'DROP', action: 'primary', primary: true }, { label: 'FOCUS', action: 'ability' }]);
    expect(pads.left).toEqual([]); expect(labels(pads.right)).toEqual(['DROP', 'FOCUS']);
  });
  it('builds a D-pad when a game steers in four directions', () => {
    const pads = touchPads([{ label: 'L', action: 'left' }, { label: 'U', action: 'up' }, { label: 'D', action: 'down' }, { label: 'R', action: 'right' }, { label: 'RUSH', action: 'ability', primary: true }]);
    expect(pads.dpad).toBe(true); expect(labels(pads.left)).toEqual(['L', 'R', 'U', 'D']); expect(labels(pads.right)).toEqual(['RUSH']);
  });
  it('puts a held throttle under the right thumb and both steering buttons under the left', () => {
    const pads = touchPads([{ label: 'LEFT', action: 'left', hold: 'left' }, { label: 'DRIVE', action: 'up', hold: 'up', primary: true }, { label: 'RIGHT', action: 'right', hold: 'right' }, { label: 'DOCK', action: 'primary' }]);
    expect(labels(pads.left)).toEqual(['LEFT', 'RIGHT']); expect(labels(pads.right)).toEqual(['DRIVE', 'DOCK']);
  });
  it('keeps pinball flippers on opposite thumbs', () => {
    const pads = touchPads([{ label: 'LEFT', action: 'left', hold: 'left' }, { label: 'KICK OFF', action: 'primary', primary: true }, { label: 'RIGHT', action: 'right', hold: 'right' }, { label: 'POWER', action: 'ability' }]);
    expect(labels(pads.left)).toEqual(['LEFT']); expect(labels(pads.right)).toEqual(['RIGHT', 'KICK OFF', 'POWER']);
  });
});
