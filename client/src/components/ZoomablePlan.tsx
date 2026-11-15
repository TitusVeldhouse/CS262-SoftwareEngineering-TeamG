/**
 * ZoomablePlan: a pan/zoom viewer that behaves like a photo or map app.
 *
 * Give it the plan's natural size in pixels (contentWidth x contentHeight) and
 * children drawn in that same pixel space (the plan image plus any SVG
 * overlay). ZoomablePlan moves and scales them together.
 *
 *   - Opens fitted to the screen and centered; re-fits when the size changes.
 *   - Pinch zooms toward your fingers, from fit-to-screen up to MAX_ZOOM times that.
 *   - Drag pans; the plan's edges can't be pulled past the screen edges
 *     (a soft rubber band, then it springs back). A flick keeps it gliding.
 *   - Double-tap zooms in where you tapped; double-tap again to fit.
 *   - focusPoint centers a plan point (a selected room) at a comfortable zoom
 *     and shows a fixed-size marker there.
 *   - Web: drag with the mouse, scroll to pan, ctrl/cmd + scroll or trackpad
 *     pinch to zoom.
 *
 * All the math lives in map-geometry.ts; read the comment at the top of that
 * file first. Gesture callbacks are marked "worklet", which means they run on
 * the UI thread every frame without going through React state, so dragging
 * stays smooth.
 */

import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from "react-native-gesture-handler";
import {
  calculateAxisBounds,
  calculateFitTransform,
  calculateFocusTransform,
  calculateScaleLimits,
  calculateSettledTransform,
  clamp,
  clampTransform,
  DETAIL_ZOOM,
  isWithinBounds,
  rubberBandTransform,
  zoomAroundPoint,
  ZOOM_OVERSHOOT,
  type PlanTransform,
  type Size,
} from "./map-geometry";

export type PlanPoint = readonly [number, number];

type ZoomablePlanProps = {
  /** Natural width of the plan image, in image pixels. */
  contentWidth: number;
  /** Natural height of the plan image, in image pixels. */
  contentHeight: number;
  /** A plan point (image pixels) to center and mark, e.g. the selected room. */
  focusPoint?: PlanPoint | null;
  /** Plan image and overlays, laid out at contentWidth x contentHeight. */
  children: ReactNode;
};

const ANIMATION_MS = 240;
const BUTTON_ZOOM_STEP = 1.5;
const MARKER_SIZE = 22;

const timing = { duration: ANIMATION_MS, easing: Easing.out(Easing.cubic) };

type TransformValues = {
  scale: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
};

function readTransform(values: TransformValues): PlanTransform {
  "worklet";
  return { scale: values.scale.get(), x: values.x.get(), y: values.y.get() };
}

/** Moves the plan to `target`, either instantly or with a short animation. */
function applyTransform(values: TransformValues, target: PlanTransform, animated: boolean) {
  "worklet";
  cancelAnimation(values.scale);
  cancelAnimation(values.x);
  cancelAnimation(values.y);
  if (animated) {
    values.scale.set(withTiming(target.scale, timing));
    values.x.set(withTiming(target.x, timing));
    values.y.set(withTiming(target.y, timing));
  } else {
    values.scale.set(target.scale);
    values.x.set(target.x);
    values.y.set(target.y);
  }
}

