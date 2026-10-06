// @vitest-environment jsdom
import { describe, expect, it, beforeAll, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { App } from '../App';
import { useProgress } from '../../state/progressStore';
import { EditorView } from '@codemirror/view';

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
    expect(cards.every((card) => card.textContent?.includes('PLAY VECTOR ZERO'))).toBe(true);
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

  it('renders the arcade with VECTOR ZERO and locked future cabinets', async () => {
    window.location.hash = '#/arcade';
    const { host, root } = mount();
    await act(async () => {
      root.render(<App />);
    });
    await flush();
    expect(host.textContent).toContain('VECTOR ZERO');
    expect(host.textContent).toContain('RUNNER');
    expect(host.textContent).toContain('LOCKED');
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
