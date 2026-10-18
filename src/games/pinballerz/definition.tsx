import type { PlayableGame } from '../types';
import { pinballCatalog } from './catalog';
export const pinballerz: PlayableGame = {
  id: 'pinballerz', title: 'PINBALLERZ', genre: 'neon pinball · midnight jackpots', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#29223e" /><image href="/art/pinballerz/logo.svg" x="24" y="65" width="352" height="110" /></svg>,
  hero: { src: '/art/pinballerz/cover.webp', alt: "A midnight arcade in the palm of your hand. Work the flippers, light the star targets, and send a chrome ball roaring through a glowing jackpot circuit." },
  languages: ['python', 'swift', 'csharp'], starterMissionId: 'm00', sandboxMissionId: 'free', missions: pinballCatalog.missions,
  loadScreen: () => import('./PinballScreen').then(module => ({ default: module.PinballScreen })),
};
