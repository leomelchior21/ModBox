import { useState, type CSSProperties } from 'react';
import './result.css';

export interface ResultCard { win: boolean; caption: string; headline?: string; detail?: string }
export interface StageChip { level: number; name: string; state: 'done' | 'current' | 'locked' }
interface ResultOverlayProps {
  card: ResultCard; snapshot: string | null; stages: readonly StageChip[]; footnote?: string;
  onHome(): void; onPrimary(): void; onPick(level: number): void;
}

const Home = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.2 12 3.5l9 7.7V21h-6.2v-6h-5.6v6H3z" /></svg>;
const Play = ({ next }: { next: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true">{next ? <path d="M4 4.5v15l11-7.5zM16.5 4.5h3.5v15h-3.5z" /> : <path d="M12 4a8 8 0 1 1-7.6 5.5h3.3A5 5 0 1 0 12 7v3.4L6.8 5.7 12 1z" />}</svg>;
const Levels = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v3H3zM3 10.5h18v3H3zM3 16h18v3H3z" /></svg>;

/** A tilted instant photo of the moment the run ended, with Home / Retry or Next / Levels. */
export function ResultOverlay({ card, snapshot, stages, footnote, onHome, onPrimary, onPick }: ResultOverlayProps): JSX.Element {
  const [picking, setPicking] = useState(false);
  return <div className={`result result--${card.win ? 'win' : 'fail'}`} role="dialog" aria-label={card.win ? `Stage clear. ${card.headline ?? ''} ${card.caption}` : card.caption}>
    {card.win ? <div className="result__confetti" aria-hidden="true">{Array.from({ length: 42 }, (_, i) => <i key={i} style={{ left: `${(i * 37 + 11) % 100}%`, animationDelay: `${(i * .173) % 2.4}s`, animationDuration: `${2.4 + (i % 5) * .45}s`, background: i % 3 ? '#1f8cff' : '#ffffff', '--spin': `${(i % 2 ? 1 : -1) * (360 + i * 23)}deg` } as CSSProperties} />)}</div> : null}
    {picking ? <div className="result__levels">
      <b>LEVELS</b>
      <div>{stages.map(stage => <button key={stage.level} className={`result__stage result__stage--${stage.state}`} disabled={stage.state === 'locked'} onClick={() => onPick(stage.level)}>
        <span>{stage.state === 'done' ? '✓' : stage.state === 'locked' ? '🔒' : stage.level}</span>{stage.name}
      </button>)}</div>
    </div> : <figure className="result__photo">
      <div className="result__frame">{snapshot ? <img src={snapshot} alt="" /> : null}{card.headline ? <strong className="result__time">{card.headline}</strong> : null}</div>
      <figcaption>{card.caption}{card.detail ? <small>{card.detail}</small> : null}</figcaption>
    </figure>}
    <div className="result__actions">
      <button className="result__side" onClick={onHome}><Home /><span>Home</span></button>
      <button className="result__main" onClick={onPrimary} autoFocus><Play next={card.win} /><span>{card.win ? 'Next level' : 'Retry'}</span></button>
      <button className="result__side" aria-pressed={picking} onClick={() => setPicking(open => !open)}><Levels /><span>{picking ? 'Photo' : 'Levels'}</span></button>
    </div>
    {footnote ? <small className="result__note">{footnote}</small> : null}
  </div>;
}
