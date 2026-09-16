import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodeOrder } from '../../components/CodeOrder';
import { CrtGlass } from '../../components/CrtGlass';
import { TopBar } from '../../components/TopBar';
import { MissionPanel } from '../../components/MissionPanel';
import { FeedbackPanel, type FeedbackStatus } from '../../components/FeedbackPanel';
import { ModLibrary } from '../../components/ModLibrary';
import { ModStrip } from '../../components/ModStrip';
import { UnlockBurst, type UnlockToken } from '../../components/UnlockBurst';
import { SettingsDialog } from '../../components/SettingsDialog';
import { DebugPanel } from '../../components/DebugPanel';
import { GameStage, TouchControls } from '../../components/GameStage';
import { CodeEditor, applyModToEditor } from '../../editor/CodeEditor';
import type { ModInsertMode } from '../../editor/modEditing';
import { csharpAdapter } from '../../interpreter/csharp';
import { summarize } from '../../interpreter/core/summarize';
import { MODS, MOD_BY_ID } from '../../interpreter/core/mods';
import { ResizeHandle } from '../../components/ResizeHandle';
import {
  MISSIONS,
  getMission,
  nextMission,
  previousMission,
  seedMissionCode,
  unlockedMods,
} from '../../learning/missions';
import { coachPopupMessage, codeToolsForMission, copilotStep } from '../../learning/copilot';
import {
  filterConfigToUnlocked,
  resolveLiveConfig,
  validateMission,
} from '../../learning/validation';
import { useProgress } from '../../state/progressStore';
import { prefersReducedMotion, useDebouncedValue, useMediaQuery } from '../../utils/hooks';
import { VectorZeroEngine } from '../../games/vector-zero/engine/gameEngine';
import type { EngineSnapshot, Phase } from '../../games/vector-zero/engine/types';
import { synth } from '../../games/vector-zero/audio/synth';
import { DEFAULT_CONFIG } from '../../interpreter/core/limits';
import { navigate } from '../router';

/* ============================================================================
   VECTOR ZERO — THE LAB
   Editor and game, side by side, always. Code changes land in the world
   without a compile step (spec §6 / §7).
   ========================================================================== */

const EMPTY_METRICS: EngineSnapshot['metrics'] = {
  maxScore: 0,
  minHealth: 100,
  kills: 0,
  hitsTaken: 0,
  deaths: 0,
  wavesReached: 1,
  playTimeMs: 0,
  ruleTraces: [],
  ruleActivations: 0,
};

const DEFAULT_SNAPSHOT: EngineSnapshot = {
  phase: 'launch',
  score: 0,
  lives: DEFAULT_CONFIG.lives,
  wave: 1,
  health: 100,
  best: 0,
  config: { ...DEFAULT_CONFIG },
  activeRuleTexts: [],
  metrics: EMPTY_METRICS,
};

