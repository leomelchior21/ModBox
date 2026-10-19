import type { GameScreenProps } from '../types';
import { PremiumScreen, type PremiumGameSpec } from '../premium-kit/PremiumScreen';
import { stackCatalog } from './catalog';
import { StackRun } from './run';
import { StackView } from '../three-kit/arcade-views';
import '../three-kit/world.css';

export const speedStackSpec: PremiumGameSpec<StackRun> = {
  id: 'speed-stack', title: 'SPEED STACK', eyebrow: "FIND THE MOMENT. BUILD THE SKYLINE.", description: "Place jewel-colored slabs above the clouds. Every overhang gets cut away. Chain perfect placements to grow your tower wider and build a skyline worth chasing.",
  instructions: "Tap the tower, press Space, or use DROP SLAB when the edges align. Three perfects widen the tower. E activates an unlocked Focus slowdown.", goal: "ONE MORE FLOOR.",
  width: 840, height: 800, catalog: stackCatalog, controls: [{"label":"DROP SLAB · SPACE","action":"primary","primary":true},{"label":"FOCUS · E","action":"ability"}],
  create: checkpoint => new StackRun(checkpoint), createView: (canvas, run) => new StackView(canvas, run),
};
export function StackScreen(props: GameScreenProps): JSX.Element { return <PremiumScreen {...props} spec={speedStackSpec} />; }
