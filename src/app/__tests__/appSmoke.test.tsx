// @vitest-environment jsdom
import { describe, expect, it, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { App } from '../App';
import { useProgress } from '../../state/progressStore';
import { EditorView } from '@codemirror/view';
import { createGameRegistry } from '../../games/createRegistry';
import { gameRegistry } from '../../games/registry';
import { gardenGame } from '../../games/__tests__/fixtures/gardenGame';
import { VectorZeroEngine } from '../../games/vector-zero/engine/gameEngine';
import type { RuntimeMetrics } from '../../games/vector-zero/engine/types';
import { MODS } from '../../interpreter/core/mods';

/* ============================================================================
   MODBOX — APP SMOKE TEST
   Mounts the real screens in jsdom with a stubbed canvas so the whole pipeline
   (router → Lab → engine → interpreter → validation) is exercised end to end.
   ========================================================================== */

function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get(object, prop: string) {
      if (prop in object) return object[prop];
      if (prop === 'measureText') return () => ({ width: 12 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'getImageData') return () => ({ data: [] });
      return () => undefined;
    },
    set(object, prop: string, value) {
      object[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return fakeContext();
  } as unknown as HTMLCanvasElement['getContext'];

  HTMLCanvasElement.prototype.getBoundingClientRect = function rect() {
    return {
      width: 900,
      height: 600,
      top: 0,
      left: 0,
      right: 900,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };

  class FakeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeObserver;
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeObserver;

  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  // rAF is a no-op in tests: the render loops must not spin
  window.requestAnimationFrame = (() => 1) as unknown as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => undefined) as unknown as typeof window.cancelAnimationFrame;
});

const roots: Root[] = [];

beforeEach(() => useProgress.getState().resetProgress());

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  return { host, root };
}

/** Flushes microtasks so lazily imported chunks and effects settle. */
async function flush(times = 6) {
  for (let index = 0; index < times; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** Waits for a lazily loaded chunk to finish rendering. */
async function waitFor(check: () => boolean, attempts = 160): Promise<boolean> {
  for (let index = 0; index < attempts; index += 1) {
    if (check()) return true;
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 8));
    });
  }
  return check();
}

