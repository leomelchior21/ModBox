import type { PlayableGame } from '../types';
import { roombaCatalog } from './catalog';
export const roombaRun: PlayableGame = {
  id: 'roomba-run', title: 'ROOMBA RUN', genre: '3D cleaning simulator / a spotless little world', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#18343d" /><image href="/art/roomba-run/logo.svg" x="22" y="65" width="356" height="110" /></svg>,
  hero: { src: '/art/roomba-run/cover.webp', alt: 'ROOMBA RUN: an original stylized three-dimensional arcade adventure' },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: roombaCatalog.missions,
  loadScreen: () => import('./RoombaScreen').then(module => ({ default: module.RoombaScreen })),
};
