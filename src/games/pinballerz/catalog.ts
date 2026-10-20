import { createArcadeCatalog } from '../premium-kit/catalog';
export const pinballCatalog = createArcadeCatalog({
  title: 'PINBALLERZ', palettes: ['neon', 'sunset', 'ice'],
  defaults: { palette: 'neon', playerName: 'Midnight Player', power: 900, speed: 1, gravity: 900, assist: false, overdrive: false, lives: 3, bonus: 100 },
  power: { name: 'flipperPower', label: 'FLIPPER COILS', blurb: 'How fast the flippers swing, and how hard they hit.', min: 600, max: 1300, goal: 1100 },
  assist: { name: 'ballSave', label: 'SECOND CHANCE', blurb: 'Your first drain in eight seconds returns the ball.', instruction: 'Launch a ball and use the flippers. An early drain activates the save.' },
  bonus: { name: 'bumperValue', label: 'BUMPER BOUNTY', blurb: 'Points per jet-bumper strike.', min: 50, max: 300, goal: 150 },
  physics: { key: 'gravity', name: 'tableGravity', label: 'TABLE PITCH', blurb: 'How strongly the table pulls the ball toward the drain.', min: 500, max: 1400, goal: 750 },
  overdrive: { name: 'jackpotMode', label: 'JACKPOT CIRCUIT', blurb: 'Double bumper points and double every multiball jackpot.' },
  lives: { name: 'balls', label: 'BALL RESERVE', min: 2, max: 5 },
  final: 'Complete the table mission and clear a full pinball stage.',
  runtime: { ramps: 'ramp shots this stage', drops: 'target banks cleared this stage' },
});
