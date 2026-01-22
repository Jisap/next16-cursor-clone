import { create } from "zustand";
import { Id } from "../../../../convex/_generated/dataModel";

/*
*  Este store de Zustand gestiona un sistema de pestañas de editor multi-proyecto con soporte 
*  para pestañas preview (vista previa) y pinned (fijadas). 
*  Es similar al comportamiento de VS Code
*/

/*
*  Comportamiento Tipo VS Code
*  AcciónResultado
*  Click simple en archivo ---> Abre como preview, reemplaza preview anterior
*  Doble click en archivo  ---> Abre como pinned (fijado)
*  Doble click en preview  ---> Convierte preview a pinned
*  Editar archivo preview  ---> (Requeriría lógica adicional para fijar) 
*/

interface TabState {
  openTabs: Id<"files">[];          // Lista de archivos abiertos
  activeTabId: Id<"files"> | null;  // La pestaña actualmente seleccionada/visible
  previewTabId: Id<"files"> | null; // Pestaña temporal que se reemplaza al abrir otro archivo (click simple)
}

// Pinned Tab: Pestaña fijada que permanece hasta cerrarla manualmente (doble click)

const defaultTabState: TabState = {
  openTabs: [],
  activeTabId: null,
  previewTabId: null
}

interface EditorStore {
  tabs: Map<Id<"projects">, TabState>;                      // Nucleo del store: Cada proyecto tiene su propio conjunto de pestañas

  //tabs
  // ├─ projectA → { openTabs, activeTabId, previewTabId }
  // └─ projectB → { openTabs, activeTabId, previewTabId }


  getTabState: (projectId: Id<"projects">) => TabState;                     // Obtiene el estado de las pestañas de un proyecto

  openFile: (                                                               // Abre un archivo en una pestaña  
    projectId: Id<"projects">,
    fileId: Id<"files">,
    options: { pinned: boolean }
  ) => void;

  closeTab: (                                                               // Cierra una pestaña
    projectId: Id<"projects">,
    fileId: Id<"files">,
  ) => void;

  closeAllTabs: (projectId: Id<"projects">) => void;                        // Cierra todas las pestañas de un proyecto

  setActiveTab: (
    projectId: Id<"projects">,
    fileId: Id<"files">,
  ) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: new Map(),                                                          // Inicializa el store 

  getTabState: (projectId) => {
    return get().tabs.get(projectId) ?? defaultTabState;                    // Obtiene el estado de las pestañas de un proyecto
  },

  openFile: (
    projectId,  // ID del proyecto
    fileId,     // ID del archivo que queremos abrir
    { pinned }  // Indica si la intención es abrirlo como "vista previa" (false) o "fijado" (true).
  ) => {

    // Lo primero que hace es crear una copia del mapa de pestañas para trabajar 
    // de forma inmutable y recuperar el estado actual del proyecto.

    const tabs = new Map(get().tabs);                                        // Copia del mapa de pestañas global
    const state = tabs.get(projectId) ?? defaultTabState;                    // Estado actual del proyecto
    const { openTabs, previewTabId } = state;                                // Desestructuramos los estados de Pestañas abiertas y pestaña de vista previa
    const isOpen = openTabs.includes(fileId);                                // Verifica si el archivo ya está abierto

    // Caso 1: Abrir como Vista Previa (Click Simple)
    // Este caso ocurre cuando haces click en un archivo 
    // que no esta abierto y no es fijado
    if (!isOpen && !pinned) {
      const newTabs = previewTabId                                           // Si hay una pestaña de vista previa
        ? openTabs.map((id) => (id !== previewTabId) ? fileId : id)          // Reemplaza la pestaña de vista previa por el archivo abierto
        : [...openTabs, fileId]                                              // Si no hay pestaña de vista previa, agrega el archivo abierto

      tabs.set(projectId, {                                                  // Actualiza el estado del proyecto
        openTabs: newTabs,
        activeTabId: fileId,
        previewTabId: fileId
      });
      set({ tabs });
      return;
    }

    // Case 2: Opening as pinned - add new tab
    // Este caso ocurre cuando haces doble clic en un archivo que no está abierto, 
    // o cuando creas uno nuevo (que suele abrirse fijado).
    if (!isOpen && pinned) {
      tabs.set(projectId, {                                                   // Actualiza el estado del proyecto
        ...state,                                                             // Al estado actual le agregamos
        openTabs: [...openTabs, fileId],                                      // El archivo abierto
        activeTabId: fileId,                                                  // y este se activa
      });
      set({ tabs });
      return;
    }

    // Case 3: File is already open - just activate (and pin if double-clicked)
    // Este bloque maneja la activación de pestañas existentes 
    // y la "promoción" de vista previa a fijada.
    const shouldPin = pinned && previewTabId === fileId;                       // Si el usuario hizo doble click (pinned=true) Y esta pestaña era la preview actual -> true shouldPin -> se debe fijar esta pestaña
    tabs.set(projectId, {                                                      // Actualiza el estado del proyecto
      ...state,                                                                // Al estado actual le agreagmos
      activeTabId: fileId,                                                     // El archivo abierto se activa
      previewTabId: shouldPin ? null : previewTabId                            // Si shouldPin es true, previewTabId pasa a null (ya no es preview, es permanente). Si no se queda como estaba
    });
    set({ tabs });
  },

