import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  clearAccountFavorites,
  fetchAccountFavorites,
  fetchCurrentAccount,
  loginAccount,
  logoutAccount,
  registerAccount,
  syncAccountFavorites,
  type AuthSessionResponse,
  type AuthUser,
  type UserProfile,
} from "../services/api";
import {
  createAccountFavoritesStorage,
  getFavoritesStorageAdapter,
  resetLocalFavoritesStorage,
  setFavoritesStorageAdapter,
  type FavoritePlace,
} from "./favorites";
import { useFavorites } from "./favorites-context";

const SESSION_STORAGE_KEY = "calvinfinder.auth.session.v1";
const LOCAL_VAULT_STORAGE_KEY = "calvinfinder.local.accountVault.v1";

type AuthSource = "server" | "local-fallback";

type StoredSession = {
  user: AuthUser;
  profile: UserProfile;
  token: string;
  source: AuthSource;
};

type LocalAccountRecord = {
  user: AuthUser;
  profile: UserProfile;
  password: string;
  favorites: FavoritePlace[];
};

export type AuthContextValue = {
  user: AuthUser | null;
  profile: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  authSource: AuthSource | null;
  clearError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
};

const NOOP_AUTH: AuthContextValue = {
  user: null,
  profile: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  authSource: null,
  clearError: () => {},
  login: async () => false,
  register: async () => false,
  logout: async () => {},
  refreshFavorites: async () => {},
};

const AuthContext = createContext<AuthContextValue>(NOOP_AUTH);

let inMemoryLocalVault = new Map<string, LocalAccountRecord>();

function getWebStorage(): Storage | null {
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
    // Ignore storage access errors.
  }
  return null;
}

function readPersistedSession(): StoredSession | null {
  const storage = getWebStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (parsed.user?.id && parsed.profile?.id && parsed.token) {
      return {
        user: parsed.user,
        profile: parsed.profile,
        token: parsed.token,
        source: parsed.source === "local-fallback" ? "local-fallback" : "server",
      };
    }
  } catch {
    // Ignore malformed persisted session.
  }
  return null;
}

function writePersistedSession(session: StoredSession | null): void {
  const storage = getWebStorage();
  if (!storage) return;
  try {
    if (!session) {
      storage.removeItem(SESSION_STORAGE_KEY);
    } else {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage write errors.
  }
}

function loadLocalVault(): Map<string, LocalAccountRecord> {
  const storage = getWebStorage();
  if (storage) {
    try {
      const raw = storage.getItem(LOCAL_VAULT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, LocalAccountRecord>;
        if (parsed && typeof parsed === "object") {
          inMemoryLocalVault = new Map(Object.entries(parsed));
        }
      }
    } catch {
      // Ignore malformed local vault data.
    }
  }
  return inMemoryLocalVault;
}

function saveLocalVault(vault: Map<string, LocalAccountRecord>): void {
  inMemoryLocalVault = vault;
  const storage = getWebStorage();
  if (storage) {
    try {
      storage.setItem(
        LOCAL_VAULT_STORAGE_KEY,
        JSON.stringify(Object.fromEntries(vault.entries())),
      );
    } catch {
      // Ignore storage write failures.
    }
  }
}

function mergeUniqueFavorites(
  incoming: readonly FavoritePlace[],
  existing: readonly FavoritePlace[],
): FavoritePlace[] {
  const seen = new Set<string>();
  const combined: FavoritePlace[] = [];
  for (const item of [...incoming, ...existing]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    combined.push(item);
  }
  return combined;
}

function localRegister(
  email: string,
  password: string,
  displayName?: string,
  guestFavorites: readonly FavoritePlace[] = [],
): AuthSessionResponse {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new ApiError(400, "A valid email address is required");
  }
  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }
  const vault = loadLocalVault();
  if (vault.has(normalized)) {
    throw new ApiError(409, "An account with this email already exists");
  }
  const userId = `local-user-${normalized}`;
  const now = new Date().toISOString();
  const user: AuthUser = { id: userId, email: normalized, created_at: now };
  const profile: UserProfile = {
    id: userId,
    display_name: displayName?.trim() || normalized.split("@")[0] || "User",
    settings: {},
    is_admin: false,
  };
  const favorites = [...guestFavorites];
  vault.set(normalized, { user, profile, password, favorites });
  saveLocalVault(vault);
  return {
    token: `local-token:${normalized}`,
    user,
    profile,
    favorites,
    rows: [],
  };
}

function localLogin(
  email: string,
  password: string,
  guestFavorites: readonly FavoritePlace[] = [],
): AuthSessionResponse {
  const normalized = email.trim().toLowerCase();
  const vault = loadLocalVault();
  const record = vault.get(normalized);
  if (!record || record.password !== password) {
    throw new ApiError(401, "Invalid email or password");
  }
  const merged = mergeUniqueFavorites(guestFavorites, record.favorites);
  record.favorites = merged;
  saveLocalVault(vault);
  return {
    token: `local-token:${normalized}`,
    user: record.user,
    profile: record.profile,
    favorites: merged,
    rows: [],
  };
}

/**
 * Resets persisted and in-memory local auth state (intended for tests).
 */
