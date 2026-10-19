import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { najaCatalog } from './catalog';
import { NajaRun } from './run';
import { NajaView } from '../three-kit/arcade-views';
import '../three-kit/world.css';

export const najaRunSpec: PremiumGameSpec<NajaRun> = {
  id: 'naja-run', title: 'NAJA RUN', eyebrow: "A GOLDEN TRAIL. A GROWING LEGEND.", description: "Guide a jewel-scaled cobra through a forgotten temple. Gather glowing fruit and crystals, weave around your tail, and find your way to the next garden.",
  instructions: "Swipe or use arrow keys to turn. Gather five fruits, avoid stones and your own tail. E activates an unlocked Jade Rush shield.", goal: "FOLLOW YOUR INSTINCT.",
  width: 720, height: 720, catalog: najaCatalog, controls: [{"label":"← LEFT","action":"left"},{"label":"↑ UP","action":"up"},{"label":"↓ DOWN","action":"down"},{"label":"RIGHT →","action":"right"},{"label":"JADE RUSH","action":"ability","primary":true}],
  create: checkpoint => new NajaRun(checkpoint), createView: (canvas, run) => new NajaView(canvas, run),
};
export function NajaScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={najaRunSpec} />; }
