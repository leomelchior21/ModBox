import { MOD_DRAG_TYPE, placeMod } from './modEditing';
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
} from '@codemirror/view';
import { EditorState, StateEffect, StateField, type Range } from '@codemirror/state';
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
          errorLineDecorations,
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
              event.preventDefault(); applyModToEditor(view, snippet); return true;
            },
            focus: () => onFocusRef.current?.(true),
            blur: () => onFocusRef.current?.(false),
          }),
        ],
      }),
    });

    viewRef.current = view;
    onViewReadyRef.current?.(view);
    return () => {
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
export function applyModToEditor(view: EditorView | null, snippet: string): void {
  if (!view) return;
  const next = placeMod(view.state.doc.toString(), snippet);
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
  view.focus();
}
