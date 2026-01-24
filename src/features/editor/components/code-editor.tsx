import { useEffect, useMemo, useRef } from 'react'
import { EditorView, keymap } from "@codemirror/view"
import { oneDark } from "@codemirror/theme-one-dark"
import { customTheme } from '../extensions/theme'
import { getLanguageExtension } from '../extensions/language-extension'
import { indentWithTab } from "@codemirror/commands"
import { minimap } from '../extensions/minimap'
import { indentationMarkers } from "@replit/codemirror-indentation-markers"
import { customSetup } from '../extensions/custom-setup'


interface Props {
  fileName: string;
  initialValue?: string;
  onChange: (value: string) => void;
}


export const CodeEditor = ({ fileName, initialValue = "", onChange }: Props) => {

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const languageExtension = useMemo(() => getLanguageExtension(fileName), [fileName])

  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      doc: initialValue,
      parent: editorRef.current,
      extensions: [
        oneDark,
        customTheme,
        customSetup,
        languageExtension,
        keymap.of([indentWithTab]),
        minimap(),
        indentationMarkers(),
        EditorView.updateListener.of((update) => {   // Crea un "oyente" que se activa cada vez que escribe, borra etc 
          if (update.docChanged) {                   // Se verifica si el documento cambió
            onChange(update.state.doc.toString());   // Si cambió, se actualiza el estado
          }
        })
      ]
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps --initialValue is only used to initialize the document
  }, [languageExtension])



  return (
    <div ref={editorRef} className='size-full pl-4' />
  )
}
