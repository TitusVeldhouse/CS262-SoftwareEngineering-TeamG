export type MapFrame = {
  width: number;
  height: number;
  left: number;
  top: number;
};

export type PanLimits = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export const MAP_PADDING = 28;
export const MIN_MAP_SCALE = 0.5;
export const MAX_MAP_SCALE = 5;
export const DEFAULT_PAN_MARGIN = 80;

export function clampMapScale(scale: number) {
  "worklet";
  return Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, scale));
}

export function clampPanOffset(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

export function calculatePanLimitsFromDimensions(
  mapWidth: number,
  mapHeight: number,
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
  margin: number = DEFAULT_PAN_MARGIN,
): PanLimits {
  "worklet";
  const scaledW = mapWidth * scale;
  const scaledH = mapHeight * scale;

  if (scaledW === 0 || scaledH === 0 || viewportWidth === 0 || viewportHeight === 0) {
    return {
      minX: -margin,
      maxX: margin,
      minY: -margin,
      maxY: margin,
    };
  }

  // Generous pan boundaries: allow any corner or section of the map to be dragged into view,
  // while ensuring at least `margin` of the map remains visible on-screen.
  const maxTx = Math.max(margin, (scaledW + viewportWidth) / 2 - margin);
  const maxTy = Math.max(margin, (scaledH + viewportHeight) / 2 - margin);

  return {
    minX: -maxTx,
    maxX: maxTx,
    minY: -maxTy,
    maxY: maxTy,
  };
}

export function calculatePanLimits(
  frame: MapFrame,
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
  margin: number = DEFAULT_PAN_MARGIN,
): PanLimits {
  "worklet";
  return calculatePanLimitsFromDimensions(
    frame.width,
    frame.height,
    scale,
    viewportWidth,
    viewportHeight,
    margin,
  );
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