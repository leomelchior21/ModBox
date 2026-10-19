import { createArcadeCatalog } from '../premium-kit/catalog';
export const monsterCatalog = createArcadeCatalog({
  title: 'MONSTER STRIDER', palettes: ['amber', 'teal', 'violet'],
  defaults: { palette: 'amber', playerName: 'Bridge Breaker', power: 18, speed: 12, gravity: 22, assist: false, overdrive: false, lives: 3, bonus: 20 },
  power: { name: 'enginePower', label: 'TORQUE TALK', blurb: 'Acceleration and top speed. More power needs a lighter touch.', min: 10, max: 38, goal: 26 },
  assist: { name: 'autoBalance', label: 'KEEP IT LEVEL', blurb: 'Stabilize the truck in the air and soften rough landings.', instruction: 'Land a jump while the stabilizer is working.' },
  bonus: { name: 'coinValue', label: 'TRAIL TREASURE', blurb: 'Points for each floating trail coin.', min: 5, max: 100, goal: 40 },
  physics: { key: 'gravity', name: 'gravity', label: 'AIR TIME', blurb: 'Change jump arcs, suspension load and landings.', min: 10, max: 35, goal: 14 },
  overdrive: { name: 'nitro', label: 'BOTTLED LIGHTNING', blurb: 'Enable NITRO / E for a short rechargeable speed boost.' },
  lives: { name: 'spareTrucks', label: 'PIT CREW', min: 1, max: 8 },
  final: 'Cross the island bridges and reach the finish. Brake for rough landings; build speed before a gap.',
  runtime: { distance: 'meters along the trail', velocity: 'current speed in meters per second', airborne: '1 while airborne, 0 on the ground' },
  extraTools: [{ id: 'monster-air', name: 'airRule', label: 'LAND LIKE A PRO', type: 'condition', blurb: 'Engage your stabilizer only when the truck leaves the ground.', example: 'if (airborne > 0)\n{\n    autoBalance = true;\n}', glyph: '?', unlockAt: 0 }],
});
