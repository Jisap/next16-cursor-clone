import { EditorState, StateEffect, StateField } from "@codemirror/state"
import {
  EditorView,
  Tooltip,
  showTooltip,
  ViewPlugin,
  ViewUpdate,
  keymap,
} from "@codemirror/view";
import { fetcher } from "./fetcher";

let editorView: EditorView | null = null;
let currentAbortController: AbortController | null = null;

export const showQuickEditEffect = StateEffect.define<boolean>();             // Es como una especie de evento personalizado. Despacha una orden al editor 


const quickEditState = StateField.define<boolean>({                           // Estado para almacenar la edicion rapida actual
  create() {
    return false                                                              // Valor inicial (false)
  },
  update(value, transaction) {                                                // Actualiza el estado cuando ocurre algo en el editor
    for (const effect of transaction.effects) {                               // Recorre todas las transacciones (acciones) que ocurrieron en el editor 
      if (effect.is(showQuickEditEffect)) {                                   // Si la transacción (accion que ocurre (true a la edición)) existe
        return effect.value;                                                  // actualizamos el valor de la transacción (true a la edición)
      }
    }

    if (transaction.selection) {                                              // Si con el cursor seleccionamos algo
      const selection = transaction.state.selection.main;                     // Obtenemos la selección actual
      if (selection.empty) {                                                  // Si la selección es vacia
        return false;                                                         // desactivamos el modo quick Edit
      }
    }
    return value;                                                             // retornamos el valor del state
  }
});

// Función para crear el tooltip
const createQuickEditTooltip = (state: EditorState): readonly Tooltip[] => {
  const selection = state.selection.main;                                     // Obtiene la selección principal del cursor
  if (selection.empty) return [];                                             // Si no hay texto seleccionado, no muestra nada

  const isQuickEditActive = state.field(quickEditState);                      // Consulta si el modo Quick Edit está activado
  if (!isQuickEditActive) return [];                                          // Si no está activo, retorna un array vacío

  return [
    {
      pos: selection.to,                                                      // Posiciona el tooltip al final de la selección
      above: false,                                                           // Lo muestra debajo del texto (false = abajo)
      strictSide: false,                                                      // Permite que CM ajuste la posición si no cabe
      create() {                                                              // Método que construye el DOM del tooltip
        const dom = document.createElement("div")                             // Crea el contenedor principal
        dom.className = "bg-popover text-popover-foreground z-50 rounded-sm border border-input p-2 shadow-md flex flex-col gap-2 text-sm"

        const form = document.createElement("form");                          // Crea el formulario para la instrucción
        form.className = "flex flex-col gap-2";

        const input = document.createElement("input");                        // Input donde el usuario escribe qué quiere hacer
        input.type = "text";
        input.placeholder = "Edit selected code";
        input.className = "bg-transparent border-none outline-none px-2 py-1 font-sans w-[300px]"
        input.autofocus = true;                                               // Autofoco automático al aparecer

        const buttonContainer = document.createElement("div");                // Contenedor para botones Cancelar/Submit
        buttonContainer.className = "flex items-center justify-between gap-2";

        const cancelButton = document.createElement("button");                // Botón para cerrar el panel
        cancelButton.type = "button";
        cancelButton.textContent = "Cancel";
        cancelButton.className = "font-sans p-1 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-sm text-xs transition-colors";
        cancelButton.addEventListener("click", () => {                        // Listener para cancelar
          currentAbortController?.abort();                                    // Aborta la petición HTTP si está en curso
          currentAbortController = null;                                      // Limpia la referencia del controlador
          editorView?.dispatch({ effects: showQuickEditEffect.of(false) });   // Despacha efecto para cerrar el modo Quick Edit
        });

        const submitButton = document.createElement("button");                // Botón para enviar la petición a la IA
        submitButton.type = "submit";
        submitButton.textContent = "Submit";
        submitButton.className = "font-sans p-1 px-2 text-primary-foreground bg-primary hover:bg-primary/90 rounded-sm text-xs transition-colors";

        form.onsubmit = async (e) => {                                        // Manejador del envío del formulario
          e.preventDefault();                                                 // Evita la recarga de la página
          if (!editorView) return;                                            // Verifica que tengamos acceso al editor

          const instruction = input.value.trim()                              // Limpia espacios de la instrucción
          if (!instruction) return;                                           // Si está vacío, no hace nada

          const selection = editorView.state.selection.main                   // Captura la selección justo antes del fetch
          const selectedCode = editorView.state.doc.sliceString(selection.from, selection.to) // Extrae el texto a editar
          const fullCode = editorView.state.doc.toString();                   // Obtiene el código completo (contexto)

          submitButton.disabled = true;                                       // Desactiva el botón durante el proceso
          submitButton.textContent = "Editing..."                             // Cambia el texto para dar feedback visual

          currentAbortController = new AbortController();                    // Nuevo controlador para poder cancelar esta petición

          try {
            const editedCode = await fetcher({                                // Llama a la API (Smart Edit)
              selectedCode,
              fullCode,
              instruction,
            }, currentAbortController.signal)

            if (editedCode && editorView) {                                   // Si la IA devolvió código correctamente
              editorView.dispatch({                                           // Aplica los cambios al editor
                changes: { from: selection.from, to: selection.to, insert: editedCode },
                selection: { anchor: selection.from + editedCode.length },    // Resitúa el cursor al final del nuevo código
                effects: showQuickEditEffect.of(false)                        // Apaga el modo Quick Edit tras éxito
              })
            } else {
              submitButton.disabled = false;                                  // Si falla, reactiva el botón
              submitButton.textContent = "Submit";
            }
          } catch (error) {                                                   // Manejo de errores de red o servidor
            submitButton.disabled = false;
            submitButton.textContent = "Submit";
          } finally {
            currentAbortController = null                                     // Finaliza limpiando el controlador
          }
        }

        buttonContainer.appendChild(cancelButton);                            // Monta el botón cancelar
        buttonContainer.appendChild(submitButton);                            // Monta el botón submit
        form.appendChild(input);                                              // Monta el input en el form
        form.appendChild(buttonContainer)                                     // Monta los botones en el form
        dom.appendChild(form)                                                 // Monta el form en el tooltip

        setTimeout(() => input.focus(), 0)                                    // Asegura el foco tras el renderizado de CM

        return { dom }                                                        // Retorna el elemento DOM a CodeMirror
      }
    }
  ]
}

