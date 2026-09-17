import { Logo } from '../brand/Logo';

export function VhsBoot({
  mode = 'site',
  title,
}: {
  mode?: 'site' | 'game';
  title?: string;
}): JSX.Element {
  const game = mode === 'game';
  return (
    <div className={`vhs-boot vhs-boot--${mode}`} role="status" aria-live="polite" aria-label={game ? 'Loading game' : 'Loading MODBOX'}>
      <div className="vhs-boot__noise" aria-hidden="true" />
      <div className="vhs-boot__tracking" aria-hidden="true" />
      <div className="vhs-boot__hud mono" aria-hidden="true"><span>PLAY <b>SP</b></span><span>CH 03</span></div>
      <div className="vhs-boot__center">
        <Logo layout={game ? 'header' : 'hero'} height={game ? 54 : 150} className="vhs-boot__logo" />
        <p className="vhs-boot__title mono">{game ? title ?? 'VECTOR ZERO' : 'INSERTING COIN'}</p>
        <div className="vhs-boot__meter" aria-hidden="true"><span /></div>
        <p className="vhs-boot__copy mono">{game ? 'LOADING FLIGHT DECK...' : 'TUNING CRT SIGNAL...'}</p>
      </div>
      <div className="vhs-boot__time mono" aria-hidden="true">00:00:0<span>1</span></div>
    </div>
  );
}
