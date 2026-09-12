import { Suspense, lazy, useEffect, useState } from 'react';
import { LandingScreen } from './screens/LandingScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { ArcadeScreen } from './screens/ArcadeScreen';
import { SettingsDialog } from '../components/SettingsDialog';
import { Logo } from '../brand/Logo';
import { navigate, useRoute } from './router';
import { useProgress } from '../state/progressStore';
import { getMission } from '../learning/missions';

/* The Lab carries the code editor and the game engine, so it is loaded on
   demand: the landing page stays instant (spec §37). */
const LabScreen = lazy(() =>
  import('./screens/LabScreen').then((module) => ({ default: module.LabScreen })),
);

function LoadingCabinet(): JSX.Element {
  return (
    <div className="booting">
      <Logo height={30} />
      <p className="eyebrow eyebrow--blue">BOOTING CABINET…</p>
      <span className="booting__bar" aria-hidden="true" />
    </div>
  );
}

/* ============================================================================
   MODBOX — APP SHELL
   Four screens, hash routed: landing → language → arcade → lab.
   ========================================================================== */

export function App(): JSX.Element {
  const route = useRoute();
  const progress = useProgress();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const scrollHost = document.getElementById('root');
    if (scrollHost) { scrollHost.scrollTop = 0; scrollHost.scrollLeft = 0; }
    const names: Record<string, string> = {
      landing: 'MODBOX — Mod the game. Learn the code.',
      languages: 'MODBOX — Choose a language',
      arcade: 'MODBOX — The arcade',
      lab: 'MODBOX — VECTOR ZERO',
    };
    document.title = names[route.name] ?? 'MODBOX';
  }, [route.name]);

  if (route.name === 'lab') {
    return (
      <Suspense fallback={<LoadingCabinet />}>
        <LabScreen
          key={`${route.missionId ?? 'current'}-${route.debug ? 'debug' : 'clean'}`}
          missionId={route.missionId}
          debugFlag={route.debug}
        />
      </Suspense>
    );
  }

  const currentMission = getMission(progress.currentMissionId);
  const hasProgress =
    progress.completed.length > 0 ||
    Object.values(progress.codes).some((code) => code.trim().length > 0);

  const openMission = (missionId: string, debug = false) => {
    useProgress.getState().setMission(missionId);
    navigate({ name: 'lab', missionId, debug });
  };

  const settingsDialog = (
    <SettingsDialog
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      studentName={progress.studentName}
      sound={progress.settings.sound}
      debug={progress.settings.debug}
      splitRatio={progress.settings.splitRatio}
      bestScore={progress.bestScore}
      completedCount={progress.completed.length}
      onRename={(name) => useProgress.getState().setStudentName(name)}
      onToggleSound={() => useProgress.getState().setSetting('sound', !progress.settings.sound)}
      onToggleDebug={() => useProgress.getState().setSetting('debug', !progress.settings.debug)}
      onSplitRatio={(ratio) => useProgress.getState().setSetting('splitRatio', ratio)}
      onResetProgress={() => {
        useProgress.getState().resetProgress();
        navigate({ name: 'landing' });
      }}
    />
  );

  if (route.name === 'languages') {
    return (
      <>
        <LanguageScreen
          onSelect={() => navigate({ name: 'arcade' })}
          onBack={() => navigate({ name: 'landing' })}
        />
        {settingsDialog}
      </>
    );
  }

  if (route.name === 'arcade') {
    return (
      <>
        <ArcadeScreen
          completed={progress.completed}
          currentMission={currentMission}
          bestScore={progress.bestScore}
          freeModeUnlocked={progress.freeModeUnlocked}
          onBack={() => navigate({ name: 'landing' })}
          onSettings={() => setSettingsOpen(true)}
          onPlay={() => openMission('m00')}
          onContinue={() => openMission(currentMission.id)}
          onFreeMod={() => openMission('free')}
        />
        {settingsDialog}
      </>
    );
  }

  return (
    <>
      <LandingScreen
        hasProgress={hasProgress}
        bestScore={progress.bestScore}
        completedCount={progress.completed.length}
        onEnter={() => navigate({ name: 'languages' })}
        onContinue={() => openMission(currentMission.id)}
        onPlay={() => openMission('m00')}
        onArcade={() => navigate({ name: 'arcade' })}
        onProfile={() => setSettingsOpen(true)}
        currentMission={currentMission}
        studentName={progress.studentName}
      />
      {settingsDialog}
    </>
  );
}
