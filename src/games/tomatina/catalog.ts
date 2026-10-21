import { createArcadeCatalog } from '../premium-kit/catalog';
export const tomatinaCatalog = createArcadeCatalog({
  title: 'TOMATINA', palettes: ['fiesta'],
  defaults: { palette: 'fiesta', playerName: 'Tomato Kid', power: 18, speed: 5, gravity: 9, assist: false, overdrive: false, lives: 3, bonus: 100 },
  power: { name: 'throwPower', label: 'THROWING ARM', blurb: 'How fast your tomatoes fly. A stronger arm throws flatter and further.', min: 10, max: 30, goal: 24 },
  assist: { name: 'autoAim', label: 'TOMATO RADAR', blurb: 'Your tomatoes curve toward the nearest robot.', instruction: 'Throw until a radar tomato curves into a robot.' },
  bonus: { name: 'splatPoints', label: 'SPLAT POINTS', blurb: 'Points for every robot you splat, before combos and trick-shot bonuses.', min: 50, max: 1000, goal: 300 },
  physics: { key: 'gravity', name: 'tomatoGravity', label: 'TOMATO GRAVITY', blurb: 'How fast tomatoes fall. Low gravity makes long, floaty moon arcs; high gravity drops them close.', min: 2, max: 20, goal: 4 },
  overdrive: { name: 'tomatoRain', label: 'TOMATO RAIN', blurb: 'Press E (or RAIN) to make tomatoes pour from the sky onto every robot near you.' },
  lives: { name: 'dryShirts', label: 'SPARE SHIRTS', min: 1, max: 9 },
  final: 'Finish a full street: complete every goal before your spare shirts run out.',
  remix: {
    worldTheme: { label: 'TOWN', blurb: 'Take the fiesta on tour: the "boqueria" market in Barcelona, the "alhambra" in Granada, the "metro" in Madrid or Gaudí\'s "guell" park. Each town has its own walls and inks.', values: ['classic', 'boqueria', 'alhambra', 'metro', 'guell'], glyph: '⌂' },
    characterStyle: { label: 'THROWER', blurb: 'Who throws: a "chef", a rebel "robot", a "knight", your "abuela" with her oven mitt or "luchador" the wrestler. Changes your arm and your face.', values: ['original', 'chef', 'robot', 'knight', 'abuela', 'luchador'], glyph: '✋' },
    weather: { label: 'FIESTA WEATHER', blurb: 'Rain washes your paint away, wind pushes tomatoes sideways, fog and night hide you (and the robots).', values: ['clear', 'rain', 'wind', 'fog', 'night'], glyph: '☂' },
  },
  runtime: { actions: 'tomatoes thrown', splats: 'robots splatted this street', paint: 'percent of the street painted red', tomatoes: 'tomatoes in your bag', dry: 'how dry you are (100 = bone dry)', combo: 'robots splatted in a row' },
  extraMods: [
    { id: 'splash', name: 'tomatoSize', type: 'int', label: 'TOMATO SIZE', blurb: 'Bigger tomatoes paint wider splats. From size 4 the splash splats robots standing nearby too.', example: 'int tomatoSize = 4;', limits: { min: 1, max: 5 }, defaultValue: 2, glyph: '●', unlockAt: 0 },
    { id: 'bounces', name: 'bounces', type: 'int', label: 'BOUNCY TOMATOES', blurb: 'How many times a tomato ricochets off walls before it splats. Bank shots around corners!', example: 'int bounces = 2;', limits: { min: 0, max: 5 }, defaultValue: 0, glyph: '↯', unlockAt: 0 },
    { id: 'ammo', name: 'bagSize', type: 'int', label: 'TOMATO BAG', blurb: 'How many tomatoes you can carry. Crates and splatted robots refill it.', example: 'int bagSize = 40;', limits: { min: 5, max: 99 }, defaultValue: 20, glyph: '⊛', unlockAt: 0 },
    { id: 'speed', name: 'runSpeed', type: 'int', label: 'RUNNING SHOES', blurb: 'How fast you run through the streets, in metres per second.', example: 'int runSpeed = 8;', limits: { min: 2, max: 10 }, defaultValue: 5, glyph: '»', unlockAt: 0 },
    { id: 'rivals', name: 'extraRobots', type: 'int', label: 'ROBOT INVASION', blurb: 'Send extra Limpiabots into every street.', example: 'int extraRobots = 4;', limits: { min: 0, max: 8 }, defaultValue: 0, glyph: '⚙', unlockAt: 0 },
    { id: 'difficulty', name: 'robotLevel', type: 'string', label: 'ROBOT BRAINS', blurb: 'How fast the robots move, how far they see and how often the hoses fire.', example: 'string robotLevel = "easy";', values: ['easy', 'normal', 'hard', 'loco'], defaultValue: 'normal', glyph: '▲', unlockAt: 0 },
    { id: 'teammates', name: 'amigos', type: 'int', label: 'FIESTA FRIENDS', blurb: 'Friends from the town who follow you and throw tomatoes at the robots too.', example: 'int amigos = 2;', limits: { min: 0, max: 3 }, defaultValue: 0, glyph: '☺', unlockAt: 0 },
    { id: 'celebration', name: 'splatParty', type: 'string', label: 'SPLAT PARTY', blurb: 'What a robot does when you splat it: "drip" red, burst into "confetti", dance "flamenco" or launch "fireworks".', example: 'string splatParty = "flamenco";', values: ['drip', 'confetti', 'flamenco', 'fireworks'], defaultValue: 'drip', glyph: '✺', unlockAt: 0 },
  ],
  extraTools: [
    { id: 'tom-laststand', name: 'lastStandRule', label: 'LAST STAND', type: 'condition', blurb: 'When you are nearly soaked, switch on the tomato radar.', example: 'if (dry < 40)\n{\n    autoAim = true;\n}', glyph: '?', unlockAt: 0 },
    { id: 'tom-combo', name: 'comboRule', label: 'COMBO FEVER', type: 'condition', blurb: 'After three splats in a row, every tomato bounces.', example: 'if (combo >= 3)\n{\n    bounces = 3;\n}', glyph: '?', unlockAt: 0 },
  ],
});
