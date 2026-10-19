import type { PlayableGame } from '../types';
import { teamCatalog } from './catalog';
export const teamCounters: PlayableGame = {
  id: 'team-counters', title: 'TEAM COUNTERS', genre: '3D crowd runner / make every number count', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#18343d" /><image href="/art/team-counters/logo.svg" x="22" y="65" width="356" height="110" /></svg>,
  hero: { src: '/art/team-counters/cover.webp', alt: 'TEAM COUNTERS: an original stylized three-dimensional arcade adventure' },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: teamCatalog.missions,
  loadScreen: () => import('./TeamScreen').then(module => ({ default: module.TeamScreen })),
};
