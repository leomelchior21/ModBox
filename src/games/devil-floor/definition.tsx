import type { PlayableGame } from '../types';
import { GameTeaser } from '../../components/GameTeaser';
import { FLOOR_MISSIONS } from './missions';

export const devilFloor: PlayableGame = {
  id: 'platform', title: 'DEVIL FLOOR', genre: 'lava platformer', cardStyle: 'platform', status: 'play',
  Cover: () => <GameTeaser kind="platform" />,
  hero: { src: '/art/devil-floor-hero.png', alt: 'An explorer jumping over a volcanic energy chasm' },
  languages: ['python', 'swift', 'csharp'], starterMissionId: 'm00', sandboxMissionId: 'free', missions: FLOOR_MISSIONS,
  loadScreen: () => import('./DevilFloorScreen').then(module => ({ default: module.DevilFloorScreen })),
};