  closeTab: (projectId, fileId) => {                                           // Cierra una pestaña
    // Preparación
    const tabs = new Map(get().tabs);                                          // Copia del mapa de pestañas global
    const state = tabs.get(projectId) ?? defaultTabState;                      // Estado actual del proyecto
    const { openTabs, activeTabId, previewTabId } = state;                     // Desestructuramos los estados de Pestañas abiertas y pestaña de vista previa
    const tabIndex = openTabs.indexOf(fileId);                                 // Buscamos dónde está la pestaña que queremos cerrar

    if (tabIndex === -1) return;                                               // Si no existe, no hacemos nada (seguridad)                                                                                 

    const newTabs = openTabs.filter((id) => id !== fileId);                    // Se crea la nueva lista de pestañas excluyendo la que se va a cerrar.                  

    // Eliminación de la lista
    // Si cierras una pestaña que no estás viendo, el foco no debería cambiar. 
    // Pero si cierras la pestaña que estás viendo (activeTabId === fileId), 
    // el editor debe decidir cuál mostrar ahora.
    let newActiveTabId = activeTabId;                                           // Por defecto, mantenemos la misma tab activa                                         
    if (activeTabId === fileId) {                                               // Pero si estamos cerrando la tab activa:                                               
      if (newTabs.length === 0) {                                               // Escenario 1: Era la única pestaña abierta                                                
        newActiveTabId = null;                                                  // No queda nada, mostramos el estado vacío. 
      } else if (tabIndex >= newTabs.length) {                                  // Escenario 2: Cerramos la última pestaña de la derecha                               
        newActiveTabId = newTabs[newTabs.length - 1];                           // Se mantiene la última pestaña de la izquierda
      } else {                                                                  // Escenario 3: Cerramos una pestaña en el medio o la de la izquierda
        newActiveTabId = newTabs[tabIndex];                                     // Se mantiene la pestaña que estaba a la derecha de la que se cerró
      }
    }

    tabs.set(projectId, {                                                       // Actualiza el estado del proyecto
      openTabs: newTabs,
      activeTabId: newActiveTabId,
      previewTabId: previewTabId === fileId ? null : previewTabId
    })
    set({ tabs })
  },

  closeAllTabs: (projectid) => {
    const tabs = new Map(get().tabs);
    tabs.set(projectid, defaultTabState);
    set({ tabs });
  },

  setActiveTab: (projectId, fileId) => {
    const tabs = new Map(get().tabs);
    const state = tabs.get(projectId) ?? defaultTabState;
    tabs.set(projectId, {
      ...state,
      activeTabId: fileId,
    })
    set({ tabs });
  }

}))

