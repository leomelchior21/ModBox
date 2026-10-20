import { createArcadeCatalog } from '../premium-kit/catalog';
export const teamCatalog = createArcadeCatalog({
  title: 'TEAM COUNTERS', palettes: ['azure', 'violet', 'gold', 'teal'],
  defaults: { palette: 'azure', playerName: 'The Count Crew', power: 0, speed: 7, gravity: 22, assist: false, overdrive: false, lives: 3, bonus: 25 },
  power: { name: 'recruitBonus', label: 'MORE THE MERRIER', blurb: 'Extra runners recruited through each positive gate.', min: 0, max: 30, goal: 10 },
  assist: { name: 'gatePreview', label: 'DO THE MATH', blurb: 'Show each gate’s projected crowd and highlight the better result.', instruction: 'Pass a gate with projected results switched on.' },
  bonus: { name: 'battleValue', label: 'VICTORY LAP', blurb: 'Points for winning a crowd clash.', min: 10, max: 150, goal: 60 },
  physics: { key: 'speed', name: 'runSpeed', label: 'SET THE PACE', blurb: 'More speed means less time to choose a gate.', min: 3, max: 15, goal: 10 },
  overdrive: { name: 'teamShield', label: 'STRENGTH TOGETHER', blurb: 'Enable SHIELD / E to block one blade or halve your losses in one fight.' },
  lives: { name: 'rallyTokens', label: 'RALLY AGAIN', min: 1, max: 7 },
  final: 'Grow your crowd, beat the red army and climb the multiplier stairs. Smart gate choices beat bigger numbers.',
  remix: {
    worldTheme: { label: 'RACE COURSE', blurb: 'Race over a "candy" land and its chocolate river, a "beach" runway above turquoise water, a "space" station among the planets or a "volcano" path over lava.', values: ['classic', 'candy', 'beach', 'space', 'volcano'] },
    characterStyle: { label: 'CROWD LOOK', blurb: 'Turn both armies into "robot" troops, waddling "penguin" squads, "knight" brigades or "alien" visitors.', values: ['original', 'robot', 'penguin', 'knight', 'alien'] },
    weather: { label: 'RACE WEATHER', blurb: 'Wind pushes your whole crowd sideways, rain makes steering slide, snow slows the march and an "aurora" lights the sky.', values: ['clear', 'snow', 'rain', 'wind', 'aurora'] },
  },
  runtime: { distance: 'meters along the course', team: 'current runners in your crew', gates: 'gates passed this stage' },
  extraTools: [{ id: 'team-comeback', name: 'comebackRule', label: 'COMEBACK CREW', type: 'condition', blurb: 'Small crowd? Recruit ten extra runners at the next positive gate.', example: 'if (team < 20)\n{\n    recruitBonus = 10;\n}', glyph: '?', unlockAt: 0 }],
});
