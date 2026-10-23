import type { PlayableGame } from '../types';
import { anominersCatalog } from './catalog';
export const anominers: PlayableGame = {
  id: 'anominers', title: 'ANOMINERS', genre: 'cozy asteroid mining · fight or flee the anomaly', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#1b2638" /><image href="/art/anominers/logo.svg" x="24" y="65" width="352" height="110" /></svg>,
  hero: { src: '/art/anominers/cover.webp', alt: 'A tiny mining ship drills a glowing asteroid in two-tone retro pixels while the anomaly ring opens nearby.' },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: anominersCatalog.missions,
  loadScreen: () => import('./AnominersScreen').then(module => ({ default: module.AnominersScreen })),
};
