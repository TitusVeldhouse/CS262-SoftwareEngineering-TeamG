import type { FavoritePlace, NewFavoritePlace } from "../data/favorites";

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

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getApiBaseUrl(): string {
  const configured =
    typeof process !== "undefined" && process.env
      ? process.env.EXPO_PUBLIC_API_URL
      : undefined;
  if (configured && configured.trim().length > 0) {
    return configured.trim().replace(/\/+$/, "");
  }
  return "http://localhost:3000/api/v1";
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
