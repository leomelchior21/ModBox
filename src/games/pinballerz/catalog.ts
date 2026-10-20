import { createArcadeCatalog } from '../premium-kit/catalog';
export const pinballCatalog = createArcadeCatalog({
  title: 'PINBALLERZ', palettes: ['neon', 'sunset', 'ice'],
  defaults: { palette: 'neon', playerName: 'Pitch Wizard', power: 900, speed: 1, gravity: 800, assist: false, overdrive: false, lives: 3, bonus: 500 },
  power: { name: 'kickPower', label: 'BOOT POWER', blurb: 'How fast the flippers swing, and how hard they strike the ball.', min: 600, max: 1300, goal: 1100 },
  assist: { name: 'superKeeper', label: 'SUPER KEEPER', blurb: 'Your goalkeeper chases the ball and dives to save shots.', instruction: 'Play until your keeper makes a save.' },
  bonus: { name: 'goalPoints', label: 'GOLDEN GOALS', blurb: 'Points for every goal, before combos and trick-shot bonuses.', min: 100, max: 2000, goal: 1000 },
  physics: { key: 'gravity', name: 'pitchTilt', label: 'PITCH TILT', blurb: 'How strongly the pitch slopes the ball back toward your goal.', min: 500, max: 1400, goal: 650 },
  overdrive: { name: 'powerShot', label: 'POWER SHOT', blurb: 'Enable POWER / E: your next flipper strike fires a blazing shot at the goal.' },
  lives: { name: 'matchBalls', label: 'BALL RACK', min: 2, max: 5 },
  final: 'Win a full match: score the goals your stage needs before your ball rack runs out.',
  remix: {
    worldTheme: { label: 'STADIUM', blurb: 'Choose the stadium: "bernabeu" in Madrid, the Yellow Wall in "dortmund", the "maracana" in Rio or the Arch in "wembley". The home team plays in its own colours.', values: ['classic', 'bernabeu', 'dortmund', 'maracana', 'wembley'] },
    characterStyle: { label: 'TEAM KIT', blurb: 'Pick your jerseys: "red", "blue", "yellow", "white", zebra "stripes" or a "robot" squad. The home team changes kit if the colours clash.', values: ['original', 'red', 'blue', 'yellow', 'white', 'stripes', 'robot'] },
    weather: { label: 'MATCH WEATHER', blurb: 'Watch it roll in live. Rain makes the ball skid, snow makes it heavy, fog hides the far goal and a storm blows it sideways.', values: ['clear', 'rain', 'snow', 'fog', 'storm'] },
  },
  runtime: { goals: 'goals scored this stage', streak: 'goals in a row without losing a ball', saves: 'saves by your goalkeeper this stage' },
  extraMods: [
    { id: 'teammates', name: 'teammates', type: 'int', label: 'SQUAD GOALS', blurb: 'Put up to four teammates in your kit on the pitch. They pass the ball toward goal.', example: 'int teammates = 2;', limits: { min: 0, max: 4 }, defaultValue: 0, glyph: '⚑', unlockAt: 0 },
    { id: 'rivals', name: 'extraDefenders', type: 'int', label: 'RIVAL SQUAD', blurb: 'Send on up to four extra defenders for the home team.', example: 'int extraDefenders = 2;', limits: { min: 0, max: 4 }, defaultValue: 0, glyph: '⛨', unlockAt: 0 },
    { id: 'balls', name: 'ballsInPlay', type: 'int', label: 'MULTIBALL MADNESS', blurb: 'How many balls start at every kick-off. Only the last one costs you.', example: 'int ballsInPlay = 2;', limits: { min: 1, max: 3 }, defaultValue: 1, glyph: '◎', unlockAt: 0 },
    { id: 'difficulty', name: 'difficulty', type: 'string', label: 'MATCH LEVEL', blurb: 'How fast the rival keeper and defenders react.', example: 'string difficulty = "easy";', values: ['easy', 'normal', 'hard', 'pro'], defaultValue: 'normal', glyph: '▲', unlockAt: 0 },
    { id: 'celebration', name: 'celebration', type: 'string', label: 'GOAL PARTY', blurb: 'Choose the goal celebration: confetti, fireworks, a keeper backflip or smoke flares.', example: 'string celebration = "fireworks";', values: ['confetti', 'fireworks', 'backflip', 'flares'], defaultValue: 'confetti', glyph: '✺', unlockAt: 0 },
    { id: 'crowd', name: 'crowdSize', type: 'int', label: 'FULL HOUSE', blurb: 'How full the stands are, from 0 to 100 percent. A bigger crowd cheers louder.', example: 'int crowdSize = 100;', limits: { min: 0, max: 100 }, defaultValue: 70, glyph: '☺', unlockAt: 0 },
  ],
  extraTools: [{ id: 'pin-hattrick', name: 'hatTrickRule', label: 'HAT-TRICK HERO', type: 'condition', blurb: 'After three goals in a row, play every kick-off with two balls.', example: 'if (streak >= 3)\n{\n    ballsInPlay = 2;\n}', glyph: '?', unlockAt: 0 }],
});
