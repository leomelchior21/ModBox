import { createArcadeCatalog } from '../premium-kit/catalog';
export const anominersCatalog = createArcadeCatalog({
  title: 'ANOMINERS', palettes: ['retro'],
  defaults: { palette: 'retro', playerName: 'Rocky', power: 3, speed: 6, gravity: 0, assist: false, overdrive: false, lives: 3, bonus: 10 },
  power: { name: 'drillPower', label: 'DRILL POWER', blurb: 'How fast your drill beam cuts through rock and minerals.', min: 1, max: 10, goal: 6 },
  assist: { name: 'magnet', label: 'ORE MAGNET', blurb: 'Pulls loose minerals to your ship from far away.', instruction: 'Mine until the magnet pulls a mineral to you from far away.' },
  bonus: { name: 'oreValue', label: 'ORE VALUE', blurb: 'Points for every mineral you bank at the base.', min: 5, max: 200, goal: 40 },
  physics: { key: 'speed', name: 'thrust', label: 'THRUSTERS', blurb: 'How fast your ship flies.', min: 2, max: 12, goal: 9 },
  overdrive: { name: 'droneBay', label: 'DRONE BAY', blurb: 'Press E (or DRONE) to build a mining drone for 10 minerals from your cargo.' },
  lives: { name: 'spareHulls', label: 'SPARE HULLS', min: 1, max: 9 },
  final: 'Finish a whole asteroid: bank the quota and warp out before your spare hulls run out.',
  remix: {
    worldTheme: { label: 'SECTOR', blurb: 'Fly to another part of the galaxy: the "ice" fields (your ship drifts!), the "ember" reach, the "amethyst" cloud or the "verdant" ruins.', values: ['classic', 'ice', 'ember', 'amethyst', 'verdant'], glyph: '✦' },
    characterStyle: { label: 'SHIP', blurb: 'Fly a "whale" cargo ship, a "saucer", a "rocket" or a little "beetle" drone.', values: ['original', 'whale', 'saucer', 'rocket', 'beetle'], glyph: '⌂' },
    weather: { label: 'SPACE WEATHER', blurb: '"meteors" crater the asteroid and shake minerals loose, "solar" wind pushes you, a "nebula" hides you and the anomaly, an "ionstorm" throws lightning.', values: ['clear', 'meteors', 'solar', 'nebula', 'ionstorm'], glyph: '☄' },
  },
  runtime: { actions: 'blaster shots', ore: 'minerals in your cargo', bank: 'minerals banked at the base', hull: 'hull strength, 0 to 100', threat: 'how strong the anomaly is', timer: 'seconds until the anomaly wakes', drones: 'mining drones working for you' },
  extraMods: [
    { id: 'ammo', name: 'cargoHold', type: 'int', label: 'CARGO HOLD', blurb: 'How many minerals your ship carries before it must fly home.', example: 'int cargoHold = 60;', limits: { min: 10, max: 200 }, defaultValue: 30, glyph: '▣', unlockAt: 0 },
    { id: 'splash', name: 'beamRange', type: 'int', label: 'BEAM RANGE', blurb: 'How far your drill beam reaches, in cells.', example: 'int beamRange = 10;', limits: { min: 3, max: 14 }, defaultValue: 6, glyph: '⌁', unlockAt: 0 },
    { id: 'teammates', name: 'droneCrew', type: 'int', label: 'DRONE CREW', blurb: 'Mining drones that come with you to every asteroid.', example: 'int droneCrew = 2;', limits: { min: 0, max: 4 }, defaultValue: 0, glyph: '⊙', unlockAt: 0 },
    { id: 'revealMap', name: 'scanner', type: 'bool', label: 'DEEP SCANNER', blurb: 'Shows minerals and lost technology inside the rock, and adds a map.', example: 'bool scanner = true;', defaultValue: false, glyph: '◉', unlockAt: 0 },
    { id: 'bounces', name: 'blasterLevel', type: 'int', label: 'BLASTER', blurb: 'Blaster strength: more damage, and from level 3 a spread of shots.', example: 'int blasterLevel = 3;', limits: { min: 1, max: 5 }, defaultValue: 1, glyph: '✸', unlockAt: 0 },
    { id: 'rivals', name: 'anomalies', type: 'int', label: 'ANOMALY SWARM', blurb: 'Extra anomalites in every wave.', example: 'int anomalies = 3;', limits: { min: 0, max: 6 }, defaultValue: 0, glyph: '◌', unlockAt: 0 },
    { id: 'difficulty', name: 'anomalyMood', type: 'string', label: 'ANOMALY MOOD', blurb: 'How fast the anomaly wakes and how hard it hunts: "sleepy", "normal", "angry" or "furious".', example: 'string anomalyMood = "sleepy";', values: ['sleepy', 'normal', 'angry', 'furious'], defaultValue: 'normal', glyph: '▲', unlockAt: 0 },
  ],
  extraTools: [
    { id: 'ano-cargo', name: 'cargoRule', label: 'FULL HOLD ALARM', type: 'condition', blurb: 'When the cargo is nearly full, switch on the ore magnet.', example: 'if (ore >= 25)\n{\n    magnet = true;\n}', glyph: '?', unlockAt: 0 },
    { id: 'ano-danger', name: 'dangerRule', label: 'BATTLE STATIONS', type: 'condition', blurb: 'When the anomaly is strong, power up the blaster.', example: 'if (threat >= 2)\n{\n    blasterLevel = 4;\n}', glyph: '?', unlockAt: 0 },
  ],
});
