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
import { FLOOR_MODS, FLOOR_RUNTIME_LABELS, FLOOR_TOOLS, floorSchema, type FloorConfig } from './mods';
import { FLOOR_MISSIONS, FLOOR_STARTER, FLOOR_SANDBOX, getFloorMission, floorGuidance, floorMissionPassed, floorUnlocked, playableFloorProgram } from './missions';
import { DevilFloorRun, type FloorInput } from './run';
import { drawFloor, FLOOR_COLORS } from './render';
import { FloorControls } from './controls';
import { FloorSound } from './sound';
import './devil-floor.css';

const FLOOR_COACH_TARGETS = {
  'floor-log': /(?:Console\.WriteLine|print)/, 'floor-math': /^\s*moveSpeed\s*=/,
  'floor-score': /^\s*if.*\bscore\b/, 'floor-lives': /^\s*if.*\blives\b/,
};
const KEY_INPUT: Record<string, keyof FloorInput> = { ArrowUp: 'jump', KeyW: 'jump', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump' };
const modInteractionOpen = () => Boolean(document.querySelector('.mod-options, .topbar__more[open], .modal'));

export function DevilFloorScreen({ gameId, missionId, debugFlag }: GameScreenProps): JSX.Element {
  const progress = useProgress(), language = progress.activeLanguage;
  const mission = getFloorMission(missionId ?? progress.currentMissionId);
  const starter = useMemo(() => {
    const saved = useProgress.getState().getGameProgress(gameId).codes;
    const previous = FLOOR_MISSIONS[mission.order - 1];
    const carried = previous ? saved[codeKey(language, previous.id)] : undefined;
    return normalizeVariableSpacing(carried ?? formatCodeForLanguage(mission.kind === 'sandbox' ? FLOOR_SANDBOX : FLOOR_STARTER, language), language);
  }, [gameId, mission.id, mission.order, mission.kind, language]);
  const { code, onChange } = useGameCode(gameId, mission.id, language, starter);
  const debounced = useDebouncedValue(code, 220);
  const program = useMemo(() => parseGameScript<FloorConfig>(debounced, language, floorSchema), [debounced, language]);
  const unlocked = useMemo(() => floorUnlocked(mission, progress.completed, progress.freeModeUnlocked), [mission, progress.completed, progress.freeModeUnlocked]);
  const liveProgram = useMemo(() => playableFloorProgram(program, unlocked.map(mod => mod.id)), [program, unlocked]);
  const run = useMemo(() => new DevilFloorRun(), []), sound = useMemo(() => new FloorSound(), []);
  const [snapshot, setSnapshot] = useState(() => run.snapshot());
  const [focused, setFocused] = useState(false), [libraryOpen, setLibraryOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false), [dismissed, setDismissed] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null), editor = useRef<EditorView | null>(null), stage = useRef<HTMLDivElement>(null);
  const input = useRef<FloorInput>({ right: false, left: false, jump: false });
  const blocked = useRef(false); blocked.current = focused || libraryOpen || settingsOpen;
  const touch = useMediaQuery('(any-pointer: coarse)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const diagnostic = program.diagnostics.find(d => d.severity === 'error');
  const passed = floorMissionPassed(mission, liveProgram, snapshot) || progress.completed.includes(mission.id);
  const fullGameReady = mission.kind === 'final' && passed;
  const guidance = floorGuidance(mission, liveProgram, snapshot, passed);
  const showCoach = !diagnostic && dismissed !== `${mission.id}:${guidance.message}`;
  const editorTarget = Boolean(guidance.targetId && program.symbols.some(s => s.mod === guidance.targetId));
  const clearInput = useCallback(() => { for (const key of Object.keys(input.current) as (keyof FloorInput)[]) input.current[key] = false; run.releaseInput(); }, [run]);
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
      drawFloor(context, run, width, height, now / 1000, reducedMotion);
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
        input.current[KEY_INPUT[e.code]] = true;
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
  const next = FLOOR_MISSIONS[mission.order + 1], previous = FLOOR_MISSIONS[mission.order - 1];
  const mods = useMemo(() => unlocked.map(mod => localizeMod(mod, language)), [unlocked, language]);
  const tools = useMemo(() => FLOOR_TOOLS.filter(tool => mission.kind === 'sandbox' || progress.freeModeUnlocked || tool.unlockAt <= mission.order)
    .map(tool => localizeTool(tool, language)), [mission.kind, mission.order, progress.freeModeUnlocked, language]);
  const playing = snapshot.phase === 'playing';

  return <GameWorkspace gameId={gameId} gameTitle="DEVIL FLOOR" touch={touch} coding={focused}
    header={<TopBar gameName="DEVIL FLOOR" missions={FLOOR_MISSIONS} completed={progress.completed} paused={snapshot.phase === 'paused'} sound={progress.settings.sound}
      restartLabel="Restart expedition" onHome={() => navigate({ name: 'landing' })} onRestart={launch}
      onTogglePause={() => { clearInput(); run.phase === 'paused' ? run.resume() : run.pause(); update(); focusGame(); }}
      onResetCode={() => onChange(starter)} onResetFullGame={() => { if (window.confirm('Reset DEVIL FLOOR? This clears its missions, code and high score.')) { useProgress.getState().resetCurrentGame(); navigate({ name: 'landing' }); } }}
      onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onSettings={() => setSettingsOpen(true)} onOpenLibrary={() => setLibraryOpen(true)}
      onFullscreen={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void stage.current?.closest('.lab')?.requestFullscreen?.(); }} />}
    editor={{ value: code, onChange, language, mods: FLOOR_MODS, runtimeLabels: FLOOR_RUNTIME_LABELS, coachTargets: FLOOR_COACH_TARGETS,
      errorLines: diagnostic ? [diagnostic.line] : [], onFocusChange: value => { setFocused(value); clearInput(); }, onViewReady: view => { editor.current = view; },
      coach: showCoach && guidance.targetId && editorTarget
        ? { key: guidance.message, message: guidance.message, targetId: guidance.targetId } : undefined,
      onDismissCoach: dismiss, ariaLabel: `${language} platformer code editor` }}
    editorToolbar={<><span className="lab__filename mono">{fileNameForLanguage(language)}</span><span className="lab__autosave">Auto-save <b>ON</b></span></>}
    feedback={{ status: diagnostic ? 'error' : passed ? 'complete' : 'ready', diagnostic, ruleCount: liveProgram.rules.length, guidance }}
    modStrip={{ mods, tools, totalMods: FLOOR_MODS.length, collapsed, onToggleCollapsed: () => setCollapsed(v => !v), onInsert: insert, onOpenLibrary: () => setLibraryOpen(true), language,
      activeTargetId: guidance.targetId, coach: showCoach && guidance.targetId && !editorTarget ? guidance : undefined, onDismissCoach: dismiss }}
    library={{ open: libraryOpen, onClose: () => { setLibraryOpen(false); focusGame(); }, onInsert: (snippet, mode) => { setLibraryOpen(false); insert(snippet, mode); } }}
    stageRef={stage}
    stage={<div className={`stage floor-stage ${passed && next ? 'stage--missionReady' : ''} ${fullGameReady ? 'stage--fullGameReady' : ''}`} style={{ '--floor-glow': FLOOR_COLORS[snapshot.config.suitColor] } as React.CSSProperties}>
      <canvas ref={canvas} className="stage__canvas" tabIndex={0} onPointerDown={focusGame} aria-label="Devil Floor lava platformer. A/D or arrow keys to run. Space, W or Up to jump. Release and jump again for a double jump. P to pause." />
      <div className="floor__hud" aria-label="Expedition status">
        <div><small>CAVERN {String(snapshot.level).padStart(2, '0')} · {snapshot.config.heroName}</small><strong>{String(snapshot.score).padStart(5, '0')}</strong></div>
        <div className="floor__hudRight"><span className="floor__lives" aria-label={`${snapshot.lives} lives`}>{'♥'.repeat(snapshot.lives)}{'♡'.repeat(Math.max(0, 3 - snapshot.lives))}</span><small>◆ {snapshot.gems}/14 · CHECKPOINT {snapshot.checkpoint / 4}</small></div>
      </div>
      {playing && focused ? <span className="floor__editing">EDITING · EXPEDITION HELD</span> : null}
      {playing && snapshot.floorRemaining !== null ? <span className={`floor__warning ${snapshot.floorRemaining < 1 ? 'floor__warning--urgent' : ''}`}>FLOOR COLLAPSES IN {snapshot.floorRemaining.toFixed(1)}s</span> : null}
      <div className="floor__log" aria-label="Expedition log"><small>EXPEDITION FEED</small>{snapshot.messages.slice(0, touch ? 1 : 2).map((message, i) => <p key={`${i}:${message}`}>{message}</p>)}</div>
      {playing && touch ? <FloorControls input={input.current} onEngage={focusGame} /> : null}
      {playing && !touch ? <span className="floor__keys">A / D TO RUN · SPACE TO JUMP · P TO PAUSE</span> : null}
      {snapshot.phase !== 'playing' ? <div className={`overlay floor__overlay floor__overlay--${snapshot.phase}`}>
        <div className="floor__panel">
          <span className="floor__eyebrow">{mission.kind === 'sandbox' ? 'EVERY MOD UNLOCKED' : `MISSION ${mission.order + 1}/8 · ${mission.title}`}</span>
          <div className="floor__emblem" aria-hidden="true">♨</div>
          <h1>{snapshot.phase === 'launch' ? 'DEVIL FLOOR' : snapshot.phase === 'cleared' ? 'INFERNO ESCAPED' : snapshot.phase === 'paused' ? 'EXPEDITION HELD' : 'LOST TO THE FIRE'}</h1>
          <p>{snapshot.phase === 'cleared' ? 'The exit is yours. A new cavern awaits with your score and lives intact.' : snapshot.phase === 'gameover' ? `You scored ${snapshot.score}. Rewire your mods and try the expedition again.` : 'Leap across a living floor. Platforms crumble, fireballs rise, and crystals power your mods. Reach the exit on the far right.'}</p>
          <div className="floor__legend"><span>◆ CRYSTALS</span><span>⚑ CHECKPOINTS</span><span>▲ AVOID SPIKES</span></div>
          <button className="btn floor__enter" onClick={() => {
            sound.unlock(); clearInput();
            if (snapshot.phase === 'paused') run.resume(); else if (snapshot.phase === 'cleared') run.advance(); else run.launch();
            update(); focusGame();
          }}>{snapshot.phase === 'paused' ? 'RESUME EXPEDITION' : snapshot.phase === 'cleared' ? 'NEXT CAVERN →' : snapshot.phase === 'gameover' ? 'TRY AGAIN →' : 'ENTER THE INFERNO →'}</button>
          <small>{touch ? 'LEFT / RIGHT TO RUN · JUMP TO LEAP · RELEASE TO JUMP AGAIN' : 'A / D OR ARROWS TO RUN · SPACE / W / UP TO JUMP · P TO PAUSE'}</small>
        </div>
      </div> : null}
      {previous ? <button className="stage__missionBack" onClick={() => go(previous)}>← Previous mission</button> : null}
      {passed && next ? <div className="stage__missionNext"><button className="mission__next mission__next--ready" onClick={() => go(next)}>{fullGameReady ? 'Play full game' : 'NEXT MISSION'} <span aria-hidden="true">→</span></button></div> : null}
      {showCoach && !guidance.targetId && !passed && snapshot.metrics.jumps === 0 ? <CoachBubble className="coach-bubble--stage" message={guidance.message} onDismiss={dismiss} /> : null}
    </div>}
    overlays={<>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} studentName={progress.studentName} sound={progress.settings.sound} debug={progress.settings.debug} bestScore={progress.bestScore} completedCount={progress.completed.length}
        onRename={name => useProgress.getState().setStudentName(name)} onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onToggleDebug={() => useProgress.getState().setSetting('debug', !progress.settings.debug)}
        onResetProgress={() => { useProgress.getState().resetProgress(); navigate({ name: 'landing' }); }} />
      {debugFlag || progress.settings.debug ? <pre className="floor__debug" aria-label="Floor debug state">{JSON.stringify({ phase: snapshot.phase, config: snapshot.config, metrics: snapshot.metrics, ignored: Object.keys(program.config).filter(key => !unlocked.some(mod => mod.id === key)) }, null, 2)}</pre> : null}
    </>} />;
}
