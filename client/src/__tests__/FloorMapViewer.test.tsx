import React from "react";
import { StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
// jest.mock calls below are hoisted above these imports by Jest.
import FloorMapViewer from "../components/FloorMapViewer";
import {
  calculateFitTransform,
  calculateFocusTransform,
  calculateScaleLimits,
  DETAIL_ZOOM,
  isWithinBounds,
  type PlanTransform,
} from "../components/map-geometry";

// Reanimated is replaced with plain values: shared values keep their value
// across renders, animations jump straight to their target, and animated
// styles are recomputed on every render.
const mockWithDecay = jest.fn((_config: unknown) => 0);
jest.mock("react-native-reanimated", () => {
  const mockReact = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => {
      const ref = mockReact.useRef<{ value: number; get: () => number; set: (v: number) => void }>(
        null,
      );
      if (!ref.current) {
        const box = {
          value: initial,
          get: () => box.value,
          set: (v: number) => {
            box.value = v;
          },
        };
        ref.current = box;
      }
      return ref.current;
    },
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: (toValue: number) => toValue,
    withDecay: (config: unknown) => mockWithDecay(config),
    cancelAnimation: () => {},
    Easing: { out: (fn: unknown) => fn, cubic: (t: number) => t },
  };
});

// Gesture hooks are replaced with ones that remember their config, so tests
// can call onActivate / onUpdate / onDeactivate like a real finger would.
type GestureConfig = Record<string, ((event: any) => void) | unknown>;
const mockGestures: { pan?: GestureConfig; pinch?: GestureConfig; tap?: GestureConfig } = {};
jest.mock("react-native-gesture-handler", () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  usePanGesture: (config: GestureConfig) => {
    mockGestures.pan = config;
    return { type: "pan" };
  },
  usePinchGesture: (config: GestureConfig) => {
    mockGestures.pinch = config;
    return { type: "pinch" };
  },
  useTapGesture: (config: GestureConfig) => {
    mockGestures.tap = config;
    return { type: "tap" };
  },
  useSimultaneousGestures: () => ({ type: "simultaneous" }),
}));


const plan = { width: 1600, height: 1000 };
const viewport = { width: 400, height: 700 };
const sampleProps = {
  asset: 1,
  title: "Hiemenga Hall Level 2",
  imageWidth: plan.width,
  imageHeight: plan.height,
};

function call(gesture: "pan" | "pinch" | "tap", callback: string, event: object = {}) {
  const handler = mockGestures[gesture]?.[callback] as ((event: object) => void) | undefined;
  if (!handler) throw new Error(`No ${callback} on the ${gesture} gesture`);
  handler(event);
}

/**
 * Reads the plan's on-screen transform back out of the rendered style. The
 * component converts top-left-origin math into React Native's center-origin
 * transform, so undo that here: x = translateX + (width / 2) * (1 - scale).
 */
function readShownTransform(): PlanTransform {
  const style = StyleSheet.flatten(screen.getByTestId("map-surface").props.style);
  const parts = Object.assign({}, ...(style.transform as object[])) as {
    translateX: number;
    translateY: number;
    scale: number;
  };
  return {
    scale: parts.scale,
    x: parts.translateX + (plan.width / 2) * (1 - parts.scale),
    y: parts.translateY + (plan.height / 2) * (1 - parts.scale),
  };
}

function expectTransform(actual: PlanTransform, expected: PlanTransform) {
  expect(actual.scale).toBeCloseTo(expected.scale, 5);
  expect(actual.x).toBeCloseTo(expected.x, 3);
  expect(actual.y).toBeCloseTo(expected.y, 3);
}

/** Renders the viewer and gives it a size, like a real layout pass. */
async function renderMeasured(props: Partial<React.ComponentProps<typeof FloorMapViewer>> = {}) {
  const utils = await render(<FloorMapViewer {...sampleProps} {...props} />);
  await fireEvent(screen.getByTestId("map-stage"), "layout", {
    nativeEvent: { layout: viewport },
  });
  // Re-render so the animated styles pick up the values set by the layout effect.
  const refresh = () => utils.rerender(<FloorMapViewer {...sampleProps} {...props} />);
  await refresh();
  return { ...utils, refresh };
}