export default function ZoomablePlan({
  contentWidth,
  contentHeight,
  focusPoint = null,
  children,
}: ZoomablePlanProps) {
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const stageRef = useRef<ComponentRef<typeof View>>(null);
  const lastLayoutKey = useRef("");

  // What is on screen right now (may be mid-animation).
  const scale = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // While a gesture runs, fingers move a "raw" transform with no limits, and
  // the screen shows a rubber-banded copy of it. Keeping the raw copy means
  // the resistance doesn't pile up frame after frame.
  const rawScale = useSharedValue(0);
  const rawX = useSharedValue(0);
  const rawY = useSharedValue(0);

  // How many gestures (pan, pinch) are active, so we only settle when all end.
  const activeGestures = useSharedValue(0);
  // Last pinch center, used to zoom back into the limits around that point.
  const lastFocalX = useSharedValue(0);
  const lastFocalY = useSharedValue(0);

  // Sizes copied into shared values so UI-thread code can read them.
  const viewWidth = useSharedValue(0);
  const viewHeight = useSharedValue(0);
  const planWidth = useSharedValue(contentWidth);
  const planHeight = useSharedValue(contentHeight);

  const shown: TransformValues = { scale, x: translateX, y: translateY };

  const focusX = focusPoint ? focusPoint[0] : null;
  const focusY = focusPoint ? focusPoint[1] : null;

  // Fit (or focus the selected room) when the viewer or the plan changes size,
  // and animate to a newly selected room.
  useEffect(() => {
    if (viewport.width <= 0 || viewport.height <= 0 || contentWidth <= 0 || contentHeight <= 0) {
      return;
    }
    viewWidth.set(viewport.width);
    viewHeight.set(viewport.height);
    planWidth.set(contentWidth);
    planHeight.set(contentHeight);

    const content = { width: contentWidth, height: contentHeight };
    const layoutKey = `${viewport.width}x${viewport.height}:${contentWidth}x${contentHeight}`;
    const layoutChanged = layoutKey !== lastLayoutKey.current;
    lastLayoutKey.current = layoutKey;

    if (focusX !== null && focusY !== null) {
      // New room or new layout: center the room. Animate only for a new room.
      const target = calculateFocusTransform(focusX, focusY, DETAIL_ZOOM, content, viewport);
      applyTransform({ scale, x: translateX, y: translateY }, target, !layoutChanged);
    } else if (layoutChanged) {
      applyTransform(
        { scale, x: translateX, y: translateY },
        calculateFitTransform(content, viewport),
        false,
      );
    }
  }, [
    viewport,
    contentWidth,
    contentHeight,
    focusX,
    focusY,
    scale,
    translateX,
    translateY,
    viewWidth,
    viewHeight,
    planWidth,
    planHeight,
  ]);

  // ---------------------------------------------------------------------------
  // Gestures (UI thread)
  // ---------------------------------------------------------------------------

  function getSizes() {
    "worklet";
    return {
      content: { width: planWidth.get(), height: planHeight.get() },
      view: { width: viewWidth.get(), height: viewHeight.get() },
    };
  }

  // First gesture starting: stop any animation and continue from what's on screen.
  function beginGesture() {
    "worklet";
    if (activeGestures.get() === 0) {
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      rawScale.set(scale.get());
      rawX.set(translateX.get());
      rawY.set(translateY.get());
    }
    activeGestures.set(activeGestures.get() + 1);
  }

  // Show the raw transform with rubber-band resistance at the edges.
  function showRaw() {
    "worklet";
    const { content, view } = getSizes();
    const banded = rubberBandTransform(
      { scale: rawScale.get(), x: rawX.get(), y: rawY.get() },
      content,
      view,
    );
    scale.set(banded.scale);
    translateX.set(banded.x);
    translateY.set(banded.y);
  }

  // Last gesture ended: spring back inside the limits, or glide after a flick.
  function endGesture(velocityX: number, velocityY: number) {
    "worklet";
    activeGestures.set(Math.max(0, activeGestures.get() - 1));
    if (activeGestures.get() > 0) return;

    const { content, view } = getSizes();
    const current = readTransform(shown);
    const settled = calculateSettledTransform(
      current,
      lastFocalX.get(),
      lastFocalY.get(),
      content,
      view,
    );
    const needsZoomBack = Math.abs(settled.scale - current.scale) > 1e-6;

    if (needsZoomBack || !isWithinBounds(current, content, view)) {
      applyTransform(shown, settled, true);
      return;
    }

    // Momentum: keep moving at the flick speed and slow down, never leaving
    // the allowed range (rubberBandEffect lets it bounce softly at the edge).
    const boundsX = calculateAxisBounds(content.width, current.scale, view.width);
    const boundsY = calculateAxisBounds(content.height, current.scale, view.height);
    translateX.set(
      withDecay({
        velocity: velocityX,
        clamp: [boundsX.min, boundsX.max],
        rubberBandEffect: true,
        rubberBandFactor: 0.7,
      }),
    );
    translateY.set(
      withDecay({
        velocity: velocityY,
        clamp: [boundsY.min, boundsY.max],
        rubberBandEffect: true,
        rubberBandFactor: 0.7,
      }),
    );
  }

  // One finger (or the mouse) drags the plan. With two fingers this also moves
  // the plan with the fingers' midpoint, so you can pan while pinching.
  const pan = usePanGesture({
    averageTouches: true,
    activeCursor: "grabbing",
    onActivate: () => {
      "worklet";
      beginGesture();
    },
    onUpdate: (event) => {
      "worklet";
      // changeX/changeY = how far the fingers moved since the previous frame.
      rawX.set(rawX.get() + event.changeX);
      rawY.set(rawY.get() + event.changeY);
      showRaw();
    },
    onDeactivate: (event) => {
      "worklet";
      endGesture(event.canceled ? 0 : event.velocityX, event.canceled ? 0 : event.velocityY);
    },
  });

  // Two fingers zoom around the point between them (the focal point).
  const pinch = usePinchGesture({
    onActivate: (event) => {
      "worklet";
      beginGesture();
      lastFocalX.set(event.focalX);
      lastFocalY.set(event.focalY);
    },
    onUpdate: (event) => {
      "worklet";
      const { content, view } = getSizes();
      const limits = calculateScaleLimits(content, view);
      // scaleChange = how much the finger spread changed since the previous
      // frame (1.02 = 2% wider). Allow a little past the limits; it springs back.
      const nextScale = clamp(
        rawScale.get() * event.scaleChange,
        limits.min * (1 - ZOOM_OVERSHOOT),
        limits.max * (1 + ZOOM_OVERSHOOT),
      );
      const zoomed = zoomAroundPoint(
        { scale: rawScale.get(), x: rawX.get(), y: rawY.get() },
        nextScale,
        event.focalX,
        event.focalY,
      );
      rawScale.set(zoomed.scale);
      rawX.set(zoomed.x);
      rawY.set(zoomed.y);
      lastFocalX.set(event.focalX);
      lastFocalY.set(event.focalY);
      showRaw();
    },
    onDeactivate: () => {
      "worklet";
      endGesture(0, 0);
    },
  });

  // Double-tap: zoom in at the tapped spot, or back to fit if already zoomed in.
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: (event) => {
      "worklet";
      const { content, view } = getSizes();
      const limits = calculateScaleLimits(content, view);
      const current = readTransform(shown);
      const isZoomedIn = current.scale > limits.min * 1.05;
      const target = isZoomedIn
        ? calculateFitTransform(content, view)
        : clampTransform(
            zoomAroundPoint(current, Math.min(limits.min * DETAIL_ZOOM, limits.max), event.x, event.y),
            content,
            view,
          );
      applyTransform(shown, target, true);
    },
  });

  const gestures = useSimultaneousGestures(pan, pinch, doubleTap);

  // ---------------------------------------------------------------------------
  // Web: mouse wheel and trackpad
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (Platform.OS !== "web") return;
    // On web, a View's ref is the underlying DOM element.
    const node = stageRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== "function") return;

    const values: TransformValues = { scale, x: translateX, y: translateY };

    const handleWheel = (event: WheelEvent) => {
      // Keep the page from scrolling (or the browser from zooming) while the
      // pointer is over the plan. This is why the listener is added by hand:
      // React's onWheel can't call preventDefault.
      event.preventDefault();
      const content = { width: planWidth.get(), height: planHeight.get() };
      const view = { width: viewWidth.get(), height: viewHeight.get() };
      if (view.width <= 0) return;
      // Firefox may report scroll distance in lines instead of pixels.
      const unit = event.deltaMode === 1 ? 16 : 1;
      const current = readTransform(values);

      let target: PlanTransform;
      if (event.ctrlKey || event.metaKey) {
        // Trackpad pinch arrives as ctrl + wheel. Zoom around the pointer.
        const rect = node.getBoundingClientRect();
        const limits = calculateScaleLimits(content, view);
        const nextScale = clamp(
          current.scale * Math.exp(-event.deltaY * unit * 0.01),
          limits.min,
          limits.max,
        );
        target = zoomAroundPoint(
          current,
          nextScale,
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
      } else {
        target = {
          ...current,
          x: current.x - event.deltaX * unit,
          y: current.y - event.deltaY * unit,
        };
      }
      applyTransform(values, clampTransform(target, content, view), false);
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, [scale, translateX, translateY, planWidth, planHeight, viewWidth, viewHeight]);

  // ---------------------------------------------------------------------------
  // Buttons
  // ---------------------------------------------------------------------------

  // Zoom in or out around the middle of the viewer.
  const zoomBy = (factor: number) => {
    const content = { width: contentWidth, height: contentHeight };
    const limits = calculateScaleLimits(content, viewport);
    const current = readTransform(shown);
    const nextScale = clamp(current.scale * factor, limits.min, limits.max);
    const target = zoomAroundPoint(current, nextScale, viewport.width / 2, viewport.height / 2);
    applyTransform(shown, clampTransform(target, content, viewport), true);
  };

  const recenter = () => {
    applyTransform(
      shown,
      calculateFitTransform({ width: contentWidth, height: contentHeight }, viewport),
      true,
    );
  };

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  // React Native scales a view around its center, but our math scales around
  // the top-left corner (see map-geometry.ts). Shifting by half the size times
  // (1 - scale) converts one into the other.
  const planStyle = useAnimatedStyle(() => {
    const s = scale.get();
    return {
      transform: [
        { translateX: translateX.get() - (planWidth.get() / 2) * (1 - s) },
        { translateY: translateY.get() - (planHeight.get() / 2) * (1 - s) },
        { scale: s },
      ],
    };
  });

  // The marker is drawn outside the scaled plan, so it stays the same size on
  // screen at every zoom level. It is placed with screen = x + point * scale.
  const markerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() + (focusX ?? 0) * scale.get() - MARKER_SIZE / 2 },
      { translateY: translateY.get() + (focusY ?? 0) * scale.get() - MARKER_SIZE / 2 },
    ],
  }));

  const isMeasured = viewport.width > 0 && viewport.height > 0;

  return (
    <View
      ref={stageRef}
      style={styles.stage}
      testID="map-stage"
      onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout;
        if (width > 0 && height > 0 && (width !== viewport.width || height !== viewport.height)) {
          setViewport({ width, height });
        }
      }}
    >
      <GestureDetector gesture={gestures}>
        <View style={styles.gestureSurface} collapsable={false} testID="map-gesture-surface">
          <Animated.View
            style={[
              styles.plan,
              // Hidden until measured so it doesn't flash at the wrong size.
              { width: contentWidth, height: contentHeight, opacity: isMeasured ? 1 : 0 },
              planStyle,
            ]}
            testID="map-surface"
          >
            {children}
          </Animated.View>

          {focusX !== null && focusY !== null && isMeasured && (
            <Animated.View
              style={[styles.marker, { pointerEvents: "none" }, markerStyle]}
              testID="map-focus-marker"
            />
          )}
        </View>
      </GestureDetector>

      <View style={styles.controls}>
        <Pressable
          testID="zoom-in"
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          style={styles.control}
          onPress={() => zoomBy(BUTTON_ZOOM_STEP)}
        >
          <Text style={styles.controlText}>+</Text>
        </Pressable>
        <Pressable
          testID="zoom-out"
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          style={styles.control}
          onPress={() => zoomBy(1 / BUTTON_ZOOM_STEP)}
        >
          <Text style={styles.controlText}>-</Text>
        </Pressable>
        <Pressable
          testID="reset-map"
          accessibilityRole="button"
          accessibilityLabel="Recenter and fit floor plan"
          style={styles.recenterControl}
          onPress={recenter}
        >
          <Text style={styles.recenterText}>Fit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  gestureSurface: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    // Desktop browsers show a hand cursor; it turns into a fist while dragging.
    cursor: "grab",
  },
  plan: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  marker: {
    position: "absolute",
    left: 0,
    top: 0,
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#D35443",
    boxShadow: "0px 1px 4px rgba(16, 24, 40, 0.35)",
  },
  controls: {
    position: "absolute",
    top: 12,
    right: 12,
    gap: 6,
  },
  control: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    boxShadow: "0px 1px 4px rgba(16, 24, 40, 0.18)",
  },
  controlText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    lineHeight: 26,
    color: "#101828",
  },
  recenterControl: {
    minWidth: 38,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    boxShadow: "0px 1px 4px rgba(16, 24, 40, 0.18)",
  },
  recenterText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#101828",
  },
});
