import { useState } from 'react';
import type { GameDefinition } from '../games/types';

/** A consistent image frame for the home, arcade and language screens. */
export function GameArtwork({ game, eager = false }: { game: GameDefinition; eager?: boolean }): JSX.Element {
  const [failed, setFailed] = useState('');
  if (failed === game.hero.src) {
    const Cover = game.Cover;
    return <div className="game-art game-art--fallback"><Cover /></div>;
  }
  return <img className="game-art" src={game.hero.src} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} onError={() => setFailed(game.hero.src)} />;
}

export function GameAvailability({ ready }: { ready: boolean }): JSX.Element {
  return <span className={`game-availability ${ready ? 'game-availability--ready' : 'game-availability--soon'}`}>
    <span aria-hidden="true">{ready ? '●' : '◷'}</span> {ready ? 'AVAILABLE NOW' : 'COMING SOON'}
  </span>;
}
