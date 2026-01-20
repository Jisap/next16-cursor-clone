

export const BASE_PADDING = 12;

export const LEVEL_PADDING = 12;


// Calcula la sangria del item a la izquierda: Indentación Matemática: 
// En lugar de anidar divs infinitamente (lo que haría que el árbol se encogiera horizontalmente de forma descontrolada), 
// el sistema usa una estructura plana visualmente pero calcula el padding-left matemáticamente basándose en el nivel de profundidad (level).

export const getItemPadding = (level: number, isFile: boolean) => {
  // File need extra padding since they dont't hace a chevron
  const fileOffset = isFile ? 16 : 0;
  return BASE_PADDING + level * LEVEL_PADDING + fileOffset;
}

// Si es un archivo (isFile: true), le suma 16px extra. ¿Por qué? Para compensar el espacio que ocuparía el icono de la flecha (ChevronRight)
//  en una carpeta. Así, el icono del archivo queda alineado perfectamente con el texto de la carpeta superior.