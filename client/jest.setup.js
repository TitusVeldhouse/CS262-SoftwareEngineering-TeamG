jest.setTimeout(30000);

// Font loading depends on a native asset fetch that never resolves in the
// Jest environment, so tests would be stuck on each screen's loading state.
// Report fonts as already loaded instead.
jest.mock("@expo-google-fonts/inter", () => ({
  useFonts: () => [true],
  Inter_400Regular: "Inter_400Regular",
  Inter_500Medium: "Inter_500Medium",
  Inter_600SemiBold: "Inter_600SemiBold",
  Inter_700Bold: "Inter_700Bold",
  Inter_800ExtraBold: "Inter_800ExtraBold",
}));
