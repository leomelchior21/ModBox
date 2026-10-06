import { useEffect, useState } from 'react';

/* ============================================================================
   MODBOX — TINY HASH ROUTER
   No router dependency: four screens, and the URL always tells you where you
   are (so "CONTINUE VECTOR ZERO" can deep-link straight into the Lab).
   ========================================================================== */

export type Route =
  | { name: 'landing' }
  | { name: 'languages'; gameId?: string; missionId?: string; from?: 'landing' | 'arcade' }
  | { name: 'arcade' }
  | { name: 'lab'; gameId?: string; missionId?: string; debug: boolean };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [path, query] = clean.split('?');
  const params = new URLSearchParams(query ?? '');
  const debug = params.get('debug') === '1';
  const missionId = params.get('mission') ?? undefined;
  const gameId = params.get('game') ?? undefined;

  switch (path) {
    case 'languages':
      return { name: 'languages', gameId, missionId, from: params.get('from') === 'arcade' ? 'arcade' : 'landing' };
    case 'arcade':
      return { name: 'arcade' };
    case 'lab':
      return { name: 'lab', gameId, missionId, debug };
    default:
      return { name: 'landing' };
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'languages': {
      const params = new URLSearchParams();
      if (route.missionId) params.set('mission', route.missionId);
      if (route.gameId) params.set('game', route.gameId);
      if (route.from) params.set('from', route.from);
      return `#/languages${params.size ? `?${params}` : ''}`;
    }
    case 'arcade':
      return '#/arcade';
    case 'lab': {
      const params = new URLSearchParams();
      if (route.missionId) params.set('mission', route.missionId);
      if (route.gameId) params.set('game', route.gameId);
      if (route.debug) params.set('debug', '1');
      const query = params.toString();
      return `#/lab${query ? `?${query}` : ''}`;
    }
    default:
      return '#/';
  }
}

export function navigate(route: Route): void {
  const hash = routeToHash(route);
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
