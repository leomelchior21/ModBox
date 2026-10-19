import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { monsterCatalog } from './catalog';
import { MonsterRun } from './run';
import { MonsterView } from './view';
import '../three-kit/world.css';

export const monsterSpec: PremiumGameSpec<MonsterRun> = {
  id: 'monster-strider', title: 'MONSTER STRIDER', eyebrow: 'BIG TIRES. TINY MARGIN FOR ERROR.',
  description: 'A pocket-sized stunt expedition over a sunlit island chain. Feel the suspension work, fly the gaps and find the perfect balance of courage and brakes.',
  instructions: 'Hold Right / GO to accelerate. Left / BRAKE slows and reverses. Tap the right or left half of the world for the same controls. Space hops; E uses enabled nitro.', goal: 'TAKE THE HIGH ROAD.',
  width: 1000, height: 760, catalog: monsterCatalog,
  controls: [{ label: '← BRAKE', action: 'left', hold: 'left' }, { label: 'HOP · SPACE', action: 'primary' }, { label: 'GO →', action: 'right', hold: 'right', primary: true }, { label: 'NITRO · E', action: 'ability' }],
  create: checkpoint => new MonsterRun(checkpoint), createView: (canvas, run) => new MonsterView(canvas, run),
  objective: run => ({ label: 'CROSS THE ISLANDS · 133m', value: run.x, max: run.goal }),
  features: ['FEEL THE GRIP', 'HUNT TRAIL GOLD', 'TUNE YOUR NITRO', 'CROSS THE LINE'],
};
export function MonsterScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={monsterSpec} />; }
