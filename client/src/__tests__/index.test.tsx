// `renderRouter` boots the real expo-router route tree (from src/app) instead
// of rendering the Landing component in isolation, so these tests exercise
// actual navigation the same way a user would trigger it.
import { renderRouter, screen, fireEvent } from "expo-router/testing-library";

import { FEATURES } from "../app/index";

jest.mock("../components/FloorMapViewer", () => {
  const mockReact = jest.requireActual<typeof import("react")>("react");
  const { View: mockView } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return function MockPlanViewer() {
    return mockReact.createElement(mockView, { testID: "plan-viewer" });
  };
});

describe("Landing screen", () => {
  it("renders the hero copy and every feature card", () => {
    // Start the router at "/", which resolves to src/app/index.tsx (Landing).
    renderRouter("src/app", { initialUrl: "/" });

    expect(screen.getByTestId("landing-screen")).toBeTruthy();
    expect(
      screen.getByText("Never get lost on campus again."),
    ).toBeTruthy();

    // Every mocked feature card should render its title so the pitch stays
    // in sync if FEATURES is ever edited.
    for (const feature of FEATURES) {
      expect(screen.getByText(feature.title)).toBeTruthy();
    }
  });

  it("navigates to the finder screen when 'Find a Room' is pressed", () => {
    renderRouter("src/app", { initialUrl: "/" });

    // Simulate the user tapping the call-to-action button.
    fireEvent.press(screen.getByTestId("get-started-button"));

    // A successful push to /finder mounts the Finder screen in its place.
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
  });

  it("opens room search from the classroom feature", () => {
    renderRouter("src/app", { initialUrl: "/" });

    fireEvent.press(screen.getByTestId("classroom-search-feature"));

    expect(screen.getByTestId("room-search-screen")).toBeTruthy();
  });
});

describe("Menu and Map Navigation Parity", () => {
  it("navigates to the same Finder screen from the menu CTA as Exit to Campus Map does from room search", () => {
    renderRouter("src/app", { initialUrl: "/" });

    // 1. Menu CTA leads to finder-screen
    fireEvent.press(screen.getByTestId("get-started-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();

    // 2. Go to room search via View Floor Plan
    fireEvent.press(screen.getByTestId("pin-Science Building"));
    fireEvent.press(screen.getByTestId("enter-building-button"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();

    // 3. Exit to Campus Map button
    fireEvent.press(screen.getByTestId("exit-to-campus-button"));

    // 4. Destination is the same finder-screen with the map container
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.getByTestId("campus-map-scroll-vertical")).toBeTruthy();
  });

  it("navigates to the same Room Search screen from the menu feature as View Floor Plan does from Finder", () => {
    renderRouter("src/app", { initialUrl: "/" });

    // 1. Direct from menu feature card
    fireEvent.press(screen.getByTestId("classroom-search-feature"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();
    expect(screen.getByTestId("building-search-input")).toBeTruthy();

    // 2. Safe back navigation to menu
    fireEvent.press(screen.getByTestId("room-search-back-button"));
    expect(screen.getByTestId("landing-screen")).toBeTruthy();

    // 3. Via Finder -> View Floor Plan
    fireEvent.press(screen.getByTestId("get-started-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    fireEvent.press(screen.getByTestId("pin-Hiemenga Hall"));
    fireEvent.press(screen.getByTestId("enter-building-button"));

    // 4. Destination is the exact same room-search-screen
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();
    expect(screen.getByText("Hiemenga Hall")).toBeTruthy();
  });

  it("supports full round-trip flow across menu, finder, and room search", () => {
    renderRouter("src/app", { initialUrl: "/" });

    // Menu -> Finder
    fireEvent.press(screen.getByTestId("get-started-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();

    // Finder -> Room Search
    fireEvent.press(screen.getByTestId("pin-Devos Communication Building"));
    fireEvent.press(screen.getByTestId("enter-building-button"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();
    expect(screen.getByText("Devos Communication Center")).toBeTruthy();

    // Room Search -> Finder
    fireEvent.press(screen.getByTestId("exit-to-campus-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();

    // Verify navigating backwards through history unrolls the full stack cleanly:
    // Back from Finder returns to Room Search
    fireEvent.press(screen.getByTestId("back-button"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();

    // Back from Room Search returns to initial Finder
    fireEvent.press(screen.getByTestId("room-search-back-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();

    // Back from Finder returns to Landing menu
    fireEvent.press(screen.getByTestId("back-button"));
    expect(screen.getByTestId("landing-screen")).toBeTruthy();
  });
});
