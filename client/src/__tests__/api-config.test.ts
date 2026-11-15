import {
  API_PORT,
  hostFromHostUri,
  normalizeBaseUrl,
  resolveApiBaseUrl,
} from "../config/api";

describe("API base URL resolution", () => {
  it("uses EXPO_PUBLIC_API_URL first, on every platform", () => {
    for (const platformOs of ["web", "ios", "android"]) {
      expect(
        resolveApiBaseUrl({
          envUrl: "https://abc123.ngrok-free.app/",
          platformOs,
          hostUri: "192.168.1.20:8081",
        }),
      ).toEqual({ url: "https://abc123.ngrok-free.app", source: "env" });
    }
  });

  it("ignores a blank EXPO_PUBLIC_API_URL", () => {
    expect(
      resolveApiBaseUrl({ envUrl: "   ", platformOs: "ios", hostUri: "192.168.1.20:8081" }).source,
    ).toBe("expo-host");
  });

  it("uses the page's host on web", () => {
    expect(resolveApiBaseUrl({ platformOs: "web", webHostname: "localhost" })).toEqual({
      url: `http://localhost:${API_PORT}`,
      source: "web",
    });
    expect(resolveApiBaseUrl({ platformOs: "web" }).url).toBe(`http://localhost:${API_PORT}`);
  });

  it("reuses the laptop address Expo Go connected to, with the API port", () => {
    expect(resolveApiBaseUrl({ platformOs: "ios", hostUri: "192.168.1.20:8081" })).toEqual({
      url: `http://192.168.1.20:${API_PORT}`,
      source: "expo-host",
    });
    expect(resolveApiBaseUrl({ platformOs: "android", hostUri: "10.0.0.5:8081" }).url).toBe(
      `http://10.0.0.5:${API_PORT}`,
    );
    expect(resolveApiBaseUrl({ platformOs: "ios", hostUri: "my-laptop.local:8081" }).url).toBe(
      `http://my-laptop.local:${API_PORT}`,
    );
  });

  it("maps localhost to 10.0.2.2 on the Android emulator and keeps it on iOS", () => {
    expect(resolveApiBaseUrl({ platformOs: "android", hostUri: "localhost:8081" })).toEqual({
      url: `http://10.0.2.2:${API_PORT}`,
      source: "android-emulator-fallback",
    });
    expect(resolveApiBaseUrl({ platformOs: "ios", hostUri: "127.0.0.1:8081" })).toEqual({
      url: `http://localhost:${API_PORT}`,
      source: "localhost-fallback",
    });
  });

  it("warns in tunnel mode, where the laptop address cannot be detected", () => {
    const result = resolveApiBaseUrl({
      platformOs: "ios",
      hostUri: "abc-anonymous-8081.exp.direct",
    });
    expect(result.url).toBe(`http://localhost:${API_PORT}`);
    expect(result.warning).toMatch(/EXPO_PUBLIC_API_URL/);
  });

  it("falls back with a warning when there is no Expo host", () => {
    const result = resolveApiBaseUrl({ platformOs: "android", hostUri: null });
    expect(result.url).toBe(`http://10.0.2.2:${API_PORT}`);
    expect(result.warning).toMatch(/EXPO_PUBLIC_API_URL/);
  });

  it("normalizes URLs and parses Expo host strings", () => {
    expect(normalizeBaseUrl(" http://example.com/api/v1/ ")).toBe("http://example.com");
    expect(hostFromHostUri("exp://192.168.1.20:8081/--/path")).toBe("192.168.1.20");
    expect(hostFromHostUri("")).toBeNull();
  });
});
