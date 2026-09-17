import { useEffect, useState } from 'react';

/* ============================================================================
   MODBOX — SETTINGS
   Sound, on-screen debug tools and (deliberately quiet) progress reset.
   ========================================================================== */

export function SettingsDialog({
  open,
  onClose,
  studentName,
  sound,
  debug,
  bestScore,
  completedCount,
  onRename,
  onToggleSound,
  onToggleDebug,
  onResetProgress,
}: {
  open: boolean;
  onClose: () => void;
  studentName: string;
  sound: boolean;
  debug: boolean;
  bestScore: number;
  completedCount: number;
  onRename: (name: string) => void;
  onToggleSound: () => void;
  onToggleDebug: () => void;
  onResetProgress: () => void;
}): JSX.Element | null {
  const [confirmReset, setConfirmReset] = useState(false);
  const [draftName, setDraftName] = useState(studentName);

  useEffect(() => {
    setDraftName(studentName);
  }, [studentName, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Settings">
      <button type="button" className="modal__backdrop" onClick={onClose} aria-label="Close settings" />
      <div className="modal__panel">
        <header className="modal__head">
          <h2 className="modal__title">SETTINGS</h2>
          <button type="button" className="btn btn--ghost btn--chip" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="setting">
          <label className="setting__label" htmlFor="modbox-name">
            PILOT NAME
          </label>
          <div className="row">
            <input
              id="modbox-name"
              className="setting__input mono"
              value={draftName}
              maxLength={18}
              placeholder="optional"
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => onRename(draftName.trim())}
            />
            <button type="button" className="btn btn--ghost btn--chip" onClick={() => onRename(draftName.trim())}>
              Save
            </button>
          </div>
          <p className="setting__hint">Stored on this device only. MODBOX has no accounts and no server.</p>
        </div>

        <div className="setting setting--row">
          <div>
            <p className="setting__label">SOUND</p>
            <p className="setting__hint">Restrained arcade synthesis. Mute anytime.</p>
          </div>
          <button
            type="button"
            className={`btn btn--chip ${sound ? 'btn--primary' : 'btn--ghost'}`}
            onClick={onToggleSound}
            aria-pressed={sound}
          >
            {sound ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="setting setting--row">
          <div>
            <p className="setting__label">DEV DEBUG PANEL</p>
            <p className="setting__hint">FPS, GameConfig, live state, rules and parsed AST.</p>
          </div>
          <button
            type="button"
            className={`btn btn--chip ${debug ? 'btn--primary' : 'btn--ghost'}`}
            onClick={onToggleDebug}
            aria-pressed={debug}
          >
            {debug ? 'ON' : 'OFF'}
          </button>
        </div>

        <hr className="divider" />

        <div className="setting">
          <p className="setting__label">PROGRESS</p>
          <p className="setting__hint">
            {completedCount} mission{completedCount === 1 ? '' : 's'} complete · best score {bestScore}
          </p>
          {confirmReset ? (
            <div className="row">
              <button type="button" className="btn btn--flare btn--chip" onClick={onResetProgress}>
                YES, WIPE PROGRESS
              </button>
              <button type="button" className="btn btn--ghost btn--chip" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--ghost btn--chip" onClick={() => setConfirmReset(true)}>
              Reset progress
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
