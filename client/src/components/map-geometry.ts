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

export const MAP_PADDING = 16;
export const MIN_MAP_SCALE = 0.5;
export const MAX_MAP_SCALE = 5;
export const DEFAULT_PAN_MARGIN = 50;

export function clampMapScale(scale: number) {
  "worklet";
  return Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, scale));
}

export function clampPanOffset(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

export function calculatePanLimits(
  frame: MapFrame,
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
  margin: number = DEFAULT_PAN_MARGIN,
): PanLimits {
  "worklet";
  const scaledW = frame.width * scale;
  const scaledH = frame.height * scale;

  const extraX = Math.max(0, scaledW - viewportWidth);
  const extraY = Math.max(0, scaledH - viewportHeight);

  const maxTx = extraX / 2 + margin;
  const maxTy = extraY / 2 + margin;

  return {
    minX: -maxTx,
    maxX: maxTx,
    minY: -maxTy,
    maxY: maxTy,
  };
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