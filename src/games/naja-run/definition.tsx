import type { PlayableGame } from '../types';
import { najaCatalog } from './catalog';
export const najaRun: PlayableGame = {
  id: 'naja-run', title: 'NAJA RUN', genre: 'temple snake · golden harvest', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#123b2d" /><image href="/art/naja-run/logo.svg" x="24" y="65" width="352" height="110" /></svg>,
  hero: { src: '/art/naja-run/cover.webp', alt: "Guide a jewel-scaled cobra through a forgotten temple. Gather glowing fruit and crystals, weave around your tail, and find your way to the next garden." },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: najaCatalog.missions,
  loadScreen: () => import('./NajaScreen').then(module => ({ default: module.NajaScreen })),
};
