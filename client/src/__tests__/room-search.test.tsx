import { renderRouter, screen, fireEvent } from "expo-router/testing-library";
import { BUILDINGS } from "../data/room-search-data";

jest.mock("../data/room-search-data", () => ({
  BUILDINGS: [
    {
      name: "Science Building",
      floors: [
        { label: "Level 0", asset: 1 },
        { label: "Level 1", asset: 2 },
      ],
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

    fireEvent.press(screen.getByTestId(`floor-option-${nextFloor.label}`));
    expect(screen.getByTestId("selected-plan-title").props.children).toBe(
      nextFloor.label,
    );
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