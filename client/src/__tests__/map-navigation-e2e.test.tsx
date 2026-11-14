import { renderRouter, screen, fireEvent, within } from "expo-router/testing-library";
import { findFirstSharedMap } from "../data/campus-layout";

// Mock FloorMapViewer to isolate screen navigation transitions from native CAD reanimated canvas
jest.mock("../components/FloorMapViewer", () => {
  const mockReact = jest.requireActual<typeof import("react")>("react");
  const { View: mockView } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return function MockPlanViewer() {
    return mockReact.createElement(mockView, { testID: "plan-viewer" });
  };
});

describe("End-to-End Campus & Indoor Map Navigation", () => {
  it("Journey 1: Full user loop (Landing -> Campus Map -> Floor Plan -> Exit to Campus -> Landing)", async () => {
    // 1. User arrives on Landing Page
    await renderRouter("src/app", { initialUrl: "/" });
    expect(screen.getByTestId("landing-screen")).toBeTruthy();
    expect(screen.getByText("Never get lost on campus again.")).toBeTruthy();

    // 2. User presses 'Find a Room' CTA
    await fireEvent.press(screen.getByTestId("get-started-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.getByTestId("campus-map-scroll-vertical")).toBeTruthy();

    // 3. User adjusts map controls (zoom in and zoom out)
    const zoomIn = screen.getByTestId("zoom-in");
    const zoomOut = screen.getByTestId("zoom-out");

    await fireEvent.press(zoomIn);
    await fireEvent.press(zoomOut);

    // 4. User selects Hiemenga Hall pin on campus map
    await fireEvent.press(screen.getByTestId("pin-Hiemenga Hall"));
    expect(screen.getByTestId("result-card")).toBeTruthy();
    expect(screen.getByTestId("enter-building-button")).toBeTruthy();

    // 5. User transitions inside building via 'View Floor Plan'
    await fireEvent.press(screen.getByTestId("enter-building-button"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();
    expect(screen.getByText("Hiemenga Hall")).toBeTruthy();

    // 6. User switches to a different floor
    const level3Option = screen.getByTestId("floor-option-Level 3");
    await fireEvent.press(level3Option);
    expect(level3Option.props.accessibilityState.selected).toBe(true);

    // 7. User exits back to the campus map
    const exitBtn = screen.getByTestId("exit-to-campus-button");
    expect(exitBtn).toBeTruthy();
    await fireEvent.press(exitBtn);

    // 8. User lands on Finder with Hiemenga Hall focused and can recenter on Quad
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.getAllByText("Hiemenga Hall").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId("center-map-button"));

    // 9. User navigates back out through history
    await fireEvent.press(screen.getByTestId("back-button"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("room-search-back-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("back-button"));
    expect(screen.getByTestId("landing-screen")).toBeTruthy();
  });

  it("Journey 2: Menu search -> Building selection -> Multi-building transitions", async () => {
    // 1. Start on Landing
    await renderRouter("src/app", { initialUrl: "/" });

    // 2. Click 'Classroom & Room Search' feature card
    await fireEvent.press(screen.getByTestId("classroom-search-feature"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();

    // 3. Search for Science Building
    const searchInput = screen.getByTestId("building-search-input");
    await fireEvent.changeText(searchInput, "Science");

    const scienceOption = screen.getByTestId("building-option-Science Building");
    await fireEvent.press(scienceOption);

    expect(screen.getByText("Science Building")).toBeTruthy();

    // 4. Switch floors in Science Building
    const level1Option = screen.getByTestId("floor-option-Level 1");
    await fireEvent.press(level1Option);
    expect(level1Option.props.accessibilityState.selected).toBe(true);

    // 5. Exit out to the Campus Map
    await fireEvent.press(screen.getByTestId("exit-to-campus-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();

    // 6. Select a different campus building (Devos Communication Building)
    await fireEvent.press(screen.getByTestId("pin-Devos Communication Building"));
    await fireEvent.press(screen.getByTestId("enter-building-button"));

    // 7. Verifies transition into Devos Communication Center floor plan
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();
    expect(screen.getByText("Devos Communication Center")).toBeTruthy();

    // 8. Exit back to campus map
    await fireEvent.press(screen.getByTestId("exit-to-campus-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
  });

  it("Journey 3: Direct deep-link URL parameter handling", async () => {
    // Directly open finder with building param
    await renderRouter("src/app", {
      initialUrl: "/finder?building=Spoelhof%20Center",
    });

    // Pre-selects Spoelhof Center
    const trigger = screen.getByTestId("location-dropdown-trigger");
    expect(within(trigger).getByText("Spoelhof Center")).toBeTruthy();

    // Enters building directly
    await fireEvent.press(screen.getByTestId("enter-building-button"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();
    expect(screen.getByText("Spoelhof University Center")).toBeTruthy();

    // Exits cleanly back
    await fireEvent.press(screen.getByTestId("exit-to-campus-button"));
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