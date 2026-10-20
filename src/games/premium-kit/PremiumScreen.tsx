import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { EditorView } from '@codemirror/view';
import { GameWorkspace } from '../../components/GameWorkspace';
import { TopBar } from '../../components/TopBar';
import { SettingsDialog } from '../../components/SettingsDialog';
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
import { type ArcadeAction, type ArcadeConfig, type ArcadeInput, type ArcadeRun } from './core';
import { type ArcadeCatalog } from './catalog';
import { ArcadeEffects, ArcadeSound, loadArcadeArt, palette, type ArcadeArt } from './visuals';
import { PlayModeNav } from '../PlayModeNav';
import { ResultOverlay, type ResultCard, type StageChip } from './ResultCard';
import type { WorldView } from '../three-kit/types';
import './premium.css';

export interface ArcadeControl { label: string; action: ArcadeAction; hold?: keyof ArcadeInput; primary?: boolean }
export interface PremiumGameSpec<R extends ArcadeRun = ArcadeRun> {
  id: string; title: string; eyebrow: string; description: string; instructions: string; goal: string;
  width: number; height: number; catalog: ArcadeCatalog; controls: readonly ArcadeControl[];
  create(checkpoint?: unknown): R;
  draw?(ctx: CanvasRenderingContext2D, run: R, art: ArcadeArt, fx: ArcadeEffects, reduced: boolean): void;
  createView?(canvas: HTMLCanvasElement, run: R): WorldView;
  features?: readonly string[];
  objective?(run: R): { label: string; value: number; max: number };
  /** Optional instant-photo result card shown instead of the standard overlay when a stage is cleared or lost. */
  result?(run: R): ResultCard | null;
  stages?(run: R): readonly StageChip[];
}
const menuOpen = () => Boolean(document.querySelector('.mod-options,.topbar__more[open],.modal'));
const KEY_DIRECTIONS: Record<string, keyof ArcadeInput> = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };

