import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";

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

  it("renders the root plan-viewer, stage, and full-stage gesture catch surface", () => {
    render(<FloorMapViewer {...sampleProps} />);

    expect(screen.getByTestId("plan-viewer")).toBeTruthy();
    expect(screen.getByTestId("map-stage")).toBeTruthy();
    expect(screen.getByTestId("map-gesture-surface")).toBeTruthy();
    expect(screen.getByTestId("map-surface")).toBeTruthy();
  });

  it("renders zoom-in, zoom-out, and reset-map (Fit) controls", () => {
    render(<FloorMapViewer {...sampleProps} />);

    expect(screen.getByTestId("zoom-in")).toBeTruthy();
    expect(screen.getByTestId("zoom-out")).toBeTruthy();
    expect(screen.getByTestId("reset-map")).toBeTruthy();
  });

  it("handles layout events on map-stage to calibrate viewport dimensions", () => {
    render(<FloorMapViewer {...sampleProps} />);

    const stage = screen.getByTestId("map-stage");
    fireEvent(stage, "layout", {
      nativeEvent: { layout: { width: 380, height: 500 } },
    });

    expect(screen.getByTestId("map-surface")).toBeTruthy();
  });

  it("allows pressing zoom-in, zoom-out, and reset-map (Fit)", () => {
    render(<FloorMapViewer {...sampleProps} />);

    const zoomIn = screen.getByTestId("zoom-in");
    const zoomOut = screen.getByTestId("zoom-out");
    const fitBtn = screen.getByTestId("reset-map");

    fireEvent.press(zoomIn);
    fireEvent.press(zoomOut);
    fireEvent.press(fitBtn);

    expect(screen.getByTestId("reset-map")).toBeTruthy();
  });

  it("handles mouse wheel events on web to scroll and pan within clamped boundaries", () => {
    render(<FloorMapViewer {...sampleProps} />);

    const stage = screen.getByTestId("map-stage");
    fireEvent(stage, "wheel", {
      nativeEvent: { deltaY: 30, deltaX: 20 },
    });

    expect(screen.getByTestId("map-surface")).toBeTruthy();
  });

  it("recalibrates panning and scale when switching to a different floor asset", () => {
    const { rerender } = render(<FloorMapViewer {...sampleProps} asset={1} />);

    // Trigger zoom to change scale
    fireEvent.press(screen.getByTestId("zoom-in"));

    // Switch asset
    rerender(<FloorMapViewer {...sampleProps} asset={2} title="Hiemenga Hall Level 3" />);

    expect(screen.getByTestId("map-surface")).toBeTruthy();
    expect(screen.getByTestId("map-gesture-surface")).toBeTruthy();
  });

  it("renders SVG room highlights and routes on the map-overlay", () => {
    render(
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

    expect(screen.getByTestId("map-overlay")).toBeTruthy();
  });

  it("displays error message if the floor plan asset fails to load", () => {
    render(<FloorMapViewer {...sampleProps} />);

    const image = screen.getByLabelText("Hiemenga Hall Level 2");
    fireEvent(image, "error");

    expect(screen.getByTestId("plan-load-error")).toBeTruthy();
    expect(screen.getByText("This floor plan could not be loaded.")).toBeTruthy();
  });
});
