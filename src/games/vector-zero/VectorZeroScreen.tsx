import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodeOrder } from '../../components/CodeOrder';
import { VhsBoot } from '../../components/VhsBoot';
import { TopBar } from '../../components/TopBar';
import { CoachBubble } from '../../components/CoachBubble';
import { type FeedbackStatus } from '../../components/FeedbackPanel';
import { UnlockBurst, type UnlockToken } from '../../components/UnlockBurst';
import { SettingsDialog } from '../../components/SettingsDialog';
import { DebugPanel } from '../../components/DebugPanel';
import { GameStage, Joystick } from '../../components/GameStage';
import { applyModToEditor } from '../../editor/CodeEditor';
import { normalizeVariableSpacing } from '../../editor/languageEditing';
import type { ModInsertMode } from '../../editor/modEditing';
import { requireAdapter } from '../../interpreter/adapters';
import { languageById } from '../../interpreter/core/adapter';
import { codeKey, fileNameForLanguage, localizeLanguageCopy, localizeMission, localizeMod, localizeTool } from '../../interpreter/languageSyntax';
import { summarize } from '../../interpreter/core/summarize';
import { MODS, MOD_BY_ID, RUNTIME_LABELS } from '../../interpreter/core/mods';
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
import { navigate } from '../../app/router';
import { GameWorkspace } from '../../components/GameWorkspace';
import type { GameScreenProps } from '../types';

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

