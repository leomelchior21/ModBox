import type { PlayableGame } from '../types';
import { subwayCatalog } from './catalog';
export const subwayRunnerz: PlayableGame = {
  id: 'subway-runnerz', title: 'SUBWAY RUNNERZ', genre: '3D rail runner / rooftops and hoverboards', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#18343d" /><image href="/art/subway-runnerz/logo.svg" x="22" y="65" width="356" height="110" /></svg>,
  hero: { src: '/art/subway-runnerz/cover.webp', alt: 'SUBWAY RUNNERZ: an original stylized three-dimensional arcade adventure' },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: subwayCatalog.missions,
  loadScreen: () => import('./SubwayScreen').then(module => ({ default: module.SubwayScreen })),
};
