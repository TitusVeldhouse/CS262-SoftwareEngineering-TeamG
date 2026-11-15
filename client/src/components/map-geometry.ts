/**
 * Pan and zoom math for the floor plan viewer (ZoomablePlan).
 *
 * The whole viewer is described by three numbers, a "PlanTransform":
 *   scale  how many screen pixels one plan-image pixel takes up
 *          (0.25 = the plan is drawn at a quarter of its real size)
 *   x, y   where the plan's top-left corner sits on screen, in screen pixels,
 *          measured from the top-left corner of the viewer
 *
 * So a point (px, py) on the plan image appears on screen at:
 *   screenX = x + px * scale
 *   screenY = y + py * scale
 * and, going the other way, the plan point under a screen point (sx, sy) is:
 *   px = (sx - x) / scale
 *   py = (sy - y) / scale
 *
 * Every function here is pure (same input, same output) so it can be unit
 * tested, and marked "worklet" so gestures can call it on the UI thread.
 */

export type Size = {
  width: number;
  height: number;
};

export type PlanTransform = {
  scale: number;
  x: number;
  y: number;
};

export type AxisBounds = {
  min: number;
  max: number;
};

/** Empty space kept around the plan when it is fitted to the screen. */
export const MAP_PADDING = 16;
/** Furthest you can zoom in, as a multiple of the fit-to-screen size. */
export const MAX_ZOOM = 5;
/** Zoom used by double-tap and when focusing a room (multiple of fit size). */
export const DETAIL_ZOOM = 2.5;
/** How far past the limits a pinch may go before it stops (springs back after). */
export const ZOOM_OVERSHOOT = 0.25;

function isUsableSize(size: Size): boolean {
  "worklet";
  return size.width > 0 && size.height > 0;
}

export function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

/**
 * The scale at which the whole plan fits inside the viewer with some padding.
 * This is also the smallest zoom allowed. Returns 0 until both sizes are known.
 */
export function calculateFitScale(
  content: Size,
  viewport: Size,
  padding: number = MAP_PADDING,
): number {
  "worklet";
  if (!isUsableSize(content) || !isUsableSize(viewport)) return 0;
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  return Math.min(availableWidth / content.width, availableHeight / content.height);
}

/** Smallest and largest scale allowed: fit-to-screen up to MAX_ZOOM times that. */
export function calculateScaleLimits(content: Size, viewport: Size): AxisBounds {
  "worklet";
  const fit = calculateFitScale(content, viewport);
  return { min: fit, max: fit * MAX_ZOOM };
}

/**
 * The allowed range for x (or y) at a given scale, along one axis.
 * - If the scaled plan is narrower than the viewer, there is only one allowed
 *   value: the one that centers it (min === max).
 * - If it is wider, the plan may move until its edge meets the viewer's edge:
 *   x can go from (viewer - plan) [right edges line up] to 0 [left edges line up].
 */
export function calculateAxisBounds(
  contentLength: number,
  scale: number,
  viewportLength: number,
): AxisBounds {
  "worklet";
  const scaledLength = contentLength * scale;
  if (scaledLength <= viewportLength) {
    const centered = (viewportLength - scaledLength) / 2;
    return { min: centered, max: centered };
  }
  return { min: viewportLength - scaledLength, max: 0 };
}

/** Moves x and y back inside their allowed ranges (keeps the scale). */
export function clampTransform(
  transform: PlanTransform,
  content: Size,
  viewport: Size,
): PlanTransform {
  "worklet";
  const boundsX = calculateAxisBounds(content.width, transform.scale, viewport.width);
  const boundsY = calculateAxisBounds(content.height, transform.scale, viewport.height);
  return {
    scale: transform.scale,
    x: clamp(transform.x, boundsX.min, boundsX.max),
    y: clamp(transform.y, boundsY.min, boundsY.max),
  };
}

/**
 * "Rubber band" resistance: inside [min, max] the value is unchanged; past an
 * edge, the further you drag the less it moves, and it can never go more than
 * `limit` pixels past the edge. This is what makes dragging past the edge feel
 * soft instead of hitting a wall.
 */
