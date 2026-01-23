import React, { useEffect, useMemo, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorView, keymap } from "@codemirror/view"
import { oneDark } from "@codemirror/theme-one-dark"
import { customTheme } from '../extensions/theme'
import { getLanguageExtension } from '../extensions/language-extension'
import { indentWithTab } from "@codemirror/commands"


interface Props {
  fileName: string;
}


export const CodeEditor = ({ fileName }: Props) => {

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const languageExtension = useMemo(() => getLanguageExtension(fileName), [fileName])

  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      doc: `
        const Counter = () => {
          const [count, setCount] = useState(0);
          return (
            <div>
              <p>Count: {count}</p>
              <button onClick={() => setCount(count + 1)}>Increment</button>
              <button onClick={() => setCount(count - 1)}>Decrement</button>
            </div>
          );
        };
      `,
      parent: editorRef.current,
      extensions: [
        oneDark,
        customTheme,
        basicSetup,
        languageExtension,
        keymap.of([indentWithTab]),
      ]
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    }
  }, [])



  return (
    <div ref={editorRef} className='size-full pl-4' />
  )
}
