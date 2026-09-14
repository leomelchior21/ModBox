import {
  MOD_DRAG_END_EVENT,
  MOD_DRAG_START_EVENT,
  MOD_DRAG_TYPE,
  codeBlocks,
  endModDrag,
  placeMod,
  type ModInsertMode,
} from './modEditing';
import { useEffect, useRef } from 'react';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars,
  MatchDecorator,
  ViewPlugin,
} from '@codemirror/view';
import { EditorState, StateEffect, StateField, type Range, type Text } from '@codemirror/state';
import { Decoration, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { csharpCompletions, csharpHighlighting, csharpLanguage } from './csharpLanguage';
import { modboxEditorTheme } from './theme';

/* ============================================================================
   MODBOX — CODE EDITOR
   CodeMirror 6, tuned for tablets: 16px code, big touch targets, no IDE
   chrome. Focus state is reported so gameplay keys stay out of the way.
   ========================================================================== */

const setErrorLines = StateEffect.define<number[]>();
const setModDropZone = StateEffect.define<string | null>();

const errorLineDecorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorLines)) continue;
      const marks: Range<Decoration>[] = [];
      for (const line of effect.value) {
        if (line < 1 || line > transaction.state.doc.lines) continue;
        marks.push(
          Decoration.line({ class: 'cm-modbox-errorLine' }).range(
            transaction.state.doc.line(line).from,
          ),
        );
      }
      next = Decoration.set(marks, true);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

interface ModDropZoneState {
  snippet: string | null;
  decorations: DecorationSet;
}

function modDropZoneDecorations(doc: Text, snippet: string): DecorationSet {
  const incoming = codeBlocks(snippet)?.[0];
  if (!incoming) return Decoration.none;
  const blocks = codeBlocks(doc.toString()) ?? [];
  const sameSection = blocks.filter((block) => block.group === incoming.group);
  const preceding = blocks.filter((block) => block.group < incoming.group);
  const incomingName = incoming.statement.kind === 'varDecl' ? incoming.statement.name : null;
  const exactDeclaration = incomingName
    ? sameSection.filter(
      (block) => block.statement.kind === 'varDecl' && block.statement.name === incomingName,
    ).at(-1)
    : undefined;
  const sectionAnchor = sameSection.at(-1);
  const precedingAnchor = preceding.at(-1);
  const target = exactDeclaration ?? sectionAnchor ?? precedingAnchor;
  const targets = target ? [target] : [];
  const positions = new Set<number>();

  if (targets.length) {
    for (const block of targets) {
      const first = doc.lineAt(Math.min(block.from, doc.length)).number;
      const last = doc.lineAt(Math.min(block.to, doc.length)).number;
      for (let line = first; line <= last; line += 1) positions.add(doc.line(line).from);
    }
  } else {
    positions.add(doc.line(1).from);
  }

  const statement = incoming.statement;
  const tone =
    statement.kind === 'varDecl'
      ? statement.varType
      : statement.kind === 'writeLine'
        ? 'write'
        : statement.kind === 'if'
          ? 'condition'
          : 'assign';
  const marks = [...positions].map((position) =>
    Decoration.line({ class: `cm-modbox-dropZone cm-modbox-dropZone--${tone}` }).range(position),
  );
  return Decoration.set(marks, true);
}

