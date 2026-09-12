import type { LogoVariant } from './brand';
/** Homepage identity, shared by every screen. */
export function Logo({ height = 30, className }: { variant?: LogoVariant; height?: number; className?: string }): JSX.Element {
  return <span className={['logo', className].filter(Boolean).join(' ')} style={{ height }} role="img" aria-label="MODBOX"><img src={className?.includes('home__wordmark') ? '/brand/modbox-crt-hero.svg' : '/brand/modbox-crt-logo.svg'} alt="" draggable={false} /></span>;
}
export function LogoMark({ size = 26 }: { size?: number }): JSX.Element {
  return <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true"><img src="/brand/modbox-crt-mark.svg" alt="" draggable={false} /></span>;
}
