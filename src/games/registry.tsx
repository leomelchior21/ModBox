import { GameTeaser } from '../components/GameTeaser';
import { createGameRegistry } from './createRegistry';
import { vectorZero } from './vector-zero/definition';
import { neonMaze } from './neon-maze/definition';

/** Register a finished game's definition here to expose it in both libraries. */
export const gameRegistry = createGameRegistry([
  vectorZero,
  { id: 'runner', title: 'RUNNER', genre: 'endless runner', status: 'coming-soon', Cover: () => <GameTeaser kind="runner" />,
    hero: { src: '/art/runner-hero.png', alt: 'A geometric robot courier leaping across a futuristic city' } },
  neonMaze,
  { id: 'platform', title: 'DEVIL FLOOR', genre: 'vector platformer', status: 'coming-soon', Cover: () => <GameTeaser kind="platform" />,
    hero: { src: '/art/devil-floor-hero.png', alt: 'An explorer jumping over a volcanic energy chasm' } },
]);
