import { Logo } from '../brand/Logo';
import type { Mission } from '../learning/missions/types';

export interface TopBarProps {
  gameName: string;
  missions: Mission[];
  completed: string[];
  paused: boolean;
  sound: boolean;
  onHome: () => void;
  onResetCode: () => void;
  onResetFullGame: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
  onToggleSound: () => void;
  onFullscreen: () => void;
  onSettings: () => void;
  onOpenLibrary: () => void;
}

export function TopBar({
  gameName,
  missions,
  completed,
  paused,
  sound,
  onHome,
  onResetCode,
  onResetFullGame,
  onTogglePause,
  onRestart,
  onToggleSound,
  onFullscreen,
  onSettings,
  onOpenLibrary,
}: TopBarProps): JSX.Element {
  const learning = missions.filter((mission) => mission.kind !== 'sandbox');
  const done = completed.filter((id) => learning.some((mission) => mission.id === id)).length;

  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="topbar__progress">
          <label htmlFor="mission-progress">MISSION PROGRESS</label>
          <div>
            <progress id="mission-progress" max={learning.length} value={done} />
            <span>{done}/{learning.length}</span>
          </div>
        </div>
        <span className="topbar__game">
          <small>NOW PLAYING</small>
          <strong>{gameName}</strong>
        </span>
      </div>
      <button className="topbar__logo topbar__center" onClick={onHome} aria-label="MODBOX home">
        <Logo height={60} />
      </button>
      <div className="topbar__right">
        <button className="console-button" onClick={onRestart} aria-label="Restart flight">
          <span className="console-button__icon">⟳</span>
          <span className="topbar__controlLabel">RESET</span>
        </button>
        <button
          className="console-button"
          onClick={onTogglePause}
          aria-label={paused ? 'Resume' : 'Pause'}
          aria-pressed={paused}
        >
          <span className="console-button__icon">{paused ? '▷' : 'Ⅱ'}</span>
          <span className="topbar__controlLabel">{paused ? 'RESUME' : 'PAUSE'}</span>
        </button>
        <button
          className="console-button console-button--icon"
          onClick={onToggleSound}
          aria-label={sound ? 'Mute sound' : 'Unmute sound'}
          aria-pressed={sound}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M11 4 6 8H3v8h3l5 4z" />
            {sound ? <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /> : <path d="m16 9 6 6m0-6-6 6" />}
          </svg>
        </button>
        <button className="console-button console-button--icon" onClick={onFullscreen} aria-label="Fullscreen workspace">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6M3 3l6 6m6 6 6 6M3 21l6-6m6-6 6-6" />
          </svg>
        </button>
        <details className="topbar__more">
          <summary aria-label="More controls">•••</summary>
          <div onClick={(event) => { if ((event.target as HTMLElement).closest('button')) event.currentTarget.closest('details')?.removeAttribute('open'); }}>
            <button onClick={onResetCode}>Reset code</button>
            <button onClick={onOpenLibrary}>Mod Library</button>
            <button onClick={onSettings}>Settings</button>
            <button className="topbar__danger" onClick={onResetFullGame}>Reset full game</button>
          </div>
        </details>
      </div>
    </header>
  );
}
