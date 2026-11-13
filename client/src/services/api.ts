
/**
 * CalvinFinder API Service
 *
 * Centralizes all HTTP communication between the client
 * and the Express backend.
 */

// Type declaration for Expo public environment variables.
declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
  };
};

const DEFAULT_API_URL = "http://localhost:3000";

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL
).replace(/\/+$/, "");

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

// ---------------------------------------------
// API ERROR HANDLING
// ---------------------------------------------

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ---------------------------------------------
// GENERIC HTTP REQUEST
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
      "Check that the backend is running and the API URL is correct."
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(
        `Request failed with status ${response.status}`,
        response.status
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
      typeof data.error === "string"
    ) {
      message = data.error;
    }

    throw new ApiError(message, response.status);
  }

  return data as T;
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
export function getBuildingById(
  id: number
): Promise<ApiBuilding> {
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
  type?: string
): Promise<ApiPointOfInterest[]> {
  const query = type
    ? `?type=${encodeURIComponent(type)}`
    : "";

  return get<ApiPointOfInterest[]>(
    `/api/v1/points-of-interest${query}`
  );
}

// ---------------------------------------------
// SEARCH ENDPOINT
// ---------------------------------------------

/**
 * Searches buildings, rooms, and points of interest.
 */
export function searchPlaces(
  query: string
): Promise<SearchResult[]> {
  return get<SearchResult[]>(
    `/api/v1/search?q=${encodeURIComponent(query.trim())}`
  );
}
