import type { Room, RoomType } from "./campus-layout";

export type FavoritePlaceKind = "building" | "floor" | "room" | "poi";

export type FavoritesStorageMode = "local-temp" | "account";

export type FavoritePlace = {
  /** Deterministic key used for deduplication and toggle checks */
  id: string;
  kind: FavoritePlaceKind;
  title: string;
  subtitle?: string;
  /** Building name matching floorplan-manifest / room-search-data */
  building?: string;
  /** Location name matching LOCATIONS on the campus map (/finder) */
  campusLocation?: string;
  /** Floor label (e.g. "Level 2") */
  floor?: string;
  /** Room ID (e.g. "HH-211") */
  roomId?: string;
  /** Room number (e.g. "211") */
  roomNumber?: string;
  /** Campus map POI filter category (e.g. "Restrooms") */
  poiFilter?: string;
  createdAt: string;
};

export type NewFavoritePlace = Omit<FavoritePlace, "createdAt">;

/**
 * Storage contract for saved Favorites.
 * Currently backed by local temporary storage for prototyping/testing.
 * When the Account/Login feature is added, swap in an account-backed adapter
 * implementing this interface via `setFavoritesStorageAdapter`.
 */
export interface FavoritesStorageAdapter {
  readonly mode: FavoritesStorageMode;
  load(accountId?: string | null): FavoritePlace[];
  save(favorites: readonly FavoritePlace[], accountId?: string | null): void;
  clear(accountId?: string | null): void;
}

const TEMP_LOCAL_STORAGE_KEY = "calvinfinder.temp.favorites.v1";

const POI_ROOM_TYPES = new Set<RoomType>([
  "dining",
  "restroom",
  "facility",
  "lounge",
]);

function getBrowserLocalStorage(): Storage | null {
  try {
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    if (
      candidate &&
      typeof candidate.getItem === "function" &&
      typeof candidate.setItem === "function" &&
      typeof candidate.removeItem === "function"
    ) {
      return candidate;
    }
  } catch {
    // Ignore storage access errors in restricted webviews or native runtimes.
  }
  return null;
}

function isValidFavoritePlace(value: unknown): value is FavoritePlace {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FavoritePlace>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.title === "string" &&
    (candidate.kind === "building" ||
      candidate.kind === "floor" ||
      candidate.kind === "room" ||
      candidate.kind === "poi") &&
    typeof candidate.createdAt === "string"
  );
}

/**
 * Temporary local-only storage adapter for Favorites.
 * Uses an in-memory buffer synced with browser localStorage when available.
 */
export function createLocalTemporaryFavoritesStorage(): FavoritesStorageAdapter {
  let inMemoryStore: FavoritePlace[] = [];

  return {
    mode: "local-temp",
    load(): FavoritePlace[] {
      const webStorage = getBrowserLocalStorage();
      if (webStorage) {
        try {
          const raw = webStorage.getItem(TEMP_LOCAL_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              inMemoryStore = parsed.filter(isValidFavoritePlace);
              return [...inMemoryStore];
            }
          }
        } catch {
          // Fall back to in-memory buffer if persisted JSON cannot be parsed.
        }
      }
      return [...inMemoryStore];
    },
    save(favorites: readonly FavoritePlace[]): void {
      inMemoryStore = [...favorites];
      const webStorage = getBrowserLocalStorage();
      if (webStorage) {
        try {
          webStorage.setItem(TEMP_LOCAL_STORAGE_KEY, JSON.stringify(inMemoryStore));
        } catch {
          // Keep in-memory copy even if quota/security blocks webStorage writes.
        }
      }
    },
    clear(): void {
      inMemoryStore = [];
      const webStorage = getBrowserLocalStorage();
      if (webStorage) {
        try {
          webStorage.removeItem(TEMP_LOCAL_STORAGE_KEY);
        } catch {
          // Ignore removal failures.
        }
      }
    },
  };
}

let activeStorageAdapter: FavoritesStorageAdapter =
  createLocalTemporaryFavoritesStorage();

export function getFavoritesStorageAdapter(): FavoritesStorageAdapter {
  return activeStorageAdapter;
}

/**
 * Replaces the active favorites storage backend (e.g., when a user logs in).
 */
export function setFavoritesStorageAdapter(
  adapter: FavoritesStorageAdapter,
): void {
  activeStorageAdapter = adapter;
}

/**
 * Resets temporary local storage back to an empty, clean adapter (useful in tests).
 */
export function resetLocalFavoritesStorage(): void {
  activeStorageAdapter = createLocalTemporaryFavoritesStorage();
  activeStorageAdapter.clear();
}

export function buildBuildingFavorite(
  campusLocation: string,
  manifestBuilding?: string,
): NewFavoritePlace {
  return {
    id: `building:${campusLocation}`,
    kind: "building",
    title: campusLocation,
    subtitle: "Campus Building",
    campusLocation,
    building: manifestBuilding ?? campusLocation,
  };
}

export function buildFloorFavorite(
  building: string,
  floor: string,
  campusLocation?: string,
): NewFavoritePlace {
  return {
    id: `floor:${building}:${floor}`,
    kind: "floor",
    title: `${building} · ${floor}`,
    subtitle: "Building Floor Plan",
    building,
    floor,
    campusLocation,
  };
}

export function buildRoomFavorite(
  room: Room,
  building: string,
  floor: string,
  campusLocation?: string,
): NewFavoritePlace {
  const isPoiRoom = Boolean(room.type && POI_ROOM_TYPES.has(room.type));
  return {
    id: `room:${room.id}`,
    kind: isPoiRoom ? "poi" : "room",
    title: room.name ?? `Room ${room.roomNumber}`,
    subtitle: `${building} · ${floor} (${room.roomNumber})`,
    building,
    floor,
    roomId: room.id,
    roomNumber: room.roomNumber,
    campusLocation,
  };
}

export function buildPoiFilterFavorite(poiFilter: string): NewFavoritePlace {
  return {
    id: `poi:${poiFilter}`,
    kind: "poi",
    title: poiFilter,
    subtitle: "Campus Map POI Filter",
    poiFilter,
  };
}
