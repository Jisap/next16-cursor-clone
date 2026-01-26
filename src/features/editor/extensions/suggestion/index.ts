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
    return null                                                      // Valor inicial
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
};

let debounceTimer: number | null = null;
let isWaitingForSuggestion = false;
const DEBOUNCE_DELAY = 300;

const generateFakeSuggestion = (textBeforeCursor: string): string | null => {
  const trimmed = textBeforeCursor.trim();
  if (trimmed.endsWith("const")) return " myVariable = ";
  if (trimmed.endsWith("function")) return " myFunction() {\n \n }";
  if (trimmed.endsWith("console.")) return "log()";
  if (trimmed.endsWith("return")) return " null";
  return null;
}


// Actua como el disparador inteligente 
// que decide cuándo solicitar una nueva sugerencia 
// sin sobrecargar el sistema.
const createDebouncePlugin = (fileName: string) => {                         // Función que crea el plugin de rebote (debounce) para sugerencias
  return ViewPlugin.fromClass(                                               // Crea un plugin de vista a partir de una clase
    class {                                                                  // Clase anónima que define el comportamiento del plugin
      constructor(view: EditorView) {                                        // Constructor que se ejecuta al inicializar el plugin (recibe lo que esta mostrando el editor)
        this.triggerSuggestion(view)                                         // Lanza la lógica de sugerencia inicial
      }

      update(update: ViewUpdate) {                                           // Se ejecuta cada vez que la vista del editor se actualiza (recibe el informe de cambios)
        if (update.docChanged || update.selectionSet) {                      // Si el documento cambió o se movió el cursor
          this.triggerSuggestion(update.view)                                // Reinicia el proceso de solicitud de sugerencia
        }
      }

      triggerSuggestion(view: EditorView) {                                  // Método principal para gestionar el retardo de la sugerencia (recibe el view del editor)
        if (debounceTimer !== null) {                                        // Si ya existe un temporizador activo
          clearTimeout(debounceTimer);                                       // Lo cancela para evitar múltiples ejecuciones
        }

        isWaitingForSuggestion = true;                                       // Marca que estamos esperando una nueva sugerencia

        debounceTimer = window.setTimeout(async () => {                      // Inicia un nuevo temporizador con el retraso definido
          const cursor = view.state.selection.main.head;                     // Obtiene la posición actual del cursor (cabeza de la selección)
          const line = view.state.doc.lineAt(cursor);                        // Obtiene la línea de texto donde está el cursor
          const textBeforeCursor = line.text.slice(0, cursor - line.from);   // Extrae el texto desde el inicio de línea hasta el cursor
          const suggestion = generateFakeSuggestion(textBeforeCursor);       // Llama a la lógica para generar una sugerencia simulada

          isWaitingForSuggestion = false;                                    // Indica que ya ha terminado la espera de la sugerencia
          view.dispatch({                                                    // Envía una actualización al estado del editor
            effects: setSuggestionEffect.of(suggestion)                      // Aplica el efecto con la nueva sugerencia (o null)
          })
        }, DEBOUNCE_DELAY)
      }

      destroy() {                                                            // Método de limpieza cuando el plugin se destruye
        if (debounceTimer !== null) {                                        // Si hay un temporizador pendiente
          clearTimeout(debounceTimer);                                       // Lo cancela para liberar recursos y evitar errores
        }
      }
    }
  )
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
      if (isWaitingForSuggestion) {
        return Decoration.none;
      }

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
        selection: { anchor: cursor + suggestion.length },                     // Move the cursor to the end of the suggestion
        effects: [setSuggestionEffect.of(null)]                                // Clear the suggestion
      });
      return true;
    }
  }
])


export const suggestion = (fileName: string) => [ // suggestion es la extensión que aglutina todo
  suggestionState,                                // Estado para la sugerencia actual
  createDebouncePlugin(fileName),                 // trigger suggestion mientras se escribe
  renderPlugin,                                   // Plugin que renderiza la sugerencia
  acceptSuggestionKeymap                          // Tab to accept suggestion
]


// Resumen del flujo:
// 1º El plugin observa el estado suggestionState.
// 2º Cuando suggestionState tiene texto, el plugin busca la posición del cursor.
// 3º El plugin inyecta un elemento HTML(el Widget) justo en esa posición, pero lo hace de forma "virtual"(no modifica el texto real del documento, solo la vista).
// 4º Si el usuario escribe o mueve el cursor, el plugin recalcula la posición para que la sugerencia siempre "siga" al cursor.