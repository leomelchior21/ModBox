import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import { GameWorkspace } from '../../components/GameWorkspace';
import { TopBar } from '../../components/TopBar';
import { SettingsDialog } from '../../components/SettingsDialog';
import { CoachBubble } from '../../components/CoachBubble';
import { applyModToEditor } from '../../editor/CodeEditor';
import type { ModInsertMode } from '../../editor/modEditing';
import { normalizeVariableSpacing } from '../../editor/languageEditing';
import { codeKey, fileNameForLanguage, formatCodeForLanguage, localizeMod, localizeTool } from '../../interpreter/languageSyntax';
import { parseGameScript } from '../../interpreter/gameScript';
import { navigate } from '../../app/router';
import { useProgress } from '../../state/progressStore';
import { useDebouncedValue, useMediaQuery } from '../../utils/hooks';
import { useGameCode } from '../useGameCode';
import type { GameScreenProps } from '../types';
import { MAZE_MODS, MAZE_RUNTIME_LABELS, MAZE_TOOLS, mazeSchema, type MazeConfig } from './mods';
import { MAZE_MISSIONS, MAZE_STARTER, MAZE_SANDBOX, getMazeMission, mazeGuidance, mazeMissionPassed, mazeUnlocked, playableMazeProgram } from './missions';
import { NeonMazeRun, type MazeInput } from './run';
import { drawMaze, MAZE_COLORS } from './render';
import { MazeJoystick, PhaseButton } from './controls';
import { MazeSound } from './sound';
import './neon-maze.css';

const MAZE_COACH_TARGETS = {
  'maze-log': /(?:Console\.WriteLine|print)/, 'maze-math': /^\s*moveSpeed\s*=/,
  'maze-score': /^\s*if.*\bscore\b/, 'maze-energy': /^\s*if.*\benergy\b/,
};
const KEY_INPUT: Record<string, keyof MazeInput> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'phase' };
const modInteractionOpen = () => Boolean(document.querySelector('.mod-options, .topbar__more[open], .modal'));

