import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { PlayModeNav } from '../PlayModeNav';
import { ResultOverlay } from '../premium-kit/ResultCard';
import { YARD_MODS, YARD_RUNTIME_LABELS, YARD_TOOLS, yardSchema, type YardConfig } from './mods';
import { YARD_MISSIONS, YARD_STARTER, getYardMission, yardGuidance, yardMissionPassed } from './missions';
import { COLS, ROWS, UNIT_INFO, YardRun, type UnitKind } from './run';
import { YARD_LEVELS, yardLevelName } from './levels';
import { YardView } from './view';
import { YardSound } from './sound';
import './makitas.css';

const COACH_TARGETS = { 'yard-log': /(?:Console\.WriteLine|print)/, 'yard-math': /^\s*bladeDamage\s*=/, 'yard-kills': /^\s*if.*\bkills\b/, 'yard-wave': /^\s*if.*\bwave\b/ };
const interactionOpen = () => Boolean(document.querySelector('.mod-options,.topbar__more[open],.modal'));
type Tool = UnitKind | 'shovel' | null;

export function MakitasScreen({ gameId, missionId, debugFlag }: GameScreenProps): JSX.Element {
  const progress = useProgress(), language = progress.activeLanguage;
  const mission = getYardMission(missionId ?? progress.currentMissionId);
  const starter = useMemo(() => {
    const saved = useProgress.getState().getGameProgress(gameId).codes, previous = YARD_MISSIONS[mission.order - 1];
    return normalizeVariableSpacing(previous && saved[codeKey(language, previous.id)] || formatCodeForLanguage(YARD_STARTER, language), language);
  }, [gameId, mission.id, mission.kind, mission.order, language]);
  const { code, onChange } = useGameCode(gameId, mission.id, language, starter), debounced = useDebouncedValue(code, 220);
  const program = useMemo(() => parseGameScript<YardConfig>(debounced, language, yardSchema), [debounced, language]);
  const run = useMemo(() => new YardRun(useProgress.getState().getGameProgress(gameId).checkpoint), [gameId]), sound = useMemo(() => new YardSound(), []);
  const [snapshot, setSnapshot] = useState(() => run.snapshot()), [drops, setDrops] = useState<number[]>([]);
  const [focused, setFocused] = useState(false), [libraryOpen, setLibraryOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [collapsed, setCollapsed] = useState(false), [dismissed, setDismissed] = useState('');
  const [tool, setTool] = useState<Tool>(null), [hover, setHover] = useState<{ row: number; col: number } | null>(null), [icons, setIcons] = useState<Partial<Record<UnitKind, string>>>({});
  const [graphicsFailed, setGraphicsFailed] = useState(false), [graphicsAttempt, setGraphicsAttempt] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null), editor = useRef<EditorView | null>(null), stage = useRef<HTMLDivElement>(null), world = useRef<YardView | null>(null);
  const blocked = useRef(false); blocked.current = focused || libraryOpen || settingsOpen || graphicsFailed;
  const visual = useRef({ hover, tool }); visual.current = { hover, tool };
  const touch = useMediaQuery('(any-pointer: coarse)'), reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const diagnostic = program.diagnostics.find(d => d.severity === 'error');
  const passed = yardMissionPassed(mission, program, snapshot) || progress.completed.includes(mission.id);
  const next = YARD_MISSIONS[mission.order + 1], previous = YARD_MISSIONS[mission.order - 1];
  const guidance = yardGuidance(mission, program, snapshot, passed), showCoach = !diagnostic && dismissed !== `${mission.id}:${guidance.message}`;
  const editorTarget = Boolean(guidance.targetId && program.symbols.some(s => s.mod === guidance.targetId));
  const savedRevision = useRef(0);
  const update = useCallback(() => {
    setSnapshot(run.snapshot()); setDrops(run.batteries.map(b => b.id));
    if (run.checkpointRevision !== savedRevision.current) { savedRevision.current = run.checkpointRevision; useProgress.getState().setGameCheckpoint(gameId, run.checkpoint); }
  }, [run, gameId]);
  const engage = useCallback(() => { (document.activeElement as HTMLElement | null)?.closest?.('.cm-editor') && (document.activeElement as HTMLElement).blur(); setFocused(false); sound.unlock(); }, [sound]);
  const act = (move: () => void) => { if (libraryOpen || settingsOpen || interactionOpen()) return; engage(); move(); update(); };
  const insert = useCallback((snippet: string, mode?: ModInsertMode) => applyModToEditor(editor.current, snippet, mode, language), [language]);
  const dismiss = () => setDismissed(`${mission.id}:${guidance.message}`);
  const choose = (next: Tool) => { engage(); setTool(current => current === next ? null : next); };
  const tapTile = (row: number, col: number) => act(() => {
    if (tool === 'shovel') { if (run.shovel(row, col)) setTool(null); return; }
    if (tool) { if (run.place(tool, row, col)) setTool(null); return; }
    run.notice = 'Pick a tool card first, then tap a tile.'; run.noticeId++;
  });

  useEffect(() => {
    const store = useProgress.getState(); store.setMission(mission.id);
    if (store.getGameProgress(gameId).codes[codeKey(language, mission.id)] === undefined) store.setGameCode(gameId, codeKey(language, mission.id), code);
  }, [gameId, language, mission.id]);
  useEffect(() => { run.setProgram(program); update(); }, [run, program, update]);
  // Saves from the previous yard-builder version used mods that no longer exist; start those fresh.
  useEffect(() => { if (/^\s*(?:string\s+|var\s+)?(?:toolbox|zombieType|toolColor|background)\b/m.test(code)) onChange(starter); }, []);
  useEffect(() => { sound.muted = !progress.settings.sound; }, [sound, progress.settings.sound]);
  useEffect(() => { if (passed && mission.kind !== 'sandbox' && !progress.completed.includes(mission.id)) useProgress.getState().completeMission(mission.id, mission.kind === 'final'); }, [passed, mission, progress.completed]);
  useEffect(() => { if (guidance.targetId) setCollapsed(false); }, [guidance.targetId]);
  useEffect(() => { if (snapshot.score > useProgress.getState().bestScore) useProgress.getState().setBestScore(snapshot.score); }, [snapshot.score]);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    let view: YardView | undefined;
    try { view = new YardView(element, run); world.current = view; setGraphicsFailed(false); } catch { setGraphicsFailed(true); }
    const contextLost = (event: Event) => { event.preventDefault(); run.pause(); setGraphicsFailed(true); update(); };
    element.addEventListener('webglcontextlost', contextLost);
    let alive = true, raf = 0, last = performance.now(), reported = 0;
    const resize = () => { const rect = element.getBoundingClientRect(); view?.resize(Math.max(1, rect.width), Math.max(1, rect.height), Math.min(window.devicePixelRatio || 1, 2)); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(element);
    if (view) { try { const art: Partial<Record<UnitKind, string>> = {}; for (const kind of Object.keys(UNIT_INFO) as UnitKind[]) art[kind] = view.icon(kind); setIcons(art); } catch { /* Cards fall back to text. */ } }
    const draw = (now: number) => {
      if (!alive) return;
      const dt = Math.max(0, Math.min(.1, (now - last) / 1000)), before = run.phase; last = now;
      const held = blocked.current || interactionOpen() || document.hidden || run.phase === 'paused';
      if (!held) run.step(dt);
      const cues = run.feedback.splice(0);
      for (const event of new Set(run.events.splice(0))) sound.play(event);
      if (view) {
        const { hover: h, tool: t } = visual.current;
        view.preview(run.phase === 'playing' ? t : null, h?.row ?? -1, h?.col ?? 0, Boolean(h && t && (t === 'shovel' ? run.units.some(u => u.row === h.row && u.col === h.col) : run.canPlace(t, h.row, h.col))));
        view.render(dt, held, reduced, view.feedback(cues));
        stage.current?.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach(button => { const [row, col] = button.dataset.cell!.split(':').map(Number); Object.assign(button.style, view!.cell(row, col)); });
        stage.current?.querySelectorAll<HTMLButtonElement>('[data-battery]').forEach(button => { const p = view!.batteryPoint(Number(button.dataset.battery)); if (p) { button.style.left = `${p.x * 100}%`; button.style.top = `${p.y * 100}%`; } });
      }
      if (now - reported > 100 || before !== run.phase) { update(); reported = now; }
      raf = requestAnimationFrame(draw);
    };
    draw(last);
    return () => { alive = false; cancelAnimationFrame(raf); observer.disconnect(); element.removeEventListener('webglcontextlost', contextLost); world.current = null; view?.dispose(); };
  }, [run, sound, reduced, update, graphicsAttempt]);
  useEffect(() => () => sound.destroy(), [sound]);
  useEffect(() => {
    const typing = () => Boolean((document.activeElement as HTMLElement | null)?.closest('input,textarea,select,[contenteditable="true"],.cm-editor'));
    const keydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || blocked.current || interactionOpen() || typing()) return;
      const index = Number(e.key) - 1, cards = run.stage.cards;
      if (index >= 0 && index < cards.length) { e.preventDefault(); choose(cards[index]); }
      if (e.code === 'KeyS') { e.preventDefault(); choose('shovel'); }
      if (e.code === 'Escape') setTool(null);
      if (e.code === 'KeyB') { e.preventDefault(); run.collectAll(); update(); }
      if (e.code === 'KeyP') { e.preventDefault(); run.phase === 'paused' ? run.resume() : run.pause(); update(); }
      if (e.code === 'Enter' && run.phase === 'launch' && document.activeElement?.tagName !== 'BUTTON') { sound.unlock(); run.launch(); update(); }
    };
    const blur = () => { run.pause(); update(); }, hidden = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', keydown); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hidden); };
  }, [run, sound, update]);
  const go = (target: typeof mission) => {
    const store = useProgress.getState(); if (store.codes[codeKey(language, target.id)] === undefined) store.setGameCode(gameId, codeKey(language, target.id), code);
    store.setMission(target.id); navigate({ name: 'lab', gameId, missionId: target.id, debug: debugFlag });
  };
  const mods = useMemo(() => YARD_MODS.map(m => localizeMod(m, language)), [language]);
  const tools = useMemo(() => YARD_TOOLS.map(t => localizeTool(t, language)), [language]);
  const playing = snapshot.phase === 'playing', ended = snapshot.phase === 'cleared' || snapshot.phase === 'gameover';
  const footnote = mission.kind === 'sandbox' ? 'FREE PLAY · EVERY MOD IS READY TO TRY' : `OPTIONAL CHALLENGE ${mission.order + 1}/8 · ${mission.title}`;
  const levelCount = Math.max(YARD_LEVELS.length, run.frontier);

  return <GameWorkspace gameId={gameId} gameTitle="MAKITAS VS ZOMBIES" touch={touch} coding={focused}
    header={<TopBar progressLabel="OPTIONAL CHALLENGES" gameName="MAKITAS VS ZOMBIES" missions={YARD_MISSIONS} completed={progress.completed} paused={snapshot.phase === 'paused'} sound={progress.settings.sound}
      restartLabel="Retry level" onHome={() => navigate({ name: 'landing' })} onRestart={() => act(() => run.launch())}
      onTogglePause={() => act(() => { run.phase === 'paused' ? run.resume() : run.pause(); })} onResetCode={() => onChange(starter)}
      onResetFullGame={() => { if (window.confirm('Reset MAKITAS VS ZOMBIES? This clears its missions, code and high score.')) { useProgress.getState().resetCurrentGame(); navigate({ name: 'landing' }); } }}
      onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onSettings={() => setSettingsOpen(true)} onOpenLibrary={() => setLibraryOpen(true)}
      onFullscreen={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void stage.current?.closest('.lab')?.requestFullscreen?.(); }} />}
    editor={{ value: code, onChange, language, mods: YARD_MODS, runtimeLabels: YARD_RUNTIME_LABELS, coachTargets: COACH_TARGETS, errorLines: diagnostic ? [diagnostic.line] : [],
      onFocusChange: setFocused, onViewReady: view => { editor.current = view; }, coach: showCoach && guidance.targetId && editorTarget ? { key: guidance.message, message: guidance.message, targetId: guidance.targetId } : undefined,
      onDismissCoach: dismiss, ariaLabel: `${language} workshop defense code editor` }}
    editorToolbar={<><span className="lab__filename mono">{fileNameForLanguage(language)}</span><span className="lab__autosave">Auto-save <b>ON</b></span></>}
    feedback={{ status: diagnostic ? 'error' : passed ? 'complete' : 'ready', diagnostic, ruleCount: program.rules.length, guidance }}
    modStrip={{ mods, tools, totalMods: YARD_MODS.length, collapsed, onToggleCollapsed: () => setCollapsed(v => !v), onInsert: insert, onOpenLibrary: () => setLibraryOpen(true), language,
      activeTargetId: guidance.targetId, coach: showCoach && guidance.targetId && !editorTarget ? guidance : undefined, onDismissCoach: dismiss }}
    library={{ open: libraryOpen, onClose: () => setLibraryOpen(false), onInsert: (snippet, mode) => { setLibraryOpen(false); insert(snippet, mode); } }} stageRef={stage}
    stage={<div className={`stage mvz ${snapshot.night ? 'mvz--night' : ''}`}>
      <canvas key={graphicsAttempt} ref={canvas} className="mvz__canvas" tabIndex={-1} aria-label="Five-lane workshop lawn" />
      {playing ? <div className="mvz__grid" role="grid" aria-label="Lawn tiles. Pick a tool card, then tap a tile.">
        {Array.from({ length: ROWS }, (_, row) => <div key={row} role="row">{Array.from({ length: COLS }, (_, col) => {
          const unit = run.units.find(u => u.row === row && u.col === col), open = snapshot.lanes.includes(row);
          return <button key={col} role="gridcell" data-cell={`${row}:${col}`} disabled={!open} aria-label={`Lane ${row + 1}, tile ${col + 1}: ${unit ? UNIT_INFO[unit.kind].name : open ? 'empty' : 'closed'}`}
            onClick={() => tapTile(row, col)} onPointerEnter={() => setHover({ row, col })} onPointerLeave={() => setHover(null)} onFocus={() => setHover({ row, col })} onBlur={() => setHover(null)} />;
        })}</div>)}
      </div> : null}
      {playing ? <div className="mvz__drops">{drops.map(id => <button key={id} data-battery={id} className="mvz__battery" aria-label="Collect battery power" onPointerDown={() => act(() => run.collect(id))} onClick={() => act(() => run.collect(id))} />)}</div> : null}
      <div className="mvz__bank" aria-label="Tool cards">
        <div className="mvz__power" key={`p-${Math.floor(snapshot.power / 25)}`}><span aria-hidden="true">ϟ</span><strong>{snapshot.power}</strong></div>
        {snapshot.cards.map((card, index) => {
          const ready = card.ready >= 1, usable = ready && card.affordable && playing;
          return <button key={card.kind} className={`mvz__card ${tool === card.kind ? 'mvz__card--selected' : ''} ${usable ? '' : 'mvz__card--off'}`} aria-pressed={tool === card.kind}
            aria-label={`${UNIT_INFO[card.kind].name}, ${card.cost} power${ready ? '' : ', recharging'}. ${UNIT_INFO[card.kind].detail}`} title={UNIT_INFO[card.kind].detail} onClick={() => choose(card.kind)}>
            {icons[card.kind] ? <img src={icons[card.kind]} alt="" /> : <b>{UNIT_INFO[card.kind].short}</b>}
            <span className="mvz__cost">{card.cost}</span>{!ready ? <i className="mvz__cooldown" style={{ height: `${(1 - card.ready) * 100}%` }} /> : null}{!touch ? <kbd>{index + 1}</kbd> : null}
          </button>;
        })}
        <button className={`mvz__card mvz__shovel ${tool === 'shovel' ? 'mvz__card--selected' : ''}`} aria-pressed={tool === 'shovel'} aria-label="Shovel: remove a tool" onClick={() => choose('shovel')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 2.5 21.5 9.5 19 12l-2-2-6.6 6.6.9.9-3.5 3.5a2.5 2.5 0 0 1-3.5-3.5L7.8 14l.9.9L15.3 8.3l-2-2z" /></svg>{!touch ? <kbd>S</kbd> : null}</button>
      </div>
      <div className="mvz__progress" aria-label={`Level ${snapshot.level}: ${Math.round(snapshot.progress * 100)} percent of zombies arrived`}>
        <span>LEVEL {snapshot.level} · {snapshot.levelName.toUpperCase()}</span>
        <div className="mvz__track"><i style={{ width: `${snapshot.progress * 100}%` }} />{snapshot.flags.map(f => <b key={f} style={{ left: `${f * 100}%` }} className={snapshot.progress >= f ? 'mvz__flag--up' : ''} />)}<em style={{ left: `${snapshot.progress * 100}%` }} /></div>
      </div>
      {playing ? <div className="mvz__banner" key={snapshot.bannerId} aria-live="polite">{snapshot.banner}</div> : null}
      {playing ? <div className={`mvz__notice mvz__notice--${snapshot.noticeKind}`} role="status"><span key={snapshot.noticeId}>{focused ? 'EDITING · DEFENSE HELD' : snapshot.config.overdrive ? '⚡ OVERDRIVE ACTIVE' : snapshot.config.doubleShot ? '» TWIN BLADES ACTIVE' : snapshot.notice}</span></div> : null}
      {ended ? <ResultOverlay key={`${run.revision}-${snapshot.phase}`} snapshot={world.current?.snapshot() ?? null} footnote={footnote}
        card={snapshot.phase === 'cleared' ? { win: true, headline: `${snapshot.score.toLocaleString()} PTS`, caption: snapshot.levelName, detail: snapshot.reward ? `New tool unlocked · ${UNIT_INFO[snapshot.reward].name}` : `${snapshot.metrics.kills} zombies stopped` } : { win: false, caption: 'Brains... I mean, tools!', detail: 'A zombie reached the workshop' }}
        stages={Array.from({ length: levelCount }, (_, i) => i + 1).map(level => ({ level, name: yardLevelName(level), state: level < run.frontier || level === run.level && snapshot.phase === 'cleared' ? 'done' : level === run.frontier ? 'current' : 'locked' }))}
        onHome={() => navigate({ name: 'landing' })} onPrimary={() => act(() => snapshot.phase === 'cleared' ? run.advance() : run.launch())} onPick={level => act(() => run.playLevel(level))} /> : null}
      {snapshot.phase === 'launch' || snapshot.phase === 'paused' ? <div className={`mvz__overlay mvz__overlay--${snapshot.phase}`}><div className="start">
        <img className="start__logo" src="/art/makitas/logo.svg" alt="MAKITAS VS ZOMBIES" />
        <h1 className="start__goal">{snapshot.phase === 'paused' ? 'PAUSED' : 'Stop the zombies before they reach your workshop.'}</h1>
        <button className="btn yard__enter start__play" onClick={() => act(() => { snapshot.phase === 'paused' ? run.resume() : run.launch(); })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>{snapshot.phase === 'paused' ? 'RESUME' : run.checkpoint && run.level > 1 ? `CONTINUE · LEVEL ${run.level}` : 'PLAY'}</button>
        <ul className="start__keys">{(touch ? [['Tap', 'a card'], ['Tap', 'a tile to build'], ['Tap', 'batteries for power']] : [['1–7', 'pick a tool'], ['Click', 'a tile to build'], ['Click', 'batteries for power'], ['S', 'shovel']]).map(([keys, text]) => <li key={text}><kbd>{keys}</kbd>{text}</li>)}</ul>
      </div></div> : null}
      {graphicsFailed ? <div className="yard__graphics" role="alert"><strong>Let’s get your 3D workshop running.</strong><p>Reload the scene to restore its graphics.</p><button onClick={() => setGraphicsAttempt(v => v + 1)}>RELOAD SCENE</button></div> : null}
      <PlayModeNav exploring={mission.kind === 'sandbox'} nextClassName="mission__next--ready" onExplore={() => go(YARD_MISSIONS[8])} onGuide={() => go(YARD_MISSIONS[0])} onPrevious={previous ? () => go(previous) : undefined} onNext={next ? () => go(next) : undefined} />
    </div>}
    overlays={<><SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} studentName={progress.studentName} sound={progress.settings.sound} debug={progress.settings.debug} bestScore={progress.bestScore} completedCount={progress.completed.length}
      onRename={name => useProgress.getState().setStudentName(name)} onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onToggleDebug={() => useProgress.getState().setSetting('debug', !progress.settings.debug)} onResetProgress={() => { useProgress.getState().resetProgress(); navigate({ name: 'landing' }); }} />
      {debugFlag || progress.settings.debug ? <pre className="yard__debug" aria-label="Workshop debug state">{JSON.stringify({ ...snapshot, cards: undefined }, null, 2)}</pre> : null}</>} />;
}
