

export const BASE_PADDING = 12;

export const LEVEL_PADDING = 12;


// Calcula la sangria del item
export const getItemPadding = (level: number, isFile: boolean) => {
  // File need extra padding since they dont't hace a chevron
  const fileOffset = isFile ? 16 : 0;
  return BASE_PADDING + level * LEVEL_PADDING + fileOffset;

}