export function PremiumScreen<R extends ArcadeRun>({ spec, gameId, missionId, debugFlag }: GameScreenProps & { spec: PremiumGameSpec<R> }): JSX.Element {
  const progress = useProgress(), language = progress.activeLanguage, catalog = spec.catalog;
  const mission = catalog.missions.find(m => m.id === (missionId ?? progress.currentMissionId)) ?? catalog.missions[0];
  const starter = useMemo(() => {
    const saved = useProgress.getState().getGameProgress(gameId).codes, previous = catalog.missions[mission.order - 1];
    return normalizeVariableSpacing(previous && saved[codeKey(language, previous.id)] || formatCodeForLanguage(catalog.starter, language), language);
  }, [gameId, catalog, mission.id, mission.order, mission.kind, language]);
  const { code, onChange } = useGameCode(gameId, mission.id, language, starter), debounced = useDebouncedValue(code, 200);
  const program = useMemo(() => parseGameScript<ArcadeConfig>(debounced, language, catalog.schema), [debounced, language, catalog]);
  const unlocked = catalog.mods, liveProgram = program;
  const run = useMemo(() => spec.create(useProgress.getState().getGameProgress(gameId).checkpoint), [spec, gameId]);
  const effects = useMemo(() => new ArcadeEffects(), []), sound = useMemo(() => new ArcadeSound(), []);
  const [, render] = useState(0), [focused, setFocused] = useState(false), [libraryOpen, setLibraryOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [collapsed, setCollapsed] = useState(false);
  const [expandedGame, setExpandedGame] = useState(false);
  const [graphicsFailed, setGraphicsFailed] = useState(false), [graphicsAttempt, setGraphicsAttempt] = useState(0);
  const world = useRef<WorldView | null>(null);
  const editor = useRef<EditorView | null>(null), stage = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const blocked = useRef(false); blocked.current = focused || libraryOpen || settingsOpen || graphicsFailed;
  const touch = useMediaQuery('(any-pointer: coarse)'), reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const savedRevision = useRef(-1);
  const update = useCallback(() => {
    render(v => v + 1);
    const store = useProgress.getState();
    if (run.score > store.getGameProgress(gameId).bestScore) store.setBestScore(run.score);
    if (run.checkpointRevision !== savedRevision.current && run.checkpoint) { savedRevision.current = run.checkpointRevision; store.setGameCheckpoint(gameId, run.checkpoint); }
  }, [run, gameId]);
  const engage = () => { if ((document.activeElement as HTMLElement | null)?.closest('.cm-editor,input,textarea,select')) (document.activeElement as HTMLElement).blur(); setFocused(false); sound.unlock(); };
  const act = (action: ArcadeAction) => { if (libraryOpen || settingsOpen || menuOpen()) return; engage(); run.action(action); update(); };
  const launch = () => { engage(); run.launch(); update(); canvas.current?.focus({ preventScroll: true }); };
  const togglePause = () => { engage(); run.phase === 'paused' ? run.resume() : run.pause(); update(); };
  const passed = catalog.passed(mission, liveProgram, run) || progress.completed.includes(mission.id);
  const diagnostic = program.diagnostics.find(d => d.severity === 'error');
  const guidance = passed ? { message: mission.kind === 'final' ? 'Challenges complete. Keep remixing your game.' : 'Challenge complete. Keep experimenting or try the next challenge.' } : { message: mission.message, targetId: mission.targetId };
  const mods = useMemo(() => unlocked.map(m => localizeMod(m, language)), [unlocked, language]);
  const tools = useMemo(() => catalog.tools.map(t => localizeTool(t, language)), [catalog, language]);
  const insert = useCallback((snippet: string, mode?: ModInsertMode) => applyModToEditor(editor.current, snippet, mode, language), [language]);
  const previous = catalog.missions[mission.order - 1], next = catalog.missions[mission.order + 1];
  const go = (target: typeof mission) => {
    const store = useProgress.getState(); if (store.codes[codeKey(language, target.id)] === undefined) store.setGameCode(gameId, codeKey(language, target.id), code);
    store.setMission(target.id); navigate({ name: 'lab', gameId, missionId: target.id, debug: debugFlag });
  };
  useEffect(() => { const store = useProgress.getState(); store.setMission(mission.id); if (store.getGameProgress(gameId).codes[codeKey(language, mission.id)] === undefined) store.setGameCode(gameId, codeKey(language, mission.id), code); }, [gameId, mission.id, language]);
  useEffect(() => { run.setProgram(liveProgram); update(); }, [run, liveProgram, update]);
  useEffect(() => { sound.muted = !progress.settings.sound; }, [sound, progress.settings.sound]);
  useEffect(() => () => sound.destroy(), [sound]);
  useEffect(() => { if (passed && mission.kind !== 'sandbox' && !progress.completed.includes(mission.id)) useProgress.getState().completeMission(mission.id, mission.kind === 'final'); }, [passed, mission, progress.completed]);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    let view: WorldView | undefined;
    try { view = spec.createView?.(element, run); setGraphicsFailed(false); } catch { setGraphicsFailed(true); return; }
    world.current = view ?? null;
    const ctx = view ? null : element.getContext('2d'); if (!view && !ctx) return;
    const art = view ? null : loadArcadeArt(gameId); let alive = true, raf = 0, last = performance.now(), reported = 0, w = 1, h = 1, dpr = 1, revision = run.revision;
    const resize = () => { const r = element.getBoundingClientRect(); w = Math.max(1, r.width); h = Math.max(1, r.height); dpr = Math.min(window.devicePixelRatio || 1, 2); if (view) view.resize(w, h, dpr); else { element.width = Math.round(w * dpr); element.height = Math.round(h * dpr); } };
    const contextLost = (event: Event) => { event.preventDefault(); run.pause(); setGraphicsFailed(true); update(); };
    const contextRestored = () => { setGraphicsFailed(false); update(); };
    element.addEventListener('webglcontextlost', contextLost); element.addEventListener('webglcontextrestored', contextRestored);
    resize(); const observer = new ResizeObserver(resize); observer.observe(element);
    const draw = (now: number) => {
      if (!alive) return;
      const reduced = reducedRef.current;
      const dt = Math.min(0.06, Math.max(0, (now - last) / 1000)); last = now;
      const held = blocked.current || menuOpen() || document.hidden || run.phase === 'paused';
      if (held) { run.releaseInput(); run.pointer('cancel', 0, 0); view?.pointer?.('cancel', 0, 0, -1); }
      if (revision !== run.revision) { effects.reset(); revision = run.revision; }
      if (!held) { run.step(dt); effects.step(dt); }
      const cues = run.cues.splice(0); if (!view) effects.consume(cues, palette(run.config.palette).accent, reduced);
      for (const kind of new Set(cues.map(c => c.kind))) sound.play(kind);
      if (view) view.render(dt, held, reduced, cues);
      else if (ctx && art) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const fit = Math.min(w / spec.width, h / spec.height), x = (w - spec.width * fit) / 2, y = (h - spec.height * fit) / 2;
      ctx.save(); ctx.translate(x, y); ctx.scale(fit, fit); ctx.beginPath(); ctx.rect(0, 0, spec.width, spec.height); ctx.clip();
      if (!reduced && effects.shake) ctx.translate(Math.sin(effects.time * 72) * 2, Math.cos(effects.time * 61) * 2);
      spec.draw?.(ctx, run, art, effects, reduced); effects.draw(ctx, reduced); ctx.restore();
      }
      if (now - reported > 100) { update(); reported = now; }
      raf = requestAnimationFrame(draw);
    };
    draw(last);
    return () => { alive = false; cancelAnimationFrame(raf); observer.disconnect(); element.removeEventListener('webglcontextlost', contextLost); element.removeEventListener('webglcontextrestored', contextRestored); world.current = null; view?.dispose(); if (art) { art.sprites.onload = null; art.cover.src = ''; art.background.src = ''; art.sprites.src = ''; } };
  }, [run, spec, gameId, effects, sound, update, graphicsAttempt]);
  useEffect(() => {
    const typing = () => Boolean((document.activeElement as HTMLElement | null)?.closest('.cm-editor,input,textarea,select,[contenteditable="true"]'));
    const keydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing() || blocked.current || menuOpen()) return;
      if ((e.code === 'Space' || e.code === 'Enter') && (e.target as Element | null)?.closest('button,a,summary')) return;
      const direction = KEY_DIRECTIONS[e.code];
      if (direction) { e.preventDefault(); run.input[direction] = true; if (!e.repeat) run.action(direction); }
      if (!e.repeat && ['Space', 'Enter', 'KeyE', 'KeyN', 'KeyP'].includes(e.code)) {
        e.preventDefault(); sound.unlock();
        if (e.code === 'KeyP') run.phase === 'paused' ? run.resume() : run.pause();
        else if (run.phase === 'gameover') run.retryStage();
        else if (run.phase === 'ready') run.launch();
        else if (run.phase === 'cleared') run.advance();
        else run.action(e.code === 'KeyE' ? 'ability' : e.code === 'KeyN' ? 'nudge' : 'primary');
      }
      update();
    };
    const keyup = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) run.input.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) run.input.right = false;
      if (['ArrowUp', 'KeyW'].includes(e.code)) run.input.up = false;
      if (['ArrowDown', 'KeyS'].includes(e.code)) run.input.down = false;
    };
    const blur = () => { run.pause(); run.pointer('cancel', 0, 0); update(); }, visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { run.releaseInput(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); };
  }, [run, sound, update]);
  const pointer = (phase: 'down' | 'move' | 'up' | 'cancel', e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (libraryOpen || settingsOpen || menuOpen() || run.phase !== 'playing') return;
    if (phase === 'down') { engage(); e.currentTarget.focus({ preventScroll: true }); e.currentTarget.setPointerCapture?.(e.pointerId); }
    const r = e.currentTarget.getBoundingClientRect(), fit = Math.min(r.width / spec.width, r.height / spec.height);
    if (world.current?.pointer) world.current.pointer(phase, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, e.pointerId);
    else if (spec.createView) run.pointer(phase, (e.clientX - r.left) / r.width * spec.width, (e.clientY - r.top) / r.height * spec.height, e.pointerId);
    else run.pointer(phase, (e.clientX - r.left - (r.width - spec.width * fit) / 2) / fit, (e.clientY - r.top - (r.height - spec.height * fit) / 2) / fit, e.pointerId); update();
  };
  const colors = palette(run.config.palette);
  const objective = spec.objective?.(run);
  const card = run.phase === 'cleared' || run.phase === 'gameover' ? spec.result?.(run) ?? null : null;
  const resume = (move: () => void) => { engage(); move(); update(); canvas.current?.focus({ preventScroll: true }); };
  const footnote = mission.kind === 'sandbox' ? 'BASIC GAME · EVERY MOD IS READY TO TRY' : `OPTIONAL CHALLENGE ${mission.order + 1}/8 · ${mission.title}`;
  return <GameWorkspace gameId={gameId} gameTitle={spec.title} touch={touch} coding={focused} expandedGame={expandedGame}
    header={<TopBar progressLabel="OPTIONAL CHALLENGES" gameName={spec.title} missions={catalog.missions} completed={progress.completed} paused={run.phase === 'paused'} sound={progress.settings.sound}
      restartLabel="Retry saved stage" onRestart={launch} onTogglePause={togglePause} onHome={() => navigate({ name: 'landing' })} onResetCode={() => onChange(starter)}
      onResetFullGame={() => { if (window.confirm(`Reset ${spec.title} missions, code and score?`)) { useProgress.getState().resetCurrentGame(); navigate({ name: 'landing' }); } }}
      onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onSettings={() => setSettingsOpen(true)} onOpenLibrary={() => setLibraryOpen(true)}
      onFullscreen={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void stage.current?.closest('.lab')?.requestFullscreen?.(); }} />}
    editor={{ value: code, onChange, language, mods: catalog.mods, runtimeLabels: catalog.runtimeLabels, coachTargets: { 'arcade-rule': /^\s*if.*\bscore\b/ }, errorLines: diagnostic ? [diagnostic.line] : [], onFocusChange: setFocused, onViewReady: view => { editor.current = view; }, ariaLabel: `${language} ${spec.title} code editor` }}
    editorToolbar={<><span className="lab__filename mono">{fileNameForLanguage(language)}</span><span className="lab__autosave">Auto-save <b>ON</b></span></>}
    feedback={{ status: diagnostic ? 'error' : passed ? 'complete' : 'ready', diagnostic, ruleCount: liveProgram.rules.length, guidance }}
    modStrip={{ mods, tools, totalMods: catalog.mods.length, collapsed, onToggleCollapsed: () => setCollapsed(v => !v), onInsert: insert, onOpenLibrary: () => setLibraryOpen(true), language, activeTargetId: guidance.targetId }}
    library={{ open: libraryOpen, onClose: () => setLibraryOpen(false), onInsert: (snippet, mode) => { setLibraryOpen(false); insert(snippet, mode); } }} stageRef={stage}
    stage={<div className={`stage premium-stage premium-stage--${gameId} ${spec.createView ? 'world-stage' : ''}`} style={{ '--arcade-accent': colors.accent, '--arcade-warm': colors.warm, '--arcade-dark': colors.dark, '--arcade-cover': `url('/art/${gameId}/cover.webp')`, '--arcade-background': `url('/art/${gameId}/${spec.createView ? 'cover' : 'background'}.webp')`, '--world-sprites': `url('/art/${gameId}/sprites.webp')` } as CSSProperties}>
      <div className="premium__head"><div><span className="premium__eyebrow">{spec.eyebrow}</span><img className="premium__logo" src={`/art/${gameId}/logo.svg`} alt={spec.title} /><span className="premium__player">{run.config.playerName} <i>·</i> STAGE {String(run.level).padStart(2, '0')}</span></div><div className="premium__best"><small>PERSONAL BEST</small><strong>♛ {progress.bestScore.toLocaleString()}</strong></div></div>
      <div className="premium__stats" aria-label="Live game stats"><div><small>SCORE</small><strong>{run.score.toLocaleString()}</strong></div>{run.stats().map(stat => <div key={stat.label}><small>{stat.label}</small><strong>{stat.value}</strong></div>)}</div>
      <div className="premium__field"><canvas key={graphicsAttempt} ref={canvas} className="premium__canvas" tabIndex={0} aria-label={`${spec.title} playfield. ${spec.instructions}`} onPointerDown={e => pointer('down', e)} onPointerMove={e => pointer('move', e)} onPointerUp={e => pointer('up', e)} onPointerCancel={e => pointer('cancel', e)} />{objective ? <div className="world__objective"><span>{objective.label}</span><progress aria-label={objective.label} value={objective.value} max={objective.max} /></div> : null}<button className="premium__expand" aria-label={expandedGame ? 'Restore code view' : 'Expand game view'} aria-pressed={expandedGame} onClick={() => { engage(); setExpandedGame(value => !value); }}>⛶ <span>{expandedGame ? 'SHOW CODE' : 'EXPAND'}</span></button></div>
      <div className="premium__notice" role="status" aria-live="polite">{focused ? 'EDITING · GAME HELD' : run.notice}</div>
      <div className={`premium__controls ${touch ? 'premium__controls--touch' : 'premium__controls--desktop'}`}>{spec.controls.map(control => <button key={control.label} className={control.primary ? 'premium__control--primary' : ''} disabled={run.phase !== 'playing' || control.action === 'ability' && !run.config.overdrive} aria-label={control.label} title={control.action === 'ability' && !run.config.overdrive ? `Enable ${catalog.mods.find(m => m.id === 'overdrive')?.label} in your code` : undefined}
        onClick={event => { if (!control.hold || event.detail === 0) act(control.action); }}
        onPointerDown={e => { if (control.hold && !libraryOpen && !settingsOpen && !menuOpen()) { engage(); e.currentTarget.setPointerCapture?.(e.pointerId); run.input[control.hold] = true; if (spec.createView) { run.action(control.action); update(); } } }}
        onPointerUp={() => { if (control.hold) run.input[control.hold] = false; }} onPointerCancel={() => { if (control.hold) run.input[control.hold] = false; }} onBlur={() => { if (control.hold) run.input[control.hold] = false; }}>{control.label}</button>)}</div>
      <span className="premium__keyHint">{spec.instructions}</span>
      <PlayModeNav className="premium__missionNav" nextClassName="premium__next" exploring={mission.kind === 'sandbox'} onExplore={() => go(catalog.missions[8])} onGuide={() => go(catalog.missions[0])} onPrevious={previous ? () => go(previous) : undefined} onNext={next ? () => go(next) : undefined} />
      {card ? <ResultOverlay key={`${run.revision}-${run.phase}`} card={card} snapshot={world.current?.snapshot?.() ?? null} stages={spec.stages?.(run) ?? []} footnote={footnote}
        onHome={() => navigate({ name: 'landing' })} onPrimary={() => resume(() => card.win ? run.advance() : run.retryStage())} onPick={level => resume(() => run.replayStage(level))} /> : null}
      {run.phase !== 'playing' && !card ? <div className={`premium__overlay premium__overlay--${run.phase}`}><div className="premium__intro"><span className="premium__eyebrow">{run.phase === 'ready' ? spec.eyebrow : run.phase === 'paused' ? 'TAKE A BREATHER' : run.phase === 'cleared' ? 'ANOTHER ONE FOR THE HIGHLIGHT REEL' : 'YOUR NEXT RUN STARTS HERE'}</span><img src={`/art/${gameId}/logo.svg`} alt={spec.title} className="premium__introLogo" />
        <h1>{run.phase === 'ready' ? spec.goal : run.phase === 'paused' ? 'HOLD THAT THOUGHT.' : run.phase === 'cleared' ? 'BEAUTIFULLY DONE.' : 'ONE MORE TRY.'}</h1>
        <p>{run.phase === 'ready' ? spec.description : run.phase === 'paused' ? 'Your game is right here when you are ready.' : run.phase === 'cleared' ? `Stage ${run.level} secured. ${run.score.toLocaleString()} points and a tougher challenge ahead.` : 'Retry this stage with your latest code. A different approach can change everything.'}</p>
        <div className="premium__how"><b>HOW TO PLAY</b><span>{spec.instructions}</span></div>
        {spec.features ? <div className="world__features">{spec.features.map((feature, index) => <span key={feature}><i style={{ backgroundPosition: `${index % 2 * 100}% ${Math.floor(index / 2) * 100}%` }} />{feature}</span>)}</div> : null}
        <button className="premium__start" onClick={() => { engage(); if (run.phase === 'paused') run.resume(); else if (run.phase === 'cleared') run.advance(); else if (run.phase === 'gameover') run.retryStage(); else run.launch(); update(); canvas.current?.focus({ preventScroll: true }); }}>{run.phase === 'paused' ? 'BACK TO IT' : run.phase === 'cleared' ? 'NEXT STAGE' : run.phase === 'gameover' ? 'RETRY SAVED STAGE' : run.hasCheckpoint ? 'CONTINUE PLAYING' : 'LET’S PLAY'} →</button>
        <small>{footnote}</small>
        {run.phase === 'ready' ? <button className="play-mode__intro" onClick={() => go(catalog.missions[mission.kind === 'sandbox' ? 0 : 8])}>{mission.kind === 'sandbox' ? 'TRY OPTIONAL CHALLENGES' : 'SWITCH TO FREE PLAY'}</button> : null}
      </div></div> : null}
      {graphicsFailed ? <div className="world__unavailable" role="alert"><strong>Let’s get your 3D world running.</strong><p>The scene could not start. Reload it, or try a browser with 3D support.</p><button onClick={() => setGraphicsAttempt(v => v + 1)}>RELOAD SCENE</button></div> : null}
    </div>}
    overlays={<><SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} studentName={progress.studentName} sound={progress.settings.sound} debug={progress.settings.debug} bestScore={progress.bestScore} completedCount={progress.completed.length} onRename={name => useProgress.getState().setStudentName(name)} onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onToggleDebug={() => useProgress.getState().setSetting('debug', !progress.settings.debug)} onResetProgress={() => { useProgress.getState().resetProgress(); navigate({ name: 'landing' }); }} />{debugFlag || progress.settings.debug ? <pre className="premium__debug">{JSON.stringify({ gameId, phase: run.phase, score: run.score, level: run.level, lives: run.lives, config: run.config, graphics: world.current?.diagnostics?.(), runtime: Object.fromEntries(Object.entries(run).filter(([key, value]) => typeof value === 'number' && !['score', 'level', 'lives'].includes(key))), metrics: run.metrics }, null, 2)}</pre> : null}</>} />;
}
