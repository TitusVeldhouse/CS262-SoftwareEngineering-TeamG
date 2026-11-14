import {
  renderRouter,
  screen,
  fireEvent,
  within,
  waitFor,
} from "expo-router/testing-library";
import {
  buildBuildingFavorite,
  buildFloorFavorite,
  buildPoiFilterFavorite,
  buildRoomFavorite,
  getFavoritesStorageAdapter,
  resetLocalFavoritesStorage,
  setFavoritesStorageAdapter,
} from "../data/favorites";
import type {
  FavoritePlace,
  FavoritesStorageAdapter,
} from "../data/favorites";
import { resetLocalAuthState } from "../data/auth-context";
import { getAllRooms } from "../data/campus-layout";

jest.mock("../components/FloorMapViewer", () => {
  const mockReact = jest.requireActual<typeof import("react")>("react");
  const { View: mockView } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return function MockPlanViewer({ highlights = [] }: { highlights?: unknown[] }) {
    return mockReact.createElement(mockView, {
      testID: "plan-viewer",
      accessibilityHint: `highlights:${highlights.length}`,
    });
  };
});

describe("Favorites Storage & Builder Helpers", () => {
  beforeEach(() => {
    resetLocalFavoritesStorage();
  });

  it("builds deterministic favorites for buildings, floors, rooms, and POIs", () => {
    const rooms = getAllRooms();
    const classroom = rooms.find((r) => r.id === "HH-211")!;
    const cafe = rooms.find((r) => r.id === "HEK-CAFE")!;

    const buildingFav = buildBuildingFavorite("Hiemenga Hall", "Hiemenga Hall");
    expect(buildingFav.id).toBe("building:Hiemenga Hall");
    expect(buildingFav.kind).toBe("building");

    const floorFav = buildFloorFavorite("Hiemenga Hall", "Level 2", "Hiemenga Hall");
    expect(floorFav.id).toBe("floor:Hiemenga Hall:Level 2");
    expect(floorFav.kind).toBe("floor");

    const roomFav = buildRoomFavorite(classroom, "Hiemenga Hall", "Level 2");
    expect(roomFav.id).toBe("room:HH-211");
    expect(roomFav.kind).toBe("room");
    expect(roomFav.roomId).toBe("HH-211");

    const poiRoomFav = buildRoomFavorite(cafe, "Hekman Library", "Level 2");
    expect(poiRoomFav.id).toBe("room:HEK-CAFE");
    expect(poiRoomFav.kind).toBe("poi");

    const poiFilterFav = buildPoiFilterFavorite("Restrooms");
    expect(poiFilterFav.id).toBe("poi:Restrooms");
    expect(poiFilterFav.kind).toBe("poi");
  });

  it("stores and clears favorites in temporary local storage", () => {
    const storage = getFavoritesStorageAdapter();
    expect(storage.mode).toBe("local-temp");
    expect(storage.load()).toEqual([]);

    const sample: FavoritePlace = {
      ...buildPoiFilterFavorite("Printers"),
      createdAt: "2026-11-10T00:00:00.000Z",
    };

    storage.save([sample]);
    expect(storage.load()).toHaveLength(1);
    expect(storage.load()[0].id).toBe("poi:Printers");

    storage.clear();
    expect(storage.load()).toEqual([]);
  });

  it("allows swapping in a future account-backed storage adapter", () => {
    const remoteRecords = new Map<string, FavoritePlace[]>();
    const mockAccountAdapter: FavoritesStorageAdapter = {
      mode: "account",
      load(accountId) {
        return remoteRecords.get(accountId ?? "default") ?? [];
      },
      save(items, accountId) {
        remoteRecords.set(accountId ?? "default", [...items]);
      },
      clear(accountId) {
        remoteRecords.delete(accountId ?? "default");
      },
    };

    setFavoritesStorageAdapter(mockAccountAdapter);
    const active = getFavoritesStorageAdapter();
    expect(active.mode).toBe("account");

    const fav: FavoritePlace = {
      ...buildPoiFilterFavorite("Water Fountains"),
      createdAt: "2026-11-10T00:00:00.000Z",
    };
    active.save([fav], "user-123");
    expect(active.load("user-123")).toHaveLength(1);
  });
});

