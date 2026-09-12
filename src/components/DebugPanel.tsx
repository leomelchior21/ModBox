import { useEffect, useRef, useState } from 'react';
import type { GameConfig, ProgramResult } from '../interpreter/core/types';
import type { Mission } from '../learning/missions/types';
import type { VectorZeroEngine } from '../games/vector-zero/engine/gameEngine';
import { statementLabel } from '../interpreter/core/diagnostics';
import { summarize } from '../interpreter/core/summarize';

/* ============================================================================
   MODBOX — DEV DEBUG PANEL (never part of the student UI)
   Enabled with ?debug=1 or the settings toggle.
   ========================================================================== */

export function DebugPanel({
  open,
  onClose,
  engine,
  mission,
  program,
  config,
  unlocked,
  editorFocused,
}: {
  open: boolean;
  onClose: () => void;
  engine: VectorZeroEngine | null;
  mission: Mission;
  program: ProgramResult;
  config: GameConfig;
  unlocked: string[];
  editorFocused: boolean;
}): JSX.Element | null {
  const [fps, setFps] = useState(0);
  const [tick, setTick] = useState(0);
  const frames = useRef(0);
  const last = useRef(performance.now());

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const loop = () => {
      frames.current += 1;
      const now = performance.now();
      if (now - last.current >= 500) {
        setFps(Math.round((frames.current * 1000) / (now - last.current)));
        frames.current = 0;
        last.current = now;
        setTick((value) => value + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  const snapshot = engine?.getSnapshot();
  const summary = summarize(program);
  const rules = program.rules.map((rule) => `${rule.conditionText} → ${rule.actions.map((a) => a.text).join(', ')}`);

  return (
    <aside className="debug" aria-label="Developer debug panel">
      <header className="debug__head">
        <span className="debug__title mono">MODBOX DEBUG · {tick}</span>
        <button type="button" className="btn btn--ghost btn--chip" onClick={onClose}>
          Hide
        </button>
      </header>

      <div className="debug__grid mono">
        <section>
          <h4>PERF</h4>
          <p>fps: {fps}</p>
          <p>phase: {snapshot?.phase ?? '—'}</p>
          <p>editor focus: {String(editorFocused)}</p>
          <p>rules: {rules.length}</p>
          <p>nodes: {summary.astNodes}</p>
        </section>

        <section>
          <h4>MISSION</h4>
          <p>{mission.id} · {mission.code}</p>
          <p>unlocked: {unlocked.join(', ') || '—'}</p>
          <p>ignored mods: {summary.modsUsed.filter((mod) => !unlocked.includes(mod)).join(', ') || '—'}</p>
        </section>

        <section>
          <h4>LIVE STATE</h4>
          <p>score: {snapshot?.score ?? 0}</p>
          <p>lives: {snapshot?.lives ?? 0}</p>
          <p>wave: {snapshot?.wave ?? 0}</p>
          <p>health: {Math.round(snapshot?.health ?? 0)}</p>
          <p>kills: {snapshot?.metrics.kills ?? 0}</p>
          <p>rule activations: {snapshot?.metrics.ruleActivations ?? 0}</p>
        </section>

        <section>
          <h4>GAMECONFIG</h4>
          <pre>{JSON.stringify(config, null, 1)}</pre>
        </section>

        <section>
          <h4>ACTIVE RULES</h4>
          {snapshot?.activeRuleTexts.length ? (
            snapshot.activeRuleTexts.map((text) => <p key={text}>{text}</p>)
          ) : (
            <p>—</p>
          )}
          <h4>RULE TRACES</h4>
          {(snapshot?.metrics.ruleTraces ?? []).map((trace) => (
            <p key={trace}>{trace}</p>
          ))}
          {!snapshot?.metrics.ruleTraces.length ? <p>—</p> : null}
        </section>

        <section>
          <h4>PARSED AST</h4>
          {program.ast.statements.map((statement, index) => (
            <p key={index}>
              {statement.pos.line}: {statementLabel(statement)}
            </p>
          ))}
          {!program.ast.statements.length ? <p>—</p> : null}
        </section>

        <section>
          <h4>DIAGNOSTICS</h4>
          {program.diagnostics.length ? (
            program.diagnostics.map((diagnostic, index) => (
              <p key={index}>
                [{diagnostic.code}] L{diagnostic.line} {diagnostic.message}
              </p>
            ))
          ) : (
            <p>—</p>
          )}
        </section>

        <section>
          <h4>FLIGHT LOG QUEUE</h4>
          {program.comms.map((line) => (
            <p key={line.id}>&gt; {line.text}</p>
          ))}
          {!program.comms.length ? <p>—</p> : null}
        </section>
      </div>
    </aside>
  );
}
