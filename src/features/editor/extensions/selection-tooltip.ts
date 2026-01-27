import { EditorView, Tooltip, showTooltip } from "@codemirror/view"
import { StateField, EditorState } from "@codemirror/state"
import { showQuickEditEffect, quickEditState } from "./quick-edit";



let editorView: EditorView | null = null;

// Función que decide qué botones mostrar
// cuando el usuario selecciona texto
const createTooltipForSelection = (state: EditorState): readonly Tooltip[] => {
  const selection = state.selection.main;                                     // Obtiene la selección principal
  if (selection.empty) return [];                                             // Si no hay selección, no muestra el menú

  const isQuickEditActive = state.field(quickEditState);                      // Verifica si ya estamos en modo edición (formulario abierto)
  if (isQuickEditActive) return [];                                           // Si el formulario ya está abierto, oculta estos botones

  return [
    {
      pos: selection.to,                                                      // Posiciona el menú al final de la selección
      above: false,                                                           // Muestra el menú debajo del texto
      strictSide: false,                                                      // Permite ajuste automático de posición
      create() {                                                              // Construye el DOM del menú de herramientas
        const dom = document.createElement("div")                             // Contenedor principal del menú
        dom.className = "bg-popover text-popover-foreground z-50 rounded-sm border border-input p-1 shadow-md flex items-center gap-2 text-sm"

        const addToChatButton = document.createElement("button");              // Boton para enviar código al chat
        addToChatButton.textContent = "Add to Chat";
        addToChatButton.className = "font-sans p-1 px-2 hover:bg-foreground/10 rounded-sm"
        const quickEditButton = document.createElement("button");             // Botón para activar el Smart Edit
        quickEditButton.className = "font-sans p-1 px-2 hover:bg-foreground/10 rounded-sm flex items-center gap-1"
        const quickEditButtonText = document.createElement("span");
        quickEditButtonText.textContent = "Quick Edit"
        const quickEditButtonShortcut = document.createElement("span");       // Indicador visual del atajo de teclado
        quickEditButtonShortcut.textContent = "(Ctrl+K)"
        quickEditButtonShortcut.className = "text-sm opacity-60"

        quickEditButton.appendChild(quickEditButtonText);
        quickEditButton.appendChild(quickEditButtonShortcut);
        quickEditButton.onclick = () => {                                     // Al hacer clic, activa el modo Smart Edit
          if (editorView) {
            editorView.dispatch({
              effects: showQuickEditEffect.of(true)                           // Envía el efecto para abrir el formulario
            })
          }
        }
        dom.appendChild(addToChatButton);                                     // Añade botón de chat al menú
        dom.appendChild(quickEditButton);                                     // Añade botón de edición al menú
        return { dom }                                                        // Retorna el elemento para ser renderizado por CM
      }
    }
  ]
}

// Campo de estado que controla la lógica 
// de actualización del menú de selección
const selectionTooltipField = StateField.define<readonly Tooltip[]>({
  create(state) {
    return createTooltipForSelection(state);                                  // Crea el menú inicial
  },
  update(tooltips, transaction) {                                             // Actualiza el menú ante cualquier cambio
    if (!transaction.docChanged && !transaction.selection) {                  // Si no cambió el texto ni la selección...
      return createTooltipForSelection(transaction.state)                     // ...intenta actualizarlo
    }
    for (const effect of transaction.effects) {                               // Escucha efectos externos
      if (effect.is(showQuickEditEffect)) {                                   // Si se activa/desactiva el modo edición...
        return createTooltipForSelection(transaction.state)                   // ...refresca el menú
      }
    }
    return tooltips;                                                          // Si no hay cambios, mantiene el menú actual
  },
  provide: (field) => showTooltip.computeN(                                   // Registra el campo en el sistema de tooltips de CM
    [field],
    (state) => state.field(field)
  )
})



const captureViewExtension = EditorView.updateListener.of((update) => {
  editorView = update.view;
})

export const selectionTooltip = () => [
  selectionTooltipField,
  captureViewExtension,
]