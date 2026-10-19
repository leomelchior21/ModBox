import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { slingersCatalog } from './catalog';
import { SlingersRun } from './run';
import { SlingersView } from '../three-kit/arcade-views';
import '../three-kit/world.css';

export const makitaSlingersSpec: PremiumGameSpec<SlingersRun> = {
  id: 'makita-slingers', title: 'MAKITA SLINGERS', eyebrow: "SCRAPYARD PHYSICS. SERIOUSLY SHARP.", description: "Pull back a sawblade and turn towering robot fortresses into flying scrap. Break the supports, set off chain reactions, and make every blade count.",
  instructions: "Drag the blade backward and release. Or use Up/Down to aim and Space to fire. E blasts an upgraded blade in flight.", goal: "LET THE SCRAP FLY.",
  width: 1000, height: 640, catalog: slingersCatalog, controls: [{"label":"AIM ↑","action":"up"},{"label":"FIRE BLADE","action":"primary","primary":true},{"label":"AIM ↓","action":"down"},{"label":"BLAST · E","action":"ability"}],
  create: checkpoint => new SlingersRun(checkpoint), createView: (canvas, run) => new SlingersView(canvas, run),
};
export function SlingersScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={makitaSlingersSpec} />; }
