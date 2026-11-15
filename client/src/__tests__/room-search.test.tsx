import { renderRouter, screen, fireEvent } from "expo-router/testing-library";
import { BUILDINGS } from "../data/room-search-data";
import {
  calculateFitTransform,
  calculateScaleLimits,
  MAP_PADDING,
  MAX_ZOOM,
} from "../components/map-geometry";

jest.mock("../data/room-search-data", () => ({
  BUILDINGS: [
    {
      name: "Bunker Interpretive Center",
      floors: [{ label: "Level 1", asset: 1 }],
    },
    {
      name: "Science Building",
      floors: [{ label: "Level 0", asset: 2 }, { label: "Level 1", asset: 3 }],
    },
    {
      name: "Calvin Crossings",
      floors: [{ label: "Level 1", asset: 4 }],
    },
    {
      name: "North Hall",
      floors: [{ label: "Level 0", asset: 5 }],
    },
    {
      name: "Hekman Library",
      floors: [{ label: "Level 1", asset: 6 }],
    },
    {
      name: "Hiemenga Hall",
      floors: [{ label: "Level 2", asset: 7 }],
    },
  ],
}));

jest.mock("../components/FloorMapViewer", () => {
  const mockReact = jest.requireActual<typeof import("react")>("react");
  const { View: mockView } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return function MockPlanViewer() {
    return mockReact.createElement(mockView, { testID: "plan-viewer" });
  };
});

describe("Room search screen", () => {
  it.each([
    [357, 520],
    [1080, 700],
  ])("fits and centers the full map in a %ix%ipx viewport", (width, height) => {
    const content = { width: 1584, height: 1224 };
    const fit = calculateFitTransform(content, { width, height });
    const shownWidth = content.width * fit.scale;
    const shownHeight = content.height * fit.scale;

    expect(shownWidth).toBeLessThanOrEqual(width - MAP_PADDING * 2 + 0.01);
    expect(shownHeight).toBeLessThanOrEqual(height - MAP_PADDING * 2 + 0.01);
    expect(fit.x).toBeCloseTo((width - shownWidth) / 2);
    expect(fit.y).toBeCloseTo((height - shownHeight) / 2);
  });

  it("never zooms out past fit-to-screen and caps zoom-in at MAX_ZOOM", () => {
    const content = { width: 1584, height: 1224 };
    const viewport = { width: 357, height: 520 };
    const limits = calculateScaleLimits(content, viewport);

    expect(limits.min).toBeCloseTo(calculateFitTransform(content, viewport).scale);
    expect(limits.max).toBeCloseTo(limits.min * MAX_ZOOM);
  });

  it("lists academic buildings alphabetically before auxiliary buildings", async () => {
    await renderRouter("src/app", { initialUrl: "/room-search" });

    const buildingIds = screen
      .getAllByTestId(/^building-option-/)
      .map((building) => building.props.testID);

    expect(buildingIds).toEqual([
      "building-option-Hekman Library",
      "building-option-Hiemenga Hall",
      "building-option-North Hall",
      "building-option-Science Building",
      "building-option-Bunker Interpretive Center",
      "building-option-Calvin Crossings",
    ]);
  });

  it("searches buildings and displays the selected floor plan", async () => {
    await renderRouter("src/app", { initialUrl: "/room-search" });

    await fireEvent.changeText(screen.getByTestId("building-search-input"), "Science");
    await fireEvent.press(screen.getByTestId("building-option-Science Building"));

    expect(screen.getByTestId("plan-viewer")).toBeTruthy();
    expect(screen.getByText("Science Building")).toBeTruthy();

    const scienceBuilding = BUILDINGS.find(
      (building) => building.name === "Science Building",
    );
    expect(scienceBuilding).toBeDefined();
    expect(scienceBuilding?.floors.length).toBeGreaterThan(1);

    const nextFloor = scienceBuilding?.floors[1];
    if (!nextFloor) throw new Error("Expected a second Science Building floor");

    const nextFloorOption = screen.getByTestId(
      `floor-option-${nextFloor.label}`,
    );
    await fireEvent.press(nextFloorOption);
    expect(nextFloorOption.props.accessibilityState.selected).toBe(true);
  });

  it("shows an empty state for unmatched building names", async () => {
    await renderRouter("src/app", { initialUrl: "/room-search" });

    await fireEvent.changeText(
      screen.getByTestId("building-search-input"),
      "Not a campus building",
    );

    expect(screen.getByTestId("no-building-results")).toBeTruthy();
  });

  it("automatically selects a building and renders its floor plan when opened with building param", async () => {
    await renderRouter("src/app", { initialUrl: "/room-search?building=Hiemenga%20Hall" });

    expect(screen.getByTestId("plan-viewer")).toBeTruthy();
    expect(screen.getByText("Hiemenga Hall")).toBeTruthy();
    expect(screen.getByTestId("floor-option-Level 2")).toBeTruthy();
  });

  it("renders a green Exit to Campus Map button and navigates to the campus map on press", async () => {
    await renderRouter("src/app", { initialUrl: "/room-search?building=Hiemenga%20Hall" });

    const exitBtn = screen.getByTestId("exit-to-campus-button");
    expect(exitBtn).toBeTruthy();
    expect(screen.getByText(/Exit to Campus Map/i)).toBeTruthy();

    await fireEvent.press(exitBtn);
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
  });

  it.each([
    "Hiemenga Hall",
    "Science Building",
    "Hekman Library",
  ])(
    "exits to campus map with matching building for %s",
    async (buildingName) => {
      await renderRouter("src/app", {
        initialUrl: `/room-search?building=${encodeURIComponent(buildingName)}`,
      });

      const exitBtn = screen.getByTestId("exit-to-campus-button");
      await fireEvent.press(exitBtn);

      expect(screen.getByTestId("finder-screen")).toBeTruthy();
      expect(screen.getByTestId("result-card")).toBeTruthy();
    },
  );

  it("returns to the map with the selected building when deep-linked", async () => {
    await renderRouter("src/app", { initialUrl: "/room-search?building=Hiemenga%20Hall" });

    await fireEvent.press(screen.getByTestId("room-search-back-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.getByTestId("result-card")).toBeTruthy();
    expect(screen.getAllByText("Hiemenga Hall").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("room-search-screen")).toBeNull();
  });
});