import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

// A compact dark editor theme (avoids pulling in a separate theme package).
export const oneDark: Extension = EditorView.theme(
  {
    '&': {
      color: '#d4d4d4',
      backgroundColor: '#1e1e1e',
      height: '100%'
    },
    '.cm-content': {
      caretColor: '#e0e0e0',
      fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
      fontSize: '13.5px'
    },
    '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.5' },
    '&.cm-focused .cm-cursor': { borderLeftColor: '#e0e0e0' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#264f78'
    },
    '.cm-gutters': {
      backgroundColor: '#1e1e1e',
      color: '#666',
      border: 'none'
    },
    '.cm-activeLine': { backgroundColor: '#2a2a2a' },
    '.cm-activeLineGutter': { backgroundColor: '#2a2a2a', color: '#bbb' },
    '.cm-selectionMatch': { backgroundColor: '#3a3d41' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: '#3a5a40',
      outline: 'none'
    }
  },
  { dark: true }
)
