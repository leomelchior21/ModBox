import { createArcadeCatalog } from '../premium-kit/catalog';
export const subwayCatalog = createArcadeCatalog({
  title: 'SUBWAY RUNNERZ', palettes: ['neon', 'sunset', 'violet'],
  defaults: { palette: 'neon', playerName: 'Metro Mischief', power: 9, speed: 12, gravity: 22, assist: false, overdrive: false, lives: 3, bonus: 10 },
  power: { name: 'jumpPower', label: 'SUPER SNEAKERS', blurb: 'Bigger jumps open new routes over the trains.', min: 7, max: 16, goal: 13 },
  assist: { name: 'coinMagnet', label: 'POCKET MAGNET', blurb: 'Collect coins from adjacent tracks.', instruction: 'Collect an off-track coin with the magnet.' },
  bonus: { name: 'coinValue', label: 'CITY GOLD', blurb: 'Points earned for each rail token.', min: 5, max: 100, goal: 25 },
  physics: { key: 'speed', name: 'runSpeed', label: 'METRO TEMPO', blurb: 'Change the pace of the city chase.', min: 7, max: 24, goal: 16 },
  overdrive: { name: 'hoverboard', label: 'BOARD CULTURE', blurb: 'Enable BOARD / E: surf a glowing board and absorb one crash.' },
  lives: { name: 'chances', label: 'SECOND WIND', min: 1, max: 8 },
  final: 'Reach the station. Dodge trains, climb ramps onto their roofs and follow the coin trails.',
  remix: {
    worldTheme: { label: 'METRO LINE', blurb: 'Run another line: "tokyo" neon nights with cherry blossoms, the "beach" line by the sea, the "arctic" express or the "mars" colony, where jumps float in low gravity.', values: ['classic', 'tokyo', 'beach', 'arctic', 'mars'] },
    characterStyle: { label: 'RUNNER STYLE', blurb: 'Become a "skater" with a board, a "ninja", a "robot" or an "astronaut".', values: ['original', 'skater', 'ninja', 'robot', 'astronaut'] },
    weather: { label: 'CITY WEATHER', blurb: 'Rain makes slides longer and lanes slippery, snow slows the run, fog hides what is coming and a storm brings lightning.', values: ['clear', 'rain', 'snow', 'fog', 'storm'] },
  },
  runtime: { distance: 'meters travelled', coins: 'coins collected this stage', streak: 'coin chain since your last crash' },
  extraTools: [{ id: 'subway-chain', name: 'coinRule', label: 'EARN YOUR BOARD', type: 'condition', blurb: 'Collect ten coins to make a hoverboard available.', example: 'if (coins >= 10)\n{\n    hoverboard = true;\n}', glyph: '?', unlockAt: 0 }],
});
