import { createArcadeCatalog } from '../premium-kit/catalog';
/** NEON MAZE keeps the variable names of the original game (moveSpeed, sentinels, shield, gemDuration…), so old code still runs. */
export const mazeCatalog = createArcadeCatalog({
  title: 'NEON MAZE', palettes: ['neon'], signatureName: 'runnerName',
  defaults: { palette: 'neon', playerName: 'Echo', power: 4, speed: 2, gravity: 0, assist: false, overdrive: false, lives: 3, bonus: 50 },
  power: { name: 'moveSpeed', label: 'MOVE SPEED', blurb: 'How fast your runner rolls through the corridors.', min: 1, max: 10, goal: 6 },
  assist: { name: 'shield', label: 'SHIELD', blurb: 'Absorbs one hit from a sentinel, then recharges in eight seconds.', instruction: 'Play until the shield saves you from a sentinel.' },
  bonus: { name: 'coreValue', label: 'GEM VALUE', blurb: 'Points for each amber gem. Catching frozen sentinels pays double, then doubles again.', min: 25, max: 500, goal: 100 },
  physics: { key: 'speed', name: 'sentinelSpeed', label: 'HUNTER SPEED', blurb: 'How fast the sentinels move. 1 is a crawl, 6 is a blur.', min: 1, max: 6, goal: 1 },
  overdrive: { name: 'timeWarp', label: 'TIME WARP', blurb: 'Press E (or WARP) to slow every sentinel to a crawl for four seconds.' },
  lives: { name: 'spareOrbs', label: 'SPARE ORBS', min: 1, max: 9 },
  final: 'Clear a whole sector: three gems, then roll into the exit before your spare orbs run out.',
  remix: {
    worldTheme: { label: 'GRID STYLE', blurb: 'Rebuild the labyrinth: "arcade" 1980 cabinet, "matrix" code rain, "ocean" bioluminescent abyss or a "sunset" vaporwave grid.', values: ['classic', 'arcade', 'matrix', 'ocean', 'sunset'], glyph: '◈' },
    characterStyle: { label: 'RUNNER', blurb: 'Roll as a "comet" with a fiery tail, a flying "ufo", a "cube" from an 8-bit game or a hungry "chomper".', values: ['original', 'comet', 'ufo', 'cube', 'chomper'], glyph: '●' },
    weather: { label: 'SIGNAL', blurb: 'Live interference: "static" makes walls flicker out, "blackout" shrinks your light, a "storm" lights the maze only in flashes, "snow" slows everyone.', values: ['clear', 'static', 'blackout', 'storm', 'snow'], glyph: '≋' },
  },
  runtime: { actions: 'turns and dashes', dots: 'dots collected in this sector', cores: 'gems collected in this sector', stun: 'seconds the sentinels stay frozen', flow: 'dot streak multiplier, 1 to 8', train: 'drones following you right now', steps: 'tiles travelled', energy: 'orbs left, as a percentage' },
  extraMods: [
    { id: 'rivals', name: 'sentinels', type: 'int', label: 'SENTINELS', blurb: 'Extra hunters on top of each sector’s squad: chasers, interceptors, flankers and gem guards.', example: 'int sentinels = 2;', limits: { min: 0, max: 5 }, defaultValue: 0, glyph: '◇', unlockAt: 0 },
    { id: 'sleepers', name: 'sleepers', type: 'int', label: 'GHOST TRAIN', blurb: 'Extra sleeping drones. They wake as you pass and follow you in a train: eat them all with one gem.', example: 'int sleepers = 8;', limits: { min: 0, max: 16 }, defaultValue: 0, glyph: '∴', unlockAt: 0 },
    { id: 'gemDuration', name: 'gemDuration', type: 'int', label: 'GEM STUN', blurb: 'How many seconds an amber gem freezes the sentinels.', example: 'int gemDuration = 9;', limits: { min: 2, max: 12 }, defaultValue: 6, glyph: '❄', unlockAt: 0 },
    { id: 'phaseLength', name: 'phaseLength', type: 'int', label: 'PHASE DASH', blurb: 'How many tiles a dash (SPACE) jumps, straight through walls.', example: 'int phaseLength = 3;', limits: { min: 1, max: 4 }, defaultValue: 2, glyph: '↠', unlockAt: 0 },
    { id: 'mazeSize', name: 'mazeSize', type: 'int', label: 'MAZE SIZE', blurb: 'How many rooms wide each labyrinth is. Applies to the next sector or a retry.', example: 'int mazeSize = 9;', limits: { min: 5, max: 9 }, defaultValue: 7, glyph: '▦', unlockAt: 0 },
    { id: 'revealMap', name: 'revealMap', type: 'bool', label: 'ROOM LIGHTS', blurb: 'Light up the whole maze, even in dark sectors and blackouts, and show a map.', example: 'bool revealMap = true;', defaultValue: false, glyph: '◉', unlockAt: 0 },
    { id: 'trail', name: 'trail', type: 'bool', label: 'LIGHT TRAIL', blurb: 'Leave a glowing ribbon behind your runner.', example: 'bool trail = false;', defaultValue: true, glyph: '⌁', unlockAt: 0 },
    { id: 'wallColor', name: 'wallColor', type: 'string', label: 'NEON COLOR', blurb: 'Rewire the neon of the walls: "cyan", "violet", "lime", "amber" or "pink". "theme" uses the grid style’s own colour.', example: 'string wallColor = "lime";', values: ['theme', 'cyan', 'violet', 'lime', 'amber', 'pink'], defaultValue: 'theme', glyph: '◆', unlockAt: 0 },
    { id: 'difficulty', name: 'sentinelBrain', type: 'string', label: 'HUNTER BRAINS', blurb: 'How clever the hunters are: "sleepy" ones wander off, "genius" ones predict your route and never rest.', example: 'string sentinelBrain = "sleepy";', values: ['sleepy', 'normal', 'smart', 'genius'], defaultValue: 'normal', glyph: '▲', unlockAt: 0 },
  ],
  extraTools: [
    { id: 'maze-math', name: 'speedMath', label: 'SPEED MATH', type: 'int', blurb: 'Add two to your movement speed.', example: 'moveSpeed = moveSpeed + 2;', glyph: '+', unlockAt: 0 },
    { id: 'maze-train', name: 'trainRule', label: 'TRAIN ALARM', type: 'condition', blurb: 'When five drones follow you, freeze the sentinels for longer.', example: 'if (train >= 5)\n{\n    gemDuration = 10;\n}', glyph: '?', unlockAt: 0 },
    { id: 'maze-escape', name: 'escapeRule', label: 'ESCAPE RULE', type: 'condition', blurb: 'On your last orb, dash further.', example: 'if (lives <= 1)\n{\n    phaseLength = 4;\n}', glyph: '≤', unlockAt: 0 },
  ],
});
