import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { LandingScreen } from './screens/LandingScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { ArcadeScreen } from './screens/ArcadeScreen';
import { SettingsDialog } from '../components/SettingsDialog';
import { VhsBoot } from '../components/VhsBoot';
import { navigate, useRoute } from './router';
import { useProgress } from '../state/progressStore';
import { gameRegistry } from '../games/registry';
import type { GameRegistry } from '../games/createRegistry';
import { DEFAULT_GAME_ID, type PlayableGame } from '../games/types';

function UnavailableGame(): JSX.Element {
  return <main className="screen"><h1>This game is unavailable.</h1><button className="btn btn--primary" onClick={() => navigate({ name: 'landing' })}>BACK TO GAMES</button></main>;
}

/* ============================================================================
   MODBOX — APP SHELL
   Pick a game on the landing page or arcade, then its language, then play.
   ========================================================================== */

export function App({ registry = gameRegistry }: { registry?: GameRegistry } = {}): JSX.Element {
  const route = useRoute();
  const progress = useProgress();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [siteBooting, setSiteBooting] = useState(true);
  const gameId = 'gameId' in route ? route.gameId ?? DEFAULT_GAME_ID : undefined;
  const selected = gameId ? registry.get(gameId) : undefined;
  const selectedGame = selected?.status === 'play' ? selected : undefined;
  const screens = useMemo(() => new Map(registry.games.filter((game): game is PlayableGame => game.status === 'play').map(game => [game.id, lazy(game.loadScreen)])), [registry]);

  useEffect(() => {
    if (!selectedGame) return;
    const store = useProgress.getState();
    store.selectGame(selectedGame.id, selectedGame.starterMissionId, selectedGame.languages[0]);
    if (!selectedGame.languages.includes(useProgress.getState().activeLanguage)) store.setLanguage(selectedGame.languages[0]);
  }, [selectedGame]);


  useEffect(() => {
    const timer = window.setTimeout(() => setSiteBooting(false), 1250);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const scrollHost = document.getElementById('root');
    if (scrollHost) { scrollHost.scrollTop = 0; scrollHost.scrollLeft = 0; }
    const names: Record<string, string> = {
      landing: 'MODBOX — Mod the game. Learn the code.',
      languages: 'MODBOX — Choose a language',
      arcade: 'MODBOX — The arcade',
      lab: `MODBOX — ${selectedGame?.title ?? 'Game unavailable'}`,
    };
    document.title = names[route.name] ?? 'MODBOX';
  }, [route.name, selectedGame?.title]);

  if (route.name === 'lab') {
    const Screen = selectedGame ? screens.get(selectedGame.id) : undefined;
    if (!selectedGame || !Screen) return <UnavailableGame />;
    if (progress.activeGameId !== selectedGame.id) return <VhsBoot mode="game" title={selectedGame.title} />;
    return <>
      <Suspense fallback={<VhsBoot mode="game" title={selectedGame.title} />}>
        <Screen key={`${selectedGame.id}-${progress.activeLanguage}-${route.missionId ?? 'current'}-${route.debug}`} gameId={selectedGame.id} missionId={route.missionId} debugFlag={route.debug} />
      </Suspense>
      {siteBooting ? <VhsBoot /> : null}
    </>;
  }

  const getProgress = (game: PlayableGame) => progress.getGameProgress(game.id, game.starterMissionId);
  const chooseLanguage = (game: PlayableGame, missionId?: string) => {
    const saved = getProgress(game);
    const target = missionId ?? (game.missions.some(mission => mission.id === saved.currentMissionId) ? saved.currentMissionId : game.starterMissionId);
    navigate({ name: 'languages', gameId: game.id, missionId: target, from: route.name === 'arcade' ? 'arcade' : 'landing' });
  };

  const settingsDialog = (
    <SettingsDialog
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      studentName={progress.studentName}
      sound={progress.settings.sound}
      debug={progress.settings.debug}
      bestScore={progress.bestScore}
      completedCount={progress.completed.length}
      onRename={(name) => useProgress.getState().setStudentName(name)}
      onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)}
      onToggleDebug={() => useProgress.getState().setSetting('debug', !progress.settings.debug)}
      onResetProgress={() => {
        useProgress.getState().resetProgress();
        navigate({ name: 'landing' });
      }}
    />
  );

  if (route.name === 'languages') {
    if (!selectedGame) return <UnavailableGame />;
    return (
      <>
        <LanguageScreen
          game={selectedGame}
          onSelect={(language) => {
            useProgress.getState().setLanguage(language);
            const missionId = selectedGame.missions.some(mission => mission.id === route.missionId) ? route.missionId! : selectedGame.starterMissionId;
            useProgress.getState().setMission(missionId);
            navigate({ name: 'lab', gameId: selectedGame.id, missionId, debug: false });
          }}
          onBack={() => navigate({ name: route.from ?? 'landing' })}
        />
        {settingsDialog}
        {siteBooting ? <VhsBoot /> : null}
      </>
    );
  }

  if (route.name === 'arcade') {
    return (
      <>
        <ArcadeScreen
          games={registry.games} getProgress={getProgress} onSelectGame={chooseLanguage}
          onBack={() => navigate({ name: 'landing' })}
          onSettings={() => setSettingsOpen(true)}
        />
        {settingsDialog}
        {siteBooting ? <VhsBoot /> : null}
      </>
    );
  }

  return (
    <>
      <LandingScreen
        games={registry.games} getProgress={getProgress} onSelectGame={chooseLanguage}
        onArcade={() => navigate({ name: 'arcade' })}
        onProfile={() => setSettingsOpen(true)}
        studentName={progress.studentName}
      />
      {settingsDialog}
      {siteBooting ? <VhsBoot /> : null}
    </>
  );
}
