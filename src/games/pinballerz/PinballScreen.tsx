import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { pinballCatalog } from './catalog';
import { PinballRun } from './run';
import { PinballView } from '../three-kit/arcade-views';
import '../three-kit/world.css';

export const pinballerzSpec: PremiumGameSpec<PinballRun> = {
  id: 'pinballerz', title: 'PINBALLERZ', eyebrow: "CHROME. COILS. ONE MORE BALL.", description: "A midnight arcade in the palm of your hand. Work the flippers, light the star targets, and send a chrome ball roaring through a glowing jackpot circuit.",
  instructions: "Space launches or flips both paddles. Hold Left/Right or A/D for flippers. Touch either half of the table to flip. N nudges; three per stage.", goal: "MAKE SOME NOISE.",
  width: 640, height: 920, catalog: pinballCatalog, controls: [{"label":"LEFT FLIPPER","action":"left","hold":"left"},{"label":"LAUNCH / FLIP","action":"primary","primary":true},{"label":"RIGHT FLIPPER","action":"right","hold":"right"},{"label":"NUDGE · N","action":"nudge"}],
  create: checkpoint => new PinballRun(checkpoint), createView: (canvas, run) => new PinballView(canvas, run),
};
export function PinballScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={pinballerzSpec} />; }