export function NeonMazeScreen({ gameId, missionId, debugFlag }: GameScreenProps): JSX.Element {
  const progress = useProgress(), language = progress.activeLanguage;
  const mission = getMazeMission(missionId ?? progress.currentMissionId);
  const starter = useMemo(() => {
    const saved = useProgress.getState().getGameProgress(gameId).codes;
    const previous = MAZE_MISSIONS[mission.order - 1];
    const carried = previous ? saved[codeKey(language, previous.id)] : undefined;
    return normalizeVariableSpacing(carried ?? formatCodeForLanguage(mission.kind === 'sandbox' ? MAZE_SANDBOX : MAZE_STARTER, language), language);
  }, [gameId, mission.id, mission.order, mission.kind, language]);
  const { code, onChange } = useGameCode(gameId, mission.id, language, starter);
  const debounced = useDebouncedValue(code, 220);
  const program = useMemo(() => parseGameScript<MazeConfig>(debounced, language, mazeSchema), [debounced, language]);
  const unlocked = useMemo(() => mazeUnlocked(mission, progress.completed, progress.freeModeUnlocked), [mission, progress.completed, progress.freeModeUnlocked]);
  const liveProgram = useMemo(() => playableMazeProgram(program, unlocked.map(mod => mod.id)), [program, unlocked]);
  const run = useMemo(() => new NeonMazeRun(), []), sound = useMemo(() => new MazeSound(), []);
  const [snapshot, setSnapshot] = useState(() => run.snapshot());
  const [focused, setFocused] = useState(false), [libraryOpen, setLibraryOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false), [dismissed, setDismissed] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null), editor = useRef<EditorView | null>(null), stage = useRef<HTMLDivElement>(null);
  const input = useRef<MazeInput>({ up: false, right: false, down: false, left: false, phase: false });
  const blocked = useRef(false); blocked.current = focused || libraryOpen || settingsOpen;
  const touch = useMediaQuery('(any-pointer: coarse)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const diagnostic = program.diagnostics.find(d => d.severity === 'error');
  const passed = mazeMissionPassed(mission, liveProgram, snapshot) || progress.completed.includes(mission.id);
  const fullGameReady = mission.kind === 'final' && passed;
  const guidance = mazeGuidance(mission, liveProgram, snapshot, passed);
  const showCoach = !diagnostic && dismissed !== `${mission.id}:${guidance.message}`;
  const editorTarget = Boolean(guidance.targetId && program.symbols.some(s => s.mod === guidance.targetId));
  const clearInput = useCallback(() => { for (const key of Object.keys(input.current) as (keyof MazeInput)[]) input.current[key] = false; }, []);
  const update = useCallback(() => { setSnapshot(run.snapshot()); }, [run]);
  const focusGame = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.(); canvas.current?.focus({ preventScroll: true }); setFocused(false); sound.unlock();
  }, [sound]);
  const launch = useCallback(() => { sound.unlock(); clearInput(); run.launch(); update(); focusGame(); }, [sound, run, update, focusGame, clearInput]);
  const insert = useCallback((snippet: string, mode?: ModInsertMode) => applyModToEditor(editor.current, snippet, mode, language), [language]);
  const dismiss = () => setDismissed(`${mission.id}:${guidance.message}`);

  useEffect(() => {
    const store = useProgress.getState(); store.setMission(mission.id);
    if (store.getGameProgress(gameId).codes[codeKey(language, mission.id)] === undefined) store.setGameCode(gameId, codeKey(language, mission.id), code);
  }, [gameId, language, mission.id]); // Initial save; useGameCode saves every later edit immediately.
  useEffect(() => { run.setProgram(liveProgram); update(); }, [liveProgram, run, update]);
  useEffect(() => { sound.muted = !progress.settings.sound; }, [progress.settings.sound, sound]);
  useEffect(() => {
    if (passed && mission.kind !== 'sandbox' && !progress.completed.includes(mission.id)) useProgress.getState().completeMission(mission.id, mission.kind === 'final');
  }, [passed, mission, progress.completed]);
  useEffect(() => { if (guidance.targetId) setCollapsed(false); }, [guidance.targetId]);

  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d');
    if (!element || !context) return;
    let raf = 0, last = performance.now(), reported = 0, width = 600, height = 600, alive = true;
    const resize = () => {
      const rect = element.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      element.width = Math.round(width * dpr); element.height = Math.round(height * dpr); context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(element);
    const draw = (now: number) => {
      if (!alive) return;
      const previous = run.phase;
      if (blocked.current || modInteractionOpen()) clearInput();
      else run.step((now - last) / 1000, input.current);
      last = now;
      for (const event of run.events.splice(0)) sound.play(event);
      drawMaze(context, run, width, height, now / 1000, reducedMotion);
      if (now - reported > 120 || previous !== run.phase) { update(); reported = now; }
      raf = requestAnimationFrame(draw);
    };
    draw(last);
    return () => { alive = false; cancelAnimationFrame(raf); observer.disconnect(); clearInput(); };
  }, [run, update, clearInput, reducedMotion, sound]);
  useEffect(() => () => sound.destroy(), [sound]);
  useEffect(() => {
    const typing = () => Boolean((document.activeElement as HTMLElement | null)?.closest('input,textarea,select,[contenteditable="true"],.cm-editor,button,summary'));
    const keydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || blocked.current || modInteractionOpen() || typing()) return;
      if (KEY_INPUT[e.code] && run.phase === 'playing') {
        e.preventDefault();
        const direction = KEY_INPUT[e.code];
        if (direction !== 'phase') {
          input.current.up = input.current.right = input.current.down = input.current.left = false;
          run.requestTurn(direction);
        }
        input.current[direction] = true;
      }
      if (e.code === 'KeyP') { e.preventDefault(); clearInput(); run.phase === 'paused' ? run.resume() : run.pause(); update(); }
      if (e.code === 'Enter' && run.phase === 'launch') { e.preventDefault(); launch(); }
    };
    const keyup = (e: KeyboardEvent) => { if (KEY_INPUT[e.code]) input.current[KEY_INPUT[e.code]] = false; };
    const blur = () => { clearInput(); run.pause(); update(); };
    const hidden = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hidden); clearInput(); };
  }, [run, update, launch, clearInput]);
  useEffect(() => {
    if (snapshot.score > useProgress.getState().bestScore) useProgress.getState().setBestScore(snapshot.score);
  }, [snapshot.score]);

  const go = (next: typeof mission) => {
    clearInput(); const store = useProgress.getState();
    if (next.kind === 'sandbox' && store.codes[codeKey(language, next.id)] === undefined) store.setGameCode(gameId, codeKey(language, next.id), code);
    store.setMission(next.id); navigate({ name: 'lab', gameId, missionId: next.id, debug: debugFlag });
  };
  const next = MAZE_MISSIONS[mission.order + 1], previous = MAZE_MISSIONS[mission.order - 1];
  const mods = useMemo(() => unlocked.map(mod => localizeMod(mod, language)), [unlocked, language]);
  const tools = useMemo(() => MAZE_TOOLS.filter(tool => mission.kind === 'sandbox' || progress.freeModeUnlocked || tool.unlockAt <= mission.order)
    .map(tool => localizeTool(tool, language)), [mission.kind, mission.order, progress.freeModeUnlocked, language]);
  const playing = snapshot.phase === 'playing';
  const onPhase = () => { focusGame(); run.phaseJump(); update(); };

  return <GameWorkspace gameId={gameId} gameTitle="NEON MAZE" touch={touch} coding={focused}
    header={<TopBar gameName="NEON MAZE" missions={MAZE_MISSIONS} completed={progress.completed} paused={snapshot.phase === 'paused'} sound={progress.settings.sound}
      restartLabel="Restart maze" onHome={() => navigate({ name: 'landing' })} onRestart={launch}
      onTogglePause={() => { clearInput(); run.phase === 'paused' ? run.resume() : run.pause(); update(); focusGame(); }}
      onResetCode={() => onChange(starter)} onResetFullGame={() => { if (window.confirm('Reset NEON MAZE? This clears its missions, code and high score.')) { useProgress.getState().resetCurrentGame(); navigate({ name: 'landing' }); } }}
      onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onSettings={() => setSettingsOpen(true)} onOpenLibrary={() => setLibraryOpen(true)}
      onFullscreen={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void stage.current?.closest('.lab')?.requestFullscreen?.(); }} />}
    editor={{ value: code, onChange, language, mods: MAZE_MODS, runtimeLabels: MAZE_RUNTIME_LABELS, coachTargets: MAZE_COACH_TARGETS,
      errorLines: diagnostic ? [diagnostic.line] : [], onFocusChange: value => { setFocused(value); clearInput(); }, onViewReady: view => { editor.current = view; },
      coach: showCoach && guidance.targetId && editorTarget
        ? { key: guidance.message, message: guidance.message, targetId: guidance.targetId } : undefined,
      onDismissCoach: dismiss, ariaLabel: `${language} maze code editor` }}
    editorToolbar={<><span className="lab__filename mono">{fileNameForLanguage(language)}</span><span className="lab__autosave">Auto-save <b>ON</b></span></>}
    feedback={{ status: diagnostic ? 'error' : passed ? 'complete' : 'ready', diagnostic, ruleCount: liveProgram.rules.length, guidance }}
    modStrip={{ mods, tools, totalMods: MAZE_MODS.length, collapsed, onToggleCollapsed: () => setCollapsed(v => !v), onInsert: insert, onOpenLibrary: () => setLibraryOpen(true), language,
      activeTargetId: guidance.targetId, coach: showCoach && guidance.targetId && !editorTarget ? guidance : undefined, onDismissCoach: dismiss }}
    library={{ open: libraryOpen, onClose: () => { setLibraryOpen(false); focusGame(); }, onInsert: (snippet, mode) => { setLibraryOpen(false); insert(snippet, mode); } }}
    stageRef={stage}
    stage={<div className={`stage neon-stage ${passed && next ? 'stage--missionReady' : ''} ${fullGameReady ? 'stage--fullGameReady' : ''}`} style={{ '--maze-neon': MAZE_COLORS[snapshot.config.wallColor] } as React.CSSProperties}>
      <canvas ref={canvas} className="stage__canvas" tabIndex={0} onPointerDown={focusGame} aria-label="Neon Maze game. Your runner moves continuously. Arrow keys or WASD to steer; Space to phase jump; P to pause." />
      <div className="neon__hud" aria-label="Maze status">
        <div><small>SECTOR {String(snapshot.level).padStart(2, '0')} · {snapshot.config.runnerName}</small><strong>{String(snapshot.score).padStart(5, '0')}</strong></div>
        <div className="neon__hudRight"><span>◆ {snapshot.cores}/3 <b>CORES</b> · {snapshot.lives} <b>LIVES</b></span><label>ENERGY <meter min={0} max={100} low={40} high={70} optimum={100} value={snapshot.energy} /> {snapshot.energy}%</label></div>
      </div>
      {playing && focused ? <span className="neon__editing">EDITING · MAZE CLOCK HELD</span> : null}
      <div className="neon__log" aria-label="Signal log"><small>SIGNAL FEED</small>{snapshot.messages.slice(0, touch ? 1 : 2).map((message, i) => <p key={`${i}:${message}`}>{message}</p>)}</div>
      {playing ? <div className="touchbar neon__controls">
        {!touch ? <span className="neon__keys">ALWAYS MOVING · WASD / ARROWS TO STEER · SPACE TO PHASE</span> : null}
        <div className={`touchbar__cluster ${touch ? 'touchbar__cluster--left' : 'touchbar__cluster--right'}`}><PhaseButton cooldown={snapshot.phaseCooldown} onPhase={onPhase} /></div>
        {touch ? <MazeJoystick input={input.current} onEngage={focusGame} onTurn={direction => run.requestTurn(direction)} /> : null}
      </div> : null}
      {snapshot.phase !== 'playing' ? <div className={`overlay neon__overlay neon__overlay--${snapshot.phase}`}>
        <div className="neon__panel">
          <span className="neon__eyebrow">{mission.kind === 'sandbox' ? 'EVERY MOD UNLOCKED' : `MISSION ${mission.order + 1}/8 · ${mission.title}`}</span>
          <div className="neon__emblem" aria-hidden="true">◈</div>
          <h1>{snapshot.phase === 'launch' ? 'NEON MAZE' : snapshot.phase === 'cleared' ? 'SECTOR CLEAR' : snapshot.phase === 'paused' ? 'SIGNAL HELD' : 'SIGNAL LOST'}</h1>
          <p>{snapshot.phase === 'cleared' ? 'Three cores linked. One way out. Your next labyrinth awaits.' : snapshot.phase === 'gameover' ? `You scored ${snapshot.score}. Rewire your mods and run it again.` : 'Keep moving. Queue your turns, link three cores, and outsmart the sentinels to reach the exit.'}</p>
          <div className="neon__legend"><span><i className="neon__legendRunner" /> YOU</span><span><i className="neon__legendCore" /> CORE</span><span><i className="neon__legendHunter" /> SENTINEL</span></div>
          <button className="btn neon__enter" onClick={() => {
            if (snapshot.phase === 'paused') run.resume(); else if (snapshot.phase === 'cleared') run.advance(); else run.launch();
            update(); focusGame();
          }}>{snapshot.phase === 'paused' ? 'RESUME RUN' : snapshot.phase === 'cleared' ? 'NEXT SECTOR →' : snapshot.phase === 'gameover' ? 'RUN AGAIN →' : 'ENTER THE MAZE →'}</button>
          <small>{touch ? 'ALWAYS MOVING · JOYSTICK TO STEER · PHASE TO JUMP' : 'ALWAYS MOVING · WASD / ARROWS TO STEER · SPACE TO PHASE · P TO PAUSE'}</small>
        </div>
      </div> : null}
      {previous ? <button className="stage__missionBack" onClick={() => go(previous)}>← Previous mission</button> : null}
      {passed && next ? <div className="stage__missionNext"><button className="mission__next mission__next--ready" onClick={() => go(next)}>{fullGameReady ? 'Play full game' : 'NEXT MISSION'} <span aria-hidden="true">→</span></button></div> : null}
      {showCoach && !guidance.targetId && !passed && snapshot.metrics.steps === 0 ? <CoachBubble className="coach-bubble--stage" message={guidance.message} onDismiss={dismiss} /> : null}
    </div>}
    overlays={<>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} studentName={progress.studentName} sound={progress.settings.sound} debug={progress.settings.debug} bestScore={progress.bestScore} completedCount={progress.completed.length}
        onRename={name => useProgress.getState().setStudentName(name)} onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onToggleDebug={() => useProgress.getState().setSetting('debug', !progress.settings.debug)}
        onResetProgress={() => { useProgress.getState().resetProgress(); navigate({ name: 'landing' }); }} />
      {debugFlag || progress.settings.debug ? <pre className="neon__debug" aria-label="Maze debug state">{JSON.stringify({ phase: snapshot.phase, config: snapshot.config, metrics: snapshot.metrics, ignored: Object.keys(program.config).filter(key => !unlocked.some(mod => mod.id === key)) }, null, 2)}</pre> : null}
    </>} />;
}
