import {
  renderRouter,
  screen,
  fireEvent,
  waitFor,
} from "expo-router/testing-library";
import { resetLocalAuthState } from "../data/auth-context";
import {
  buildPoiFilterFavorite,
  getFavoritesStorageAdapter,
  resetLocalFavoritesStorage,
} from "../data/favorites";

jest.mock("../components/FloorMapViewer", () => {
  const mockReact = jest.requireActual<typeof import("react")>("react");
  const { View: mockView } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return function MockPlanViewer() {
    return mockReact.createElement(mockView, { testID: "plan-viewer" });
  };
});

describe("Account Auth Screens & User Avatar Integration", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network offline"));
    resetLocalFavoritesStorage();
    resetLocalAuthState();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders the guest avatar button in the top right corner and navigates to the login page", async () => {
    await renderRouter("src/app", { initialUrl: "/" });

    const avatarBtn = screen.getByTestId("user-avatar-button");
    expect(avatarBtn).toBeTruthy();
    expect(screen.getByText("Log In")).toBeTruthy();

    await fireEvent.press(avatarBtn);

    await waitFor(() => {
      expect(screen.getByTestId("login-screen")).toBeTruthy();
    });
    expect(screen.getByTestId("login-email-input")).toBeTruthy();
    expect(screen.getByTestId("login-password-input")).toBeTruthy();
    expect(screen.getByText("Haven't made an account yet? Click")).toBeTruthy();
    expect(screen.getByText("HERE!")).toBeTruthy();
  });

  it("navigates between Login and Sign Up via 'Click HERE!' links", async () => {
    await renderRouter("src/app", { initialUrl: "/login" });

    await waitFor(() => {
      expect(screen.getByTestId("login-screen")).toBeTruthy();
    });

    // Tap HERE! to go to signup page
    await fireEvent.press(screen.getByTestId("login-signup-link"));
    await waitFor(() => {
      expect(screen.getByTestId("signup-screen")).toBeTruthy();
    });
    expect(screen.getByTestId("signup-display-name-input")).toBeTruthy();
    expect(screen.getByText("Already have an account? Click")).toBeTruthy();

    // Tap HERE! to return to login page
    await fireEvent.press(screen.getByTestId("signup-login-link"));
    await waitFor(() => {
      expect(screen.getByTestId("login-screen")).toBeTruthy();
    });
  });

  it("catches temporary guest favorites upon signing up, updates the avatar to user initials, and allows signing out", async () => {
    // 1. Start as guest on landing page and bookmark a favorite
    await renderRouter("src/app", { initialUrl: "/" });

    await fireEvent.press(screen.getByTestId("favorites-menu-toggle"));
    await fireEvent.press(screen.getByTestId("quick-add-poi:Restrooms"));
    expect(screen.getByTestId("favorite-item-poi:Restrooms")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("favorites-collapse-button"));

    // 2. Open login page from top-right avatar button
    await fireEvent.press(screen.getByTestId("user-avatar-button"));
    await waitFor(() => {
      expect(screen.getByTestId("login-screen")).toBeTruthy();
    });

    // 3. Switch to signup page via HERE! link
    await fireEvent.press(screen.getByTestId("login-signup-link"));
    await waitFor(() => {
      expect(screen.getByTestId("signup-screen")).toBeTruthy();
    });

    await fireEvent.changeText(
      screen.getByTestId("signup-display-name-input"),
      "Titus Veldhouse",
    );
    await fireEvent.changeText(
      screen.getByTestId("signup-email-input"),
      "titus@calvin.edu",
    );
    await fireEvent.changeText(
      screen.getByTestId("signup-password-input"),
      "password123",
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("signup-submit-button").props.accessibilityState?.disabled,
      ).toBeFalsy();
    });

    await fireEvent.press(screen.getByTestId("signup-submit-button"));

    // 4. Returns to previous screen; avatar now displays user initials and name
    await waitFor(() => {
      expect(screen.getByTestId("user-avatar-circle")).toBeTruthy();
      expect(screen.getByText("TV")).toBeTruthy();
      expect(screen.getByText("Titus Veldhouse")).toBeTruthy();
    });

    // Favorites menu still holds the caught favorite, now synced to account
    await fireEvent.press(screen.getByTestId("favorites-menu-toggle"));
    expect(screen.getByTestId("favorite-item-poi:Restrooms")).toBeTruthy();
    expect(screen.getByText("Account Synced · Titus Veldhouse")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("favorites-collapse-button"));

    // 5. Tap avatar to open dedicated Account Profile screen
    await fireEvent.press(screen.getByTestId("user-avatar-button"));
    await waitFor(() => {
      expect(screen.getByTestId("account-screen")).toBeTruthy();
    });
    expect(screen.getByTestId("account-display-name")).toHaveTextContent(
      "Titus Veldhouse",
    );
    expect(screen.getByTestId("account-email")).toHaveTextContent(
      "titus@calvin.edu",
    );
    expect(screen.getByTestId("account-sync-badge")).toHaveTextContent(
      "● Account Synced",
    );

    // 6. Sign out -> returns to guest mode with guest button and cleared temporary list
    await fireEvent.press(screen.getByTestId("account-sign-out-button"));

    await waitFor(() => {
      expect(screen.getByTestId("user-avatar-button")).toBeTruthy();
      expect(screen.getByText("Log In")).toBeTruthy();
    });

    expect(getFavoritesStorageAdapter().mode).toBe("local-temp");
    await fireEvent.press(screen.getByTestId("favorites-menu-toggle"));
    expect(screen.getByTestId("favorites-empty-state")).toBeTruthy();
    expect(screen.getByText("Temporary Local List")).toBeTruthy();
  });

  it("stores guest favorites strictly locally without server storage", () => {
    const storage = getFavoritesStorageAdapter();
    expect(storage.mode).toBe("local-temp");

    const sample = {
      ...buildPoiFilterFavorite("Printers"),
      createdAt: new Date().toISOString(),
    };
    storage.save([sample]);

    expect(storage.load()).toHaveLength(1);
    expect(storage.load()[0].id).toBe("poi:Printers");

    // Clearing expires/resets local session
    storage.clear();
    expect(storage.load()).toHaveLength(0);
  });
});
