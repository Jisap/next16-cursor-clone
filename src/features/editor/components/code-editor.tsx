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
        customSetup,
        languageExtension,
        keymap.of([indentWithTab]),
        minimap(),
        indentationMarkers()
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
