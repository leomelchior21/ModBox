import type { PlayableGame } from '../types';
import { mazeCatalog } from './catalog';
/** The original cabinet ID ("maze") is kept, so saves and links keep working. */
export const neonMaze: PlayableGame = {
  id: 'maze', title: 'NEON MAZE', genre: 'neon chase · chain, freeze, devour', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#0b0618" /><image href="/art/maze/logo.svg" x="24" y="65" width="352" height="110" /></svg>,
  hero: { src: '/art/maze/cover.webp', alt: 'A glowing orb rolls through a neon labyrinth, a ghost train of drones behind it and frozen sentinels ahead.' },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: mazeCatalog.missions,
  loadScreen: () => import('./NeonMazeScreen').then(module => ({ default: module.NeonMazeScreen })),
};
