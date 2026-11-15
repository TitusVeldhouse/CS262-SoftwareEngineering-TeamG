/**
 * Setup for the end-to-end tests, which run in plain Node (no React Native).
 *
 * The client's API code may import a few React Native / Expo modules to work
 * out the server address (see src/config/api.ts on the mobile-connection
 * branch). Those modules need a phone or simulator, so small stand-ins are
 * used here. They don't change which server is called: global-setup.js sets
 * EXPO_PUBLIC_API_URL, and that setting always wins.
 */

// React Native defines __DEV__ as a global; plain Node doesn't.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: null } },
}));
