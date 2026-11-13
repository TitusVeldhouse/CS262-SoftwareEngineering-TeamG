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

// Keep initial fitting and gesture zoom limits in one place so the viewer
// controls and the worklet-based pinch gesture use the same bounds.
export const MAP_PADDING = 28;
export const MIN_MAP_SCALE = 0.5;
export const MAX_MAP_SCALE = 5;
export const DEFAULT_PAN_MARGIN = 80;

export function calculateDynamicMinScale(
  imageWidth: number,
  imageHeight: number,
): number {
  "worklet";
  const maxDim = Math.max(imageWidth, imageHeight);
  // For large blueprints (e.g., DC AND BU at 1982px, Devries at 1570px),
  // allow zooming out down to 0.3x so the entire schematic can be inspected.
  if (maxDim >= 1500) {
    return 0.3;
  }
  return MIN_MAP_SCALE;
}

export function clampMapScale(
  scale: number,
  minScale: number = MIN_MAP_SCALE,
  maxScale: number = MAX_MAP_SCALE,
) {
  "worklet";
  return Math.min(maxScale, Math.max(minScale, scale));
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
  margin?: number,
): PanLimits {
  "worklet";
  const scaledW = mapWidth * scale;
  const scaledH = mapHeight * scale;

  const dynamicMarginX =
    margin ??
    Math.max(40, Math.min(viewportWidth * 0.12, scaledW * 0.1, DEFAULT_PAN_MARGIN));
  const dynamicMarginY =
    margin ??
    Math.max(40, Math.min(viewportHeight * 0.12, scaledH * 0.1, DEFAULT_PAN_MARGIN));

  // Layout can be measured before its image or viewport has a nonzero size.
  // Keep the result finite and allow a small fallback pan until dimensions arrive.
  if (scaledW === 0 || scaledH === 0 || viewportWidth === 0 || viewportHeight === 0) {
    const fallbackMargin = margin ?? DEFAULT_PAN_MARGIN;
    return {
      minX: -fallbackMargin,
      maxX: fallbackMargin,
      minY: -fallbackMargin,
      maxY: fallbackMargin,
    };
  }

  // Generous pan boundaries: scale dynamically with map size (scaledW, scaledH) and viewport.
  const maxTx = Math.max(dynamicMarginX, (scaledW + viewportWidth) / 2 - dynamicMarginX);
  const maxTy = Math.max(dynamicMarginY, (scaledH + viewportHeight) / 2 - dynamicMarginY);

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
  margin?: number,
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
  customPadding?: number,
): MapFrame {
  // Preserve the image aspect ratio while fitting it inside the padded viewport.
  const padding = customPadding ?? MAP_PADDING;
  const availableWidth = Math.max(0, viewportWidth - padding * 2);
  const availableHeight = Math.max(0, viewportHeight - padding * 2);
  // Zero-sized image measurements can occur during layout; use a zero scale
  // rather than dividing by zero, then center the resulting empty frame.
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