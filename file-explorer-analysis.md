# Análisis del Sistema de Explorador de Archivos

Este documento detalla la arquitectura y funcionamiento del explorador de archivos implementado en el proyecto. El sistema utiliza una estructura de árbol recursiva combinada con una estrategia de carga de datos bajo demanda (Lazy Loading).

## 1. Visión Global: Árbol Recursivo

El sistema no carga todos los archivos del proyecto de una sola vez para optimizar el rendimiento. En su lugar:

1.  **Nivel Raíz**: Al inicio, solo se cargan los archivos y carpetas que están en la raíz del proyecto (`parentId: undefined`).
2.  **Recursividad**: Cada carpeta es un nodo que puede contener otros nodos.
3.  **Lazy Loading**: El contenido de una subcarpeta solo se solicita al servidor cuando el usuario expande esa carpeta específica.

## 2. Componentes Principales

### A. `FileExplorer` (`index.tsx`)
Es el **contenedor principal** y punto de entrada.
- **Responsabilidad**:
  - Renderizar el encabezado del proyecto.
  - Manejar el estado global de apertura del panel (`isOpen`).
  - Cargar los archivos del **Nivel 0** (Raíz) usando `useFolderContent`.
  - Gestionar la creación de archivos/carpetas en la raíz.

### B. `Tree` (`tree.tsx`)
Es el **corazón recursivo** del sistema. Representa un nodo individual (archivo o carpeta).
- **Lógica de Carpeta**:
  - Si es una carpeta, tiene su propio estado local `isOpen`.
  - Utiliza `useFolderContent` pasando su propio `_id` como `parentId`.
  - **Optimización**: La consulta a la base de datos solo se activa (`enabled: true`) si la carpeta es de tipo "folder" **Y** está abierta (`isOpen`).
  - Si está abierta, se renderiza a sí mismo (`<Tree />`) para cada uno de sus hijos, incrementando el `level` (+1).
- **Lógica de Archivo**:
  - Si es un archivo, simplemente renderiza su representación visual y maneja eventos como doble clic o menú contextual.

### C. `TreeItemWrapper` (`tree-item-wrapper.tsx`)
Componente de **presentación pura**.
- **Responsabilidad**:
  - Define la apariencia de cada fila (hover, estado activo).
  - Aplica la **indentación** correcta basada en el `level` recibido.
  - Contiene el `ContextMenu` (clic derecho) para acciones como Renombrar, Eliminar o Crear Nuevo Archivo/Carpeta.
  - Maneja eventos de teclado (Enter para renombrar) y ratón.

### D. `CreateInput` (`create-input.tsx`)
Formulario efímero para capturar nombres de nuevos elementos.
- **Características**:
  - Aparece temporalmente en el árbol cuando `creating` es true.
  - Usa la misma lógica de indentación para alinearse visualmente con el nivel actual.
  - Detecta automáticamente iconos de archivo según la extensión escrita (gracias a `FileIcon`).
  - Maneja la confirmación (`onSubmit`) o cancelación (`onCancel`).

### E. `constants.ts`
Contiene la lógica matemática para la indentación visual, evitando el anidamiento excesivo de `divs` en el DOM.

```typescript
// Fórmula de indentación
paddingLeft = BASE_PADDING + (level * LEVEL_PADDING) + (isFile ? 16 : 0)
```
*El offset extra para archivos (16px) compensa la falta del icono de flecha ("chevron") que tienen las carpetas, manteniendo el texto alineado.*

## 3. Flujo de Datos (Data Flow)

1.  **Inicio**: `FileExplorer` se monta y llama a `useFolderContent({ projectId })`.
2.  **Convex**: Retorna la lista de archivos raíz (donde `parentId` es null/undefined).
3.  **Renderizado**: Se mapea la lista y por cada ítem se monta un `<Tree level={0} />`.
4.  **Interacción**:
    - Usuario hace clic en una carpeta llamada "src".
    - El componente `<Tree>` de "src" cambia su estado `isOpen` a `true`.
    - Se activa el hook `useFolderContent({ parentId: "id_de_src" })`.
    - Se cargan los hijos de esa carpeta y se renderizan nuevos componentes `<Tree level={1} />`.

## 4. Hooks y Backend (`use-files.ts` / `files.ts`)

- **`useFolderContent`**: Hook inteligente que envuelve `useQuery`.
  - Si `enabled` es falso (carpeta cerrada), pasa `"skip"` a Convex. Esto evita realizar peticiones innecesarias al servidor.
  - Retorna `undefined` mientras carga, lo que permite mostrar el componente `<LoadingRow />`.

- **Mutaciones**:
  - `createFile` / `createFolder`: Inserta en la BD.
  - `deleteFile`: Realiza un borrado recursivo en el backend (si borras una carpeta, borra todos sus descendientes).
  - `renameFile`: Verifica que no existan duplicados en el mismo nivel antes de renombrar.

## 5. Resumen de Ventajas

- **Escalabilidad**: Al cargar solo lo necesario, el explorador funciona rápido incluso con miles de archivos.
- **Mantenibilidad**: La separación entre lógica recursiva (`Tree`) y presentación (`TreeItemWrapper`) facilita cambios visuales.
- **UX**: Feedback visual inmediato con estados de carga (`LoadingRow`) y actualizaciones optimistas (propias de Convex).
