import { useCallback, useEffect, useState } from 'react';
import type { LanguageId } from '../interpreter/core/adapter';
import { codeKey } from '../interpreter/languageSyntax';
import { useProgress } from '../state/progressStore';

/** Save at the game boundary so switching games cannot redirect a late edit. */
export function useGameCode(gameId: string, missionId: string, language: LanguageId, starter: string) {
  const key = codeKey(language, missionId);
  const read = () => useProgress.getState().getGameProgress(gameId).codes[key] ?? starter;
  const [code, setCode] = useState(read);
  useEffect(() => { setCode(read()); }, [gameId, key, starter]);
  const onChange = useCallback((value: string) => {
    setCode(value);
    useProgress.getState().setGameCode(gameId, key, value);
  }, [gameId, key]);
  return { code, onChange };
}