describe('MODBOX app shell', () => {
  it('opens Neon Maze from the library with its own languages, mods and independent progress', async () => {
    useProgress.getState().setCode('csharp:m00', 'string enemy = "big-rock";');
    window.location.hash = '#/';
    const { host, root } = mount();
    await act(async () => root.render(<App />));
    const maze = host.querySelector<HTMLButtonElement>('.home-game--maze');
    expect(maze?.textContent).toContain('AVAILABLE NOW');
    await act(async () => maze?.click());
    expect(await waitFor(() => Boolean(host.querySelector('.languages')))).toBe(true);
    expect(window.location.hash).toContain('game=maze');
    expect(host.querySelectorAll('.langcard')).toHaveLength(3);
    await act(async () => host.querySelector<HTMLButtonElement>('.langcard:nth-child(3) button')?.click());
    expect(await waitFor(() => Boolean(host.querySelector('.neon-stage')))).toBe(true);
    expect(host.querySelector('.lab')?.getAttribute('data-game-id')).toBe('maze');
    expect(host.querySelector('.lab__left .cm-editor')).toBeTruthy();
    expect(host.querySelector('.lab__left .feedback')).toBeTruthy();
    expect(host.querySelector('.lab__right canvas')).toBeTruthy();
    expect(host.querySelector('.modstrip')?.textContent).toContain('wallColor');
    expect(host.querySelector('.modstrip')?.textContent).not.toContain('laserPower');
    const view = EditorView.findFromDOM(host.querySelector('.cm-editor')!);
    await act(async () => view!.dispatch({ changes: { from: 0, to: view!.state.doc.length, insert: 'string wallColor = "amber";' } }));
    expect(await waitFor(() => Boolean(host.querySelector('.neon-stage .mission__next')))).toBe(true);
    expect(useProgress.getState().getGameProgress('maze').completed).toContain('m00');
    const resetCode = [...host.querySelectorAll<HTMLButtonElement>('.topbar__more button')].find(button => button.textContent === 'Reset code');
    await act(async () => resetCode?.click());
    expect(useProgress.getState().getGameProgress('maze').codes['csharp:m00']).toBe('string wallColor = "cyan";');
    await act(async () => view!.dispatch({ changes: { from: 0, to: view!.state.doc.length, insert: 'string wallColor = "amber";' } }));
    await act(async () => host.querySelector<HTMLButtonElement>('.mission__next')?.click());
    expect(await waitFor(() => useProgress.getState().currentMissionId === 'm01')).toBe(true);
    expect(host.querySelector('.cm-content')?.textContent).toContain('amber');
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'string runnerName = "Sparrow";', types: ['application/x-modbox-mod'] } });
    await act(async () => host.querySelector('.cm-content')?.dispatchEvent(drop));
    expect(await waitFor(() => host.querySelector('.neon__hud')?.textContent?.includes('Sparrow') ?? false)).toBe(true);
    expect(useProgress.getState().getGameProgress('vector-zero').codes['csharp:m00']).toBe('string enemy = "big-rock";');
    expect(useProgress.getState().getGameProgress('vector-zero').completed).toEqual([]);
  });

  it('celebrates mission eight only after passing and opens the fully unlocked game', async () => {
    for (const id of ['m00', 'm01', 'm02', 'm03', 'm04', 'm05', 'm06']) useProgress.getState().completeMission(id);
    useProgress.getState().setCode('csharp:final', [
      'string shipName = "Voyager";', 'int enemies = 5;', 'int laserPower = 1;',
      'bool shield = false;', 'Console.WriteLine(shipName);',
      'if (score >= 300) { shield = true; }',
    ].join('\n'));
    let engine: VectorZeroEngine | undefined;
    const setProgram = VectorZeroEngine.prototype.setProgram;
    vi.spyOn(VectorZeroEngine.prototype, 'setProgram').mockImplementation(function (this: VectorZeroEngine, input) {
      engine = this;
      return setProgram.call(this, input);
    });
    window.location.hash = '#/lab?game=vector-zero&mission=final';
    const { host, root } = mount();
    await act(async () => root.render(<App />));
    expect(await waitFor(() => Boolean(host.querySelector('.cm-editor')))).toBe(true);
    expect(host.querySelector('.stage--fullGameReady')).toBeNull();
    expect(host.querySelector('.mission__next')).toBeNull();
    expect(useProgress.getState().freeModeUnlocked).toBe(false);

    // Feed the real validation pipeline a rock kill reported by the simulation.
    await act(async () => engine!.launch());
    (engine as unknown as { metrics: RuntimeMetrics }).metrics.kills = 1;
    await act(async () => engine!.pause());
    expect(await waitFor(() => Boolean(host.querySelector('.stage--fullGameReady')))).toBe(true);
    expect(host.querySelector('.stage__fullGameStatus')?.textContent).toContain('All mods unlocked');
    expect(host.querySelector('.mission__next')?.textContent).toContain('Play full game');
    expect(useProgress.getState().completed).toContain('final');
    expect(useProgress.getState().freeModeUnlocked).toBe(true);

    await act(async () => host.querySelector<HTMLButtonElement>('.mission__next')?.click());
    expect(await waitFor(() => useProgress.getState().currentMissionId === 'free')).toBe(true);
    expect(window.location.hash).toContain('mission=free');
    expect(host.querySelector('.stage--fullGameReady')).toBeNull();
    expect(host.querySelectorAll('.modtile__options')).toHaveLength(MODS.length);
    expect(host.querySelector('.cm-content')?.textContent).toContain('Voyager');
    expect(useProgress.getState().codes['csharp:free']).toBe(useProgress.getState().codes['csharp:final']);
  });

  it('restores the full-game celebration when returning to completed mission eight', async () => {
    useProgress.getState().completeMission('final', true);
    useProgress.getState().setCode('csharp:free', 'string shipName = "My sandbox";');
    window.location.hash = '#/lab?game=vector-zero&mission=final';
    const { host, root } = mount();
    await act(async () => root.render(<App />));
    expect(await waitFor(() => Boolean(host.querySelector('.stage--fullGameReady')))).toBe(true);
    expect(host.querySelector('.mission__next')?.textContent).toContain('Play full game');
    expect(host.querySelector('.feedback--complete')?.textContent).toContain('Your game is ready');
    await act(async () => host.querySelector<HTMLButtonElement>('.mission__next')?.click());
    expect(await waitFor(() => useProgress.getState().currentMissionId === 'free')).toBe(true);
    expect(useProgress.getState().codes['csharp:free']).toBe('string shipName = "My sandbox";');
  });

  it('registers another game with its own languages, mods, game design and isolated saves', async () => {
    useProgress.getState().setCode('csharp:m00', 'string enemy = "big-rock";');
    const registry = createGameRegistry([...gameRegistry.games, gardenGame]);
    window.location.hash = '#/';
    const { host, root } = mount();
    await act(async () => root.render(<App registry={registry} />));
    await act(async () => host.querySelector<HTMLButtonElement>('.home-game--garden-test')?.click());
    await flush();
    expect(window.location.hash).toContain('game=garden-test');
    expect([...host.querySelectorAll('.langcard h2')].map(card => card.textContent)).toEqual(['Python', 'C#']);
    await act(async () => host.querySelector<HTMLButtonElement>('.langcard:first-child button')?.click());
    expect(await waitFor(() => Boolean(host.querySelector('.garden-stage')))).toBe(true);
    expect(host.querySelector('.lab')?.getAttribute('data-game-id')).toBe('garden-test');
    expect(host.querySelector('.lab__filename')?.textContent).toBe('main.py');
    expect(host.querySelector('.lab__left .cm-editor')).toBeTruthy();
    expect(host.querySelector('.lab__left .feedback')).toBeTruthy();
    expect(host.querySelector('.lab__left .modstrip')).toBeTruthy();
    expect(host.querySelectorAll('.lab__right .garden-tile')).toHaveLength(3);
    expect(host.querySelector('canvas')).toBeNull();
    expect(host.querySelector('.modstrip')?.textContent).not.toContain('enemy');

    // A tap chooses a catalog value through the same popup used by Vector Zero.
    await act(async () => host.querySelector<HTMLButtonElement>('.modtile__options')?.click());
    const max = [...host.querySelectorAll<HTMLButtonElement>('.mod-options__tree button')].find(button => button.textContent?.includes('12'));
    await act(async () => max?.click());
    expect(host.querySelectorAll('.garden-tile')).toHaveLength(12);
    expect(host.querySelector('.cm-content')?.textContent).toContain('tiles = 12');

    // A drop uses the same code insertion path with an unrelated control name.
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'rain = True', types: ['application/x-modbox-mod'] } });
    await act(async () => host.querySelector('.cm-content')?.dispatchEvent(drop));
    expect(host.querySelector('.garden-stage')?.getAttribute('data-rain')).toBe('true');
    expect(useProgress.getState().getGameProgress('garden-test').codes['python:m00']).toContain('tiles = 12');

    await act(async () => { window.location.hash = '#/lab?game=vector-zero&mission=m00'; });
    expect(await waitFor(() => Boolean(host.querySelector('.lab[data-game-id="vector-zero"] .cm-editor')))).toBe(true);
    expect(host.querySelector('.cm-content')?.textContent).toContain('big-rock');
    expect(host.querySelector('.cm-content')?.textContent).not.toContain('tiles');

    // Leaving immediately after typing must preserve the latest source.
    const vectorEditor = EditorView.findFromDOM(host.querySelector('.cm-editor')!);
    await act(async () => {
      vectorEditor!.dispatch({ changes: { from: 0, to: vectorEditor!.state.doc.length, insert: 'string enemy = "small-rock";' } });
      window.location.hash = '#/lab?game=garden-test&mission=m00';
    });
    expect(await waitFor(() => Boolean(host.querySelector('.garden-stage')))).toBe(true);
    expect(useProgress.getState().getGameProgress('vector-zero').codes['csharp:m00']).toContain('small-rock');
    expect(host.querySelectorAll('.garden-tile')).toHaveLength(12);
  }, 15000);

  it('does not launch Vector Zero for an unknown or removed game', async () => {
    window.location.hash = '#/lab?game=missing-game';
    const { host, root } = mount();
    await act(async () => root.render(<App />));
    expect(host.textContent).toContain('This game is unavailable');
    expect(host.querySelector('.cm-editor')).toBeNull();
    await act(async () => { window.location.hash = '#/lab?game=runner'; });
    await flush();
    expect(host.textContent).toContain('This game is unavailable');
  });

  it('launches Devil Floor, applies its mods and carries its own mission code', async () => {
    window.location.hash = '#/';
    const { host, root } = mount();
    await act(async () => root.render(<App />));
    const card = host.querySelector<HTMLButtonElement>('.home-game--platform');
    expect(card?.textContent).toContain('AVAILABLE NOW');
    await act(async () => card?.click()); await flush();
    expect(window.location.hash).toContain('game=platform');
    expect(host.querySelector('.languages__game h2')?.textContent).toBe('DEVIL FLOOR');
    await act(async () => host.querySelector<HTMLButtonElement>('.langcard:nth-child(1) button')?.click());
    expect(await waitFor(() => Boolean(host.querySelector('.floor-stage .stage__canvas')))).toBe(true);
    expect(host.querySelector('.cm-content')?.textContent).toContain('suitColor = "amber"');
    expect(host.querySelector('.topbar__game')?.textContent).toContain('DEVIL FLOOR');
    expect(host.querySelector('.floor__panel h1')?.textContent).toBe('DEVIL FLOOR');
    const view = EditorView.findFromDOM(host.querySelector('.cm-editor')!);
    await act(async () => view!.dispatch({ changes: { from: 0, to: view!.state.doc.length, insert: 'suitColor = "cyan"' } }));
    expect(await waitFor(() => Boolean(host.querySelector('.stage .mission__next--ready')))).toBe(true);
    expect(useProgress.getState().getGameProgress('platform').completed).toContain('m00');
    await act(async () => host.querySelector<HTMLButtonElement>('.floor__enter')?.click());
    expect(host.querySelector('.floor__overlay')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Pause"]')?.click());
    expect(host.querySelector('.floor__panel h1')?.textContent).toBe('EXPEDITION HELD');
    await act(async () => host.querySelector<HTMLButtonElement>('.stage .mission__next--ready')?.click());
    expect(await waitFor(() => host.querySelector('.floor__eyebrow')?.textContent?.includes('NAME THE FLAME') ?? false)).toBe(true);
    expect(host.querySelector('.cm-content')?.textContent).toContain('suitColor = "cyan"');
    await act(async () => { window.location.hash = '#/lab?game=maze&mission=m00'; });
    expect(await waitFor(() => Boolean(host.querySelector('.neon-stage')))).toBe(true);
    expect(host.querySelector('.cm-content')?.textContent).toContain('wallColor');
    expect(useProgress.getState().getGameProgress('platform').codes['python:m00']).toContain('suitColor = "cyan"');
  }, 15000);

  it('launches workshop defense, deploys tools, applies its own mods and preserves isolated progress', async () => {
    window.location.hash = '#/'; const { host, root } = mount(); await act(async () => root.render(<App />));
    await act(async () => host.querySelector<HTMLButtonElement>('.home-game--makitas')?.click()); await flush();
    expect(host.querySelector('.languages__game h2')?.textContent).toBe('MAKITAS VS ZOMBIES');
    await act(async () => host.querySelector<HTMLButtonElement>('.langcard:nth-child(1) button')?.click());
    expect(await waitFor(() => Boolean(host.querySelector('.yard__enter')))).toBe(true);
    expect(host.querySelector('.cm-content')?.textContent).toContain('toolColor = "teal"');
    const view = EditorView.findFromDOM(host.querySelector('.cm-editor')!);
    await act(async () => view!.dispatch({ changes: { from: 0, to: view!.state.doc.length, insert: 'toolColor = "amber"' } }));
    expect(await waitFor(() => Boolean(host.querySelector('.stage .mission__next--ready')))).toBe(true);
    expect(useProgress.getState().getGameProgress('makitas-vs-zombies').completed).toContain('m00');
    await act(async () => host.querySelector<HTMLButtonElement>('.yard__enter')?.click());
    expect(host.querySelectorAll('[role="gridcell"]')).toHaveLength(45);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-cell="2:0"]')?.click());
    expect(host.querySelector('[data-cell="2:0"]')?.getAttribute('aria-label')).toContain('CIRCULAR SAW');
    expect(host.querySelector('.yard__power strong')?.textContent).toBe('250');
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label^="Select recycle tool"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-cell="2:0"]')?.click());
    expect(host.querySelector('.yard__power strong')?.textContent).toBe('300');
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Pause"]')?.click());
    expect(host.querySelector('.yard__panel h1')?.textContent).toBe('TOOLS DOWN');
    await act(async () => host.querySelector<HTMLButtonElement>('.stage .mission__next--ready')?.click());
    expect(await waitFor(() => host.querySelector('.yard__eyebrow')?.textContent?.includes('WORKSHOP RADIO') ?? false)).toBe(true);
    expect(host.querySelector('.cm-content')?.textContent).toContain('toolColor = "amber"');
    await act(async () => { window.location.hash = '#/lab?game=platform&mission=m00'; });
    expect(await waitFor(() => Boolean(host.querySelector('.floor-stage')))).toBe(true);
    expect(host.querySelector('.cm-content')?.textContent).toContain('suitColor');
    expect(useProgress.getState().getGameProgress('makitas-vs-zombies').codes['python:m00']).toContain('toolColor = "amber"');
  }, 15000);

  it('renders the landing screen', async () => {
    window.location.hash = '#/';
    const { host, root } = mount();
    await act(async () => {
      root.render(<App />);
    });
    await flush();
    expect(host.textContent).toContain('MOD IT. CODE IT. PLAY IT.');
    expect(host.textContent).toContain('ENTER MODBOX');
    expect(host.querySelector('.home__games')).toBeTruthy();
    expect(host.querySelector('.home__languages')).toBeNull();
    const games = [...host.querySelectorAll('.home-game')];
    expect(games.map(card => card.querySelector('h3')?.textContent)).toEqual(['VECTOR ZERO', 'NEON MAZE', 'DEVIL FLOOR', 'MAKITAS VS ZOMBIES']);
    expect(games.every(card => card.tagName === 'BUTTON' && card.textContent?.includes('AVAILABLE NOW'))).toBe(true);
    expect(games.every(card => card.querySelector('.home-game__art .game-art'))).toBe(true);
  });

  it('renders Python, Swift, and C# as playable languages in the right order', async () => {
    window.location.hash = '#/languages';
    const { host, root } = mount();
    await act(async () => {
      root.render(<App />);
    });
    await flush();
    const cards = [...host.querySelectorAll('.langcard')];
    expect(cards.map((card) => card.querySelector('h2')?.textContent)).toEqual(['Python', 'Swift', 'C#']);
    expect(cards.map(card => card.querySelector('button')?.getAttribute('aria-label'))).toEqual(['Play VECTOR ZERO in Python', 'Play VECTOR ZERO in Swift', 'Play VECTOR ZERO in C#']);
    expect(host.querySelector('.languages__game h2')?.textContent).toBe('VECTOR ZERO');
    expect(cards.every(card => card.querySelector('.langcard__example code'))).toBe(true);
  });

  it('asks for a language after choosing a game and launches that game in Swift', async () => {
    window.location.hash = '#/';
    const { host, root } = mount();
    await act(async () => root.render(<App />));
    await act(async () => host.querySelector<HTMLButtonElement>('.home-game--vector')?.click());
    await flush();
    expect(window.location.hash).toContain('/languages?mission=m00');
    expect(host.querySelector('.languages')).toBeTruthy();
    await act(async () => host.querySelector<HTMLButtonElement>('.langcard:nth-child(2) button')?.click());
    expect(await waitFor(() => Boolean(host.querySelector('.cm-editor')))).toBe(true);
    expect(useProgress.getState().activeLanguage).toBe('swift');
    expect(window.location.hash).toContain('/lab?mission=m00');
    expect(host.querySelector('.lab__filename')?.textContent).toBe('main.swift');
  });

  it('renders all four playable games in the arcade', async () => {
    window.location.hash = '#/arcade';
    const { host, root } = mount();
    await act(async () => {
      root.render(<App />);
    });
    await flush();
    expect(host.textContent).toContain('VECTOR ZERO');
    expect(host.textContent).toContain('MAKITAS VS ZOMBIES');
    expect(host.textContent).not.toContain('RUNNER');
    expect(host.textContent).not.toContain('COMING SOON');
    expect([...host.querySelectorAll('.cabinet__title')].map(title => title.textContent)).toEqual(['VECTOR ZERO', 'NEON MAZE', 'DEVIL FLOOR', 'MAKITAS VS ZOMBIES']);
    expect(host.querySelectorAll('.cabinet--locked button')).toHaveLength(0);
  });

  it('lazy-loads the Lab with editor, HUD and mission 00 code', async () => {
    window.location.hash = '#/lab?mission=m00';
    const { host, root } = mount();
    await act(async () => {
      root.render(<App />);
    });

    const mounted = await waitFor(() => Boolean(host.querySelector('.cm-editor')));
    expect(mounted, 'the Lab chunk should load and mount').toBe(true);

    // the game canvas and the CodeMirror editor are both mounted
    expect(host.querySelector('canvas')).toBeTruthy();
    // mission 00 starter code is in the editor
    expect(host.textContent).toContain('string enemy = "small-rock";');
    // co-pilot instruction + gated mission navigation
    expect(host.querySelector('.topbar__game')?.textContent).toContain('VECTOR ZERO');
    expect(host.textContent).toContain('FIRST CONTACT');
    expect(host.textContent).toContain('YOUR NEXT STEP');
    expect(host.textContent).toContain('Change the enemy type to "big-rock".');
    expect(host.querySelector('[data-guided="true"]')).toBeTruthy();
    expect(host.querySelector('.feedback__checks')).toBeNull();
    expect(host.querySelector('.mission__next')).toBeNull();
    expect(host.querySelector('.lab__console')).toBeNull();
    // the launch overlay offers the real controls
    expect(host.textContent).toContain('LAUNCH');
    expect(host.querySelector('.overlay__mission')?.textContent).toContain('MISSION 00');
    expect(host.textContent).toContain('rotate left');
  });

  it('shows Next Mission in the stage after passing and carries edited code through missions 01 and 02', async () => {
    window.location.hash = '#/lab?mission=m00';
    const { host, root } = mount();
    await act(async () => root.render(<App />));
    expect(await waitFor(() => Boolean(host.querySelector('.cm-editor')))).toBe(true);
    const view = EditorView.findFromDOM(host.querySelector('.cm-editor')!);
    expect(view).toBeTruthy();
    await act(async () => view!.dispatch({ changes: { from: 0, to: view!.state.doc.length, insert: 'string enemy = "big-rock";' } }));
    expect(await waitFor(() => Boolean(host.querySelector('.stage .mission__next--ready')))).toBe(true);
    await act(async () => host.querySelector<HTMLButtonElement>('.mission__next')?.click());
    expect(await waitFor(() => host.querySelector('.overlay__mission')?.textContent?.includes('MISSION 01') ?? false)).toBe(true);
    expect(host.querySelector('.cm-content')?.textContent).toContain('big-rock');
    expect(useProgress.getState().codes['csharp:m00']).toContain('big-rock');
    expect(host.querySelector('.lab__console')).toBeNull();

    const nextView = EditorView.findFromDOM(host.querySelector('.cm-editor')!);
    const namedShip = 'string enemy = "big-rock";\nstring shipName = "Voyager";\nConsole.WriteLine(shipName);';
    await act(async () => nextView!.dispatch({ changes: { from: 0, to: nextView!.state.doc.length, insert: namedShip } }));
    expect(await waitFor(() => Boolean(host.querySelector('.stage .mission__next--ready')))).toBe(true);
    await act(async () => host.querySelector<HTMLButtonElement>('.mission__next')?.click());
    expect(await waitFor(() => host.querySelector('.overlay__mission')?.textContent?.includes('MISSION 02') ?? false)).toBe(true);
    expect(host.querySelector('.cm-content')?.textContent).toContain('Voyager');
    expect(host.querySelector('.modstrip__row')).toBeTruthy();
    expect(host.querySelector('.lab__console')).toBeNull();
  });
});
