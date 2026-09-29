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
