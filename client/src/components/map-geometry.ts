export type MapFrame = {
  width: number;
  height: number;
  left: number;
  top: number;
};

export const MAP_PADDING = 16;
export const MIN_MAP_SCALE = 0.5;
export const MAX_MAP_SCALE = 5;

export function clampMapScale(scale: number) {
  return Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, scale));
}

export function calculateMapFrame(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): MapFrame {
  const availableWidth = Math.max(0, viewportWidth - MAP_PADDING * 2);
  const availableHeight = Math.max(0, viewportHeight - MAP_PADDING * 2);
  const widthScale = imageWidth > 0 ? availableWidth / imageWidth : 0;
  const heightScale = imageHeight > 0 ? availableHeight / imageHeight : 0;
  const fitScale =
    imageWidth > 0 && imageHeight > 0
      ? Math.min(widthScale, heightScale)
      : 0;
  const width = imageWidth * fitScale;
  const height = imageHeight * fitScale;
  return {
    width,
    height,
    left: (viewportWidth - width) / 2,
    top: (viewportHeight - height) / 2,
  };
}