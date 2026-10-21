import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { EditorView } from '@codemirror/view';
import { GameWorkspace } from '../../components/GameWorkspace';
import { TopBar } from '../../components/TopBar';
import { SettingsDialog } from '../../components/SettingsDialog';
import { InviteList } from '../premium-kit/InviteList';
import { forgeInvites } from '../premium-kit/classicInvites';
import type { ModInvite } from '../premium-kit/invites';
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
import { FORGE_MODS, FORGE_RUNTIME_LABELS, FORGE_TOOLS, forgeSchema, type ForgeConfig } from './mods';
import { FORGE_MISSIONS, FORGE_STARTER, getForgeMission, forgeGuidance, forgeMissionPassed } from './missions';
import { ForgeRun, SIZE, type Piece, type Placement } from './run';
import { ForgeSound } from './sound';
import './forge.css';

function PieceArt({ piece }: { piece: Piece }): JSX.Element {
  const rows = Math.max(...piece.cells.map(c => c[0])) + 1, cols = Math.max(...piece.cells.map(c => c[1])) + 1;
  return <span className="forge__pieceArt" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, aspectRatio: `${cols}/${rows}`, '--piece-cols': cols, '--piece-rows': rows } as CSSProperties} aria-hidden="true">
    {piece.cells.map(([r, c]) => <i key={`${r}:${c}`} className={`forge__block forge__color--${piece.color}`} style={{ gridRow: r + 1, gridColumn: c + 1 }} />)}
  </span>;
}
const menuOpen = () => Boolean(document.querySelector('.mod-options,.topbar__more[open],.modal'));

