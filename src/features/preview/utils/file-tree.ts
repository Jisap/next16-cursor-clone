import { FileSystemTree } from "@webcontainer/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";

type FileDoc = Doc<"files">;

/**
 * PROPÓSITO: Transforma la estructura plana de archivos de Convex en un árbol jerárquico 
 * compatible con la API de WebContainer.
 * 
 * Esta función es vital para "montar" el sistema de archivos virtual en el navegador,
 * permitiendo que Node.js reconozca la estructura de carpetas y archivos.
 */
export const buildFileTree = (files: FileDoc[]): FileSystemTree => {
  const tree: FileSystemTree = {};
  // Mapa para acceso rápido por ID
  const filesMap = new Map(files.map((f) => [f._id, f]));

  /**
   * Obtiene la ruta jerárquica de un archivo subiendo por sus padres.
   */
  const getPath = (file: FileDoc): string[] => {
    const parts: string[] = [file.name];
    let parentId = file.parentId;                                         // 1. Inicializamos el recorrido con el padre del archivo actual.

    while (parentId) {                                                    // 2. Mientras exista un padre (no hayamos llegado a la raíz):
      const parent = filesMap.get(parentId);                              //    a. Buscamos el documento del padre en el mapa.
      if (!parent) break;                                                 //    b. Si no existe, salimos (caso de error o raíz).
      parts.unshift(parent.name);                                         //    c. Añadimos el nombre del padre al INICIO del array (orden jerárquico).
      parentId = parent.parentId;                                         //    d. Pasamos al siguiente padre en la cadena.
    };

    return parts;                                                         // 3. Devolvemos el array ordenado (ej: ["src", "app", "page.tsx"]).
  };

  /**
   *Construcción del árbol anidado  
   * */
  for (const file of files) {                                             // 1. Recorremos todos los archivos.
    const pathParts = getPath(file);                                      // 2. Obtenemos la ruta jerárquica para el archivo actual.
    let current = tree;                                                   // 3. Empezamos a recorrer desde la raíz del árbol.

    for (let i = 0; i < pathParts.length; i++) {                          // 4. Iteramos sobre cada parte de la ruta (ej: "src", luego "app", luego "page.tsx").
      const part = pathParts[i];                                          //    a. Obtenemos la parte actual.
      const isLast = i === pathParts.length - 1;                          //    b. Verificamos si es la última parte.

      if (isLast) {                                                       // 5. Si estamos en la última parte (el archivo o carpeta final):
        // En el último nivel, insertamos el archivo o directorio final
        if (file.type === "folder") {                                     //    a. Si es una carpeta, creamos un objeto directory vacío.
          current[part] = { directory: {} };
        } else if (!file.storageId && file.content !== undefined) {       //    b. Si es un archivo (y no es binario), creamos un objeto file con su contenido.
          current[part] = { file: { contents: file.content } };
        }
      } else {                                                            // 6. Si no estamos en la última parte:
        // Creamos carpetas intermedias si no existen en el camino
        if (!current[part]) {                                             //    a. Si la carpeta no existe en el nivel actual:
          current[part] = { directory: {} };                              //       i. La creamos como un objeto directory vacío.
        }
        const node = current[part];
        if ("directory" in node) {                                        //    b. Si el nodo es una carpeta:
          current = node.directory;                                       //       i. Actualizamos 'current' para descender al siguiente nivel.
        }
      }
    }
  }

  return tree;
};

/**
 * PROPÓSITO: Reconstruye la ruta completa (string) de un archivo específico partiendo
 * desde la raíz del proyecto.
 * 
 * Útil para operaciones de lectura/escritura directa en el WebContainer donde
 * se requiere la ruta absoluta interna (ej: "src/index.js").
 */
export const getFilePath = (
  file: FileDoc,
  filesMap: Map<Id<"files">, FileDoc>
): string => {
  const parts: string[] = [file.name];
  let parentId = file.parentId;                                           // 1. Empezamos el rastreo desde el padre inmediato.

  while (parentId) {                                                      // 2. Subimos por la jerarquía hasta llegar a la raíz:
    const parent = filesMap.get(parentId);
    if (!parent) break;
    parts.unshift(parent.name);                                           //    a. Insertamos el nombre de la carpeta al inicio de la ruta.
    parentId = parent.parentId;                                           //    b. Avanzamos al siguiente ancestro.
  }

  return parts.join("/");                                                 // 3. Unimos las partes con "/" para obtener la ruta estilo POSIX.
};