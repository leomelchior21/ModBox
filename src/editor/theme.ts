import { EditorView } from '@codemirror/view';
import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/* ============================================================================
   MODBOX — EDITOR THEME
   Deep ink surface with teaching colors shared by the draggable Mods.
   ========================================================================== */

export const modboxEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#06091d',
      color: '#e8eaf2',
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
      backgroundColor: '#06091d',
      color: '#77829a',
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
    '.cm-modbox-token--string': { color: '#f3c969', fontWeight: '700' },
    '.cm-modbox-token--int': { color: '#4de1f2', fontWeight: '700' },
    '.cm-modbox-token--bool': { color: '#ff8b62', fontWeight: '700' },
    '.cm-modbox-token--write': { color: '#4de1f2', fontWeight: '700' },
    '.cm-modbox-token--literal': { color: '#4de1f2', fontWeight: '700' },
    '.cm-modbox-addedLine': {
      backgroundColor: 'rgba(77,225,242,0.18)',
      boxShadow: 'inset 4px 0 0 #4de1f2',
      animation: 'modbox-added-line 0.72s ease-in-out 3',
    },
    '.cm-modbox-dropZone': {
      backgroundColor: 'color-mix(in srgb, var(--drop-color) 16%, transparent)',
      boxShadow: 'inset 4px 0 0 var(--drop-color)',
    },
    '.cm-modbox-dropZone--string': { '--drop-color': '#f3c969' },
    '.cm-modbox-dropZone--int': { '--drop-color': '#4de1f2' },
    '.cm-modbox-dropZone--bool': { '--drop-color': '#ff8b62' },
    '.cm-modbox-dropZone--write': { '--drop-color': '#4de1f2' },
    '.cm-modbox-dropZone--condition': { '--drop-color': '#ef7180' },
    '.cm-modbox-dropZone--assign': { '--drop-color': '#bd9cff' },
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
  { tag: [t.keyword, t.controlKeyword], color: '#f3c969', fontWeight: '700' },
  { tag: [t.typeName, t.standard(t.typeName)], color: '#f3c969' },
  { tag: [t.bool], color: '#4de1f2', fontWeight: '700' },
  { tag: [t.null], color: '#ff8b62', fontWeight: '700' },
  { tag: [t.number], color: '#4de1f2' },
  { tag: [t.string], color: '#9bd587' },
  { tag: [t.comment], color: '#7f8aa2', fontStyle: 'italic' },
  { tag: [t.variableName, t.propertyName], color: '#ef7180' },
  { tag: [t.operator], color: '#4de1f2' },
  { tag: [t.punctuation, t.separator, t.bracket], color: '#d6d9e4' },
  { tag: [t.className, t.namespace, t.function(t.variableName)], color: '#4de1f2' },
  { tag: [t.invalid], color: '#FF4A18', textDecoration: 'underline wavy #FF4A18' },
]);
