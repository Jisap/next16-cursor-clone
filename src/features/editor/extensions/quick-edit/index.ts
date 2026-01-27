import { EditorState, StateEffect, StateField } from "@codemirror/state"
import {
  EditorView,
  Tooltip,
  showTooltip,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { fetcher } from "./fetcher";


export const showQuickEditEffect = StateEffect.define<boolean>();     // Es como una especie de evento personalizado. Despacha una orden al editor 

let editorView: EditorView | null = null;
let currentAbortController: AbortController | null = null;

const quickEditState = StateField.define<boolean>({                  // Estado para almacenar la edicion rapida actual
  create() {
    return false                                                     // Valor inicial (false)
  },
  update(value, transaction) {                                       // Actualiza el estado cuando ocurre algo en el editor
    for (const effect of transaction.effects) {                      // Recorre todas las transacciones (acciones) que ocurrieron en el editor 
      if (effect.is(showQuickEditEffect)) {                          // Si la transacción (accion que ocurre (true a la edición)) existe
        return effect.value;                                         // actualizamos el valor de la transacción (true a la edición)
      }
    }

    if (transaction.selection) {                                       // Si con el cursor seleccionamos algo
      const selection = transaction.state.selection.main;            // Obtenemos la selección actual
      if (selection.empty) {                                           // Si la selección es vacia
        return false;                                                // desactivamos el modo quick Edit
      }
    }
    return value;                                                    // retornamos el valor del state
  }
});

const createQuickEditTooltip = (state: EditorState): readonly Tooltip[] => {
  const selection = state.selection.main;
  if (selection.empty) {
    return [];
  }

  const isQuickEditActive = state.field(quickEditState);
  if (!isQuickEditActive) {
    return [];
  }

  return [
    {
      pos: selection.to,
      above: false,
      strictSide: false,
      create() {
        const dom = document.createElement("div")
        dom.className =
          "bg-popover text-popover-foreground z-50 rounded-sm border border-input p-2 shadow-md flex flex-col gap-2 text-sm"

        const form = document.createElement("form");
        form.className = "flex flex-col gap-2";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Edit selected code";
        input.className =
          "bg-transparent border-none outline-none px-2 py-1 font-sans w-[300px]"
        input.autofocus = true;

        const buttonContainer = document.createElement("div");
        buttonContainer.className = "flex items-center justify-between gap-2";

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.textContent = "Cancel";
        cancelButton.className =
          "font-sans p-1 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-sm text-xs transition-colors";
        cancelButton.addEventListener("click", () => {
          if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
          }

          if (editorView) {
            editorView.dispatch({
              effects: showQuickEditEffect.of(false)
            })
          }
        });

        const submitButton = document.createElement("button");
        submitButton.type = "submit";
        submitButton.textContent = "Submit";
        submitButton.className =
          "font-sans p-1 px-2 text-primary-foreground bg-primary hover:bg-primary/90 rounded-sm text-xs transition-colors";

        form.onsubmit = async (e) => {
          e.preventDefault();

          if (!editorView) return;

          const instruction = input.value.trim()
          if (!instruction) return;

          const selection = editorView.state.selection.main
          const selectedCode = editorView.state.doc.sliceString(
            selection.from,
            selection.to
          )
          const fullCode = editorView.state.doc.toString();

          submitButton.disabled = true;
          submitButton.textContent = "Editing..."

          currentAbortController = new AbortController();

          try {
            const editedCode = await fetcher(
              {
                selectedCode,
                fullCode,
                instruction,
              },
              currentAbortController.signal
            )

            if (editedCode && editorView) {
              editorView.dispatch({
                changes: {
                  from: selection.from,
                  to: selection.to,
                  insert: editedCode,
                },
                selection: {
                  anchor: selection.from + editedCode.length
                },
                effects: showQuickEditEffect.of(false)
              })
            } else {
              submitButton.disabled = false;
              submitButton.textContent = "Submit";
            }
          } catch (error) {
            console.error(error);
            submitButton.disabled = false;
            submitButton.textContent = "Submit";
          } finally {
            currentAbortController = null
          }
        }

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(submitButton);

        form.appendChild(input);
        form.appendChild(buttonContainer)

        dom.appendChild(form)

        setTimeout(() => {
          input.focus()
        }, 0)

        return { dom }
      }
    }
  ]
}

const quickEditTooltipField = StateField.define<readonly Tooltip[]>({
  create: (state) => createQuickEditTooltip(state),
  update(tooltips, tr) {
    if (!tr.docChanged && !tr.selection) {
      return createQuickEditTooltip(tr.state)
    }
    for (const effect of tr.effects) {
      if (effect.is(showQuickEditEffect)) {
        return createQuickEditTooltip(tr.state)
      }
    }
    return tooltips
  },

  provide: (field) => showTooltip.computeN(
    [field],
    (state) => state.field(field),
  )
})

const editorViewPlugin = ViewPlugin.fromClass(class {
  constructor(view: EditorView) {
    editorView = view;
  }
  update(update: ViewUpdate) {
    editorView = update.view;
  }
  destroy() {
    editorView = null;
  }
});


export const quickEdit = (fileName: string) => [ // quick-edit es la extensión que aglutina todo
  quickEditState,
  quickEditTooltipField,
  editorViewPlugin
]