describe("FloorMapViewer", () => {
  beforeEach(() => {
    mockWithDecay.mockClear();
  });

  it("renders the stage, gesture surface, controls, and plan image", async () => {
    await render(<FloorMapViewer {...sampleProps} />);
    expect(screen.getByTestId("plan-viewer")).toBeTruthy();
    expect(screen.getByTestId("map-gesture-surface")).toBeTruthy();
    expect(screen.getByTestId("floor-plan-image")).toBeTruthy();
    expect(screen.getByTestId("zoom-in")).toBeTruthy();
    expect(screen.getByTestId("zoom-out")).toBeTruthy();
    expect(screen.getByLabelText("Recenter and fit floor plan")).toBeTruthy();
  });

  it("opens fitted to the screen and centered on both axes", async () => {
    await renderMeasured();
    expectTransform(readShownTransform(), calculateFitTransform(plan, viewport));
  });

  it("re-fits when the viewer changes size (rotation, window resize)", async () => {
    const { refresh } = await renderMeasured();
    const landscape = { width: 900, height: 400 };
    await fireEvent(screen.getByTestId("map-stage"), "layout", {
      nativeEvent: { layout: landscape },
    });
    await refresh();
    expectTransform(readShownTransform(), calculateFitTransform(plan, landscape));
  });

  it("pinch zooms toward the fingers: the plan point under them stays put", async () => {
    const { refresh } = await renderMeasured();
    const before = readShownTransform();
    const focal = { focalX: 180, focalY: 330 };
    const planPointX = (focal.focalX - before.x) / before.scale;
    const planPointY = (focal.focalY - before.y) / before.scale;

    // 4x makes the plan larger than the viewer on both axes. (At smaller zooms
    // an axis that still fits stays centered, which is intended.)
    call("pinch", "onActivate", focal);
    call("pinch", "onUpdate", { ...focal, scaleChange: 4 });
    await refresh();

    const after = readShownTransform();
    expect(after.scale).toBeCloseTo(before.scale * 4);
    expect(after.x + planPointX * after.scale).toBeCloseTo(focal.focalX);
    expect(after.y + planPointY * after.scale).toBeCloseTo(focal.focalY);
  });

  it("springs back to fit after pinching smaller than fit", async () => {
    const { refresh } = await renderMeasured();
    call("pinch", "onActivate", { focalX: 200, focalY: 350 });
    call("pinch", "onUpdate", { focalX: 200, focalY: 350, scaleChange: 0.5 });
    await refresh();
    const limits = calculateScaleLimits(plan, viewport);
    // Overshoot is allowed while pinching, but only a little.
    expect(readShownTransform().scale).toBeLessThan(limits.min);
    expect(readShownTransform().scale).toBeGreaterThan(limits.min * 0.7);

    call("pinch", "onDeactivate", { canceled: false });
    await refresh();
    expectTransform(readShownTransform(), calculateFitTransform(plan, viewport));
  });

  it("caps zoom-in at the maximum and settles there", async () => {
    const { refresh } = await renderMeasured();
    call("pinch", "onActivate", { focalX: 200, focalY: 350 });
    call("pinch", "onUpdate", { focalX: 200, focalY: 350, scaleChange: 50 });
    call("pinch", "onDeactivate", { canceled: false });
    await refresh();
    const limits = calculateScaleLimits(plan, viewport);
    expect(readShownTransform().scale).toBeCloseTo(limits.max);
    expect(isWithinBounds(readShownTransform(), plan, viewport)).toBe(true);
  });

  it("resists dragging past the edge, then springs back inside", async () => {
    const { refresh } = await renderMeasured();
    const fit = readShownTransform();

    call("pan", "onActivate");
    call("pan", "onUpdate", { changeX: 300, changeY: 0 });
    await refresh();
    const dragged = readShownTransform();
    // A fitted plan has no room to move sideways: it gives a little, not 300px.
    expect(dragged.x).toBeGreaterThan(fit.x);
    expect(dragged.x).toBeLessThan(fit.x + 300);

    call("pan", "onDeactivate", { canceled: false, velocityX: 0, velocityY: 0 });
    await refresh();
    expectTransform(readShownTransform(), fit);
  });

  it("keeps gliding after a flick, limited to the plan's edges", async () => {
    const { refresh } = await renderMeasured();
    // Zoom in first so there is room to move.
    call("tap", "onActivate", { x: 200, y: 350 });
    await refresh();
    const zoomed = readShownTransform();

    call("pan", "onActivate");
    call("pan", "onUpdate", { changeX: -10, changeY: 0 });
    call("pan", "onDeactivate", { canceled: false, velocityX: -1200, velocityY: 0 });

    const xDecay = mockWithDecay.mock.calls[0][0] as { velocity: number; clamp: number[] };
    expect(xDecay.velocity).toBe(-1200);
    // The glide may not leave the allowed range for this zoom level.
    expect(xDecay.clamp[0]).toBeCloseTo(viewport.width - plan.width * zoomed.scale);
    expect(xDecay.clamp[1]).toBe(0);
  });

  it("double-tap zooms in at the tapped point, and again resets to fit", async () => {
    const { refresh } = await renderMeasured();
    const fit = readShownTransform();
    const tap = { x: 150, y: 400 };
    const planPointX = (tap.x - fit.x) / fit.scale;

    call("tap", "onActivate", tap);
    await refresh();
    const zoomed = readShownTransform();
    expect(zoomed.scale).toBeCloseTo(fit.scale * DETAIL_ZOOM);
    // The tapped spot stays under the finger (the plan is wide enough here).
    expect(zoomed.x + planPointX * zoomed.scale).toBeCloseTo(tap.x);

    call("tap", "onActivate", tap);
    await refresh();
    expectTransform(readShownTransform(), fit);
  });

  it("zoom buttons zoom around the center and Fit recenters", async () => {
    const { refresh } = await renderMeasured();
    const fit = readShownTransform();

    await fireEvent.press(screen.getByTestId("zoom-in"));
    await refresh();
    expect(readShownTransform().scale).toBeCloseTo(fit.scale * 1.5);

    await fireEvent.press(screen.getByTestId("zoom-out"));
    await fireEvent.press(screen.getByTestId("zoom-out"));
    await refresh();
    // Can't zoom out past fit.
    expect(readShownTransform().scale).toBeCloseTo(fit.scale);

    await fireEvent.press(screen.getByTestId("zoom-in"));
    await fireEvent.press(screen.getByTestId("reset-map"));
    await refresh();
    expectTransform(readShownTransform(), fit);
  });

  it("centers a selected room and shows a fixed-size marker on it", async () => {
    const room = [800, 500] as const;
    await renderMeasured({ focusPoint: room });

    const shown = readShownTransform();
    expectTransform(shown, calculateFocusTransform(room[0], room[1], DETAIL_ZOOM, plan, viewport));

    const marker = StyleSheet.flatten(screen.getByTestId("map-focus-marker").props.style);
    const markerShift = Object.assign({}, ...(marker.transform as object[])) as {
      translateX: number;
      translateY: number;
    };
    // The marker's center sits on the room's screen position (center of the viewer).
    expect(markerShift.translateX + marker.width / 2).toBeCloseTo(viewport.width / 2);
    expect(markerShift.translateY + marker.height / 2).toBeCloseTo(viewport.height / 2);
    // It is not inside the scaled plan, so it doesn't grow when zooming.
    expect(marker.width).toBe(22);
  });

  it("re-fits when switching to a different floor plan size", async () => {
    const { rerender } = await renderMeasured();
    const nextPlan = { width: 900, height: 1200 };
    await rerender(
      <FloorMapViewer {...sampleProps} imageWidth={nextPlan.width} imageHeight={nextPlan.height} />,
    );
    await rerender(
      <FloorMapViewer {...sampleProps} imageWidth={nextPlan.width} imageHeight={nextPlan.height} />,
    );
    const style = StyleSheet.flatten(screen.getByTestId("map-surface").props.style);
    const parts = Object.assign({}, ...(style.transform as object[])) as { scale: number };
    expect(parts.scale).toBeCloseTo(calculateFitTransform(nextPlan, viewport).scale);
  });

  it("draws room highlights and routes on the overlay", async () => {
    await render(
      <FloorMapViewer
        {...sampleProps}
        highlights={[{ id: "HH-211", points: [[10, 10], [60, 10], [60, 60]] }]}
        routes={[{ id: "route-1", points: [[0, 0], [100, 100]] }]}
      />,
    );
    expect(screen.getByTestId("map-overlay")).toBeTruthy();
  });

  it("shows an error message if the floor plan image fails to load", async () => {
    await render(<FloorMapViewer {...sampleProps} />);
    await fireEvent(screen.getByTestId("floor-plan-image"), "error");
    expect(screen.getByTestId("plan-load-error")).toBeTruthy();
  });
});
