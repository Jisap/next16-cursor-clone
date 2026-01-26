import { StateEffect, StateField } from "@codemirror/state"
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  keymap
} from "@codemirror/view";

/**
 * Definición de un Efecto de Estado (StateEffect) para gestionar las sugerencias.
 * 
 * En CodeMirror, el estado es inmutable. Este efecto actúa como una señal o evento
 * para comunicar cambios desde fuera del estado (ej. respuesta de una API).
 * 
 * Payload:
 * - string: El texto de la sugerencia a mostrar.
 * - null: Indica que se debe limpiar/borrar la sugerencia actual.
 * 
 * Este efecto será interceptado por un StateField (suggestionState) que actualizará
 * su valor interno en consecuencia.
 */
const setSuggestionEffect = StateEffect.define<string | null>();     // Es como una especie de evento personalizado. Despacha una orden al editor ( Hay una nueva sugerencia o borra la sugerencia)

const suggestionState = StateField.define<string | null>({           // Estado para almacenar la sugerencia actual
  create() {
    return "// TODO: implement this"                                 // Valor inicial
  },
  update(value, transaction) {                                       // Actualiza el estado cuando ocurre algo en el editor
    for (const effect of transaction.effects) {                      // Si la transacción (accion que ocurre) tiene un setSuggestionEffect (sugerencia) la actualizamos
      if (effect.is(setSuggestionEffect)) {                          // Si no mantenemos el valor de la sugerencia
        return effect.value;
      }
    }
    return value;
  }
});

// Aqui se define como se ve la sugerencia en el html
class SuggestionWidget extends WidgetType {
  constructor(readonly text: string) {
    super()
  }

  toDOM() {
    const span = document.createElement("span")
    span.textContent = this.text
    span.style.opacity = "0.4"
    span.style.pointerEvents = "none"
    return span
  }
}

// Esta es la pieza que conecta todo. Observa el estado 
// y decide cuando y donde pintar el widget
const renderPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;                                                // Almacena las decoraciones (widgets) activas

    constructor(view: EditorView) {
      this.decorations = this.build(view)                                      // Genera la decoración inicial al cargar
    }

    update(update: ViewUpdate) {                                               // Se ejecuta en cada cambio (teclas, clics, etc.)
      const suggestionChanged = update.transactions.some((transaction) => {
        return transaction.effects.some((effect) => {
          return effect.is(setSuggestionEffect)                                // ¿Ha llegado una nueva sugerencia?
        });
      });

      // Condiciones para regenerar la UI: cambio en doc, selección o sugerencia
      const shouldRebuild = update.docChanged || update.selectionSet || suggestionChanged;

      if (shouldRebuild) {
        this.decorations = this.build(update.view)                             // Actualiza la posición o el texto del widget
      }
    }

    build(view: EditorView) {
      const suggestion = view.state.field(suggestionState);                    // Extrae el texto del Ghost Text desde el estado

      if (!suggestion) {
        return Decoration.none;                                                // Si no hay texto, limpia la pantalla
      }

      const cursor = view.state.selection.main.head;                           // Obtiene la posición exacta donde está el cursor
      return Decoration.set([
        Decoration.widget({
          widget: new SuggestionWidget(suggestion),                            // Crea la pieza visual (DOM)
          side: 1,                                                             // Fuerza a que aparezca A LA DERECHA del cursor
          key: "suggestion"                                                    // ID para que CodeMirror recicle el elemento
        }).range(cursor)                                                       // Ancla el widget a la posición del cursor
      ])
    }
  },
  {
    decorations: (plugin) => plugin.decorations                                // Indica al editor qué propiedad renderizar
  }
);

const acceptSuggestionKeymap = keymap.of([
  {
    key: "Tab",                                                                // Tab para aceptar la sugerencia
    run: (view) => {
      const suggestion = view.state.field(suggestionState);                    // Obtiene el texto de la sugerencia
      if (!suggestion) return false;                                           // Si no hay sugerencia, el tab hace su función normal

      const cursor = view.state.selection.main.head;                           // Obtiene la posición del cursor
      view.dispatch({
        changes: { from: cursor, insert: suggestion },                         // Insert the suggestion text at the cursor position
        selection: { anchor: cursor + suggestion.length },                      // Move the cursor to the end of the suggestion
        effects: [setSuggestionEffect.of(null)]                                // Clear the suggestion
      });
      return true;
    }
  }
])


export const suggestion = (fileName: string) => [ // suggestion es la extensión que aglutina todo
  suggestionState,                                // Estado para la sugerencia actual
  renderPlugin,                                   // Plugin que renderiza la sugerencia
  acceptSuggestionKeymap                          // Tab to accept suggestion
]


// Resumen del flujo:
// 1º El plugin observa el estado suggestionState.
// 2º Cuando suggestionState tiene texto, el plugin busca la posición del cursor.
// 3º El plugin inyecta un elemento HTML(el Widget) justo en esa posición, pero lo hace de forma "virtual"(no modifica el texto real del documento, solo la vista).
// 4º Si el usuario escribe o mueve el cursor, el plugin recalcula la posición para que la sugerencia siempre "siga" al cursor.