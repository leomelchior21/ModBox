import { useId } from 'react';

/** Bowed glass, layered metal bezel and softly warped live phosphor content. */
export function CrtGlass(): JSX.Element {
  const id = useId().replaceAll(':', '');
  const outline = 'M56 16 Q500 0 944 16 Q978 18 985 54 Q1000 380 985 706 Q978 742 944 744 Q500 760 56 744 Q22 742 15 706 Q0 380 15 54 Q22 18 56 16Z';
  return <svg className="crt-glass" viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <filter id="crt-content-curve" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feImage href="/art/crt-displacement.png" x="-5%" y="-5%" width="110%" height="110%" preserveAspectRatio="none" result="curve" />
        <feDisplacementMap in="SourceGraphic" in2="curve" scale="4" xChannelSelector="R" yChannelSelector="G" />
        <feGaussianBlur stdDeviation=".25" />
      </filter>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2=".85" y2="1"><stop stopColor="#080d0b"/><stop offset=".08" stopColor="#a5b5aa"/><stop offset=".13" stopColor="#283e32"/><stop offset=".4" stopColor="#0a1810"/><stop offset=".65" stopColor="#496556"/><stop offset=".9" stopColor="#b2c1b4"/><stop offset="1" stopColor="#101d17"/></linearGradient>
      <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f5ffdf"/><stop offset=".16" stopColor="#b7f1cb"/><stop offset=".34" stopColor="#3c7a5a"/><stop offset=".6" stopColor="#81cda4"/><stop offset=".83" stopColor="#fcffe1"/><stop offset="1" stopColor="#82af9a"/></linearGradient>
      <radialGradient id={`${id}-flare`}><stop stopColor="#fffce0" stopOpacity=".95"/><stop offset=".15" stopColor="#dcffdf" stopOpacity=".7"/><stop offset=".48" stopColor="#bdffdf" stopOpacity=".14"/><stop offset="1" stopColor="#bdffdf" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-reflection`} x1="0" y1="0" x2=".2" y2="1"><stop stopColor="#f0ffe7" stopOpacity=".16"/><stop offset="1" stopColor="#f0ffe7" stopOpacity="0"/></linearGradient>
      <filter id={`${id}-bloom`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <path d={outline} fill="none" stroke="#030806" strokeWidth="29"/>
    <path d={outline} fill="none" stroke={`url(#${id}-metal)`} strokeWidth="19"/>
    <path d={outline} fill="none" stroke="#03160c" strokeWidth="11"/>
    <path d={outline} fill="none" stroke={`url(#${id}-light)`} strokeWidth="7" opacity=".7" filter={`url(#${id}-bloom)`}/>
    <path d={outline} fill="none" stroke={`url(#${id}-light)`} strokeWidth="2.6"/>
    <path d={outline} transform="translate(8 7) scale(.984 .982)" fill="none" stroke="#aeefc7" strokeWidth=".7" opacity=".45"/>
    <path d="M54 79Q61 48 102 47Q500 21 898 47Q948 51 947 80Q498 47 54 101Z" fill={`url(#${id}-reflection)`} opacity=".5"/>
    <path d="M39 133Q21 373 43 626" stroke="#e5ffed" strokeWidth="6" fill="none" opacity=".1"/>
    <path d="M958 152Q977 380 957 624" stroke="#e5ffed" strokeWidth="4" fill="none" opacity=".12"/>
    <ellipse cx="42" cy="58" rx="30" ry="48" fill={`url(#${id}-flare)`} transform="rotate(35 42 58)"/>
    <ellipse cx="961" cy="698" rx="26" ry="42" fill={`url(#${id}-flare)`} transform="rotate(35 961 698)"/>
    <ellipse cx="955" cy="56" rx="22" ry="31" fill={`url(#${id}-flare)`} opacity=".6"/>
    <ellipse cx="45" cy="700" rx="24" ry="30" fill={`url(#${id}-flare)`} opacity=".5"/>
  </svg>;
}
