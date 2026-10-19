import type { PlayableGame } from '../types';
import { slingersCatalog } from './catalog';
export const makitaSlingers: PlayableGame = {
  id: 'makita-slingers', title: 'MAKITA SLINGERS', genre: 'sawblade slingshot · tower destruction', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#183f3d" /><image href="/art/makita-slingers/logo.svg" x="24" y="65" width="352" height="110" /></svg>,
  hero: { src: '/art/makita-slingers/cover.webp', alt: "Pull back a sawblade and turn towering robot fortresses into flying scrap. Break the supports, set off chain reactions, and make every blade count." },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: slingersCatalog.missions,
  loadScreen: () => import('./SlingersScreen').then(module => ({ default: module.SlingersScreen })),
};