export function BlockForgeScreen({ gameId, missionId, debugFlag }: GameScreenProps): JSX.Element {
  const progress = useProgress(), language = progress.activeLanguage, mission = getForgeMission(missionId ?? progress.currentMissionId);
  const starter = useMemo(() => {
    const saved = useProgress.getState().getGameProgress(gameId).codes, previous = FORGE_MISSIONS[mission.order - 1];
    return normalizeVariableSpacing(previous && saved[codeKey(language, previous.id)] || formatCodeForLanguage(FORGE_STARTER, language), language);
  }, [gameId, mission.id, mission.order, mission.kind, language]);
  const { code, onChange } = useGameCode(gameId, mission.id, language, starter), debounced = useDebouncedValue(code, 180);
  const program = useMemo(() => parseGameScript<ForgeConfig>(debounced, language, forgeSchema), [debounced, language]);
  const unlocked = FORGE_MODS, liveProgram = program;
  const run = useMemo(() => new ForgeRun(2026, useProgress.getState().getGameProgress(gameId).checkpoint), [gameId]), sound = useMemo(() => new ForgeSound(), []);
  const [, render] = useState(0);
  const [focused, setFocused] = useState(false), [libraryOpen, setLibraryOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState(0), [hover, setHover] = useState<{ row: number; col: number } | null>(null), [active, setActive] = useState(0);
  const [flash, setFlash] = useState<{ id: number; result: Placement } | null>(null), [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; slot: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const editor = useRef<EditorView | null>(null), stage = useRef<HTMLDivElement>(null), board = useRef<HTMLDivElement>(null);
  const touch = useMediaQuery('(any-pointer: coarse)');
  const update = useCallback(() => {
    render(n => n + 1);
    if (run.phase !== 'ready') useProgress.getState().setGameCheckpoint(gameId, run.checkpoint());
  }, [run, gameId]);
  const focusGame = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement?.closest('.cm-editor,input,textarea,select')) activeElement.blur();
    setFocused(false);
  }, []);
  const passed = forgeMissionPassed(mission, liveProgram, run) || progress.completed.includes(mission.id), guidance = forgeGuidance(mission, passed);
  const diagnostic = program.diagnostics.find(d => d.severity === 'error'), next = FORGE_MISSIONS[mission.order + 1], previous = FORGE_MISSIONS[mission.order - 1];
  const mods = useMemo(() => unlocked.map(m => localizeMod(m, language)), [unlocked, language]);
  const tools = useMemo(() => FORGE_TOOLS.map(t => localizeTool(t, language)), [language]);
  const insert = useCallback((snippet: string, mode?: ModInsertMode) => applyModToEditor(editor.current, snippet, mode, language), [language]);
  // The blacksmith's advice after a full board: help mods first, then a new challenge once every helper is on.
  const forgeTips = (): ModInvite[] => { const config = run.config as unknown as Record<string, unknown>, help = forgeInvites(config, 'lose'); return (help.length ? help : forgeInvites(config, 'win')).slice(0, 2).map(invite => ({ ...invite, code: formatCodeForLanguage(invite.code, language).trim() })); };
  const acceptInvite = (invite: ModInvite) => { insert(formatCodeForLanguage(invite.code, language), 'replace'); window.setTimeout(reset, 450); };
  const reset = () => { run.launch(true); setSelected(0); setHover(null); setFlash(null); focusGame(); update(); };
  const interact = () => !libraryOpen && !settingsOpen && !menuOpen();
  const place = (row: number, col: number, slot = selected) => {
    if (!interact()) return;
    focusGame(); const result = run.place(slot, row, col);
    if (result) {
      sound.play(result.lines, result.combo); setFlash({ id: Date.now(), result });
      setSelected(run.tray.findIndex(p => p !== null)); setHover(null);
      if (run.score > useProgress.getState().bestScore) useProgress.getState().setBestScore(run.score);
    }
    update();
  };
  const rotate = () => { if (interact()) { focusGame(); run.rotate(selected); setHover(null); update(); } };
  const undo = () => { if (interact() && run.undo()) { setSelected(run.tray.findIndex(Boolean)); setFlash(null); setHover(null); focusGame(); update(); } };
  const hint = () => { if (!interact()) return; focusGame(); const result = run.hint(); if (result) { setSelected(result.slot); setHover({ row: result.row, col: result.col }); setActive(result.row * SIZE + result.col); } update(); };
  const reshuffle = () => { if (interact() && run.reshuffle()) { setSelected(0); setHover(null); setFlash(null); focusGame(); update(); } };
  const go = (target: typeof mission) => {
    const store = useProgress.getState(); if (store.codes[codeKey(language, target.id)] === undefined) store.setGameCode(gameId, codeKey(language, target.id), code);
    store.setMission(target.id); navigate({ name: 'lab', gameId, missionId: target.id, debug: debugFlag });
  };
  useEffect(() => {
    const store = useProgress.getState(); store.setMission(mission.id);
    if (store.getGameProgress(gameId).codes[codeKey(language, mission.id)] === undefined) store.setGameCode(gameId, codeKey(language, mission.id), code);
  }, [gameId, language, mission.id]);
  useEffect(() => { run.setProgram(liveProgram); update(); }, [run, liveProgram, update]);
  useEffect(() => { sound.muted = !progress.settings.sound; }, [sound, progress.settings.sound]);
  useEffect(() => () => sound.destroy(), [sound]);
  useEffect(() => { if (passed && mission.kind !== 'sandbox' && !progress.completed.includes(mission.id)) useProgress.getState().completeMission(mission.id, mission.kind === 'final'); }, [passed, mission, progress.completed]);
  useEffect(() => { if (!flash) return; const timer = window.setTimeout(() => setFlash(null), 850); return () => window.clearTimeout(timer); }, [flash]);
  useEffect(() => {
    const blur = () => { drag.current = null; setDragging(false); setHover(null); run.pause(); update(); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); };
  }, [run, update]);
  const pointerCell = (e: ReactPointerEvent) => {
    const rect = board.current?.getBoundingClientRect(); if (!rect) return null;
    const row = Math.floor((e.clientY - rect.top) / rect.height * SIZE), col = Math.floor((e.clientX - rect.left) / rect.width * SIZE);
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE ? { row, col } : null;
  };
  const dragStart = (e: ReactPointerEvent<HTMLButtonElement>, slot: number) => {
    if (run.phase !== 'playing' || !interact() || e.button !== 0) return;
    setSelected(slot); focusGame(); drag.current = { x: e.clientX, y: e.clientY, slot, moved: false }; e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const dragMove = (e: ReactPointerEvent) => {
    const current = drag.current; if (!current) return;
    if (Math.hypot(e.clientX - current.x, e.clientY - current.y) > 8) current.moved = true;
    if (current.moved) { setDragging(true); setHover(pointerCell(e)); }
  };
  const dragEnd = (e: ReactPointerEvent) => {
    const current = drag.current, cell = pointerCell(e); drag.current = null; setDragging(false);
    suppressClick.current = Boolean(current?.moved);
    if (current?.moved && cell) place(cell.row, cell.col, current.slot); else setHover(null);
  };
  const preview = hover ? run.preview(selected, hover.row, hover.col) : null;
  const ghostCells = hover && run.tray[selected] ? run.tray[selected]!.cells.map(([r, c]) => [r + hover.row, c + hover.col]).filter(([r, c]) => r < SIZE && c < SIZE).map(([r, c]) => r * SIZE + c) : [];
  const key = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !interact()) return;
    if (['1', '2', '3'].includes(e.key)) { e.preventDefault(); setSelected(Number(e.key) - 1); }
    if (e.key.toLowerCase() === 'r') { e.preventDefault(); rotate(); }
    if (e.key.toLowerCase() === 'h') { e.preventDefault(); hint(); }
    if (e.key.toLowerCase() === 'u') { e.preventDefault(); undo(); }
    if (e.key.toLowerCase() === 'p') { e.preventDefault(); run.phase === 'paused' ? run.resume() : run.pause(); update(); }
  };
  return <GameWorkspace gameId={gameId} gameTitle="BLOCK FORGE" touch={touch} coding={focused}
    header={<TopBar progressLabel="OPTIONAL CHALLENGES" gameName="BLOCK FORGE" missions={FORGE_MISSIONS} completed={progress.completed} paused={run.phase === 'paused'} sound={progress.settings.sound}
      restartLabel="Start a fresh board" onHome={() => navigate({ name: 'landing' })} onRestart={reset} onTogglePause={() => { run.phase === 'paused' ? run.resume() : run.pause(); update(); focusGame(); }}
      onResetCode={() => onChange(starter)} onResetFullGame={() => { if (window.confirm('Reset BLOCK FORGE missions, code and high score?')) { useProgress.getState().resetCurrentGame(); navigate({ name: 'landing' }); } }}
      onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onSettings={() => setSettingsOpen(true)} onOpenLibrary={() => setLibraryOpen(true)}
      onFullscreen={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void stage.current?.closest('.lab')?.requestFullscreen?.(); }} />}
    editor={{ value: code, onChange, language, mods: FORGE_MODS, runtimeLabels: FORGE_RUNTIME_LABELS, coachTargets: { 'forge-combo': /^\s*if.*\blines\b/ }, errorLines: diagnostic ? [diagnostic.line] : [], onFocusChange: setFocused, onViewReady: view => { editor.current = view; }, ariaLabel: `${language} block puzzle code editor` }}
    editorToolbar={<><span className="lab__filename mono">{fileNameForLanguage(language)}</span><span className="lab__autosave">Auto-save <b>ON</b></span></>}
    feedback={{ status: diagnostic ? 'error' : passed ? 'complete' : 'ready', diagnostic, ruleCount: liveProgram.rules.length, guidance }}
    modStrip={{ mods, tools, totalMods: FORGE_MODS.length, collapsed, onToggleCollapsed: () => setCollapsed(v => !v), onInsert: insert, onOpenLibrary: () => setLibraryOpen(true), language, activeTargetId: guidance.targetId }}
    library={{ open: libraryOpen, onClose: () => setLibraryOpen(false), onInsert: (snippet, mode) => { setLibraryOpen(false); insert(snippet, mode); } }} stageRef={stage}
    stage={<div className={`stage forge-stage forge-stage--${run.config.palette} ${passed && next ? 'stage--missionReady' : ''}`} data-finish={run.config.blockStyle} onKeyDown={key}>
      <div className="forge__header"><div><span className="forge__eyebrow">A LITTLE SPACE. ENDLESS POSSIBILITIES.</span><h1>BLOCK <em>FORGE</em><i>✦</i></h1><span className="forge__signature">{run.config.playerName}'s workshop</span></div><div className="forge__best"><span>PERSONAL BEST</span><strong>♛ {progress.bestScore.toLocaleString()}</strong></div></div>
      <div className="forge__stats"><div><span>SCORE</span><strong key={`score-${run.score}`}>{run.score.toLocaleString()}</strong></div><div><span>LINES</span><strong>{run.lines.toString().padStart(2, '0')}</strong></div><div className={run.combo > 1 ? 'forge__combo--hot' : ''}><span>COMBO</span><strong>{run.combo > 1 ? `×${run.combo}` : '—'}</strong></div></div>
      <div className={`forge__boardSpace ${dragging ? 'forge__boardSpace--drag' : ''}`}>
        <div ref={board} className="forge__board" role="grid" aria-label="Eight by eight block board. Select a piece, then use arrow keys and Enter to place it.">
          {Array.from({ length: SIZE }, (_, row) => <div role="row" key={row}>{Array.from({ length: SIZE }, (_, col) => {
            const index = row * SIZE + col, color = run.board[index], ghost = ghostCells.includes(index), cleared = preview?.cleared.includes(index), bursting = flash?.result.cleared.includes(index) && run.config.sparkles;
            return <button key={col} data-forge-cell={index} role="gridcell" tabIndex={active === index ? 0 : -1} disabled={run.phase !== 'playing'} aria-label={`Row ${row + 1}, column ${col + 1}, ${color ? 'occupied' : 'empty'}${ghost ? preview ? ', piece fits' : ', piece blocked' : ''}`} className={`forge__cell ${color ? `forge__color--${color} forge__cell--filled` : ''} ${ghost ? preview ? `forge__cell--ghost forge__color--${run.tray[selected]?.color}` : 'forge__cell--invalid' : ''} ${cleared ? 'forge__cell--line' : ''} ${bursting ? 'forge__cell--burst' : ''}`}
              onClick={() => place(row, col)} onPointerEnter={e => { if (e.pointerType !== 'touch') setHover({ row, col }); }} onPointerLeave={e => { if (e.pointerType !== 'touch') setHover(null); }} onFocus={() => { setActive(index); setHover({ row, col }); }}
              onKeyDown={e => { const delta = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key]; if (!delta) return; e.preventDefault(); const r = Math.max(0, Math.min(7, row + delta[0])), c = Math.max(0, Math.min(7, col + delta[1])); setActive(r * SIZE + c); board.current?.querySelector<HTMLButtonElement>(`[data-forge-cell="${r * SIZE + c}"]`)?.focus(); }}>
              {color || ghost && preview ? <i className="forge__block" aria-hidden="true" /> : null}
            </button>;
          })}</div>)}
        </div>
        {flash?.result.lines ? <div key={flash.id} className="forge__celebration" aria-hidden="true"><strong>{flash.result.lines > 1 ? `${flash.result.lines} LINES!` : flash.result.combo > 1 ? `COMBO ×${flash.result.combo}` : 'BEAUTIFUL!'}</strong><span>+{flash.result.points}</span></div> : null}
      </div>
      <div className="forge__status" role="status" aria-live="polite">{preview?.lines ? `Release for ${preview.lines} line${preview.lines > 1 ? 's' : ''} / +${preview.points}` : run.notice}</div>
      <div className="forge__tray" aria-label="Three-piece tray">{run.tray.map((piece, slot) => <button key={`${slot}-${piece?.id ?? 'empty'}`} className={`forge__piece ${selected === slot && piece ? 'forge__piece--selected' : ''}`} disabled={!piece || run.phase !== 'playing'} aria-label={piece ? `Select piece ${slot + 1}, ${piece.cells.length} blocks` : `Piece ${slot + 1} placed`} aria-pressed={selected === slot && Boolean(piece)} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setSelected(slot); focusGame(); }} onPointerDown={e => dragStart(e, slot)} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={() => { drag.current = null; setDragging(false); setHover(null); }}>
        <kbd>{slot + 1}</kbd>{piece ? <PieceArt piece={piece} /> : <span className="forge__placed">✓</span>}
      </button>)}</div>
      <div className="forge__actions"><button disabled={!run.config.rotations || !run.tray[selected] || run.phase !== 'playing'} onClick={rotate} title="Enable rotations in your code">↻ <span>ROTATE</span></button><button disabled={!run.config.showHints || run.phase !== 'playing'} onClick={hint} title="Enable showHints in your code">✧ <span>HINT</span></button><button disabled={!run.canUndo} onClick={undo} title="Enable allowUndo in your code">↶ <span>UNDO</span></button><button disabled={!run.rerolls || run.phase !== 'playing'} onClick={reshuffle}>⤨ <span>RESHUFFLE</span><b>{run.rerolls}</b></button></div>
      <div className="forge__footer"><span>{touch ? 'DRAG A PIECE, OR SELECT + TAP' : '1–3 SELECT · R ROTATE · H HINT · U UNDO'}</span><span>NO CLOCK. JUST ONE MORE BLOCK.</span></div>
      <PlayModeNav className="forge__missionNav" nextClassName="forge__next" exploring={mission.kind === 'sandbox'} onExplore={() => go(FORGE_MISSIONS[8])} onGuide={() => go(FORGE_MISSIONS[0])} onPrevious={previous ? () => go(previous) : undefined} onNext={next ? () => go(next) : undefined} />
      {run.phase !== 'playing' ? <div className="forge__overlay"><div className="forge__intro"><span className="forge__eyebrow">{run.phase === 'ready' ? 'YOUR NEXT LITTLE OBSESSION' : run.phase === 'paused' ? 'TAKE YOUR TIME' : 'EVERY BLOCK IS A NEW BEGINNING'}</span><span className="forge__introIcon">▦</span><h2>{run.phase === 'ready' ? <>Find your <em>flow.</em></> : run.phase === 'paused' ? 'Room to breathe.' : 'A beautiful run.'}</h2><p>{run.phase === 'ready' ? 'Fit colorful pieces into the board. Fill any row or column to clear it. Chain clears, make space, and build something brilliant.' : run.phase === 'paused' ? 'Your board is right here when you are ready.' : `${run.score.toLocaleString()} points. ${run.lines} lines. Try a different fit and go a little further.`}</p>{run.phase === 'ready' ? <div className="forge__introSteps"><span><b>01</b> FIT BLOCKS</span><span><b>02</b> CLEAR LINES</span><span><b>03</b> CHAIN COMBOS</span></div> : null}<button className="forge__start" onClick={() => { if (run.phase === 'paused') { run.resume(); update(); } else if (run.phase === 'ready' && run.hasSavedBoard) { run.launch(false); setSelected(run.tray.findIndex(Boolean)); update(); } else reset(); }}> {run.phase === 'ready' && run.hasSavedBoard ? 'CONTINUE YOUR BOARD' : run.phase === 'ready' ? 'LET’S MAKE ROOM' : run.phase === 'paused' ? 'BACK TO THE BOARD' : 'FRESH BOARD'} →</button>{run.phase === 'gameover' ? <div className="forge__rescue">{run.canUndo ? <button onClick={undo}>↶ Undo last move</button> : null}{run.rerolls > 0 ? <button onClick={reshuffle}>⤨ Reshuffle ({run.rerolls} left)</button> : null}</div> : <small>Tap to place or drag and drop. No timer, no rush.</small>}{run.phase === 'gameover' ? <InviteList moment="lose" invites={forgeTips()} onInvite={acceptInvite} /> : null}{run.phase === 'ready' ? <button className="play-mode__intro" onClick={() => go(FORGE_MISSIONS[mission.kind === 'sandbox' ? 0 : 8])}>{mission.kind === 'sandbox' ? 'TRY OPTIONAL CHALLENGES' : 'SWITCH TO FREE PLAY'}</button> : null}</div></div> : null}
    </div>}
    overlays={<><SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} studentName={progress.studentName} sound={progress.settings.sound} debug={progress.settings.debug} bestScore={progress.bestScore} completedCount={progress.completed.length} onRename={name => useProgress.getState().setStudentName(name)} onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)} onToggleDebug={() => useProgress.getState().setSetting('debug', !progress.settings.debug)} onResetProgress={() => { useProgress.getState().resetProgress(); navigate({ name: 'landing' }); }} />{debugFlag || progress.settings.debug ? <pre className="forge__debug">{JSON.stringify({ phase: run.phase, score: run.score, lines: run.lines, combo: run.combo, metrics: run.metrics }, null, 2)}</pre> : null}</>} />;
}
