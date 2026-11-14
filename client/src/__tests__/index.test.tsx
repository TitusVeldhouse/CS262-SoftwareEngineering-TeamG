import { renderRouter, screen, fireEvent } from "expo-router/testing-library";

jest.mock("../components/FloorMapViewer", () => {
  const mockReact = jest.requireActual<typeof import("react")>("react");
  const { View: mockView } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return function MockPlanViewer() {
    return mockReact.createElement(mockView, { testID: "plan-viewer" });
  };
});

describe("Campus map home route", () => {
  it("renders the campus map at / instead of the obsolete welcome screen", async () => {
    await renderRouter("src/app", { initialUrl: "/" });

    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.getByTestId("campus-map-scroll-vertical")).toBeTruthy();
    expect(screen.queryByTestId("landing-screen")).toBeNull();
    expect(screen.queryByTestId("get-started-button")).toBeNull();
    expect(screen.queryByTestId("back-button")).toBeNull();
  });

  it("keeps /finder available as a compatible campus map route", async () => {
    await renderRouter("src/app", { initialUrl: "/finder" });

    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.getByTestId("campus-map-scroll-vertical")).toBeTruthy();
  });

  it("returns directly to the map from Room Search and preserves the building", async () => {
    await renderRouter("src/app", { initialUrl: "/" });

    await fireEvent.press(screen.getByTestId("pin-Science Building"));
    await fireEvent.press(screen.getByTestId("enter-building-button"));
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("room-search-back-button"));

    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.queryByTestId("room-search-screen")).toBeNull();
    expect(screen.getAllByText("Science Building").length).toBeGreaterThan(0);
  });

  it("returns directly to the map when exiting a floor plan", async () => {
    await renderRouter("src/app", { initialUrl: "/room-search?building=Hiemenga%20Hall" });

    await fireEvent.press(screen.getByTestId("exit-to-campus-button"));

    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.queryByTestId("room-search-screen")).toBeNull();
    expect(screen.getAllByText("Hiemenga Hall").length).toBeGreaterThan(0);
  });
});