export function rubberBand(value: number, min: number, max: number, limit: number): number {
  "worklet";
  if (limit <= 0) return clamp(value, min, max);
  // Grows quickly at first, then flattens out towards `limit`.
  const resist = (distance: number) => limit * (1 - 1 / ((distance * 0.55) / limit + 1));
  if (value < min) return min - resist(min - value);
  if (value > max) return max + resist(value - max);
  return value;
}

/** Applies rubber-band resistance to x and y for the current scale. */
export function rubberBandTransform(
  transform: PlanTransform,
  content: Size,
  viewport: Size,
): PlanTransform {
  "worklet";
  const boundsX = calculateAxisBounds(content.width, transform.scale, viewport.width);
  const boundsY = calculateAxisBounds(content.height, transform.scale, viewport.height);
  return {
    scale: transform.scale,
    x: rubberBand(transform.x, boundsX.min, boundsX.max, viewport.width / 3),
    y: rubberBand(transform.y, boundsY.min, boundsY.max, viewport.height / 3),
  };
}

/**
 * Changes the scale while keeping the plan point under (focalX, focalY) in the
 * same place on screen. This is what makes a pinch zoom "toward your fingers".
 *
 * The plan point under the focal point is (focalX - x) / scale. After zooming
 * we want that same point at the same screen position:
 *   focalX = newX + planPoint * newScale  =>  newX = focalX - (focalX - x) * (newScale / scale)
 */
export function zoomAroundPoint(
  transform: PlanTransform,
  newScale: number,
  focalX: number,
  focalY: number,
): PlanTransform {
  "worklet";
  if (transform.scale <= 0) return { scale: newScale, x: transform.x, y: transform.y };
  const ratio = newScale / transform.scale;
  return {
    scale: newScale,
    x: focalX - (focalX - transform.x) * ratio,
    y: focalY - (focalY - transform.y) * ratio,
  };
}

/** Whole plan visible and centered on both axes. */
export function calculateFitTransform(content: Size, viewport: Size): PlanTransform {
  "worklet";
  const scale = calculateFitScale(content, viewport);
  return {
    scale,
    x: (viewport.width - content.width * scale) / 2,
    y: (viewport.height - content.height * scale) / 2,
  };
}

/**
 * Puts plan point (px, py) in the middle of the viewer at `zoom` times the fit
 * scale, then nudges it so the plan's edges stay on screen (a room in a corner
 * cannot be perfectly centered without showing empty space).
 */
export function calculateFocusTransform(
  px: number,
  py: number,
  zoom: number,
  content: Size,
  viewport: Size,
): PlanTransform {
  "worklet";
  const limits = calculateScaleLimits(content, viewport);
  const scale = clamp(limits.min * zoom, limits.min, limits.max);
  return clampTransform(
    {
      scale,
      x: viewport.width / 2 - px * scale,
      y: viewport.height / 2 - py * scale,
    },
    content,
    viewport,
  );
}

/**
 * Where the plan should come to rest after a gesture: the scale is brought
 * back inside its limits (zooming around the focal point so nothing jumps
 * sideways), then x and y are brought back inside their ranges.
 */
export function calculateSettledTransform(
  transform: PlanTransform,
  focalX: number,
  focalY: number,
  content: Size,
  viewport: Size,
): PlanTransform {
  "worklet";
  const limits = calculateScaleLimits(content, viewport);
  const scale = clamp(transform.scale, limits.min, limits.max);
  return clampTransform(zoomAroundPoint(transform, scale, focalX, focalY), content, viewport);
}

/** True when x and y are already inside their allowed ranges. */
export function isWithinBounds(transform: PlanTransform, content: Size, viewport: Size): boolean {
  "worklet";
  const clamped = clampTransform(transform, content, viewport);
  return Math.abs(clamped.x - transform.x) < 0.5 && Math.abs(clamped.y - transform.y) < 0.5;
}
