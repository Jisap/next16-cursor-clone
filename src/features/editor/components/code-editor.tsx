import React, { useEffect, useRef } from 'react'
import { basicSetup, EditorView } from 'codemirror'
import { javascript } from "@codemirror/lang-javascript"
import { oneDark } from "@codemirror/theme-one-dark"
import { customTheme } from '../extensions/theme'


export const CodeEditor = () => {

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

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
        javascript({ typescript: true })
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
