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
import { YARD_MODS, YARD_RUNTIME_LABELS, YARD_TOOLS, yardSchema, type YardConfig } from './mods';
import { YARD_MISSIONS, YARD_STARTER, YARD_SANDBOX, getYardMission, yardGuidance, yardMissionPassed, yardUnlocked, playableYardProgram } from './missions';
import { COLS, ROWS, UNIT_INFO, YardRun, type YardTool, type UnitKind } from './run';
import { drawYard, TOOL_COLORS, VIEW } from './render';
import { YardEffects } from './effects';
import { YardSound } from './sound';
import './makitas.css';

const COACH_TARGETS = { 'yard-log': /(?:Console\.WriteLine|print)/, 'yard-math': /^\s*bladeDamage\s*=/, 'yard-kills': /^\s*if.*\bkills\b/, 'yard-wave': /^\s*if.*\bwave\b/ };
const TOOLS: YardTool[] = ['saw', 'charger', 'wall', 'frost', 'upgrade', 'recycle'];
const interactionOpen = () => Boolean(document.querySelector('.mod-options,.topbar__more[open],.modal'));

export function MakitasScreen({ gameId, missionId, debugFlag }: GameScreenProps): JSX.Element {
  const progress = useProgress(), language = progress.activeLanguage;
  const mission = getYardMission(missionId ?? progress.currentMissionId);
  const starter = useMemo(() => {
    const saved = useProgress.getState().getGameProgress(gameId).codes, previous = YARD_MISSIONS[mission.order - 1];
    return normalizeVariableSpacing(previous && saved[codeKey(language, previous.id)] || formatCodeForLanguage(mission.kind === 'sandbox' ? YARD_SANDBOX : YARD_STARTER, language), language);
  }, [gameId, mission.id, mission.kind, mission.order, language]);
  const { code, onChange } = useGameCode(gameId, mission.id, language, starter), debounced = useDebouncedValue(code, 220);
  const program = useMemo(() => parseGameScript<YardConfig>(debounced, language, yardSchema), [debounced, language]);
  const unlocked = useMemo(() => yardUnlocked(mission, progress.completed, progress.freeModeUnlocked), [mission, progress.completed, progress.freeModeUnlocked]);
  const liveProgram = useMemo(() => playableYardProgram(program, unlocked.map(m => m.id)), [program, unlocked]);
  const run = useMemo(() => new YardRun(), []), effects = useMemo(() => new YardEffects(), []), sound = useMemo(() => new YardSound(), []);
  const [snapshot, setSnapshot] = useState(() => run.snapshot());
  const [drops, setDrops] = useState(() => [...run.batteries]);
  const [focused, setFocused] = useState(false), [libraryOpen, setLibraryOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false), [dismissed, setDismissed] = useState('');
  const [selected, setSelected] = useState<YardTool>('saw'), [activeCell, setActiveCell] = useState({ row: 2, col: 0 });
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null), editor = useRef<EditorView | null>(null), stage = useRef<HTMLDivElement>(null);
  const blocked = useRef(false); blocked.current = focused || libraryOpen || settingsOpen;
  const visual = useRef({ hover, selected }); visual.current = { hover, selected };
  const touch = useMediaQuery('(any-pointer: coarse)'), reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const diagnostic = program.diagnostics.find(d => d.severity === 'error');
  const passed = yardMissionPassed(mission, liveProgram, snapshot) || progress.completed.includes(mission.id);
  const fullGameReady = mission.kind === 'final' && passed, next = YARD_MISSIONS[mission.order + 1], previous = YARD_MISSIONS[mission.order - 1];
  const guidance = yardGuidance(mission, liveProgram, snapshot, passed), showCoach = !diagnostic && dismissed !== `${mission.id}:${guidance.message}`;
  const editorTarget = Boolean(guidance.targetId && program.symbols.some(s => s.mod === guidance.targetId));
  const update = useCallback(() => { setSnapshot(run.snapshot()); setDrops([...run.batteries]); }, [run]);
  const focusGame = useCallback(() => { (document.activeElement as HTMLElement | null)?.blur?.(); canvas.current?.focus({ preventScroll: true }); setFocused(false); sound.unlock(); }, [sound]);
  const launch = useCallback(() => { sound.unlock(); run.launch(); update(); focusGame(); }, [run, sound, update, focusGame]);
  const insert = useCallback((snippet: string, mode?: ModInsertMode) => applyModToEditor(editor.current, snippet, mode, language), [language]);
  const dismiss = () => setDismissed(`${mission.id}:${guidance.message}`);
  const engage = () => { setFocused(false); sound.unlock(); };
  const actOnCell = (row: number, col: number) => { if (libraryOpen || settingsOpen || interactionOpen()) return; engage(); run.interact(selected, row, col); setActiveCell({ row, col }); update(); };

  useEffect(() => {
    const store = useProgress.getState(); store.setMission(mission.id);
    if (store.getGameProgress(gameId).codes[codeKey(language, mission.id)] === undefined) store.setGameCode(gameId, codeKey(language, mission.id), code);
  }, [gameId, language, mission.id]);
  useEffect(() => { run.setProgram(liveProgram); update(); }, [run, liveProgram, update]);
  useEffect(() => { sound.muted = !progress.settings.sound; }, [sound, progress.settings.sound]);
  useEffect(() => { if (passed && mission.kind !== 'sandbox' && !progress.completed.includes(mission.id)) useProgress.getState().completeMission(mission.id, mission.kind === 'final'); }, [passed, mission, progress.completed]);
  useEffect(() => { if (guidance.targetId) setCollapsed(false); }, [guidance.targetId]);
  useEffect(() => { if (snapshot.score > useProgress.getState().bestScore) useProgress.getState().setBestScore(snapshot.score); }, [snapshot.score]);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d'); if (!element || !ctx) return;
    const art = { yard: new Image(), sprites: new Image() }; art.yard.src = '/art/makitas/yard.webp'; art.sprites.src = '/art/makitas/sprites.webp';
    let alive = true, raf = 0, last = performance.now(), reported = 0, width = 1080, height = 760, revision = run.revision;
    const resize = () => { const rect = element.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); width = Math.max(1, rect.width); height = Math.max(1, rect.height); element.width = Math.round(width * dpr); element.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(element);
    const draw = (now: number) => {
      if (!alive) return;
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)), before = run.phase; last = now;
      const held = blocked.current || interactionOpen() || run.phase === 'paused';
      if (revision !== run.revision) { effects.reset(); revision = run.revision; }
      if (!held) { run.step(dt); effects.step(dt); }
      effects.consume(run.feedback.splice(0), TOOL_COLORS[run.config.toolColor] ?? TOOL_COLORS.teal, reduced);
      // Coalesce sounds from a large fight into one cue per event per frame.
      for (const event of new Set(run.events.splice(0))) sound.play(event);
      drawYard(ctx, run, art, effects, width, height, reduced, visual.current.hover, visual.current.selected);
      if (now - reported > 100 || before !== run.phase) { update(); reported = now; }
      raf = requestAnimationFrame(draw);
    };
    draw(last);
    return () => { alive = false; cancelAnimationFrame(raf); observer.disconnect(); };
  }, [run, effects, sound, reduced, update]);
  useEffect(() => () => sound.destroy(), [sound]);
  useEffect(() => {
    const typing = () => Boolean((document.activeElement as HTMLElement | null)?.closest('input,textarea,select,[contenteditable="true"],.cm-editor'));
    const keydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || blocked.current || interactionOpen() || typing()) return;
      const tool = Number(e.key); if (tool >= 1 && tool <= 6) { e.preventDefault(); setSelected(TOOLS[tool - 1]); }
      if (e.code === 'KeyB') { e.preventDefault(); sound.unlock(); run.collectAll(); update(); }
      if (e.code === 'KeyP') { e.preventDefault(); run.phase === 'paused' ? run.resume() : run.pause(); update(); }
      if (e.code === 'Enter' && run.phase === 'launch' && document.activeElement?.tagName !== 'BUTTON') launch();
    };
    const blur = () => { run.pause(); update(); }, hidden = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', keydown); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hidden); };
  }, [run, sound, update, launch]);
  const go = (target: typeof mission) => {
    const store = useProgress.getState(); if (target.kind === 'sandbox' && store.codes[codeKey(language, target.id)] === undefined) store.setGameCode(gameId, codeKey(language, target.id), code);
    store.setMission(target.id); navigate({ name: 'lab', gameId, missionId: target.id, debug: debugFlag });
  };
  const mods = useMemo(() => unlocked.map(m => localizeMod(m, language)), [unlocked, language]);
  const tools = useMemo(() => YARD_TOOLS.filter(t => mission.kind === 'sandbox' || progress.freeModeUnlocked || t.unlockAt <= mission.order).map(t => localizeTool(t, language)), [mission.kind, mission.order, progress.freeModeUnlocked, language]);
  const playing = snapshot.phase === 'playing';
  const keyCell = (e: React.KeyboardEvent, row: number, col: number) => {
    const delta = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key]; if (!delta) return;
    e.preventDefault(); const target = { row: Math.max(0, Math.min(ROWS - 1, row + delta[0])), col: Math.max(0, Math.min(COLS - 1, col + delta[1])) };
    setActiveCell(target); stage.current?.querySelector<HTMLButtonElement>(`[data-cell="${target.row}:${target.col}"]`)?.focus();
  };

  return <GameWorkspace gameId={gameId} gameTitle="MAKITAS VS ZOMBIES" touch={touch} coding={focused}
    header={<TopBar gameName="MAKITAS VS ZOMBIES" missions={YARD_MISSIONS} completed={progress.completed} paused={snapshot.phase === 'paused'} sound={progress.settings.sound}
      restartLabel="Restart defense" onHome={() => navigate({ name: 'landing' })} onRestart={launch}
      onTogglePause={() => { run.phase === 'paused' ? run.resume() : run.pause(); update(); focusGame(); }} onResetCode={() => onChange(starter)}
      onResetFullGame={() => { if (window.confirm('Reset MAKITAS VS ZOMBIES? This clears its missions, code and high score.')) { useProgress.getState().resetCurrentGame(); navigate({ name: 'landing' }); } }}
      onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onSettings={() => setSettingsOpen(true)} onOpenLibrary={() => setLibraryOpen(true)}
      onFullscreen={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void stage.current?.closest('.lab')?.requestFullscreen?.(); }} />}
    editor={{ value: code, onChange, language, mods: YARD_MODS, runtimeLabels: YARD_RUNTIME_LABELS, coachTargets: COACH_TARGETS, errorLines: diagnostic ? [diagnostic.line] : [],
      onFocusChange: setFocused, onViewReady: view => { editor.current = view; }, coach: showCoach && guidance.targetId && editorTarget ? { key: guidance.message, message: guidance.message, targetId: guidance.targetId } : undefined,
      onDismissCoach: dismiss, ariaLabel: `${language} workshop defense code editor` }}
    editorToolbar={<><span className="lab__filename mono">{fileNameForLanguage(language)}</span><span className="lab__autosave">Auto-save <b>ON</b></span></>}
    feedback={{ status: diagnostic ? 'error' : passed ? 'complete' : 'ready', diagnostic, ruleCount: liveProgram.rules.length, guidance }}
    modStrip={{ mods, tools, totalMods: YARD_MODS.length, collapsed, onToggleCollapsed: () => setCollapsed(v => !v), onInsert: insert, onOpenLibrary: () => setLibraryOpen(true), language,
      activeTargetId: guidance.targetId, coach: showCoach && guidance.targetId && !editorTarget ? guidance : undefined, onDismissCoach: dismiss }}
    library={{ open: libraryOpen, onClose: () => { setLibraryOpen(false); focusGame(); }, onInsert: (snippet, mode) => { setLibraryOpen(false); insert(snippet, mode); } }} stageRef={stage}
    stage={<div className={`stage yard-stage ${passed && next ? 'stage--missionReady' : ''} ${fullGameReady ? 'stage--fullGameReady' : ''}`} style={{ '--yard-glow': TOOL_COLORS[snapshot.config.toolColor] } as React.CSSProperties}>
      <canvas ref={canvas} className="stage__canvas" tabIndex={-1} aria-label="Animated five-lane workshop battlefield" />
      <div className="yard__hud"><div className="yard__brand"><span className="yard__brandIcon">✹</span><div><small>NIGHT {String(snapshot.night).padStart(2, '0')} / WORKSHOP DEFENSE</small><strong>{snapshot.config.workshopName}</strong></div></div>
        <div className="yard__power" key={`power-${Math.floor(snapshot.power / 25)}`}><span>ϟ</span><div><strong>{snapshot.power}</strong><small>BATTERY POWER</small></div></div>
        <div className="yard__integrity" aria-label={`${snapshot.lives} workshop integrity`}><span>{[0, 1, 2].map(i => <b key={i} className={i >= snapshot.lives ? 'yard__heart--lost' : ''}>♥</b>)}</span><small>{String(snapshot.score).padStart(5, '0')} PTS</small></div>
      </div>
      <div className="yard__waveTrack" aria-label={`Wave ${snapshot.wave} of 3`}><span>INVASION</span>{[1, 2, 3].map(w => <i key={w} className={snapshot.wave >= w ? 'yard__wave--active' : ''}><b>{w}</b>{w === 3 ? 'FOREMAN' : `WAVE ${w}`}</i>)}<small>{snapshot.spawning || snapshot.remaining ? `${snapshot.remaining} INCOMING` : `NEXT IN ${snapshot.countdown}s`}</small></div>
      {playing ? <>
        <div className="yard__fieldActions"><span>{focused ? 'EDITING · DEFENSE HELD' : snapshot.config.overdrive ? '⚡ OVERDRIVE ACTIVE' : snapshot.config.doubleShot ? '» TWIN BLADES ACTIVE' : `⌁ ${snapshot.messages[0]}`}</span>
          {!snapshot.spawning && snapshot.remaining === 0 && snapshot.wave < 3 ? <button onClick={() => { engage(); run.sendWave(); update(); }}>SEND WAVE {snapshot.wave + 1} →</button> : <span className="yard__danger">{snapshot.wave === 3 ? 'FINAL INVASION' : 'DEFEND EVERY LANE'}</span>}
        </div>
        <div className="yard__grid" role="grid" aria-label="Defense lawn. Arrow keys choose a tile; Enter deploys the selected tool.">
          {Array.from({ length: ROWS }, (_, row) => <div key={row} role="row">{Array.from({ length: COLS }, (_, col) => {
            const u = run.units.find(unit => unit.row === row && unit.col === col);
            return <button key={col} role="gridcell" data-cell={`${row}:${col}`} tabIndex={activeCell.row === row && activeCell.col === col ? 0 : -1}
              aria-label={`Lane ${row + 1}, tile ${col + 1}: ${u ? `${UNIT_INFO[u.kind].name}, level ${u.level}, ${Math.ceil(u.hp)} health${selected === 'upgrade' ? `, upgrade costs ${run.upgradeCost(u)}` : ''}` : 'empty'}`}
              onClick={() => actOnCell(row, col)} onPointerEnter={() => setHover({ row, col })} onPointerLeave={() => setHover(null)} onFocus={() => { setHover({ row, col }); setFocused(false); }} onBlur={() => setHover(null)} onKeyDown={e => keyCell(e, row, col)} />;
          })}</div>)}
        </div>
        <div className="yard__drops">{drops.map(b => <button key={b.id} className="yard__battery" aria-label={`Collect ${b.value} battery power`} style={{ left: `${(VIEW.x + b.x * VIEW.cw) / VIEW.width * 100}%`, top: `${(VIEW.y + (b.row + 0.5) * VIEW.ch) / VIEW.height * 100}%` }} onClick={() => { engage(); run.collect(b.id); update(); }}><span>ϟ</span><b>{b.value}</b></button>)}</div>
        <div className={`yard__notice yard__notice--${snapshot.noticeKind}`} role="status" aria-live="polite"><span key={snapshot.noticeId}>{snapshot.notice}</span><button disabled={!snapshot.batteries} onClick={() => { engage(); run.collectAll(); update(); }}>ϟ COLLECT {snapshot.batteries || ''}</button></div>
        <div className="yard__tools" aria-label="Defender tools">{(Object.keys(UNIT_INFO) as UnitKind[]).map((kind, index) => <button key={kind} className={`yard__tool ${selected === kind ? 'yard__tool--selected' : ''} ${snapshot.power < UNIT_INFO[kind].cost ? 'yard__tool--poor' : ''}`} aria-pressed={selected === kind} aria-label={`Select ${UNIT_INFO[kind].name}, ${UNIT_INFO[kind].cost} power. ${UNIT_INFO[kind].detail}`} onClick={() => { engage(); setSelected(kind); }}>
          <span className={`yard__toolSprite yard__toolSprite--${kind}`} /><span className="yard__toolCopy"><b>{kind === 'saw' ? 'SAW' : kind === 'charger' ? 'CHARGER' : kind === 'wall' ? 'BARRIER' : 'FROST'}</b><small>ϟ {UNIT_INFO[kind].cost}</small></span><kbd>{index + 1}</kbd></button>)}
          <div className="yard__utility"><button aria-label="Select upgrade tool, 90 or 150 power" aria-pressed={selected === 'upgrade'} className={selected === 'upgrade' ? 'yard__utility--selected' : ''} onClick={() => { engage(); setSelected('upgrade'); }} title="Upgrade a defender: 90 / 150 power (5)">↑ <span>UPGRADE</span></button><button aria-label="Select recycle tool, 50 percent refund" aria-pressed={selected === 'recycle'} className={selected === 'recycle' ? 'yard__utility--selected' : ''} onClick={() => { engage(); setSelected('recycle'); }} title="Recycle a defender for a 50% refund (6)">↶ <span>RECYCLE</span></button></div>
        </div>
        <div className="yard__footer"><span>{selected === 'upgrade' ? 'TAP A DEFENDER · 90 / 150 POWER' : selected === 'recycle' ? 'TAP A DEFENDER · 50% REFUND' : UNIT_INFO[selected].detail.toUpperCase()}</span><span>{touch ? 'SELECT TOOL → TAP TILE' : '1–6 TOOLS · B COLLECT · P PAUSE'}</span></div>
      </> : <div className={`overlay yard__overlay yard__overlay--${snapshot.phase}`}>
        <div className="yard__panel"><span className="yard__eyebrow">{mission.kind === 'sandbox' ? 'ALL MODS UNLOCKED · ENDLESS NIGHTS' : `MISSION ${mission.order + 1}/8 · ${mission.title}`}</span>
          <span className="yard__tagline">BATTERIES INCLUDED. MERCY SOLD SEPARATELY.</span>
          <h1>{snapshot.phase === 'launch' ? <>MAKITAS<span>VS <em>ZOMBIES</em></span></> : snapshot.phase === 'paused' ? 'TOOLS DOWN' : snapshot.phase === 'cleared' ? 'YARD SECURED' : 'WORKSHOP LOST'}</h1>
          <p>{snapshot.phase === 'launch' ? 'The dead clocked in. Put your circular saws to work. Build a battery economy, hold five lanes, and survive the foreman.' : snapshot.phase === 'paused' ? 'Your defense is on hold. The zombies can wait.' : snapshot.phase === 'cleared' ? 'Three waves. One workshop. Still standing. A tougher night is waiting.' : 'The invasion got through. Add chargers, cover every lane, and protect your saws with barricades.'}</p>
          {snapshot.phase === 'cleared' || snapshot.phase === 'gameover' ? <div className="yard__results"><div><small>SCORE</small><b>{snapshot.score}</b></div><div><small>DEFEATED</small><b>{snapshot.metrics.kills}</b></div><div><small>WAVES</small><b>{snapshot.wave}/3</b></div></div> : snapshot.phase === 'launch' ? <div className="yard__introSteps"><span><b>01</b> CHARGE UP</span><span><b>02</b> DEPLOY SAWS</span><span><b>03</b> HOLD THE LINE</span></div> : null}
          <button className="btn yard__enter" onClick={() => { sound.unlock(); if (snapshot.phase === 'paused') run.resume(); else if (snapshot.phase === 'cleared') run.advance(); else run.launch(); update(); focusGame(); }}>{snapshot.phase === 'paused' ? 'RESUME DEFENSE →' : snapshot.phase === 'cleared' ? 'NEXT NIGHT →' : snapshot.phase === 'gameover' ? 'REBUILD & RETRY →' : 'DEFEND THE WORKSHOP →'}</button>
          <small>{snapshot.phase === 'launch' ? `Start with ${snapshot.config.startingPower} power · 5 emergency sweepers · 3 waves` : 'Select a tool, then an empty tile. Collect the glowing batteries.'}</small>
        </div>
      </div>}
      {previous ? <button className="stage__missionBack" onClick={() => go(previous)}>← Previous mission</button> : null}
      {passed && next ? <div className="stage__missionNext"><button className="mission__next mission__next--ready" onClick={() => go(next)}>{fullGameReady ? 'Play full game' : 'NEXT MISSION'} →</button></div> : null}
    </div>}
    overlays={<><SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} studentName={progress.studentName} sound={progress.settings.sound} debug={progress.settings.debug} bestScore={progress.bestScore} completedCount={progress.completed.length}
      onRename={name => useProgress.getState().setStudentName(name)} onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onToggleDebug={() => useProgress.getState().setSetting('debug', !progress.settings.debug)} onResetProgress={() => { useProgress.getState().resetProgress(); navigate({ name: 'landing' }); }} />
      {debugFlag || progress.settings.debug ? <pre className="yard__debug" aria-label="Workshop debug state">{JSON.stringify({ ...snapshot, ignored: Object.keys(program.config).filter(k => !unlocked.some(m => m.id === k)) }, null, 2)}</pre> : null}</>} />;
}
