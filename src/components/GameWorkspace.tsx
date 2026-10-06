import type { ReactNode, RefObject } from 'react';
import { CrtGlass } from './CrtGlass';
import { CodeEditor, type CodeEditorProps } from '../editor/CodeEditor';
import { FeedbackPanel, type FeedbackPanelProps } from './FeedbackPanel';
import { ModStrip, type ModStripProps } from './ModStrip';
import { ModLibrary } from './ModLibrary';

export interface GameWorkspaceProps {
  gameId: string;
  gameTitle: string;
  touch: boolean;
  coding: boolean;
  header: ReactNode;
  editor: CodeEditorProps;
  editorToolbar: ReactNode;
  feedback: FeedbackPanelProps;
  modStrip: ModStripProps;
  modAreaExtras?: ReactNode;
  library: { open: boolean; onClose: () => void; onInsert: ModStripProps['onInsert'] };
  stage: ReactNode;
  stageRef?: RefObject<HTMLDivElement>;
  stageExtras?: ReactNode;
  overlays?: ReactNode;
}

/** Shared responsive workspace. Games supply their own simulation and controls. */
export function GameWorkspace({ gameId, gameTitle, touch, coding, header, editor, editorToolbar, feedback, modStrip, modAreaExtras, library, stage, stageRef, stageExtras, overlays }: GameWorkspaceProps): JSX.Element {
  return <div className={`lab crt-cabinet ${touch ? 'lab--touch' : ''} ${coding ? 'lab--coding' : 'lab--flying'}`} data-game-id={gameId}>
    <CrtGlass />
    {header}
    <div className="lab__body">
      <section id="code-panel" className="lab__left" aria-label="Code and mission">
        <div className="lab__editorZone">
          <div className={`lab__editor ${editor.coach ? 'lab__editor--coaching' : ''}`}>
            <div className="lab__editorHead">{editorToolbar}</div>
            <CodeEditor {...editor} />
          </div>
          <FeedbackPanel {...feedback} />
          <div className={`lab__modArea ${modAreaExtras ? 'lab__modArea--controls' : ''}`}>
            {modAreaExtras}
            <ModStrip {...modStrip} />
          </div>
        </div>
      </section>
      <section id="flight-panel" className="lab__right" aria-label={`${gameTitle} game`}>
        <div className="lab__stageHost" ref={stageRef}>
          <div className="stage-frame">{stage}</div>
          <ModLibrary {...library} unlocked={modStrip.mods} totalMods={modStrip.totalMods} language={modStrip.language} runtimeLabels={editor.runtimeLabels} />
          {stageExtras}
        </div>
      </section>
    </div>
    {overlays}
  </div>;
}
