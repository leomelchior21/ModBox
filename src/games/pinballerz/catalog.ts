import { createArcadeCatalog } from '../premium-kit/catalog';
export const pinballCatalog = createArcadeCatalog({
  title: 'PINBALLERZ', palettes: ['neon', 'sunset', 'ice'],
  defaults: { palette: 'neon', playerName: 'Midnight Player', power: 850, speed: 1, gravity: 500, assist: false, overdrive: false, lives: 3, bonus: 100 },
  power: { name: 'flipperPower', label: 'FLIPPER COILS', blurb: 'Impulse from a well-timed flipper shot.', min: 600, max: 1300, goal: 950 },
  assist: { name: 'ballSave', label: 'SECOND CHANCE', blurb: 'Your first drain in seven seconds returns the ball.', instruction: 'Launch a ball and use the flippers. An early drain activates the save.' },
  bonus: { name: 'bumperValue', label: 'BUMPER BOUNTY', blurb: 'Points per jet-bumper strike.', min: 50, max: 300, goal: 150 },
  physics: { key: 'gravity', name: 'tableGravity', label: 'TABLE PITCH', blurb: 'How strongly the table pulls the ball toward the drain.', min: 300, max: 700, goal: 420 },
  overdrive: { name: 'jackpotMode', label: 'JACKPOT CIRCUIT', blurb: 'Double bumper scoring and boost the three-star jackpot.' },
  lives: { name: 'balls', label: 'BALL RESERVE', min: 2, max: 5 },
  final: 'Reach the table target and complete a full pinball stage.',
});
