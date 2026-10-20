import { createArcadeCatalog } from '../premium-kit/catalog';
export const slingersCatalog = createArcadeCatalog({
  title: 'MAKITA SLINGERS', palettes: ['teal', 'amber', 'violet'],
  defaults: { palette: 'teal', playerName: 'Scrapyard Crew', power: 88, speed: 1, gravity: 320, assist: false, overdrive: false, lives: 4, bonus: 250 },
  power: { name: 'launchPower', label: 'SLING POWER', blurb: 'How fast a full pull launches a blade.', min: 55, max: 125, goal: 100 },
  assist: { name: 'aimGuide', label: 'FLIGHT PREVIEW', blurb: 'Predict the real blade trajectory before releasing.', instruction: 'Launch a blade with the trajectory guide switched on.' },
  bonus: { name: 'robotValue', label: 'SCRAP BOUNTY', blurb: 'Points for every robot you dismantle.', min: 100, max: 600, goal: 350 },
  physics: { key: 'gravity', name: 'gravity', label: 'QUARRY GRAVITY', blurb: 'Gravity affects sawblades and falling towers.', min: 180, max: 500, goal: 260 },
  overdrive: { name: 'blastBlade', label: 'BLAST BLADE', blurb: 'Press E in flight to detonate any blade with a shockwave.' },
  lives: { name: 'bladeCount', label: 'BLADE RACK', min: 3, max: 8 },
  final: 'Dismantle every robot in a quarry and clear the stage.',
  runtime: { robots: 'robots still standing', blades: 'blades left in the rack' },
});
