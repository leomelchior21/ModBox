import type { PlayableGame } from '../types';
import { pinballCatalog } from './catalog';
export const pinballerz: PlayableGame = {
  id: 'pinballerz', title: 'PINBALLERZ', genre: 'soccer pinball · flip it into the net', status: 'play',
  Cover: () => <svg viewBox="0 0 400 240" aria-hidden="true"><rect width="400" height="240" fill="#29223e" /><image href="/art/pinballerz/logo.svg" x="24" y="65" width="352" height="110" /></svg>,
  hero: { src: '/art/pinballerz/cover.webp', alt: "Soccer meets pinball. Swing the flippers, strike the ball past purple defenders and a diving keeper, and send the crowd wild with every goal." },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: pinballCatalog.missions,
  loadScreen: () => import('./PinballScreen').then(module => ({ default: module.PinballScreen })),
};
