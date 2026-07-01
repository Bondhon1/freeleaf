import { useEffect, useRef } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  StreamLanguage
} from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { oneDark } from './editorTheme'
import { useStore } from '../state/store'

function buildExtensions(theme: 'light' | 'dark'): Extension[] {
  const onChange = EditorView.updateListener.of((u) => {
    if (u.docChanged) useStore.getState().setEditorContents(u.state.doc.toString())
  })

  const appKeymap = keymap.of([
    {
      key: 'Mod-s',
      preventDefault: true,
      run: () => {
        void useStore.getState().saveActiveFile()
        return true
      }
    },
    {
      key: 'Mod-Enter',
      preventDefault: true,
      run: () => {
        void useStore.getState().runCompile()
        return true
      }
    }
  ])

  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    highlightSelectionMatches(),
    StreamLanguage.define(stex),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    appKeymap,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    onChange,
    EditorView.lineWrapping,
    ...(theme === 'dark' ? [oneDark] : [])
  ]
}

export default function Editor(): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const activePath = useStore((s) => s.activeFile?.path ?? null)
  const theme = useStore((s) => s.settings?.theme ?? 'dark')
  const gotoRequest = useStore((s) => s.gotoRequest)

  // Create the view once.
  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: useStore.getState().activeFile?.contents ?? '',
        extensions: buildExtensions(useStore.getState().settings?.theme ?? 'dark')
      })
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // Rebuild state when theme changes (simple full reconfigure).
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.setState(
      EditorState.create({
        doc: view.state.doc,
        selection: view.state.selection,
        extensions: buildExtensions(theme)
      })
    )
  }, [theme])

  // Load new document when the active file changes.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const contents = useStore.getState().activeFile?.contents ?? ''
    if (contents !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: contents } })
    }
  }, [activePath])

  // Jump to a line on request (from the log panel).
  useEffect(() => {
    const view = viewRef.current
    if (!view || !gotoRequest) return
    const lineNo = Math.min(Math.max(gotoRequest.line, 1), view.state.doc.lines)
    const line = view.state.doc.line(lineNo)
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' })
    })
    view.focus()
  }, [gotoRequest])

  return <div className="editor" ref={hostRef} />
}