export function LabScreen({
  missionId,
  debugFlag,
}: {
  missionId?: string;
  debugFlag: boolean;
}): JSX.Element {
  const progress = useProgress();
  const mission = useMemo(
    () => getMission(missionId ?? progress.currentMissionId),
    [missionId, progress.currentMissionId],
  );

  const engineRef = useRef<VectorZeroEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<import('@codemirror/view').EditorView | null>(null);
  const passedRef = useRef(false);

  const [orderOpen, setOrderOpen] = useState(false);
  const [code, setCode] = useState('');
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(DEFAULT_SNAPSHOT);
  const [phase, setPhase] = useState<Phase>('launch');
  const [worldUpdated, setWorldUpdated] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modStripCollapsed, setModStripCollapsed] = useState(false);
  const [unlockTokens, setUnlockTokens] = useState<UnlockToken[]>([]);
  const [metricsTick, setMetricsTick] = useState(0);
  const [dismissedCoachKey, setDismissedCoachKey] = useState<string | null>(null);

  const touch = useMediaQuery('(any-pointer: coarse)');
  const debugVisible = debugFlag || progress.settings.debug;

  /* ------------------------------------------------------------ live parsing */

  const debouncedCode = useDebouncedValue(code, 380);
  const program = useMemo(() => csharpAdapter.parse(debouncedCode), [debouncedCode]);
  const summary = useMemo(() => summarize(program), [program]);
  const diagnostic = program.diagnostics.find((entry) => entry.severity === 'error');

  const unlocked = useMemo(
    () => unlockedMods(progress.completed, mission.id, progress.freeModeUnlocked),
    [progress.completed, mission.id, progress.freeModeUnlocked],
  );

  const unlockedModList = useMemo(() => MODS.filter((mod) => unlocked.includes(mod.id)), [unlocked]);

  const filtered = useMemo(
    () => filterConfigToUnlocked(program.config, unlocked),
    [program.config, unlocked],
  );

  const liveConfig = useMemo(
    () => resolveLiveConfig(mission.scenario, program.config, unlocked),
    [mission.scenario, program.config, unlocked],
  );

  /* ----------------------------------------------------------- engine program */

  const engineProgram = useMemo(
    () => ({
      config: liveConfig,
      rules: program.rules
        .map((rule) => ({
          ...rule,
          actions: rule.actions.filter((action) => unlocked.includes(action.target)),
        }))
        .filter((rule) => rule.actions.length > 0 || rule.writes.length > 0),
      comms: program.comms.map((line) => ({ id: line.id, text: line.text, tone: 'in' as const })),
      constants: Object.fromEntries(
        program.symbols
          .filter((symbol) => symbol.userOnly)
          .map((symbol) => [symbol.name, symbol.value]),
      ),
      missionLabel: mission.code,
    }),
    [liveConfig, program, unlocked, mission.code],
  );


  /* ------------------------------------------------------------------ effects */

  // 1. engine lifecycle — created once, code flows in through setProgram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new VectorZeroEngine(canvas, {
      bestScore: useProgress.getState().bestScore,
      reducedMotion: prefersReducedMotion(),
      onPhase: (nextPhase, nextSnapshot) => {
        setPhase(nextPhase);
        setSnapshot(nextSnapshot);
      },
      onUpdate: () => {
        setWorldUpdated(true);
        window.setTimeout(() => setWorldUpdated(false), 1300);
      },
      onGameOver: (score) => {
        useProgress.getState().setBestScore(score);
        setMetricsTick((tick) => tick + 1);
      },
    });
    engine.setSound(useProgress.getState().settings.sound);
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // 2. mission code: reuse what exists, otherwise preserve the previous work
  // without inserting the new mission's answer for the student
  useEffect(() => {
    const store = useProgress.getState();
    if (store.currentMissionId !== mission.id) store.setMission(mission.id);
    const existing = store.codes[mission.id];
    if (existing !== undefined) {
      setCode(existing);
      return;
    }
    const previous = previousMission(mission.id);
    const previousCode = previous ? (store.codes[previous.id] ?? '') : '';
    const seeded = seedMissionCode(previousCode, mission);
    setCode(seeded);
    store.setCode(mission.id, seeded);
  }, [mission]);

  // 3. always remember the student's code
  useEffect(() => {
    if (!code) return;
    const timer = window.setTimeout(() => useProgress.getState().setCode(mission.id, code), 500);
    return () => window.clearTimeout(timer);
  }, [code, mission.id]);

  // 4. push every parse result into the living game
  useEffect(() => {
    engineRef.current?.setProgram(engineProgram);
  }, [engineProgram]);

  // 5. keep the engine mute state in sync with settings
  useEffect(() => {
    engineRef.current?.setSound(progress.settings.sound);
  }, [progress.settings.sound]);

  useEffect(() => {
    engineRef.current?.setKeyEnabled(!editorFocused && !libraryOpen && !settingsOpen && !orderOpen);
  }, [editorFocused, libraryOpen, settingsOpen, orderOpen]);

  // 6. metrics polling while flying — validation reads live behaviour
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'respawn') return;
    const timer = window.setInterval(() => setMetricsTick((tick) => tick + 1), 700);
    return () => window.clearInterval(timer);
  }, [phase]);

  /* -------------------------------------------------------------- validation */

  const metrics = useMemo(() => {
    void metricsTick;
    return engineRef.current?.getMetrics() ?? EMPTY_METRICS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricsTick, phase, engineProgram]);

  const validationContext = useMemo(
    () => ({
      code: debouncedCode,
      program,
      summary,
      config: liveConfig,
      metrics,
      unlocked,
      ignored: filtered.ignored,
    }),
    [debouncedCode, program, summary, liveConfig, metrics, unlocked, filtered.ignored],
  );

  const validation = useMemo(
    () => validateMission(mission, validationContext),
    [mission, validationContext],
  );
  const guidance = useMemo(
    () => copilotStep(mission, validationContext, validation),
    [mission, validationContext, validation],
  );
  const codeTools = useMemo(() => codeToolsForMission(mission), [mission]);

  const missionComplete = mission.requirements.length > 0 && validation.passed;
  const missionPassed = missionComplete || progress.completed.includes(mission.id);
  const coachKey = `${mission.id}:${guidance.message}`;
  const coachVisible = !diagnostic && dismissedCoachKey !== coachKey;
  const libraryStep = Boolean(
    guidance.targetId && /^(Add|Build)\b/i.test(guidance.message),
  );
  const coach = coachVisible ? { ...guidance, message: coachPopupMessage(guidance) } : undefined;
  const editorCoach = coach && guidance.targetId && !libraryStep && !missionComplete ? {
    key: coachKey,
    message: coach.message,
    hint: coach.hint,
    targetId: guidance.targetId,
  } : undefined;
  const libraryCoach = coach && libraryStep ? coach : undefined;

  useEffect(() => {
    if (libraryStep) setModStripCollapsed(false);
  }, [coachKey, libraryStep]);

  // 7. completion + unlock animation (never longer than ~1.5s)
  useEffect(() => {
    if (missionComplete && !passedRef.current) {
      passedRef.current = true;
      const store = useProgress.getState();
      store.completeMission(mission.id, mission.id === 'final');
      const tokens = mission.unlocks.map((id) => ({
        id,
        label: MOD_BY_ID[id]?.label ?? id.toUpperCase(),
      }));
      if (tokens.length) setUnlockTokens(tokens);
      synth.play(tokens.length ? 'unlock' : 'success');
    }
    if (!missionComplete) passedRef.current = false;
  }, [missionComplete, mission]);

  const status: FeedbackStatus = diagnostic
    ? 'error'
    : missionComplete
      ? 'complete'
      : worldUpdated
        ? 'updated'
        : 'ready';

  /* ----------------------------------------------------------- interactions */

  const focusGame = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    stageRef.current?.querySelector<HTMLCanvasElement>('canvas')?.focus({ preventScroll: true });
    setEditorFocused(false);
    synth.unlock();
  }, []);

  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => editorViewRef.current?.focus());
  }, []);


  const handleLaunch = useCallback(() => {
    synth.unlock();
    engineRef.current?.launch();
    focusGame();
  }, [focusGame]);

  const handleResetCode = useCallback(() => {
    const store = useProgress.getState();
    const previous = previousMission(mission.id);
    const previousCode = previous ? (store.codes[previous.id] ?? '') : '';
    setCode(seedMissionCode(previousCode, mission));
  }, [mission]);

  const handleBack = useCallback(() => {
    const previous = previousMission(mission.id);
    if (!previous) return;
    useProgress.getState().setMission(previous.id);
    navigate({ name: 'lab', missionId: previous.id, debug: debugFlag });
  }, [mission.id, debugFlag]);

  const handleNext = useCallback(() => {
    const next = nextMission(mission.id);
    if (!next) return;
    useProgress.getState().setMission(next.id);
    navigate({ name: 'lab', missionId: next.id, debug: debugFlag });
  }, [mission.id, debugFlag]);

  const handleResetFullGame = useCallback(() => {
    const confirmed = window.confirm(
      'Reset the full Vector Zero game? This clears every mission, saved code, unlock and high score.',
    );
    if (!confirmed) return;
    useProgress.getState().resetProgress();
    navigate({ name: 'landing' });
  }, []);

  const handleFullscreen = useCallback(() => {
    const host = stageRef.current?.closest('.lab') as HTMLElement | null;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void (host ?? stageRef.current)?.requestFullscreen?.();
  }, []);


  const handleInsertCode = useCallback((snippet: string, mode: ModInsertMode = 'replace') => {
    requestAnimationFrame(() => applyModToEditor(editorViewRef.current, snippet, mode));
  }, []);

  const pipeline = `C# · VECTOR ZERO · ${mission.code}`;

  /* -------------------------------------------------------------------- view */

  return (
    <div className={`lab crt-cabinet ${touch ? 'lab--touch' : ''} ${editorFocused ? 'lab--coding' : 'lab--flying'}`}>
      <CrtGlass />
      <TopBar
        gameName="VECTOR ZERO"
        missions={MISSIONS}
        completed={progress.completed}
        paused={phase === 'paused'}
        sound={progress.settings.sound}
        onHome={() => navigate({ name: 'landing' })}
        onResetCode={handleResetCode}
        onResetFullGame={handleResetFullGame}
        onTogglePause={() => { engineRef.current?.togglePause(); if (phase === 'paused') focusGame(); }}
        onRestart={() => { engineRef.current?.restart(); focusGame(); }}
        onToggleSound={() => {
          const next = !progress.settings.sound;
          useProgress.getState().setSetting('sound', next);
          engineRef.current?.setSound(next);
        }}
        onFullscreen={handleFullscreen}
        onSettings={() => setSettingsOpen(true)}
        onOpenLibrary={() => { setLibraryOpen((open) => !open); focusGame(); }}
      />


      <div className="lab__body" style={{ ['--split' as string]: `${Math.round(progress.settings.splitRatio * 100)}%` }}>
        <section id="code-panel" className={`lab__left ${libraryCoach ? 'lab__left--coach-outside' : ''}`} aria-label="Code and mission">
          <div className="lab__editorZone">
            <div className={`lab__editor ${editorCoach ? 'lab__editor--coaching' : ''}`}>
              <div className="lab__editorHead">
                <span className="lab__filename mono">main.cs</span>
                <button className="lab__arrange" onClick={() => setOrderOpen(true)} title="Reorder whole code blocks">⠿ Arrange</button>
                <span className="lab__autosave">Auto-save <b>ON</b></span>
              </div>
              <CodeEditor
                value={code}
                onChange={setCode}
                errorLines={diagnostic ? [diagnostic.line] : []}
                onFocusChange={setEditorFocused}
                onViewReady={view => { editorViewRef.current = view; }}
                coach={editorCoach}
                onDismissCoach={() => setDismissedCoachKey(coachKey)}
              />
            </div>
            <FeedbackPanel status={status} diagnostic={diagnostic} ruleCount={program.rules.length} guidance={guidance} />
            <ModStrip mods={unlockedModList} tools={codeTools} activeTargetId={guidance.targetId} totalMods={MODS.length} collapsed={modStripCollapsed} onToggleCollapsed={() => setModStripCollapsed(v => !v)} onInsert={handleInsertCode} onOpenLibrary={() => setLibraryOpen(true)} coach={libraryCoach} onDismissCoach={() => setDismissedCoachKey(coachKey)} />
          </div>
        </section>
        <ResizeHandle ratio={progress.settings.splitRatio} onChange={ratio => useProgress.getState().setSetting('splitRatio', ratio)} />
        <section id="flight-panel" className="lab__right" aria-label="Vector Zero game">
          <div className="lab__stageHost" ref={stageRef}>
            <div className="stage-frame">
              <GameStage canvasRef={canvasRef} engine={engineRef.current} phase={phase} snapshot={snapshot} showTouchControls={false} onLaunch={handleLaunch} onResume={() => engineRef.current?.resume()} onRestart={() => engineRef.current?.restart()} onFocusGame={focusGame} statusNote={mission.kind === 'sandbox' ? 'Every Mod you discovered is unlocked. Change anything.' : pipeline} missionName={mission.kind === 'sandbox' ? mission.code : `MISSION ${String(mission.order).padStart(2, '0')} · ${mission.code}`} coach={coach && !guidance.targetId && !missionComplete ? { ...coach, onDismiss: () => setDismissedCoachKey(coachKey) } : undefined} />
            </div>
            <ModLibrary open={libraryOpen} onClose={() => { setLibraryOpen(false); focusEditor(); }} unlocked={unlockedModList} totalMods={MODS.length} onInsert={(snippet, mode) => { setLibraryOpen(false); handleInsertCode(snippet, mode); }} />
            {unlockTokens.length ? <UnlockBurst tokens={unlockTokens} onDone={() => setUnlockTokens([])} /> : null}
          </div>
        </section>
      </div>
      <div className="lab__console">
        {touch ? <TouchControls engine={engineRef.current} onEngage={focusGame} /> : null}
        <div className="lab__briefing">
          <div className="lab__missionZone">
            <MissionPanel mission={mission} complete={missionPassed} onBack={handleBack} onNext={handleNext} hasPrevious={Boolean(previousMission(mission.id))} hasNext={Boolean(nextMission(mission.id))} coach={coach && missionComplete ? coach : undefined} onDismissCoach={() => setDismissedCoachKey(coachKey)} />
          </div>
        </div>
      </div>
      {orderOpen ? <CodeOrder code={code} onClose={() => { setOrderOpen(false); focusEditor(); }} onChange={next => { const view = editorViewRef.current; if (view) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } }); }} /> : null}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} studentName={progress.studentName} sound={progress.settings.sound} debug={progress.settings.debug} splitRatio={progress.settings.splitRatio} bestScore={progress.bestScore} completedCount={progress.completed.length}
        onRename={name => useProgress.getState().setStudentName(name)}
        onToggleSound={() => { const next = !progress.settings.sound; useProgress.getState().setSetting('sound', next); engineRef.current?.setSound(next); }}
        onToggleDebug={() => useProgress.getState().setSetting('debug', !progress.settings.debug)}
        onSplitRatio={ratio => useProgress.getState().setSetting('splitRatio', ratio)}
        onResetProgress={() => { useProgress.getState().resetProgress(); navigate({ name: 'landing' }); }} />
      <DebugPanel open={debugVisible} onClose={() => useProgress.getState().setSetting('debug', false)} engine={engineRef.current} mission={mission} program={program} config={liveConfig} unlocked={unlocked} editorFocused={editorFocused} />
    </div>
  );
}
