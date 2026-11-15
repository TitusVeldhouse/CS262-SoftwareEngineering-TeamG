/**
 * API base URL configuration
 *
 * Every request to the Express server builds its URL from API_BASE_URL in this
 * file, so this is the one place that decides where "the server" is.
 *
 * Why this is needed: "localhost" always means "this device". In a web browser
 * on your laptop, localhost is your laptop, so http://localhost:3000 reaches
 * the server. On a phone or emulator, localhost is the phone itself, where no
 * server is running, so the app has to use your laptop's network address.
 *
 * The URL is chosen in this order (the first rule that applies wins):
 *   1. EXPO_PUBLIC_API_URL, if it is set (in client/.env). Use this for a
 *      phone hotspot, a tunnel such as ngrok, or a deployed server.
 *   2. Web: the host the page was loaded from (normally localhost), port 3000.
 *   3. Phone / emulator: the laptop address that Expo Go already used to
 *      download the app (Constants.expoConfig.hostUri, e.g. 192.168.1.20:8081),
 *      with the port swapped for the API port.
 *   4. Fallback: 10.0.2.2 on Android (the emulator's name for your laptop) or
 *      localhost on iOS (the iOS simulator shares your laptop's network).
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

// Expo replaces process.env.EXPO_PUBLIC_* with the real value when it bundles
// the app. It only does this when the name is written out in full like
// process.env.EXPO_PUBLIC_API_URL (no optional chaining, no destructuring).
declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
  };
};

/** Port the Express server listens on (see server/index.js). */
export const API_PORT = 3000;

/** The Android emulator's built-in address for the computer running it. */
const ANDROID_EMULATOR_HOST = "10.0.2.2";

export type ApiUrlSource =
  | "env"
  | "web"
  | "expo-host"
  | "android-emulator-fallback"
  | "localhost-fallback";

export type ResolvedApiUrl = {
  /** Base URL without a trailing slash and without /api/v1, e.g. http://192.168.1.20:3000 */
  url: string;
  /** Which rule above produced the URL (shown in the dev log to help debugging). */
  source: ApiUrlSource;
  /** Set when the URL is probably wrong and the developer should do something. */
  warning?: string;
};

export type ApiUrlInputs = {
  envUrl?: string | null;
  platformOs: string;
  /** Metro host that Expo Go connected to, e.g. "192.168.1.20:8081". */
  hostUri?: string | null;
  /** Hostname of the web page, e.g. "localhost" (web only). */
  webHostname?: string | null;
};

/** Removes trailing slashes and a trailing /api/v1 so paths can be appended. */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").replace(/\/api\/v1$/, "");
}

/**
 * Pulls the hostname out of Expo's hostUri ("192.168.1.20:8081" -> "192.168.1.20").
 * Returns null when there is nothing usable.
 */
export function hostFromHostUri(hostUri: string | null | undefined): string | null {
  if (!hostUri) return null;
  const withoutScheme = hostUri.replace(/^[a-z]+:\/\//i, "");
  const host = withoutScheme.split("/")[0].split(":")[0];
  return host.length > 0 ? host : null;
}

/** True for addresses on your own network: 192.168.x.x, 10.x.x.x, laptop.local, and so on. */
function isLanHost(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.endsWith(".local");
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Picks the API base URL from the inputs. Kept free of Expo imports so it can
 * be unit tested with any combination of platform and host.
 */
export function resolveApiBaseUrl({
  envUrl,
  platformOs,
  hostUri,
  webHostname,
}: ApiUrlInputs): ResolvedApiUrl {
  // 1. An explicit override always wins.
  if (envUrl && envUrl.trim().length > 0) {
    return { url: normalizeBaseUrl(envUrl), source: "env" };
  }

  // 2. Web: the browser can reach the server on the machine that served the page.
  if (platformOs === "web") {
    return { url: `http://${webHostname || "localhost"}:${API_PORT}`, source: "web" };
  }

  const fallback: ResolvedApiUrl =
    platformOs === "android"
      ? { url: `http://${ANDROID_EMULATOR_HOST}:${API_PORT}`, source: "android-emulator-fallback" }
      : { url: `http://localhost:${API_PORT}`, source: "localhost-fallback" };

  const host = hostFromHostUri(hostUri);

  // Expo reports localhost when Metro runs with --localhost. That works for the
  // iOS simulator, and the Android emulator needs 10.0.2.2 instead. (Checked
  // before the LAN rule because 127.0.0.1 also looks like a network address.)
  if (host && isLoopbackHost(host)) {
    return fallback;
  }

  // 3. Phone or emulator: reuse the laptop address Expo Go is already talking to.
  if (host && isLanHost(host)) {
    return { url: `http://${host}:${API_PORT}`, source: "expo-host" };
  }

  // Any other host means a tunnel (expo start --tunnel gives *.exp.direct),
  // which carries the app bundle but not our API, so the laptop address is unknown.
  if (host) {
    return {
      ...fallback,
      warning:
        `Expo is connected through "${host}" (tunnel mode), so the server address ` +
        "cannot be detected. Set EXPO_PUBLIC_API_URL in client/.env.",
    };
  }

  // 4. No Expo host at all (for example a standalone build without the override).
  return {
    ...fallback,
    warning: "No Expo host was found. Set EXPO_PUBLIC_API_URL in client/.env.",
  };
}

function readWebHostname(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  return window.location.hostname || null;
}

const resolved = resolveApiBaseUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  platformOs: Platform.OS,
  hostUri: Constants.expoConfig?.hostUri,
  webHostname: Platform.OS === "web" ? readWebHostname() : null,
});

/** Base URL of the Express server, e.g. http://192.168.1.20:3000 (no /api/v1). */
export const API_BASE_URL = resolved.url;

/** Base URL including the version prefix, e.g. http://192.168.1.20:3000/api/v1 */
export const API_V1_URL = `${API_BASE_URL}/api/v1`;

let hasLoggedApiUrl = false;

/**
 * In development, prints which server address the app will use, once per app
 * start. If the phone shows "Can't reach server", compare this with the
 * address printed by the server.
 */
export function logApiBaseUrlOnce(): void {
  if (!__DEV__ || hasLoggedApiUrl) return;
  hasLoggedApiUrl = true;
  console.log(`[api] Using server at ${API_BASE_URL} (${resolved.source})`);
  if (resolved.warning) {
    console.warn(`[api] ${resolved.warning}`);
  }
}
