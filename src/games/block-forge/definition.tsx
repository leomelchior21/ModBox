import type { PlayableGame } from '../types';
import { FORGE_MISSIONS } from './missions';

export function ForgeCover(): JSX.Element {
  const colors = ['#bba6ed', '#85d5bf', '#f4bb87', '#93b9ed', '#e6a0c3'];
  return <svg viewBox="0 0 400 240" aria-hidden="true"><defs><radialGradient id="forge-cover-bg"><stop stopColor="#504163" /><stop offset="1" stopColor="#17192d" /></radialGradient></defs><rect width="400" height="240" fill="url(#forge-cover-bg)" /><g transform="translate(108 22) rotate(-8 90 90)">{Array.from({ length: 36 }, (_, i) => { const r = Math.floor(i / 6), c = i % 6, occupied = [0, 1, 6, 7, 11, 17, 18, 19, 20, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35].includes(i); return <g key={i}><rect x={c * 29} y={r * 29} width="25" height="25" rx="4" fill={occupied ? colors[Math.floor(i / 7) % colors.length] : '#292e43'} stroke={occupied ? '#ffffff66' : '#81819b33'} /><path d={`M${c * 29 + 4} ${r * 29 + 3}h17`} stroke="#ffffff55" /></g>; })}</g><path d="m64 69 4 9 10 2-9 4-2 10-4-9-10-2 9-4zm264 92 4 10 10 2-9 4-2 10-4-9-10-3 9-4z" fill="#c2f6d6" /><text x="200" y="226" textAnchor="middle" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="23" fill="#eee8ff" letterSpacing="2">BLOCK FORGE</text></svg>;
}
export const blockForge: PlayableGame = {
  id: 'block-forge', title: 'BLOCK FORGE', genre: 'block puzzle · combos & creativity', status: 'play', Cover: ForgeCover,
  hero: { src: '/art/block-forge/cover.svg', alt: 'Pastel jewel blocks filling a glowing puzzle board in a violet workshop' },
  languages: ['python', 'swift', 'csharp'], playFirst: true, starterMissionId: 'free', sandboxMissionId: 'free', missions: FORGE_MISSIONS,
  loadScreen: () => import('./BlockForgeScreen').then(module => ({ default: module.BlockForgeScreen })),
};
