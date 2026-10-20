import { createArcadeCatalog } from '../premium-kit/catalog';
export const stackCatalog = createArcadeCatalog({
  title: 'SPEED STACK', palettes: ['candy', 'mint', 'coral'],
  defaults: { palette: 'candy', playerName: 'Skyline Architect', power: 8, speed: 135, gravity: 1, assist: false, overdrive: false, lives: 2, bonus: 75 },
  power: { name: 'perfectWindow', label: 'PERFECT TIMING', blurb: 'How close a placement must be to snap perfectly.', min: 3, max: 24, goal: 12 },
  assist: { name: 'magnetSnap', label: 'MAGNET SNAP', blurb: 'Adds a little extra forgiveness around a perfect placement.', instruction: 'Drop a block close to the tower to use magnetic alignment.' },
  bonus: { name: 'perfectBonus', label: 'SKYLINE BONUS', blurb: 'Bonus points for each perfect placement in a streak.', min: 25, max: 200, goal: 125 },
  physics: { key: 'speed', name: 'blockSpeed', label: 'BUILD TEMPO', blurb: 'The speed of the incoming slab.', min: 70, max: 260, goal: 180 },
  overdrive: { name: 'focusMode', label: 'SLOW THE MOMENT', blurb: 'Use FOCUS or E for a three-second timing window in slow motion.' },
  lives: { name: 'chances', label: 'SECOND CHANCES', min: 1, max: 4 },
  final: 'Stack every floor of a skyline and clear the stage.',
  runtime: { floors: 'floors stacked this stage', streak: 'perfect drops in a row' },
});
