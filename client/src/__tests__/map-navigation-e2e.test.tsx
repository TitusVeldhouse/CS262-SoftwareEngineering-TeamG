import { renderRouter, screen, fireEvent, within } from "expo-router/testing-library";
import { findFirstSharedMap } from "../data/campus-layout";

// Mock Reanimated & Gesture Handler for the real router tree
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
  };
});

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  const chainable = () => ({
    onBegin: () => chainable(),
    onUpdate: () => chainable(),
    maxPointers: () => chainable(),
  });
  return {
    GestureDetector: ({ children }: any) => children,
    GestureHandlerRootView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    Gesture: {
      Pinch: () => chainable(),
      Pan: () => chainable(),
      Simultaneous: () => chainable(),
    },
  };
});

describe("End-to-End Campus & Indoor Map Navigation", () => {
  it("Journey 1: Full user loop (Landing -> Campus Map -> Floor Plan -> Exit to Campus -> Landing)", () => {
    // 1. User arrives on Landing Page
    renderRouter("src/app", { initialUrl: "/" });
    expect(screen.getByTestId("landing-screen")).toBeTruthy();
    expect(screen.getByText("Never get lost on campus again.")).toBeTruthy();

    // 2. User presses 'Find a Room' CTA
    fireEvent.press(screen.getByTestId("get-started-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.getByTestId("campus-map-scroll-vertical")).toBeTruthy();

    // 3. User adjusts map controls (zoom in, zoom out, and recalibrates with Quad)
    const zoomIn = screen.getByTestId("zoom-in");
    const zoomOut = screen.getByTestId("zoom-out");
    const quadBtn = screen.getByTestId("center-map-button");

    fireEvent.press(zoomIn);
    fireEvent.press(zoomOut);
    fireEvent.press(quadBtn);

    // 4. User selects Hiemenga Hall pin on campus map
    fireEvent.press(screen.getByTestId("pin-Hiemenga Hall"));
    expect(screen.getByTestId("result-card")).toBeTruthy();
    expect(screen.getByTestId("enter-building-button")).toBeTruthy();

    // 5. User transitions inside building via 'View Floor Plan'
    fireEvent.press(screen.getByTestId("enter-building-button"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();
    expect(screen.getByText("Hiemenga Hall")).toBeTruthy();

    // 6. User switches to a different floor
    const level3Option = screen.getByTestId("floor-option-Level 3");
    fireEvent.press(level3Option);
    expect(level3Option.props.accessibilityState.selected).toBe(true);

    // 7. User exits back to the campus map
    const exitBtn = screen.getByTestId("exit-to-campus-button");
    expect(exitBtn).toBeTruthy();
    fireEvent.press(exitBtn);

    // 8. User lands on Finder with Hiemenga Hall focused and centered
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.getAllByText("Hiemenga Hall").length).toBeGreaterThan(0);

    // 9. User navigates back out through history
    fireEvent.press(screen.getByTestId("back-button"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();

    fireEvent.press(screen.getByTestId("room-search-back-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();

    fireEvent.press(screen.getByTestId("back-button"));
    expect(screen.getByTestId("landing-screen")).toBeTruthy();
  });

  it("Journey 2: Menu search -> Building selection -> Multi-building transitions", () => {
    // 1. Start on Landing
    renderRouter("src/app", { initialUrl: "/" });

    // 2. Click 'Classroom & Room Search' feature card
    fireEvent.press(screen.getByTestId("classroom-search-feature"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();

    // 3. Search for Science Building
    const searchInput = screen.getByTestId("building-search-input");
    fireEvent.changeText(searchInput, "Science");

    const scienceOption = screen.getByTestId("building-option-Science Building");
    fireEvent.press(scienceOption);

    expect(screen.getByText("Science Building")).toBeTruthy();

    // 4. Switch floors in Science Building
    const level1Option = screen.getByTestId("floor-option-Level 1");
    fireEvent.press(level1Option);
    expect(level1Option.props.accessibilityState.selected).toBe(true);

    // 5. Exit out to the Campus Map
    fireEvent.press(screen.getByTestId("exit-to-campus-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();

    // 6. Select a different campus building (Devos Communication Building)
    fireEvent.press(screen.getByTestId("pin-Devos Communication Building"));
    fireEvent.press(screen.getByTestId("enter-building-button"));

    // 7. Verifies transition into Devos Communication Center floor plan
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();
    expect(screen.getByText("Devos Communication Center")).toBeTruthy();

    // 8. Exit back to campus map
    fireEvent.press(screen.getByTestId("exit-to-campus-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
  });

  it("Journey 3: Direct deep-link URL parameter handling", () => {
    // Directly open finder with building param
    renderRouter("src/app", { initialUrl: "/finder?building=Spoelhof%20Center" });

    // Pre-selects Spoelhof Center
    const trigger = screen.getByTestId("location-dropdown-trigger");
    expect(within(trigger).getByText("Spoelhof Center")).toBeTruthy();

    // Enters building directly
    fireEvent.press(screen.getByTestId("enter-building-button"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();
    expect(screen.getByText("Spoelhof University Center")).toBeTruthy();

    // Exits cleanly back
    fireEvent.press(screen.getByTestId("exit-to-campus-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
  });

  it("Journey 4: Spatial navigation route resolution parity across campus hierarchy", () => {
    // Intra-floor navigation (Same room / same floor)
    const sameFloor = findFirstSharedMap("HH-211", "HH-213");
    expect(sameFloor?.scope).toBe("floor");
    expect(sameFloor?.sharedMapTitle).toBe("Hiemenga Hall - Level 2");

    // Inter-floor navigation within same building
    const differentFloor = findFirstSharedMap("HH-211", "HH-311");
    expect(differentFloor?.scope).toBe("building");
    expect(differentFloor?.sharedMapTitle).toContain("Stairs / Elevator");

    // Inter-building outdoor campus navigation
    const crossCampus = findFirstSharedMap("HH-211", "SB-110");
    expect(crossCampus?.scope).toBe("campus");
    expect(crossCampus?.sharedMapTitle).toBe("Campus Master Plan");
  });
});

