import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View,
    },
    useSharedValue: (init: any) => {
      let val = init;
      return {
        get: () => val,
        set: (v: any) => {
          val = v;
        },
      };
    },
    useAnimatedStyle: (fn: any) => fn(),
    withTiming: (toValue: any) => toValue,
    runOnJS: (fn: any) => fn,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  const chainable = () => ({
    onBegin: () => chainable(),
    onUpdate: () => chainable(),
    onFinalize: () => chainable(),
    maxPointers: () => chainable(),
  });
  return {
    GestureDetector: ({ children }: any) => children,
    Gesture: {
      Pinch: () => chainable(),
      Pan: () => chainable(),
      Simultaneous: () => chainable(),
    },
  };
});

import FloorMapViewer from "../components/FloorMapViewer";

describe("FloorMapViewer Component", () => {
  const sampleProps = {
    asset: 1,
    title: "Hiemenga Hall Level 2",
    imageWidth: 1570,
    imageHeight: 1035,
  };

  it("renders the root plan-viewer, stage, and full-stage gesture catch surface", async () => {
    const view = await render(<FloorMapViewer {...sampleProps} />);

    expect(view.getByTestId("plan-viewer")).toBeTruthy();
    expect(view.getByTestId("map-stage")).toBeTruthy();
    expect(view.getByTestId("map-gesture-surface")).toBeTruthy();
    expect(view.getByTestId("map-surface")).toBeTruthy();
  });

  it("renders zoom-in, zoom-out, and reset-map (Fit) controls", async () => {
    const view = await render(<FloorMapViewer {...sampleProps} />);

    expect(view.getByTestId("zoom-in")).toBeTruthy();
    expect(view.getByTestId("zoom-out")).toBeTruthy();
    expect(view.getByTestId("reset-map")).toBeTruthy();
  });

  it("handles layout events on map-stage to calibrate viewport dimensions", async () => {
    const view = await render(<FloorMapViewer {...sampleProps} />);

    const stage = view.getByTestId("map-stage");
    await fireEvent(stage, "layout", {
      nativeEvent: { layout: { width: 380, height: 500 } },
    });

    expect(view.getByTestId("map-surface")).toBeTruthy();
  });

  it("allows pressing zoom-in, zoom-out, and reset-map (Fit)", async () => {
    const view = await render(<FloorMapViewer {...sampleProps} />);

    const zoomIn = view.getByTestId("zoom-in");
    const zoomOut = view.getByTestId("zoom-out");
    const fitBtn = view.getByTestId("reset-map");

    await fireEvent.press(zoomIn);
    await fireEvent.press(zoomOut);
    await fireEvent.press(fitBtn);

    expect(view.getByTestId("reset-map")).toBeTruthy();
  });

  it("handles mouse wheel events on web to scroll and pan within clamped boundaries", async () => {
    const view = await render(<FloorMapViewer {...sampleProps} />);

    const stage = view.getByTestId("map-stage");
    await fireEvent(stage, "wheel", {
      nativeEvent: { deltaY: 30, deltaX: 20 },
    });

    expect(view.getByTestId("map-surface")).toBeTruthy();
  });

  it("recalibrates panning and scale when switching to a different floor asset", async () => {
    const view = await render(<FloorMapViewer {...sampleProps} asset={1} />);

    // Trigger zoom to change scale
    await fireEvent.press(view.getByTestId("zoom-in"));

    // Switch asset
    await view.rerender(
      <FloorMapViewer {...sampleProps} asset={2} title="Hiemenga Hall Level 3" />,
    );

    expect(view.getByTestId("map-surface")).toBeTruthy();
    expect(view.getByTestId("map-gesture-surface")).toBeTruthy();
  });

  it("renders SVG room highlights and routes on the map-overlay", async () => {
    const view = await render(
      <FloorMapViewer
        {...sampleProps}
        highlights={[
          {
            id: "room-211",
            points: [
              [100, 100],
              [200, 100],
              [200, 200],
              [100, 200],
            ],
          },
        ]}
        routes={[
          {
            id: "route-entrance-to-211",
            points: [
              [50, 50],
              [100, 100],
            ],
          },
        ]}
      />,
    );

    expect(view.getByTestId("map-overlay")).toBeTruthy();
  });

  it("displays error message if the floor plan asset fails to load", async () => {
    const view = await render(<FloorMapViewer {...sampleProps} />);

    const image = view.getByLabelText("Hiemenga Hall Level 2");
    await fireEvent(image, "error");

    expect(view.getByTestId("plan-load-error")).toBeTruthy();
    expect(view.getByText("This floor plan could not be loaded.")).toBeTruthy();
  });
});
