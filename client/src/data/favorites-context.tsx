import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getFavoritesStorageAdapter,
  type FavoritePlace,
  type FavoritesStorageMode,
  type NewFavoritePlace,
} from "./favorites";

type FavoritesContextValue = {
  favorites: FavoritePlace[];
  storageMode: FavoritesStorageMode;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  isFavorite: (id: string) => boolean;
  addFavorite: (place: NewFavoritePlace) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (place: NewFavoritePlace) => boolean;
  clearFavorites: () => void;
  reloadFavorites: (accountId?: string | null) => void;
};

const NOOP_CONTEXT: FavoritesContextValue = {
  favorites: [],
  storageMode: "local-temp",
  isDrawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
  isFavorite: () => false,
  addFavorite: () => {},
  removeFavorite: () => {},
  toggleFavorite: () => false,
  clearFavorites: () => {},
  reloadFavorites: () => {},
};

const FavoritesContext = createContext<FavoritesContextValue>(NOOP_CONTEXT);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoritePlace[]>(() =>
    getFavoritesStorageAdapter().load(),
  );
  const [storageMode, setStorageMode] = useState<FavoritesStorageMode>(
    () => getFavoritesStorageAdapter().mode,
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const accountIdRef = useRef<string | null | undefined>(undefined);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((prev) => !prev);
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.some((item) => item.id === id),
    [favorites],
  );

  const addFavorite = useCallback((place: NewFavoritePlace) => {
    setFavorites((prev) => {
      if (prev.some((item) => item.id === place.id)) {
        return prev;
      }
      const nextItem: FavoritePlace = {
        ...place,
        createdAt: new Date().toISOString(),
      };
      const next = [nextItem, ...prev];
      getFavoritesStorageAdapter().save(next, accountIdRef.current);
      return next;
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.filter((item) => item.id !== id);
      getFavoritesStorageAdapter().save(next, accountIdRef.current);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    (place: NewFavoritePlace): boolean => {
      const alreadySaved = favorites.some((item) => item.id === place.id);
      if (alreadySaved) {
        removeFavorite(place.id);
        return false;
      }
      addFavorite(place);
      return true;
    },
    [favorites, addFavorite, removeFavorite],
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    getFavoritesStorageAdapter().clear(accountIdRef.current);
  }, []);

  const reloadFavorites = useCallback((accountId?: string | null) => {
    accountIdRef.current = accountId;
    const adapter = getFavoritesStorageAdapter();
    setStorageMode(adapter.mode);
    setFavorites(adapter.load(accountId));
  }, []);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        storageMode,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        isFavorite,
        addFavorite,
        removeFavorite,
        toggleFavorite,
        clearFavorites,
        reloadFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  return useContext(FavoritesContext);
}
