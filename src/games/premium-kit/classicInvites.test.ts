import { describe, expect, it } from 'vitest';
import { floorInvites, forgeInvites } from './classicInvites';
import { usableInvites } from './InviteList';
import { FLOOR_MODS } from '../devil-floor/mods';
import { FORGE_MODS } from '../block-forge/mods';

describe('classic game invites', () => {
  it('only targets real mods', () => {
    const ids = new Set<string>([...FLOOR_MODS, ...FORGE_MODS].map(m => m.id));
    for (const list of [floorInvites({ meltDelay: 4, lavaSpeed: 2 }, 'lose'), floorInvites({ meltDelay: 4, lavaSpeed: 2 }, 'win'), forgeInvites({}, 'lose'), forgeInvites({}, 'win')])
      for (const invite of list) expect(ids.has(invite.target), invite.target).toBe(true);
  });
  it('helps after a loss and challenges after a win', () => {
    expect(floorInvites({ doubleJump: false }, 'lose').every(i => i.tone === 'help')).toBe(true);
    expect(floorInvites({ lavaSpeed: 2, meltDelay: 4 }, 'win').some(i => i.tone === 'challenge')).toBe(true);
  });
  it('drops advice the student already took', () => {
    expect(forgeInvites({ showHints: true, rotations: true, allowUndo: true }, 'lose')).toEqual([]);
    expect(floorInvites({ shield: true }, 'lose').map(i => i.id)).not.toContain('floor-shield');
  });
  it('hides invites for mods that are still locked', () => {
    expect(usableInvites(floorInvites({}, 'lose'), ['shield']).map(i => i.target)).toEqual(['shield']);
  });
});
