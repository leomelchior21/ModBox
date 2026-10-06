import { useId } from 'react';

const COVER_STARS: [number, number][] = [
  [30, 40],
  [90, 22],
  [150, 58],
  [210, 30],
  [268, 52],
  [330, 26],
  [370, 70],
  [58, 120],
  [128, 140],
  [196, 108],
  [300, 132],
  [356, 160],
  [24, 200],
  [110, 224],
  [250, 210],
  [340, 226],
];

/** Original cover art, drawn with vectors — no external sprites (spec §37). */
export function VectorZeroCover(): JSX.Element {
  const glowId = useId();
  return <svg className="cover" viewBox="0 0 400 260" role="img" aria-label="Vector Zero cover art">
    <defs><radialGradient id={glowId}><stop stopColor="#092927"/><stop offset="1" stopColor="#020e0a"/></radialGradient></defs>
    <rect width="400" height="260" fill={`url(#${glowId})`} />
    {COVER_STARS.map(([x,y],i) => <g key={i} fill="#d8ffff"><circle cx={x} cy={y} r={i%3===0?1.8:1} opacity=".8"/>{i%4===0?<path d={`M${x-4} ${y}h8m-4-4v8`} stroke="#c5ffff" opacity=".6"/>:null}</g>)}
    <g fill="none" stroke="#d5fff2" strokeWidth="2">
      <path d="m55 46 12-6 11 5 6 11-3 12-12 6-13-3-8-11zM321 48l12-7 12 4 9 11-4 14-13 6-14-5-7-11zM58 192l14-8 14 6 7 13-7 15-15 2-13-8-4-12zM317 187l15-6 13 8 4 15-9 13-16 1-11-11z" />
      <path opacity=".4" d="M61 53h2m10 10h2m253-8h2m10 9h2M64 201h2m15 7h2m244-12h2m8 9h2" />
    </g>
    <g transform="translate(206 135) rotate(10)">
      <path d="m-38-22-76 15 72 1m-2 18-81 20 88-5" fill="#2adfff" opacity=".65"/>
      <path d="m-38-16-58 9h57m-2 28-53 9 58-2" stroke="#a4ffff" strokeWidth="3"/>
      <path d="M95 0 15-25-29-71h-22l21 55-24-4-13 20 13 20 24-4-21 55h22l44-46z" fill="#061f25" stroke="#d9ffff" strokeWidth="2.5"/>
      <path d="m95 0-69-10-11-15-12 25 12 25 11-15zM3 0h-43m10-16 15-13m-15 45 15 13m-27-93 23 5m-23 121 23-5" fill="none" stroke="#a1e8ed" strokeWidth="2"/>
      <path d="m26-10 7 20m15-14 5 8m-94-17v26" stroke="#fff" strokeWidth="2"/>
    </g>
  </svg>;
}
