/**
 * CalvinFinder API Service
 *
 * Centralizes HTTP communication between the client and the Express backend.
 * Provides endpoints for campus catalog data (buildings, floors, points of interest, search)
 * as well as user account authentication and favorite places synchronization.
 */

import type { FavoritePlace, NewFavoritePlace } from "../data/favorites";

// Type declaration for Expo public environment variables.
declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
  };
};

const DEFAULT_API_URL = "http://localhost:3000";

export const API_BASE_URL = (
  typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
    ? process.env.EXPO_PUBLIC_API_URL
    : DEFAULT_API_URL
)
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "");

export function getApiBaseUrl(): string {
  const configured =
    typeof process !== "undefined" && process.env
      ? process.env.EXPO_PUBLIC_API_URL
      : undefined;
  if (configured && configured.trim().length > 0) {
    const trimmed = configured.trim().replace(/\/+$/, "");
    return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
  }
  return `${API_BASE_URL}/api/v1`;
}

// ---------------------------------------------
// API TYPES
// ---------------------------------------------

export type ApiFloor = {
  level: number;
  rooms: string[];
};

export type ApiBuildingSummary = {
  id: number;
  name: string;
  isParkingLot: boolean;
};

export type ApiBuilding = ApiBuildingSummary & {
  floors: ApiFloor[];
};

export type ApiPointOfInterest = {
  id: number;
  type: string;
  buildingId: number;
  floor: number;
  label: string;
};

export type BuildingSearchResult = {
  kind: "building";
  id: number;
  name: string;
};

export type RoomSearchResult = {
  kind: "room";
  buildingId: number;
  floor: number;
  name: string;
};

export type PointSearchResult = {
  kind: "poi";
  id: number;
  name: string;
};

export type SearchResult =
  | BuildingSearchResult
  | RoomSearchResult
  | PointSearchResult;

export type AuthUser = {
  id: string;
  email: string;
  created_at: string;
};

export type UserProfile = {
  id: string;
  display_name: string;
  settings: Record<string, unknown>;
  is_admin: boolean;
};

export type DomainFavoriteRow = {
  id: number;
  user_id: string;
  building_id: number | null;
  room_id: number | null;
  poi_id: number | null;
  floor_label: string | null;
  created_at: string;
};

export type AuthSessionResponse = {
  token: string;
  user: AuthUser;
  profile: UserProfile;
  favorites: FavoritePlace[];
  rows: DomainFavoriteRow[];
};

export type AccountFavoritesResponse = {
  favorites: FavoritePlace[];
  rows: DomainFavoriteRow[];
};

// ---------------------------------------------
// API ERROR HANDLING
// ---------------------------------------------

export class ApiError extends Error {
  readonly status: number;

  constructor(statusOrMessage: number | string, messageOrStatus?: string | number) {
    const message =
      typeof statusOrMessage === "string"
        ? statusOrMessage
        : typeof messageOrStatus === "string"
          ? messageOrStatus
          : "API error";
    const status =
      typeof statusOrMessage === "number"
        ? statusOrMessage
        : typeof messageOrStatus === "number"
          ? messageOrStatus
          : 500;

    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ---------------------------------------------
// GENERIC HTTP REQUEST HELPERS
// ---------------------------------------------

async function get<T>(endpoint: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    throw new Error(
      `Unable to connect to the server at ${API_BASE_URL}. ` +
        "Check that the backend is running and the API URL is correct.",
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(
        `Request failed with status ${response.status}`,
        response.status,
      );
    }

    throw new Error("The server returned an invalid JSON response.");
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
    ) {
      message = (data as { error: string }).error;
    }

    throw new ApiError(message, response.status);
  }

  return data as T;
}

async function requestJson<T>(
  path: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (
    !response ||
    typeof response.status !== "number" ||
    typeof response.text !== "function"
  ) {
    throw new Error("Network request did not return a valid HTTP response");
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as { error?: unknown }).error === "string"
        ? (parsed as { error: string }).error
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, errorMessage);
  }

  return parsed as T;
}