// Campo de estado que gestiona la visibilidad 
// y actualización de los tooltips
const quickEditTooltipField = StateField.define<readonly Tooltip[]>({
  create: (state) => createQuickEditTooltip(state),                           // Inicializa el tooltip basándose en el estado actual
  update(tooltips, tr) {                                                      // Se ejecuta en cada transacción (cambio) del editor
    if (!tr.docChanged && !tr.selection) {                                    // Si no cambió el documento ni la selección...
      return createQuickEditTooltip(tr.state)                                 // ...intenta actualizar/mantener el tooltip
    }
    for (const effect of tr.effects) {                                        // Busca efectos específicos en la transacción
      if (effect.is(showQuickEditEffect)) {                                   // Si se activó/desactivó el modo Quick Edit...
        return createQuickEditTooltip(tr.state)                               // ...refresca el tooltip
      }
    }
    return tooltips                                                           // Si no hay cambios relevantes, mantiene los actuales
  },
  provide: (field) => showTooltip.computeN(                                   // Provee los tooltips al sistema de visualización de CM
    [field],                                                                  // Depende de este campo de estado
    (state) => state.field(field),                                            // Función que extrae los tooltips del estado
  )
})

// Define los atajos de teclado específicos para la edición rápida
const quickEditKeymap = keymap.of([
  {
    key: "Mod-k",                                                             // Atajo: Cmd+K (Mac) o Ctrl+K (Windows/Linux)
    run: (view) => {                                                          // Función que se ejecuta al pulsar el atajo
      const selection = view.state.selection.main;                            // Obtiene la selección actual del editor
      if (selection.empty) {                                                  // Si no hay texto seleccionado...
        return false;                                                         // ...no hace nada y permite que otros plugins usen la tecla
      }

      view.dispatch({                                                         // Si hay selección, activa el modo Quick Edit
        effects: showQuickEditEffect.of(true)                                 // Despacha el efecto que muestra el tooltip
      });
      return true;                                                            // Indica que el atajo ha sido manejado con éxito
    }
  }
])


const captureViewExtension = EditorView.updateListener.of((update) => {
  editorView = update.view;
})


export const quickEdit = (fileName: string) => [ // quick-edit es la extensión que aglutina todo
  quickEditState,
  quickEditTooltipField,
  quickEditKeymap,
  captureViewExtension,
]