describe("Favorites Side Collapsable Menu & Navigation Integration", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network offline"));
    resetLocalFavoritesStorage();
    resetLocalAuthState();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("starts collapsed and expands/collapses cleanly via toggle, handle, and backdrop", async () => {
    await renderRouter("src/app", { initialUrl: "/" });

    expect(screen.queryByTestId("favorites-drawer")).toBeNull();

    await fireEvent.press(screen.getByTestId("favorites-menu-toggle"));
    expect(screen.getByTestId("favorites-drawer")).toBeTruthy();
    expect(screen.getByTestId("favorites-empty-state")).toBeTruthy();
    expect(screen.getByTestId("favorites-storage-notice")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("favorites-collapse-button"));
    expect(screen.queryByTestId("favorites-drawer")).toBeNull();

    // Open again and collapse using the side rail handle
    await fireEvent.press(screen.getByTestId("favorites-menu-toggle"));
    expect(screen.getByTestId("favorites-drawer")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("favorites-side-collapse-handle"));
    expect(screen.queryByTestId("favorites-drawer")).toBeNull();

    // Open again and collapse using the dimmed backdrop
    await fireEvent.press(screen.getByTestId("favorites-menu-toggle"));
    expect(screen.getByTestId("favorites-drawer")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("favorites-backdrop"));
    expect(screen.queryByTestId("favorites-drawer")).toBeNull();
  });

  it("saves campus buildings and POIs on Finder, lists them in the side menu, and filters/removes cleanly", async () => {
    await renderRouter("src/app", { initialUrl: "/finder" });

    // Favorite selected building (Hekman Library by default)
    await fireEvent.press(screen.getByTestId("favorite-building-button"));
    // Favorite Restrooms POI
    await fireEvent.press(screen.getByTestId("favorite-poi-Restrooms"));

    expect(screen.getByTestId("favorites-count-badge")).toHaveTextContent("2");

    // Expand side drawer
    await fireEvent.press(screen.getByTestId("favorites-menu-toggle"));
    expect(screen.getByTestId("favorite-item-building:Hekman Library")).toBeTruthy();
    expect(screen.getByTestId("favorite-item-poi:Restrooms")).toBeTruthy();

    // Filter to POIs only
    await fireEvent.press(screen.getByTestId("favorites-filter-poi"));
    expect(screen.queryByTestId("favorite-item-building:Hekman Library")).toBeNull();
    expect(screen.getByTestId("favorite-item-poi:Restrooms")).toBeTruthy();

    // Back to All and remove one item
    await fireEvent.press(screen.getByTestId("favorites-filter-all"));
    await fireEvent.press(screen.getByTestId("favorite-remove-poi:Restrooms"));
    expect(screen.queryByTestId("favorite-item-poi:Restrooms")).toBeNull();
    expect(screen.getByTestId("favorite-item-building:Hekman Library")).toBeTruthy();

    // Clear all temporary favorites
    await fireEvent.press(screen.getByTestId("favorites-clear-button"));
    expect(screen.getByTestId("favorites-empty-state")).toBeTruthy();
  });

  it("saves rooms and floors on Room Search, highlights selected rooms, and navigates directly from Favorites", async () => {
    await renderRouter("src/app", { initialUrl: "/room-search?building=Hiemenga%20Hall" });

    // Save Level 2 floor and Classroom 211 directly from the floor strip
    await fireEvent.press(screen.getByTestId("favorite-floor-button"));
    await fireEvent.press(screen.getByTestId("favorite-room-HH-211"));

    // Selecting a room chip passes its highlight polygon to FloorMapViewer
    await fireEvent.press(screen.getByTestId("floor-room-chip-HH-211"));
    expect(screen.getByTestId("plan-viewer").props.accessibilityHint).toBe(
      "highlights:1",
    );

    // Go back to Landing screen and open Favorites side menu
    await fireEvent.press(screen.getByTestId("room-search-back-button"));
    expect(screen.getByTestId("landing-screen")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("favorites-menu-toggle"));
    const drawer = screen.getByTestId("favorites-drawer");
    expect(within(drawer).getByText("Classroom 211")).toBeTruthy();

    // Quick-add a room/POI directly inside the drawer
    await fireEvent.changeText(
      screen.getByTestId("favorites-quick-add-input"),
      "Group Study",
    );
    await fireEvent.press(screen.getByTestId("quick-add-room:HEK-201"));

    // Tap Classroom 211 favorite to jump directly to Room Search and collapse drawer
    await fireEvent.press(screen.getByTestId("favorite-navigate-room:HH-211"));
    expect(screen.queryByTestId("favorites-drawer")).toBeNull();
    expect(screen.getByTestId("room-search-screen")).toBeTruthy();
    expect(screen.getByText("Hiemenga Hall")).toBeTruthy();
    expect(screen.getByTestId("plan-viewer").props.accessibilityHint).toBe(
      "highlights:1",
    );

    // Open drawer while already on Room Search and navigate to Group Study Room 201 in Hekman Library
    await fireEvent.press(screen.getByTestId("favorites-menu-toggle"));
    await fireEvent.press(screen.getByTestId("favorite-navigate-room:HEK-201"));
    expect(screen.queryByTestId("favorites-drawer")).toBeNull();
    expect(screen.getByText("Hekman Library")).toBeTruthy();
  });

  it("navigates to Finder with matching POI active when tapping a saved POI favorite", async () => {
    await renderRouter("src/app", { initialUrl: "/" });

    await fireEvent.press(screen.getByTestId("favorites-menu-toggle"));
    await fireEvent.press(screen.getByTestId("quick-add-poi:Restrooms"));
    await fireEvent.press(screen.getByTestId("favorite-navigate-poi:Restrooms"));

    expect(screen.getByTestId("finder-screen")).toBeTruthy();
    expect(screen.queryByTestId("favorites-drawer")).toBeNull();
    expect(screen.getByText("✓")).toBeTruthy();
  });

  it("catches temporary favorites when creating an account, hides them after logout, and returns them upon login", async () => {
    await renderRouter("src/app", { initialUrl: "/" });

    // 1. Add a temporary local favorite while logged out
    await fireEvent.press(screen.getByTestId("favorites-menu-toggle"));
    await fireEvent.press(screen.getByTestId("quick-add-poi:Restrooms"));
    expect(screen.getByTestId("favorite-item-poi:Restrooms")).toBeTruthy();
    expect(screen.getByText("Temporary Local List")).toBeTruthy();

    // 2. Open account form inside drawer and create an account
    await fireEvent.press(screen.getByTestId("favorites-account-toggle"));
    await fireEvent.press(screen.getByTestId("account-mode-register"));
    await fireEvent.changeText(
      screen.getByTestId("account-display-name-input"),
      "Titus",
    );
    await fireEvent.changeText(
      screen.getByTestId("account-email-input"),
      "titus@calvin.edu",
    );
    await fireEvent.changeText(
      screen.getByTestId("account-password-input"),
      "password123",
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("account-submit-button").props.accessibilityState?.disabled,
      ).toBeFalsy();
    });
    await fireEvent.press(screen.getByTestId("account-submit-button"));

    await waitFor(() => {
      expect(screen.getByText("Account Synced · Titus")).toBeTruthy();
    });

    // Caught guest favorite remains in account list and user adds another while logged in
    expect(screen.getByTestId("favorite-item-poi:Restrooms")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("quick-add-room:HH-211"));
    expect(screen.getByTestId("favorite-item-room:HH-211")).toBeTruthy();

    // 3. Sign out -> reverts to empty Temporary Local List
    await fireEvent.press(screen.getByTestId("account-logout-button"));

    await waitFor(() => {
      expect(screen.getByText("Temporary Local List")).toBeTruthy();
      expect(screen.getByTestId("favorites-empty-state")).toBeTruthy();
    });

    // 4. Sign back in -> saved account favorites list is returned
    await fireEvent.press(screen.getByTestId("favorites-account-toggle"));
    await fireEvent.changeText(
      screen.getByTestId("account-email-input"),
      "titus@calvin.edu",
    );
    await fireEvent.changeText(
      screen.getByTestId("account-password-input"),
      "password123",
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("account-submit-button").props.accessibilityState?.disabled,
      ).toBeFalsy();
    });
    await fireEvent.press(screen.getByTestId("account-submit-button"));

    await waitFor(() => {
      expect(screen.getByText("Account Synced · Titus")).toBeTruthy();
      expect(screen.getByTestId("favorite-item-poi:Restrooms")).toBeTruthy();
      expect(screen.getByTestId("favorite-item-room:HH-211")).toBeTruthy();
    });
  });
});
