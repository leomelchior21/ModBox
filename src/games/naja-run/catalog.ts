import { createArcadeCatalog } from '../premium-kit/catalog';
export const najaCatalog = createArcadeCatalog({
  title: 'NAJA RUN', palettes: ['jade', 'orchid', 'gold'],
  defaults: { palette: 'jade', playerName: 'Temple Runner', power: 25, speed: 6, gravity: 1, assist: false, overdrive: false, lives: 3, bonus: 1 },
  power: { name: 'fruitValue', label: 'GOLDEN HARVEST', blurb: 'Points for the fruit you collect.', min: 10, max: 100, goal: 40 },
  assist: { name: 'wrapWalls', label: 'TEMPLE PORTALS', blurb: 'Cross an edge and emerge on the opposite side.', instruction: 'Guide Naja across the edge of the board to use a portal.' },
  bonus: { name: 'growth', label: 'GROWING LEGEND', blurb: 'Extra body segments gained per fruit.', min: 1, max: 3, goal: 2 },
  physics: { key: 'speed', name: 'snakeSpeed', label: 'SERPENT SPEED', blurb: 'How many tiles Naja travels each second.', min: 4, max: 12, goal: 8 },
  overdrive: { name: 'venomRush', label: 'JADE RUSH', blurb: 'Double fruit points and unlock a temporary shield with JADE RUSH or E.' },
  lives: { name: 'charms', label: 'TEMPLE CHARMS', min: 1, max: 5 },
  final: 'Collect five fruits and clear a temple garden.',
});
