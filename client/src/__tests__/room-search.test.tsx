import { renderRouter, screen, fireEvent } from "expo-router/testing-library";
import { BUILDINGS } from "../data/room-search-data";
import {
  clampMapScale,
  calculateMapFrame,
  MAP_PADDING,
  MIN_MAP_SCALE,
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
    const frame = calculateMapFrame(1584, 1224, width, height);

    expect(frame.width).toBeLessThanOrEqual(width - MAP_PADDING * 2 + 0.01);
    expect(frame.height).toBeLessThanOrEqual(height - MAP_PADDING * 2 + 0.01);
    expect(frame.left).toBeCloseTo((width - frame.width) / 2);
    expect(frame.top).toBeCloseTo((height - frame.height) / 2);
    expect(frame.width / frame.height).toBeCloseTo(1584 / 1224, 5);
  });

  it("allows zooming out below fit without losing the reset scale", () => {
    expect(clampMapScale(1 / 1.5)).toBeCloseTo(1 / 1.5);
    expect(clampMapScale(0.25)).toBe(MIN_MAP_SCALE);
    expect(clampMapScale(1)).toBe(1);
  });

  it("lists academic buildings alphabetically before auxiliary buildings", () => {
    renderRouter("src/app", { initialUrl: "/room-search" });

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

  it("searches buildings and displays the selected floor plan", () => {
    renderRouter("src/app", { initialUrl: "/room-search" });

    fireEvent.changeText(screen.getByTestId("building-search-input"), "Science");
    fireEvent.press(screen.getByTestId("building-option-Science Building"));

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
    fireEvent.press(nextFloorOption);
    expect(nextFloorOption.props.accessibilityState.selected).toBe(true);
  });

  it("shows an empty state for unmatched building names", () => {
    renderRouter("src/app", { initialUrl: "/room-search" });

    fireEvent.changeText(
      screen.getByTestId("building-search-input"),
      "Not a campus building",
    );

    expect(screen.getByTestId("no-building-results")).toBeTruthy();
  });
});