import type { PlayableGame } from '../types';
import { monsterCatalog } from './catalog';
export const monsterStrider: PlayableGame = {
  id: 'monster-strider', title: 'MONSTER STRIDER', genre: 'isometric stunt driving / islands and air time', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#18343d" /><image href="/art/monster-strider/logo.svg" x="22" y="65" width="356" height="110" /></svg>,
  hero: { src: '/art/monster-strider/cover.webp', alt: 'MONSTER STRIDER: an original stylized three-dimensional arcade adventure' },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: monsterCatalog.missions,
  loadScreen: () => import('./MonsterScreen').then(module => ({ default: module.MonsterScreen })),
};
