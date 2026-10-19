import { createArcadeCatalog } from '../premium-kit/catalog';
export const templeCatalog = createArcadeCatalog({
  title: 'TEMPLE RACE', palettes: ['jade', 'gold', 'orchid'],
  defaults: { palette: 'jade', playerName: 'Relic Runner', power: 9, speed: 10, gravity: 22, assist: false, overdrive: false, lives: 3, bonus: 20 },
  power: { name: 'jumpPower', label: 'LEAP OF FAITH', blurb: 'Jump higher and stay airborne longer.', min: 7, max: 15, goal: 12 },
  assist: { name: 'coinMagnet', label: 'RELIC MAGNET', blurb: 'Pull nearby coins across lanes.', instruction: 'Collect a coin from another lane with the magnet.' },
  bonus: { name: 'coinValue', label: 'GOLD STANDARD', blurb: 'Points for each ancient coin.', min: 5, max: 100, goal: 35 },
  physics: { key: 'speed', name: 'runSpeed', label: 'CHASE THE HORIZON', blurb: 'Tune running speed and obstacle reaction time.', min: 6, max: 20, goal: 13 },
  overdrive: { name: 'relicShield', label: 'ANCIENT AEGIS', blurb: 'Enable AEGIS / E for a rechargeable shield. It also rescues a missed turn.' },
  lives: { name: 'charms', label: 'LUCKY CHARMS', min: 1, max: 8 },
  final: 'Reach the temple beacon. Turn at marked corners, leap gaps and duck fallen branches.',
  runtime: { distance: 'meters travelled', coins: 'coins collected this stage', streak: 'coins since your last crash' },
  extraTools: [{ id: 'temple-distance', name: 'distanceRule', label: 'THE LONG RUN', type: 'condition', blurb: 'Make your shield available after 100 meters.', example: 'if (distance >= 100)\n{\n    relicShield = true;\n}', glyph: '?', unlockAt: 0 }],
});
