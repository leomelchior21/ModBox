import type { PlayableGame } from '../types';
import { GameTeaser } from '../../components/GameTeaser';
import { MAZE_MISSIONS } from './missions';

/** Preserve the original cabinet ID and theme when making it playable. */
export const neonMaze: PlayableGame = {
  id: 'maze', title: 'NEON MAZE', genre: 'labyrinth chase', cardStyle: 'maze', status: 'play',
  Cover: () => <GameTeaser kind="maze" />,
  hero: { src: '/art/neon-maze-hero.png', alt: 'A glowing probe racing through a vast neon labyrinth' },
  languages: ['python', 'swift', 'csharp'], starterMissionId: 'm00', sandboxMissionId: 'free', missions: MAZE_MISSIONS,
  loadScreen: () => import('./NeonMazeScreen').then(module => ({ default: module.NeonMazeScreen })),
};
