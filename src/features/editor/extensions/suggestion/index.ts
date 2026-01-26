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
import { fetcher } from "./fetcher";

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
const DEBOUNCE_DELAY = 1000;

let currentAbortController: AbortController | null = null;

// Genera el payload para enviar al servidor
const generatePayload = (view: EditorView, fileName: string) => {
  const code = view.state.doc.toString();
  if (!code || code.trim().length === 0) return null;

  const cursorPosition = view.state.selection.main.head;
  const currentLine = view.state.doc.lineAt(cursorPosition);
  const cursorInLine = cursorPosition - currentLine.from;

  const previousLines: string[] = [];
  const previousLinesToFetch = Math.min(5, currentLine.number - 1);
  for (let i = previousLinesToFetch; i >= 1; i--) {
    previousLines.push(view.state.doc.line(currentLine.number - i).text);
  }

  const nextLines: string[] = [];
  const totalLines = view.state.doc.lines;
  const linesToFetch = Math.min(5, totalLines - currentLine.number);
  for (let i = 1; i <= linesToFetch; i++) {
    nextLines.push(view.state.doc.line(currentLine.number + i).text)
  }

  return {
    fileName,
    code,
    currentLine: currentLine.text,
    previousLines: previousLines.join("\n"),
    textBeforeCursor: currentLine.text.slice(0, cursorInLine),
    textAfterCursor: currentLine.text.slice(cursorInLine),
    nextLines: nextLines.join("\n"),
    lineNumber: currentLine.number,
  }
}

// Crea un plugin de vista para CodeMirror 
// que gestiona cuándo pedir sugerencias
// Actua como el disparador inteligente 
// que decide cuándo solicitar una nueva sugerencia 
// sin sobrecargar el sistema.
const createDebouncePlugin = (fileName: string) => {                         // Recibe el nombre del archivo para pasarlo al contexto
  return ViewPlugin.fromClass(                                               // Instancia un plugin basado en una clase
    class {                                                                  // Clase anónima que contiene la lógica del plugin
      constructor(view: EditorView) {                                        // Se ejecuta una vez al montar el editor (recibe lo que esta mostrando el editor)
        this.triggerSuggestion(view)                                         // Intenta pedir una sugerencia inicial
      }

      update(update: ViewUpdate) {                                           // Se ejecuta cada vez que la vista del editor se actualiza (recibe el informe de cambios)
        if (update.docChanged || update.selectionSet) {                      // Si el documento cambió o se movió el cursor
          this.triggerSuggestion(update.view)                                // Reinicia el proceso de solicitud de sugerencia
        }
      }

      triggerSuggestion(view: EditorView) {                                  // Método principal para gestionar el retardo de la sugerencia (recibe el view del editor)
        if (debounceTimer !== null) {                                        // Si ya existe un temporizador activo
          clearTimeout(debounceTimer);                                       // lo cancela para evitar múltiples ejecuciones
        }

        if (currentAbortController !== null) {                               // Si hay una petición HTTP viajando...
          currentAbortController.abort("Cancelled by new suggestion");       // ...la mata (ya no nos interesa su respuesta) 
        }

        isWaitingForSuggestion = true;                                       // Marca estado global: "Cargando..." (para la UI)

        debounceTimer = window.setTimeout(async () => {                      // Inicia un nuevo temporizador con el retraso definido
          const payload = generatePayload(view, fileName);                   // Prepara el texto y contexto para enviar. Genera el payload

          if (!payload) {                                                    // Si no hay contexto válido (ej. archivo vacío)...
            isWaitingForSuggestion = false;                                  // ...apaga el estado de carga
            view.dispatch({ effects: setSuggestionEffect.of(null) })         // ...y limpia cualquier sugerencia en pantalla
            return                                                           // Sale, no hace petición
          }

          currentAbortController = new AbortController();                    // Crea un "interruptor" para cancelar esta petición futura

          const suggestion = await fetcher(                                  // Llama a la API (fetcher.ts)
            payload, currentAbortController.signal                           // Pasa los datos y la señal de aborto
          );


          isWaitingForSuggestion = false;                                    // Ya tenemos respuesta, apaga "Cargando..."
          view.dispatch({                                                    // Envía una orden al editor
            effects: setSuggestionEffect.of(suggestion)                      // "Pinta esta sugerencia" (o bórrala si es null)
          })
        }, DEBOUNCE_DELAY)                                                   // Espera este tiempo antes de ejecutar lo de arriba 
      }

      destroy() {                                                            // Se llama cuando cierras el archivo o el editor
        if (debounceTimer !== null) {                                        // Si hay una cuenta atrás pendiente...
          clearTimeout(debounceTimer);                                       // ...la limpia para evitar errores
        }

        if (currentAbortController !== null) {                               // Si hay una petición en curso...
          currentAbortController.abort();                                    // ...la cancela
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