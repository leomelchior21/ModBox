import './play-mode.css';

interface PlayModeNavProps {
  exploring: boolean;
  className?: string;
  nextClassName?: string;
  onExplore: () => void;
  onGuide: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

/** Challenges offer ideas; they never gate a game or its mods. */
export function PlayModeNav({ exploring, className = '', nextClassName, onExplore, onGuide, onPrevious, onNext }: PlayModeNavProps): JSX.Element {
  return <nav className={`play-mode ${className}`} aria-label="Play mode and optional challenges">
    {exploring ? <><span>FREE PLAY · ALL MODS AVAILABLE</span><button onClick={onGuide}>TRY A CHALLENGE</button></> : <>
      <button onClick={onExplore}>FREE PLAY</button>
      {onPrevious ? <button onClick={onPrevious}>← Previous</button> : null}
      {onNext ? <button className={nextClassName} onClick={onNext}>NEXT CHALLENGE →</button> : null}
    </>}
  </nav>;
}