export function resetLocalAuthState(): void {
  inMemoryLocalVault = new Map();
  writePersistedSession(null);
  const storage = getWebStorage();
  if (storage) {
    try {
      storage.removeItem(LOCAL_VAULT_STORAGE_KEY);
    } catch {
      // Ignore cleanup errors.
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { favorites, reloadFavorites } = useFavorites();
  const [session, setSession] = useState<StoredSession | null>(() =>
    readPersistedSession(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  const activateAccountStorage = useCallback(
    (
      nextSession: StoredSession,
      accountFavorites?: readonly FavoritePlace[],
    ) => {
      const { user, token, source } = nextSession;
      const adapter = createAccountFavoritesStorage({
        defaultAccountId: user.id,
        initialFavorites: accountFavorites,
        onSave: (nextFavorites) => {
          if (source === "server") {
            void syncAccountFavorites(token, nextFavorites).catch(() => {});
          } else {
            const vault = loadLocalVault();
            const record = vault.get(user.email);
            if (record) {
              record.favorites = [...nextFavorites];
              saveLocalVault(vault);
            }
          }
        },
        onClear: () => {
          if (source === "server") {
            void clearAccountFavorites(token).catch(() => {});
          } else {
            const vault = loadLocalVault();
            const record = vault.get(user.email);
            if (record) {
              record.favorites = [];
              saveLocalVault(vault);
            }
          }
        },
      });

      setFavoritesStorageAdapter(adapter);
      reloadFavorites(user.id);
    },
    [reloadFavorites],
  );

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (!session) return;

    let cancelled = false;
    (async () => {
      if (session.source === "local-fallback") {
        const vault = loadLocalVault();
        const record = vault.get(session.user.email);
        if (!cancelled) {
          activateAccountStorage(session, record?.favorites ?? []);
        }
        return;
      }

      try {
        const [me, favResponse] = await Promise.all([
          fetchCurrentAccount(session.token),
          fetchAccountFavorites(session.token),
        ]);
        if (cancelled) return;
        const refreshed: StoredSession = {
          user: me.user,
          profile: me.profile,
          token: session.token,
          source: "server",
        };
        setSession(refreshed);
        writePersistedSession(refreshed);
        activateAccountStorage(refreshed, favResponse.favorites);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          writePersistedSession(null);
          setSession(null);
          resetLocalFavoritesStorage();
          reloadFavorites(null);
        } else {
          // Preserve cached offline copy if backend is temporarily unreachable.
          activateAccountStorage(session);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, activateAccountStorage, reloadFavorites]);

  const applyAuthenticatedSession = useCallback(
    (response: AuthSessionResponse, source: AuthSource) => {
      // Clear guest temp storage before switching to account mode so temporary items
      // don't reappear unexpectedly after signing out later.
      const prevAdapter = getFavoritesStorageAdapter();
      if (prevAdapter.mode === "local-temp") {
        prevAdapter.clear();
      }

      const nextSession: StoredSession = {
        user: response.user,
        profile: response.profile,
        token: response.token,
        source,
      };
      setSession(nextSession);
      writePersistedSession(nextSession);
      activateAccountStorage(nextSession, response.favorites);
    },
    [activateAccountStorage],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      const guestFavorites =
        getFavoritesStorageAdapter().mode === "local-temp" ? [...favorites] : [];
      try {
        let response: AuthSessionResponse;
        let source: AuthSource = "server";
        try {
          response = await loginAccount({
            email,
            password,
            guestFavorites,
          });
        } catch (err) {
          if (err instanceof ApiError) {
            throw err;
          }
          source = "local-fallback";
          response = localLogin(email, password, guestFavorites);
        }

        applyAuthenticatedSession(response, source);
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to sign in";
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [favorites, applyAuthenticatedSession],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName?: string,
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      const guestFavorites =
        getFavoritesStorageAdapter().mode === "local-temp" ? [...favorites] : [];
      try {
        let response: AuthSessionResponse;
        let source: AuthSource = "server";
        try {
          response = await registerAccount({
            email,
            password,
            displayName,
            guestFavorites,
          });
        } catch (err) {
          if (err instanceof ApiError) {
            throw err;
          }
          source = "local-fallback";
          response = localRegister(email, password, displayName, guestFavorites);
        }

        applyAuthenticatedSession(response, source);
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to create account";
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [favorites, applyAuthenticatedSession],
  );

  const logout = useCallback(async (): Promise<void> => {
    const activeToken = session?.token;
    const activeSource = session?.source;
    if (activeToken && activeSource === "server") {
      await logoutAccount(activeToken).catch(() => {});
    }
    writePersistedSession(null);
    setSession(null);
    setError(null);
    resetLocalFavoritesStorage();
    reloadFavorites(null);
  }, [session, reloadFavorites]);

  const refreshFavorites = useCallback(async (): Promise<void> => {
    if (!session) return;
    if (session.source === "server") {
      try {
        const res = await fetchAccountFavorites(session.token);
        activateAccountStorage(session, res.favorites);
      } catch {
        // Keep cached account list if server request fails.
      }
      return;
    }
    const vault = loadLocalVault();
    const record = vault.get(session.user.email);
    activateAccountStorage(session, record?.favorites ?? []);
  }, [session, activateAccountStorage]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        profile: session?.profile ?? null,
        token: session?.token ?? null,
        isAuthenticated: Boolean(session?.user),
        isLoading,
        error,
        authSource: session?.source ?? null,
        clearError,
        login,
        register,
        logout,
        refreshFavorites,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
