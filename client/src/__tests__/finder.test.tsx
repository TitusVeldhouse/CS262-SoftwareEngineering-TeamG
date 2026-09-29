// `renderRouter` boots the real expo-router route tree (from src/app) instead
// of rendering the Finder component in isolation, so these tests exercise
// actual navigation the same way a user would trigger it.
import { renderRouter, screen, fireEvent, within } from "expo-router/testing-library";

import { LOCATIONS, POINTS_OF_INTEREST } from "../app/finder";

describe("Finder screen - Core Navigation & Default State", () => {
  it("shows the first mocked location selected by default", () => {
    // Jump straight to "/finder" so this test doesn't depend on the landing
    // screen's navigation working correctly.
    renderRouter("src/app", { initialUrl: "/finder" });

    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.getByTestId("result-card")).toBeTruthy();
    // LOCATIONS[0] is the initial `selected` state, so its name should
    // appear both in the dropdown trigger and the result card.
    expect(screen.getAllByText(LOCATIONS[0].name).length).toBeGreaterThan(0);
  });

  it("renders every hard-coded point of interest", () => {
    renderRouter("src/app", { initialUrl: "/finder" });

    // Guards against someone adding/removing a POI in the mock data without
    // updating the horizontal checklist that displays it.
    for (const poi of POINTS_OF_INTEREST) {
      expect(screen.getByTestId(`poi-${poi}`)).toBeTruthy();
    }
  });

  it("toggles a point of interest checkbox on press", () => {
    renderRouter("src/app", { initialUrl: "/finder" });

    const restrooms = screen.getByTestId("poi-Restrooms");
    // No checkbox starts checked, so no checkmark glyph should exist yet.
    expect(screen.queryByText("✓", { includeHiddenElements: true })).toBeNull();

    // Pressing once checks it...
    fireEvent.press(restrooms);
    expect(screen.getByText("✓")).toBeTruthy();

    // ...and pressing again unchecks it (the toggle is a Set add/remove).
    fireEvent.press(restrooms);
    expect(screen.queryByText("✓")).toBeNull();
  });

  it("opens the dropdown and selects a different location", () => {
    renderRouter("src/app", { initialUrl: "/finder" });

    // Open the location dropdown.
    fireEvent.press(screen.getByTestId("location-dropdown-trigger"));
    expect(screen.getByTestId("location-dropdown-list")).toBeTruthy();

    // Pick a location other than the default (index 0) to confirm selection
    // actually changes state rather than always matching by coincidence.
    const target = LOCATIONS[3];
    fireEvent.press(screen.getByTestId(`location-option-${target.name}`));

    // Choosing an option closes the dropdown and updates the selection.
    expect(screen.queryByTestId("location-dropdown-list")).toBeNull();
    expect(screen.getAllByText(target.name).length).toBeGreaterThan(0);
  });

  it("navigates back to the landing screen", () => {
    renderRouter("src/app", { initialUrl: "/" });

    // Go landing -> finder first, then verify the back button reverses it.
    fireEvent.press(screen.getByTestId("get-started-button"));
    expect(screen.getByTestId("finder-screen")).toBeTruthy();

    fireEvent.press(screen.getByTestId("back-button"));
    expect(screen.getByTestId("landing-screen")).toBeTruthy();
  });
});

describe("Finder screen - Campus Map Rendering & Blueprint", () => {
  it("renders the campus master plan blueprint image", () => {
    renderRouter("src/app", { initialUrl: "/finder" });

    const mapImage = screen.getByTestId("campus-map-image");
    expect(mapImage).toBeTruthy();
  });

  it("renders an interactive pin for every single campus location in LOCATIONS", () => {
    renderRouter("src/app", { initialUrl: "/finder" });

    for (const loc of LOCATIONS) {
      const pin = screen.getByTestId(`pin-${loc.name}`);
      expect(pin).toBeTruthy();
      expect(pin.props.accessibilityLabel).toBe(loc.name);
      expect(pin.props.accessibilityRole).toBe("button");
    }
  });

  it("has valid percentage coordinates within 0% to 100% for all locations", () => {
    const percentRegex = /^\d+(\.\d+)?%$/;
    for (const loc of LOCATIONS) {
      expect(loc.top).toMatch(percentRegex);
      expect(loc.left).toMatch(percentRegex);

      const topVal = parseFloat(loc.top);
      const leftVal = parseFloat(loc.left);

      expect(topVal).toBeGreaterThanOrEqual(0);
      expect(topVal).toBeLessThanOrEqual(100);
      expect(leftVal).toBeGreaterThanOrEqual(0);
      expect(leftVal).toBeLessThanOrEqual(100);
    }
  });
});

describe("Finder screen - Pin Tapping & Bidirectional Interaction", () => {
  it("selects a location and updates the result card when its pin dot is tapped on the map", () => {
    renderRouter("src/app", { initialUrl: "/finder" });

    // Pick a building other than default index 0
    const target = LOCATIONS.find((l) => l.name === "Science Building")!;
    fireEvent.press(screen.getByTestId(`pin-${target.name}`));

    // Result card must reflect tapped building
    expect(screen.getByTestId("result-card")).toBeTruthy();
    expect(screen.getAllByText(target.name).length).toBeGreaterThan(0);
  });

  it("displays a floating name badge on the active pin when tapped", () => {
    renderRouter("src/app", { initialUrl: "/finder" });

    const target = LOCATIONS.find((l) => l.name === "Chapel")!;
    fireEvent.press(screen.getByTestId(`pin-${target.name}`));

    // Chapel name should appear in the pin badge as well as the result card
    expect(screen.getAllByText(target.name).length).toBeGreaterThanOrEqual(2);
  });

  it("updates the dropdown trigger text when a pin is tapped on the map", () => {
    renderRouter("src/app", { initialUrl: "/finder" });

    const target = LOCATIONS.find((l) => l.name === "Covenant Fine Arts Center")!;
    fireEvent.press(screen.getByTestId(`pin-${target.name}`));

    const trigger = screen.getByTestId("location-dropdown-trigger");
    expect(within(trigger).getByText(target.name)).toBeTruthy();
  });

  it("updates the active pin badge when a location is picked from the dropdown", () => {
    renderRouter("src/app", { initialUrl: "/finder" });

    fireEvent.press(screen.getByTestId("location-dropdown-trigger"));
    const target = LOCATIONS.find((l) => l.name === "Fieldhouse")!;
    fireEvent.press(screen.getByTestId(`location-option-${target.name}`));

    // Both result card and pin badge display the target building name
    expect(screen.getAllByText(target.name).length).toBeGreaterThanOrEqual(2);
  });
});

describe("Finder screen - Building Floor Plan Access", () => {
  it("shows an Enter Building / View Floor Plan button when Hiemenga Hall is selected", () => {
    renderRouter("src/app", { initialUrl: "/finder" });

    fireEvent.press(screen.getByTestId("pin-Hiemenga Hall"));
    expect(screen.getByTestId("enter-building-button")).toBeTruthy();
    expect(screen.getByText(/View Floor Plan/i)).toBeTruthy();
  });
});