// ---------------------------------------------
// BUILDING ENDPOINTS
// ---------------------------------------------

/**
 * Retrieves all buildings.
 */
export function getBuildings(): Promise<ApiBuildingSummary[]> {
  return get<ApiBuildingSummary[]>("/api/v1/buildings");
}

/**
 * Retrieves one building with its floors and rooms.
 */
export function getBuildingById(id: number): Promise<ApiBuilding> {
  return get<ApiBuilding>(`/api/v1/buildings/${id}`);
}

// ---------------------------------------------
// POINTS OF INTEREST ENDPOINTS
// ---------------------------------------------

/**
 * Retrieves all points of interest.
 * Optionally filters them by type.
 */
export function getPointsOfInterest(
  type?: string,
): Promise<ApiPointOfInterest[]> {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";

  return get<ApiPointOfInterest[]>(`/api/v1/points-of-interest${query}`);
}

// ---------------------------------------------
// SEARCH ENDPOINT
// ---------------------------------------------

/**
 * Searches buildings, rooms, and points of interest.
 */
export function searchPlaces(query: string): Promise<SearchResult[]> {
  return get<SearchResult[]>(
    `/api/v1/search?q=${encodeURIComponent(query.trim())}`,
  );
}

// ---------------------------------------------
// ACCOUNT AUTH & FAVORITES ENDPOINTS
// ---------------------------------------------

export function registerAccount(params: {
  email: string;
  password: string;
  displayName?: string;
  guestFavorites?: readonly FavoritePlace[];
}): Promise<AuthSessionResponse> {
  return requestJson<AuthSessionResponse>("/auth/register", {
    method: "POST",
    body: params,
  });
}

export function loginAccount(params: {
  email: string;
  password: string;
  guestFavorites?: readonly FavoritePlace[];
}): Promise<AuthSessionResponse> {
  return requestJson<AuthSessionResponse>("/auth/login", {
    method: "POST",
    body: params,
  });
}

export function logoutAccount(token: string): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>("/auth/logout", {
    method: "POST",
    token,
  });
}

export function fetchCurrentAccount(
  token: string,
): Promise<{ user: AuthUser; profile: UserProfile }> {
  return requestJson<{ user: AuthUser; profile: UserProfile }>("/auth/me", {
    token,
  });
}

export function updateAccountProfile(
  token: string,
  updates: { display_name?: string; settings?: Record<string, unknown> },
): Promise<{ profile: UserProfile }> {
  return requestJson<{ profile: UserProfile }>("/auth/profile", {
    method: "PATCH",
    token,
    body: updates,
  });
}

export function fetchAccountFavorites(
  token: string,
): Promise<AccountFavoritesResponse> {
  return requestJson<AccountFavoritesResponse>("/favorites", {
    token,
  });
}

export function addAccountFavorite(
  token: string,
  favorite: NewFavoritePlace | FavoritePlace,
): Promise<{
  row: DomainFavoriteRow;
  favorite: FavoritePlace;
  favorites: FavoritePlace[];
  rows: DomainFavoriteRow[];
}> {
  return requestJson("/favorites", {
    method: "POST",
    token,
    body: favorite,
  });
}

export function syncAccountFavorites(
  token: string,
  favorites: readonly FavoritePlace[],
  options?: { merge?: boolean },
): Promise<AccountFavoritesResponse> {
  return requestJson<AccountFavoritesResponse>("/favorites", {
    method: "PUT",
    token,
    body: {
      favorites,
      ...(options?.merge ? { merge: true } : {}),
    },
  });
}

export function removeAccountFavorite(
  token: string,
  favoriteId: string | number,
): Promise<AccountFavoritesResponse> {
  return requestJson<AccountFavoritesResponse>(
    `/favorites/${encodeURIComponent(String(favoriteId))}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export function clearAccountFavorites(
  token: string,
): Promise<AccountFavoritesResponse> {
  return requestJson<AccountFavoritesResponse>("/favorites", {
    method: "DELETE",
    token,
  });
}
