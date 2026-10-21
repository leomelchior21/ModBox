import { createArcadeCatalog } from '../premium-kit/catalog';
export const roombaCatalog = createArcadeCatalog({
  title: 'ROOMBA RUN', palettes: ['mint', 'coral', 'ice'],
  defaults: { palette: 'mint', playerName: 'Dust Buster', power: 55, speed: 4, gravity: 22, assist: false, overdrive: false, lives: 3, bonus: 5 },
  power: { name: 'suction', label: 'SUCTION SATISFACTION', blurb: 'Increase cleaning radius and how fast stubborn dirt disappears.', min: 25, max: 150, goal: 85 },
  assist: { name: 'smartRoute', label: 'LET IT THINK', blurb: 'Find routes around furniture, chase remaining dirt and recharge automatically.', instruction: 'Let the robot clean a patch using its smart route.' },
  bonus: { name: 'cleanValue', label: 'SPOTLESS PAYDAY', blurb: 'Points for each patch of floor you finish cleaning.', min: 1, max: 25, goal: 10 },
  physics: { key: 'speed', name: 'driveSpeed', label: 'ZOOMBA', blurb: 'Change movement speed. Slow passes clean more deeply.', min: 2, max: 10, goal: 6 },
  overdrive: { name: 'turboBrush', label: 'TURBO TIDY', blurb: 'Enable TURBO / E for a wider, stronger clean that uses more battery.' },
  lives: { name: 'batteryPacks', label: 'SPARE BATTERIES', min: 1, max: 8 },
  final: 'Clean at least 90 percent of the accessible floor, then return to the glowing dock.',
  remix: {
    worldTheme: { label: 'HOUSE STYLE', blurb: 'Clean a "castle" hall with banners and torches, a "spaceship" deck, a "candy" house or a "jungle" treehouse.', values: ['classic', 'castle', 'spaceship', 'candy', 'jungle'] },
    characterStyle: { label: 'ROBOT SHELL', blurb: 'Give the vacuum a "robot" shell, a "cat" passenger, a flying-saucer "ufo" body or "tank" tracks.', values: ['original', 'robot', 'cat', 'ufo', 'tank'] },
    weather: { label: 'HOUSE CHAOS', blurb: 'A "party" drops confetti on clean floor, "pets" track muddy paws, "night" turns the lights off and a "storm" makes the power flicker and drain your battery.', values: ['clear', 'party', 'pets', 'night', 'storm'] },
  },
  runtime: { battery: 'remaining battery percent', cleaned: 'accessible floor cleaned, percent', patches: 'finished patches of floor' },
  extraTools: [{ id: 'roomba-battery', name: 'batteryRule', label: 'HOME BEFORE EMPTY', type: 'condition', blurb: 'Let the smart route take over when battery falls below 25 percent.', example: 'if (battery <= 25)\n{\n    smartRoute = true;\n}', glyph: '?', unlockAt: 0 }, { id: 'roomba-finish', name: 'finishRule', label: 'THE FINAL SWEEP', type: 'condition', blurb: 'Make the turbo brush available halfway through the job.', example: 'if (cleaned >= 50)\n{\n    turboBrush = true;\n}', glyph: '?', unlockAt: 0 }],
});