const COACH_TARGETS: Readonly<Record<string, RegExp>> = {
  writeline: /\b(?:Console\.WriteLine|print)\b/,
  'power-math': /^\s*laserPower\s*=/,
  'score-rule': /^\s*if\s*\(?[^\n]*\bscore\b/,
  'health-rule': /^\s*if\s*\(?[^\n]*\bhealth\b/,
};

export function VectorZeroScreen({ gameId, missionId, debugFlag }: GameScreenProps): JSX.Element {
  const progress = useProgress();
  const language = progress.activeLanguage;
  const adapter = useMemo(() => requireAdapter(language), [language]);
  const mission = useMemo(
    () => localizeMission(getMission(missionId ?? progress.currentMissionId), language),
    [missionId, progress.currentMissionId, language],
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
  const [gameBooting, setGameBooting] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setGameBooting(false), 1050);
    return () => window.clearTimeout(timer);
  }, []);

  const touch = useMediaQuery('(any-pointer: coarse)');
  const tabletViewport = useMediaQuery('(min-width: 601px) and (min-height: 600px)');
  const dockJoystick = touch && tabletViewport;
  const debugVisible = debugFlag || progress.settings.debug;

  /* ------------------------------------------------------------ live parsing */

  const debouncedCode = useDebouncedValue(code, 380);
  const program = useMemo(() => adapter.parse(debouncedCode), [adapter, debouncedCode]);
  const summary = useMemo(() => summarize(program), [program]);
  const diagnostic = program.diagnostics.find((entry) => entry.severity === 'error');

  const unlocked = useMemo(
    () => unlockedMods(progress.completed, mission.id, progress.freeModeUnlocked),
    [progress.completed, mission.id, progress.freeModeUnlocked],
  );

  const unlockedModList = useMemo(
    () => MODS.filter((mod) => unlocked.includes(mod.id)).sort((a, b) => {
      const aCurrent = mission.unlocks.indexOf(a.id);
      const bCurrent = mission.unlocks.indexOf(b.id);
      if (aCurrent >= 0 && bCurrent >= 0) return aCurrent - bCurrent;
      if (aCurrent >= 0) return -1;
      if (bCurrent >= 0) return 1;
      return b.unlockAt - a.unlockAt;
    }).map((mod) => localizeMod(mod, language)),
    [mission.unlocks, unlocked, language],
  );

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
    const key = codeKey(language, mission.id);
    const existing = store.codes[key] ?? (language === 'csharp' ? store.codes[mission.id] : undefined);
    if (existing !== undefined) {
      const normalized = normalizeVariableSpacing(existing, language);
      setCode(normalized);
      if (normalized !== existing) store.setCode(key, normalized);
      return;
    }
    const previous = previousMission(mission.id);
    const previousCode = previous ? (store.codes[codeKey(language, previous.id)] ?? (language === 'csharp' ? store.codes[previous.id] ?? '' : '')) : '';
    const seeded = normalizeVariableSpacing(seedMissionCode(previousCode, mission), language);
    setCode(seeded);
    store.setCode(key, seeded);
  }, [mission, language]);

  // 4. push every parse result into the living game
  useEffect(() => {
    engineRef.current?.setProgram(engineProgram);
  }, [engineProgram]);

  // 5. keep the engine mute state in sync with settings
  useEffect(() => {
    engineRef.current?.setSound(progress.settings.sound);
  }, [progress.settings.sound]);

  useEffect(() => {
    engineRef.current?.setTouchControls(touch);
  }, [touch]);

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
    () => {
      const step = copilotStep(mission, validationContext, validation);
      return { ...step, message: localizeLanguageCopy(step.message, language), hint: step.hint ? localizeLanguageCopy(step.hint, language) : undefined };
    },
    [mission, validationContext, validation, language],
  );
  const codeTools = useMemo(() => codeToolsForMission(mission).map((tool) => localizeTool(tool, language)), [mission, language]);

  const missionComplete = mission.requirements.length > 0 && validation.passed;
  const missionPassed = missionComplete || progress.completed.includes(mission.id);
  const coachKey = `${mission.id}:${guidance.message}`;
  const coachVisible = !diagnostic && dismissedCoachKey !== coachKey;
  const libraryStep = Boolean(
    guidance.targetId && /^(Add|Build)\b/i.test(guidance.message),
  );
  const coach = coachVisible ? { ...guidance, message: coachPopupMessage(guidance, language) } : undefined;
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

  const handleCodeChange = useCallback((value: string) => {
    setCode(value);
    useProgress.getState().setGameCode(gameId, codeKey(language, mission.id), value);
  }, [gameId, language, mission.id]);

  const handleResetCode = useCallback(() => {
    const store = useProgress.getState();
    const previous = previousMission(mission.id);
    const previousCode = previous ? (store.codes[codeKey(language, previous.id)] ?? (language === 'csharp' ? store.codes[previous.id] ?? '' : '')) : '';
    handleCodeChange(normalizeVariableSpacing(seedMissionCode(previousCode, mission), language));
  }, [mission, language, handleCodeChange]);

  const handleBack = useCallback(() => {
    const previous = previousMission(mission.id);
    if (!previous) return;
    useProgress.getState().setCode(codeKey(language, mission.id), code);
    useProgress.getState().setMission(previous.id);
    navigate({ name: 'lab', gameId, missionId: previous.id, debug: debugFlag });
  }, [gameId, mission.id, debugFlag, language, code]);

  const handleNext = useCallback(() => {
    const next = nextMission(mission.id);
    if (!next) return;
    useProgress.getState().setCode(codeKey(language, mission.id), code);
    useProgress.getState().setMission(next.id);
    navigate({ name: 'lab', gameId, missionId: next.id, debug: debugFlag });
  }, [gameId, mission.id, debugFlag, language, code]);

  const handleResetFullGame = useCallback(() => {
    const confirmed = window.confirm(
      'Reset the full Vector Zero game? This clears every mission, saved code, unlock and high score.',
    );
    if (!confirmed) return;
    useProgress.getState().resetCurrentGame();
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
    requestAnimationFrame(() => applyModToEditor(editorViewRef.current, snippet, mode, language));
  }, [language]);

  const pipeline = `${languageById(language).label.toUpperCase()} · VECTOR ZERO · ${mission.code}`;

  /* -------------------------------------------------------------------- view */

  return <GameWorkspace
    gameId={gameId} gameTitle="VECTOR ZERO" touch={touch} coding={editorFocused}
    header={<TopBar
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
      />}
    editor={{ value: code, onChange: handleCodeChange, mods: MODS, runtimeLabels: RUNTIME_LABELS, coachTargets: COACH_TARGETS,
      errorLines: diagnostic ? [diagnostic.line] : [], onFocusChange: setEditorFocused,
      onViewReady: view => { editorViewRef.current = view; }, coach: editorCoach,
      onDismissCoach: () => setDismissedCoachKey(coachKey), language,
      ariaLabel: `${languageById(language).label} code editor` }}
    editorToolbar={<>
      <span className="lab__filename mono">{fileNameForLanguage(language)}</span>
      {language === 'csharp' ? <button className="lab__arrange" onClick={() => setOrderOpen(true)} title="Reorder whole code blocks">&#x283F; Arrange</button> : null}
      <span className="lab__autosave">Auto-save <b>ON</b></span>
    </>}
    feedback={{ status, diagnostic, ruleCount: program.rules.length, guidance }}
    modStrip={{ mods: unlockedModList, tools: codeTools, activeTargetId: guidance.targetId, totalMods: MODS.length,
      collapsed: modStripCollapsed, onToggleCollapsed: () => setModStripCollapsed(v => !v), onInsert: handleInsertCode,
      onOpenLibrary: () => setLibraryOpen(true), coach: libraryCoach,
      onDismissCoach: () => setDismissedCoachKey(coachKey), language }}
    modAreaExtras={dockJoystick ? <div className="lab__joystickDock">
      {phase === 'playing' || phase === 'respawn'
        ? <Joystick engine={engineRef.current} onEngage={focusGame} />
        : <span className="lab__joystickStandby" aria-hidden="true">FLIGHT</span>}
    </div> : undefined}
    library={{ open: libraryOpen, onClose: () => { setLibraryOpen(false); focusEditor(); },
      onInsert: (snippet, mode) => { setLibraryOpen(false); handleInsertCode(snippet, mode); } }}
    stageRef={stageRef}
    stage={<GameStage canvasRef={canvasRef} engine={engineRef.current} phase={phase} snapshot={snapshot} showTouchControls={touch} dockJoystick={dockJoystick} onLaunch={handleLaunch} onResume={() => engineRef.current?.resume()} onRestart={() => engineRef.current?.restart()} onFocusGame={focusGame} missionReady={missionPassed && Boolean(nextMission(mission.id))} statusNote={mission.kind === 'sandbox' ? 'Every Mod you discovered is unlocked. Change anything.' : pipeline} missionName={mission.kind === 'sandbox' ? mission.code : `MISSION ${String(mission.order).padStart(2, '0')} · ${mission.code}`} coach={coach && !guidance.targetId && !missionComplete ? { ...coach, onDismiss: () => setDismissedCoachKey(coachKey) } : undefined}>
                {previousMission(mission.id) ? <button type="button" className="stage__missionBack" onClick={event => { event.stopPropagation(); handleBack(); }}>← Previous mission</button> : null}
                {missionPassed && nextMission(mission.id) ? (
                  <div className="stage__missionNext">
                    <button type="button" className="mission__next mission__next--ready" onClick={event => { event.stopPropagation(); handleNext(); }}>NEXT MISSION <span aria-hidden="true">→</span></button>
                  </div>
                ) : null}
                {coach && missionComplete && nextMission(mission.id) ? <CoachBubble className="coach-bubble--mission" message={coach.message} onDismiss={() => setDismissedCoachKey(coachKey)} /> : null}
              </GameStage>}
    stageExtras={unlockTokens.length ? <UnlockBurst tokens={unlockTokens} onDone={() => setUnlockTokens([])} /> : null}
    overlays={<>
      {orderOpen ? <CodeOrder code={code} onClose={() => { setOrderOpen(false); focusEditor(); }} onChange={next => { const view = editorViewRef.current; if (view) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } }); }} /> : null}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} studentName={progress.studentName} sound={progress.settings.sound} debug={progress.settings.debug} bestScore={progress.bestScore} completedCount={progress.completed.length}
        onRename={name => useProgress.getState().setStudentName(name)}
        onToggleSound={() => { const next = !progress.settings.sound; useProgress.getState().setSetting('sound', next); engineRef.current?.setSound(next); }}
        onToggleDebug={() => useProgress.getState().setSetting('debug', !progress.settings.debug)}
        onResetProgress={() => { useProgress.getState().resetProgress(); navigate({ name: 'landing' }); }} />
      <DebugPanel open={debugVisible} onClose={() => useProgress.getState().setSetting('debug', false)} engine={engineRef.current} mission={mission} program={program} config={liveConfig} unlocked={unlocked} editorFocused={editorFocused} />
      {gameBooting ? <VhsBoot mode="game" title={mission.code} /> : null}
    </>}
  />;
}