const modDropZone = StateField.define<ModDropZoneState>({
  create: () => ({ snippet: null, decorations: Decoration.none }),
  update(value, transaction) {
    let snippet = value.snippet;
    for (const effect of transaction.effects) {
      if (effect.is(setModDropZone)) snippet = effect.value;
    }
    if (!snippet) return { snippet: null, decorations: Decoration.none };
    if (transaction.docChanged || snippet !== value.snippet) {
      return { snippet, decorations: modDropZoneDecorations(transaction.state.doc, snippet) };
    }
    return { snippet, decorations: value.decorations.map(transaction.changes) };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

const teachingTokenMatcher = new MatchDecorator({
  regexp: /\b(?:string|int|bool|Console\.WriteLine)\b/g,
  decoration: (match) => {
    const token = match[0];
    const tone = token === 'Console.WriteLine' ? 'write' : token;
    return Decoration.mark({ class: `cm-modbox-token cm-modbox-token--${tone}` });
  },
});

const teachingTokenColors = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = teachingTokenMatcher.createDeco(view);
    }
    update(update: import('@codemirror/view').ViewUpdate): void {
      this.decorations = teachingTokenMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  errorLines?: number[];
  onFocusChange?: (focused: boolean) => void;
  onViewReady?: (view: EditorView | null) => void;
  ariaLabel?: string;
}

export function CodeEditor({
  value,
  onChange,
  errorLines = [],
  onFocusChange,
  onViewReady,
  ariaLabel = 'C# code editor',
}: CodeEditorProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocusChange);
  const onViewReadyRef = useRef(onViewReady);
  onChangeRef.current = onChange;
  onFocusRef.current = onFocusChange;
  onViewReadyRef.current = onViewReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          rectangularSelection(),
          crosshairCursor(),
          indentOnInput(),
          indentUnit.of('    '),
          bracketMatching(),
          closeBrackets(),
          autocompletion({ override: [csharpCompletions], activateOnTyping: true }),
          EditorState.tabSize.of(4),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          // the same clike/csharp stream, registered once
          csharpLanguage,
          csharpHighlighting,
          modboxEditorTheme,
          teachingTokenColors,
          errorLineDecorations,
          modDropZone,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            autocapitalize: 'off',
            autocorrect: 'off',
            spellcheck: 'false',
            'aria-label': ariaLabel,
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            dragover: (event) => {
              if (!event.dataTransfer?.types.includes(MOD_DRAG_TYPE)) return false;
              event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; return true;
            },
            drop: (event, view) => {
              const snippet = event.dataTransfer?.getData(MOD_DRAG_TYPE);
              if (!snippet) return false;
              event.preventDefault();
              applyModToEditor(view, snippet, 'duplicate');
              endModDrag();
              return true;
            },
            focus: () => onFocusRef.current?.(true),
            blur: () => onFocusRef.current?.(false),
          }),
        ],
      }),
    });

    viewRef.current = view;
    onViewReadyRef.current?.(view);
    const showDropZone = (event: Event) => {
      const snippet = (event as CustomEvent<{ snippet?: string }>).detail?.snippet;
      if (snippet) view.dispatch({ effects: setModDropZone.of(snippet) });
    };
    const hideDropZone = () => view.dispatch({ effects: setModDropZone.of(null) });
    window.addEventListener(MOD_DRAG_START_EVENT, showDropZone);
    window.addEventListener(MOD_DRAG_END_EVENT, hideDropZone);
    return () => {
      window.removeEventListener(MOD_DRAG_START_EVENT, showDropZone);
      window.removeEventListener(MOD_DRAG_END_EVENT, hideDropZone);
      view.destroy();
      viewRef.current = null;
      onViewReadyRef.current?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // external value changes (mission switches, quick inserts)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setErrorLines.of(errorLines) });
  }, [errorLines]);

  return <div className="editor-host" ref={hostRef} />;
}

/** Inserts text at the caret — used by the quick-insert chips (spec §27). */
export function insertIntoEditor(view: EditorView | null, text: string, caretBack = 0): boolean {
  if (!view) return false;
  const selection = view.state.selection.main;
  const insert = text;
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert },
    selection: { anchor: selection.from + insert.length - caretBack },
  });
  view.focus();
  return true;
}

/** Library operations are single undoable transactions, independent of the caret. */
export function applyModToEditor(
  view: EditorView | null,
  snippet: string,
  mode: ModInsertMode = 'replace',
): void {
  if (!view) return;
  const next = placeMod(view.state.doc.toString(), snippet, mode);
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
  view.focus();
}
