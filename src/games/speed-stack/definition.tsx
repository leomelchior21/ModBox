import type { PlayableGame } from '../types';
import { stackCatalog } from './catalog';
export const speedStack: PlayableGame = {
  id: 'speed-stack', title: 'SPEED STACK', genre: 'skyline stacker · perfect timing', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#29223e" /><image href="/art/speed-stack/logo.svg" x="24" y="65" width="352" height="110" /></svg>,
  hero: { src: '/art/speed-stack/cover.webp', alt: "Place jewel-colored slabs above the clouds. Every overhang gets cut away. Chain perfect placements to grow your tower wider and build a skyline worth chasing." },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: stackCatalog.missions,
  loadScreen: () => import('./StackScreen').then(module => ({ default: module.StackScreen })),
};
