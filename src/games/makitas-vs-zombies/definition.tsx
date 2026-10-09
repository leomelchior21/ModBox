import type { PlayableGame } from '../types';
import { YARD_MISSIONS } from './missions';
export const makitasVsZombies: PlayableGame = {
  id: 'makitas-vs-zombies', title: 'MAKITAS VS ZOMBIES', genre: 'workshop lane defense', cardStyle: 'makitas', status: 'play',
  Cover: () => <svg viewBox="0 0 300 180" aria-hidden="true"><rect width="300" height="180" fill="#123e34" /><circle cx="102" cy="98" r="44" fill="#c9d6cc" /><circle cx="102" cy="98" r="22" fill="#108a85" /><path d="M145 70h55v65h-55z" fill="#2da996" /><path d="m229 105-18-8 8-25 24 6 12 21-12 39h-26z" fill="#91ad69" /><circle cx="233" cy="91" r="5" fill="#fff6c7" /></svg>,
  hero: { src: '/art/makitas/cover.webp', alt: 'Teal circular saw turrets defending a sunset workshop yard from zombie construction workers' },
  languages: ['python', 'swift', 'csharp'], starterMissionId: 'm00', sandboxMissionId: 'free', missions: YARD_MISSIONS,
  loadScreen: () => import('./MakitasScreen').then(module => ({ default: module.MakitasScreen })),
};
