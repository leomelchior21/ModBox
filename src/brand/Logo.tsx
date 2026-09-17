import type { LogoVariant } from './brand';
/** Homepage identity, shared by every screen. */
export function Logo({
  height = 30,
  className,
  layout = 'header',
}: {
  height?: number;
  className?: string;
  layout?: 'header' | 'hero';
  variant?: LogoVariant;
}): JSX.Element {
  const src = layout === 'hero' ? '/brand/main-logo-final.png' : '/brand/header-logo.png';
  return <span className={['logo', `logo--${layout}`, className].filter(Boolean).join(' ')} style={{ height }} role="img" aria-label="MODBOX"><img src={src} alt="" draggable={false} /></span>;
}
export function LogoMark({ size = 26 }: { size?: number }): JSX.Element {
  return <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true"><img src="/brand/modbox-crt-mark.svg" alt="" draggable={false} /></span>;
}
