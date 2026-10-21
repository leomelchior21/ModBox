import { createArcadeCatalog } from '../premium-kit/catalog';
export const monsterCatalog = createArcadeCatalog({
  title: 'MONSTER STRIDER', palettes: ['amber', 'teal', 'violet'],
  defaults: { palette: 'amber', playerName: 'Bridge Breaker', power: 18, speed: 12, gravity: 22, assist: false, overdrive: false, lives: 3, bonus: 20 },
  power: { name: 'enginePower', label: 'TORQUE TALK', blurb: 'Motor torque and top speed. More power climbs steps and pulls wheelies, so feather the throttle.', min: 10, max: 38, goal: 26 },
  assist: { name: 'autoBalance', label: 'KEEP IT LEVEL', blurb: 'A gyro that levels the truck in the air, stiffens the suspension and fights rollovers.', instruction: 'Land a jump while the stabilizer is working.' },
  bonus: { name: 'coinValue', label: 'TRAIL TREASURE', blurb: 'Points for each floating trail coin.', min: 5, max: 100, goal: 40 },
  physics: { key: 'gravity', name: 'gravity', label: 'AIR TIME', blurb: 'Real gravity for every body: the truck, bridge planks, seesaws and crates. Lower means floaty jumps.', min: 10, max: 35, goal: 14 },
  overdrive: { name: 'nitro', label: 'BOTTLED LIGHTNING', blurb: 'Enable NITRO / E for a short rechargeable rocket boost.' },
  lives: { name: 'spareTrucks', label: 'PIT CREW', min: 1, max: 8 },
  final: 'Cross the island courses and reach the checkered finish. Tilt in the air and keep the roof off the ground.',
  remix: {
    worldTheme: { label: 'RALLY WORLD', blurb: 'Race the "desert" canyons over a sand sea, the "arctic" ice floes, a glowing "lava" field or the "mars" dunes, where low gravity makes every jump huge.', values: ['classic', 'desert', 'arctic', 'lava', 'mars'] },
    characterStyle: { label: 'GARAGE', blurb: 'Swap the truck for a "robot" walker, an armoured "tank", a sleek "racer" or a giant "hotdog".', values: ['original', 'robot', 'tank', 'racer', 'hotdog'] },
    weather: { label: 'TRACK WEATHER', blurb: 'Rain and snow steal tyre grip (snow is ice racing), wind pushes the truck in the air and fog hides the next jump.', values: ['clear', 'rain', 'snow', 'wind', 'fog'] },
  },
  runtime: { distance: 'meters from the start line', velocity: 'current speed in meters per second', airborne: '1 while airborne, 0 on the ground', tilt: 'nose-up angle in degrees (negative is nose-down)' },
  extraTools: [{ id: 'monster-air', name: 'airRule', label: 'LAND LIKE A PRO', type: 'condition', blurb: 'Engage your stabilizer only when the truck leaves the ground.', example: 'if (airborne > 0)\n{\n    autoBalance = true;\n}', glyph: '?', unlockAt: 0 }],
});
