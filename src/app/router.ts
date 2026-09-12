import { useEffect, useState } from 'react';

/* ============================================================================
   MODBOX — TINY HASH ROUTER
   No router dependency: four screens, and the URL always tells you where you
   are (so "CONTINUE VECTOR ZERO" can deep-link straight into the Lab).
   ========================================================================== */

export type Route =
  | { name: 'landing' }
  | { name: 'languages' }
  | { name: 'arcade' }
  | { name: 'lab'; missionId?: string; debug: boolean };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [path, query] = clean.split('?');
  const params = new URLSearchParams(query ?? '');
  const debug = params.get('debug') === '1';
  const missionId = params.get('mission') ?? undefined;

  switch (path) {
    case 'languages':
      return { name: 'languages' };
    case 'arcade':
      return { name: 'arcade' };
    case 'lab':
      return { name: 'lab', missionId, debug };
    default:
      return { name: 'landing' };
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'languages':
      return '#/languages';
    case 'arcade':
      return '#/arcade';
    case 'lab': {
      const params = new URLSearchParams();
      if (route.missionId) params.set('mission', route.missionId);
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
