import type { PlayableGame } from '../types';
import { MISSIONS } from '../../learning/missions';
import { VectorZeroCover } from './VectorZeroCover';

export const vectorZero: PlayableGame = {
  id: 'vector-zero', title: 'VECTOR ZERO', genre: 'programmable space shooter', status: 'play',
  cardStyle: 'vector',
  Cover: VectorZeroCover,
  hero: { src: '/art/modbox-crt-space.png', alt: 'An orange and white starfighter racing past glowing asteroids' },
  languages: ['python', 'swift', 'csharp'], starterMissionId: 'm00', sandboxMissionId: 'free', missions: MISSIONS,
  loadScreen: () => import('./VectorZeroScreen').then(module => ({ default: module.VectorZeroScreen })),
};
