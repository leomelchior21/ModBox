import type { PlayableGame } from '../types';
import { templeCatalog } from './catalog';
export const templeRace: PlayableGame = {
  id: 'temple-race', title: 'TEMPLE RACE', genre: '3D jungle runner / relics and daring turns', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#18343d" /><image href="/art/temple-race/logo.svg" x="22" y="65" width="356" height="110" /></svg>,
  hero: { src: '/art/temple-race/cover.webp', alt: 'TEMPLE RACE: an original stylized three-dimensional arcade adventure' },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: templeCatalog.missions,
  loadScreen: () => import('./TempleScreen').then(module => ({ default: module.TempleScreen })),
};
