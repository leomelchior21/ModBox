import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from '../router';

describe('game routes', () => {
  it('round-trips game, mission, language-selection origin and debug links', () => {
    const lab = { name: 'lab' as const, gameId: 'garden-test', missionId: 'intro', debug: true };
    const languages = { name: 'languages' as const, gameId: 'garden-test', missionId: 'intro', from: 'arcade' as const };
    expect(parseHash(routeToHash(lab))).toEqual(lab);
    expect(parseHash(routeToHash(languages))).toEqual(languages);
  });

  it('preserves older Vector Zero links without a game ID', () => {
    expect(parseHash('#/lab?mission=m02')).toEqual({ name: 'lab', missionId: 'm02', gameId: undefined, debug: false });
  });
});
