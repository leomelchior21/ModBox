import type { PlayableGame } from '../types';
import { tomatinaCatalog } from './catalog';
export const tomatina: PlayableGame = {
  id: 'tomatina', title: 'TOMATINA', genre: 'first-person tomato fight · paint the town red', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#f7ecc8" /><image href="/art/tomatina/logo.svg" x="24" y="65" width="352" height="110" /></svg>,
  hero: { src: '/art/tomatina/cover.webp', alt: 'A first-person tomato fight in a two-tone Spanish street: lob tomatoes at the cleaning robots and paint the town red.' },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: tomatinaCatalog.missions,
  loadScreen: () => import('./TomatinaScreen').then(module => ({ default: module.TomatinaScreen })),
};
