import { EditorView } from '@codemirror/view';
import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/* ============================================================================
   MODBOX — EDITOR THEME
   Ink surface, cream code, electric blue cursor, flare for problems.
   ========================================================================== */

export const modboxEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#06140c',
      color: '#e4ffdf',
      fontSize: '16px',
      height: '100%',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      lineHeight: '1.75',
      padding: '14px 0 40px',
      scrollbarWidth: 'thin',
      scrollbarColor: '#344d6a transparent',
    },
    '.cm-content': {
      caretColor: '#60eddd',
      padding: '0 8px',
    },
    '.cm-line': { padding: '0 10px' },
    '.cm-gutters': {
      backgroundColor: '#06140c',
      color: '#86a58c',
      border: 'none',
      paddingRight: '4px',
      userSelect: 'none',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 10px 0 14px',
      minWidth: '30px',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(137,199,146,0.14)',
      boxShadow: 'inset 3px 0 0 0 rgba(180,255,188,0.9)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(137,199,146,0.22)',
      color: '#e4ffdf',
      fontWeight: '700',
    },
    '.cm-scroller::-webkit-scrollbar': { width: '12px', height: '12px' },
    '.cm-scroller::-webkit-scrollbar-track': { background: 'transparent' },
    '.cm-scroller::-webkit-scrollbar-thumb': {
      background: '#365c40',
      borderRadius: '99px',
      border: '3px solid transparent',
      backgroundClip: 'content-box',
    },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': {
      background: '#2c5cff',
      backgroundClip: 'content-box',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#60eddd', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(137,199,146,0.35)',
    },
    '.cm-selectionMatch': { backgroundColor: 'rgba(137,199,146,0.22)' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: 'rgba(255,74,24,0.22)',
      outline: '1px solid rgba(255,74,24,0.6)',
    },
    '.cm-modbox-errorLine': {
      backgroundColor: 'rgba(255,74,24,0.14)',
      boxShadow: 'inset 3px 0 0 0 #FF4A18',
    },
    '.cm-tooltip': {
      backgroundColor: '#0c2114',
      border: '1px solid #365c40',
      borderRadius: '8px',
      color: '#e4ffdf',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: '#2C5CFF',
      color: '#fff',
    },
    '.cm-panels': { backgroundColor: '#0c2114', color: '#e4ffdf' },
    '.cm-button': {
      backgroundColor: '#152052',
      backgroundImage: 'none',
      border: '1px solid #365c40',
      borderRadius: '6px',
      color: '#e4ffdf',
    },
  },
  { dark: true },
);

export const modboxHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword], color: '#60eddd', fontWeight: '700' },
  { tag: [t.typeName, t.standard(t.typeName)], color: '#53DFFF' },
  { tag: [t.bool, t.null], color: '#FF8A5E', fontWeight: '700' },
  { tag: [t.number], color: '#FF8A5E' },
  { tag: [t.string], color: '#e5ef72' },
  { tag: [t.comment], color: '#86a58c', fontStyle: 'italic' },
  { tag: [t.variableName, t.propertyName], color: '#e4ffdf' },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: 'rgba(238,243,255,0.62)' },
  { tag: [t.className, t.namespace], color: '#35E08F' },
  { tag: [t.invalid], color: '#FF4A18', textDecoration: 'underline wavy #FF4A18' },
]);
