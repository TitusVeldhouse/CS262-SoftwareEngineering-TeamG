import {
  ApiError,
  addAccountFavorite,
  clearAccountFavorites,
  fetchAccountFavorites,
  getApiBaseUrl,
  loginAccount,
  registerAccount,
  removeAccountFavorite,
  syncAccountFavorites,
  type AccountFavoritesResponse,
  type DomainFavoriteRow,
} from "../services/api";
import {
  buildBuildingFavorite,
  buildFloorFavorite,
  buildPoiFilterFavorite,
  buildRoomFavorite,
  createAccountFavoritesStorage,
  createLocalTemporaryFavoritesStorage,
  type FavoritePlace,
} from "../data/favorites";

describe("Web-Side Favorites Sync & Import (Standalone Unit Tests)", () => {
  const originalFetch = global.fetch;
  const originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;

  const mockStorageMap = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => mockStorageMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mockStorageMap.set(key, String(value));
    },
    removeItem: (key: string) => {
      mockStorageMap.delete(key);
    },
    clear: () => {
      mockStorageMap.clear();
    },
  } as Storage;

  beforeEach(() => {
    global.fetch = jest.fn();
    mockStorageMap.clear();
    (globalThis as { localStorage?: Storage }).localStorage = mockLocalStorage;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    (globalThis as { localStorage?: Storage }).localStorage = originalLocalStorage;
  });

  describe("Sending Favorites Lists from Web Client", () => {
    it("serializes and sends a full favorites list via PUT /api/v1/favorites with Bearer auth", async () => {
      const sampleList: FavoritePlace[] = [
        {
          ...buildBuildingFavorite("Hekman Library", "Hekman Library"),
          createdAt: "2026-11-12T12:00:00.000Z",
        },
        {
          ...buildFloorFavorite("Science Building", "Level 1", "Science Building"),
          createdAt: "2026-11-12T12:01:00.000Z",
        },
        {
          ...buildPoiFilterFavorite("Printers"),
          createdAt: "2026-11-12T12:02:00.000Z",
        },
      ];

      const mockResponse: AccountFavoritesResponse = {
        favorites: sampleList,
        rows: [
          {
            id: 1,
            user_id: "user-123",
            building_id: 2,
            room_id: null,
            poi_id: null,
            floor_label: null,
            created_at: "2026-11-12T12:00:00.000Z",
          },
          {
            id: 2,
            user_id: "user-123",
            building_id: 1,
            room_id: null,
            poi_id: null,
            floor_label: "Level 1",
            created_at: "2026-11-12T12:01:00.000Z",
          },
          {
            id: 3,
            user_id: "user-123",
            building_id: null,
            room_id: null,
            poi_id: 6,
            floor_label: null,
            created_at: "2026-11-12T12:02:00.000Z",
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await syncAccountFavorites("test-token-xyz", sampleList);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(`${getApiBaseUrl()}/favorites`);
      expect(requestInit.method).toBe("PUT");
      expect(requestInit.headers).toEqual({
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer test-token-xyz",
      });

      const sentBody = JSON.parse(requestInit.body);
      expect(sentBody).toEqual({ favorites: sampleList });
      expect(result.favorites).toHaveLength(3);
      expect(result.rows).toHaveLength(3);
    });

    it("sends merge: true flag when requesting server merge mode", async () => {
      const incomingList = [
        {
          ...buildPoiFilterFavorite("Water Fountains"),
          createdAt: "2026-11-12T12:00:00.000Z",
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ favorites: incomingList, rows: [] }),
      });

      await syncAccountFavorites("token-abc", incomingList, { merge: true });

      const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
      const parsedBody = JSON.parse(requestInit.body);
      expect(parsedBody.merge).toBe(true);
      expect(parsedBody.favorites).toEqual(incomingList);
    });

    it("sends empty list to reset/clear favorites on server", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ favorites: [], rows: [] }),
      });

      const result = await syncAccountFavorites("token-abc", []);
      expect(result.favorites).toEqual([]);
      expect(result.rows).toEqual([]);

      const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse(requestInit.body)).toEqual({ favorites: [] });
    });

    it("sends single favorite addition via POST /api/v1/favorites", async () => {
      const newFav = buildPoiFilterFavorite("Restrooms");
      const mockReturn = {
        row: {
          id: 10,
          user_id: "user-1",
          building_id: null,
          room_id: null,
          poi_id: 5,
          floor_label: null,
          created_at: "2026-11-12T12:00:00.000Z",
        },
        favorite: { ...newFav, createdAt: "2026-11-12T12:00:00.000Z" },
        favorites: [{ ...newFav, createdAt: "2026-11-12T12:00:00.000Z" }],
        rows: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () => JSON.stringify(mockReturn),
      });

      const res = await addAccountFavorite("token-123", newFav);

      expect(global.fetch).toHaveBeenCalledWith(
        `${getApiBaseUrl()}/favorites`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token-123",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(newFav),
        }),
      );
      expect(res.favorite.id).toBe("poi:Restrooms");
      expect(res.row.poi_id).toBe(5);
    });

    it("URL-encodes favorite identifiers when sending DELETE requests", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ favorites: [], rows: [] }),
      });

      await removeAccountFavorite("tok", "poi:Water Fountains");

      expect(global.fetch).toHaveBeenCalledWith(
        `${getApiBaseUrl()}/favorites/poi%3AWater%20Fountains`,
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Authorization: "Bearer tok",
          }),
        }),
      );
    });

    it("sends DELETE /api/v1/favorites to clear user account favorites", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ favorites: [], rows: [] }),
      });

      await clearAccountFavorites("tok");

      expect(global.fetch).toHaveBeenCalledWith(
        `${getApiBaseUrl()}/favorites`,
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Authorization: "Bearer tok",
          }),
        }),
      );
    });
  });

  describe("Importing Server Favorites Lists into Web Client", () => {
    it("fetches and imports server favorites lists into client AccountFavoritesStorage", async () => {
      const serverPlaces: FavoritePlace[] = [
        {
          id: "building:Hiemenga Hall",
          kind: "building",
          title: "Hiemenga Hall",
          building: "Hiemenga Hall",
          campusLocation: "Hiemenga Hall",
          createdAt: "2026-11-12T10:00:00.000Z",
        },
        {
          id: "room:HH-211",
          kind: "room",
          title: "Classroom 211",
          building: "Hiemenga Hall",
          floor: "Level 2",
          roomId: "HH-211",
          roomNumber: "211",
          createdAt: "2026-11-12T10:01:00.000Z",
        },
      ];

      const serverRows: DomainFavoriteRow[] = [
        {
          id: 1,
          user_id: "user-456",
          building_id: 3,
          room_id: null,
          poi_id: null,
          floor_label: null,
          created_at: "2026-11-12T10:00:00.000Z",
        },
        {
          id: 2,
          user_id: "user-456",
          building_id: null,
          room_id: 20,
          poi_id: null,
          floor_label: null,
          created_at: "2026-11-12T10:01:00.000Z",
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ favorites: serverPlaces, rows: serverRows }),
      });

      // 1. Fetch from server
      const importedResponse = await fetchAccountFavorites("user-token-456");
      expect(importedResponse.favorites).toHaveLength(2);
      expect(importedResponse.rows).toHaveLength(2);

      // 2. Initialize web storage adapter with imported places
      const storage = createAccountFavoritesStorage({
        defaultAccountId: "user-456",
        initialFavorites: importedResponse.favorites,
      });

      expect(storage.mode).toBe("account");
      const loaded = storage.load("user-456");
      expect(loaded).toHaveLength(2);
      expect(loaded[0].id).toBe("building:Hiemenga Hall");
      expect(loaded[1].id).toBe("room:HH-211");
    });

    it("triggers onSave callback when adding or removing items in account storage mode", () => {
      const remoteSaveSpy = jest.fn();
      const remoteClearSpy = jest.fn();

      const storage = createAccountFavoritesStorage({
        defaultAccountId: "user-789",
        initialFavorites: [],
        onSave: remoteSaveSpy,
        onClear: remoteClearSpy,
      });

      const item: FavoritePlace = {
        ...buildPoiFilterFavorite("Printers"),
        createdAt: "2026-11-12T12:00:00.000Z",
      };

      storage.save([item], "user-789");
      expect(remoteSaveSpy).toHaveBeenCalledWith([item], "user-789");

      storage.clear("user-789");
      expect(remoteClearSpy).toHaveBeenCalledWith("user-789");
    });

    it("filters out malformed entries from web storage while preserving valid imported places", () => {
      const storageKey = "calvinfinder.account.favorites.v1.user-corrupt";
      const validPlace: FavoritePlace = {
        id: "poi:Restrooms",
        kind: "poi",
        title: "Restrooms",
        createdAt: "2026-11-12T12:00:00.000Z",
      };

      const malformedPayload = [
        validPlace,
        { invalid: true }, // missing id and title
        null,
        "not-an-object",
        { id: "building:Bad", kind: "invalid-kind", title: "Bad", createdAt: "" },
      ];

      mockLocalStorage.setItem(storageKey, JSON.stringify(malformedPayload));

      const storage = createAccountFavoritesStorage({
        defaultAccountId: "user-corrupt",
      });

      const loaded = storage.load("user-corrupt");
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe("poi:Restrooms");
    });
  });

  describe("Sending Guest Favorites & Importing on Login/Register", () => {
    it("sends guest favorites during login and receives imported merged account list", async () => {
      const guestFavs: FavoritePlace[] = [
        {
          ...buildRoomFavorite(
            { id: "HH-211", roomNumber: "211", name: "Classroom 211" },
            "Hiemenga Hall",
            "Level 2",
          ),
          createdAt: "2026-11-12T12:00:00.000Z",
        },
      ];

      const mergedReturn: FavoritePlace[] = [
        ...guestFavs,
        {
          ...buildBuildingFavorite("Science Building", "Science Building"),
          createdAt: "2026-11-10T10:00:00.000Z",
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            token: "new-session-tok",
            user: { id: "u-1", email: "student@calvin.edu", created_at: "" },
            profile: { id: "u-1", display_name: "Student", settings: {}, is_admin: false },
            favorites: mergedReturn,
            rows: [],
          }),
      });

      const authSession = await loginAccount({
        email: "student@calvin.edu",
        password: "password123",
        guestFavorites: guestFavs,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${getApiBaseUrl()}/auth/login`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "student@calvin.edu",
            password: "password123",
            guestFavorites: guestFavs,
          }),
        }),
      );

      expect(authSession.favorites).toHaveLength(2);
      expect(authSession.favorites.map((f) => f.id)).toEqual([
        "room:HH-211",
        "building:Science Building",
      ]);
    });

    it("sends guest favorites during register and receives imported account list", async () => {
      const guestFavs: FavoritePlace[] = [
        {
          ...buildPoiFilterFavorite("Printers"),
          createdAt: "2026-11-12T12:00:00.000Z",
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            token: "reg-tok",
            user: { id: "u-2", email: "newuser@calvin.edu", created_at: "" },
            profile: { id: "u-2", display_name: "New", settings: {}, is_admin: false },
            favorites: guestFavs,
            rows: [],
          }),
      });

      const res = await registerAccount({
        email: "newuser@calvin.edu",
        password: "password123",
        displayName: "New",
        guestFavorites: guestFavs,
      });

      expect(res.favorites).toHaveLength(1);
      expect(res.favorites[0].id).toBe("poi:Printers");
    });
  });

  describe("Error Handling & Guest Storage Isolation", () => {
    it("throws ApiError with status and message when server reports 401 or 400", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "Authentication required" }),
      });

      await expect(syncAccountFavorites("bad-token", [])).rejects.toThrow(ApiError);
      await expect(syncAccountFavorites("bad-token", [])).rejects.toMatchObject({
        status: 401,
        message: "Authentication required",
      });
    });

    it("guest storage never calls fetch or transmits data over network", () => {
      const guestStorage = createLocalTemporaryFavoritesStorage();
      expect(guestStorage.mode).toBe("local-temp");

      const item: FavoritePlace = {
        ...buildPoiFilterFavorite("Vending Machines"),
        createdAt: "2026-11-12T12:00:00.000Z",
      };

      guestStorage.save([item]);
      expect(guestStorage.load()).toHaveLength(1);
      guestStorage.clear();
      expect(guestStorage.load()).toHaveLength(0);

      // Verify zero network calls were made
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
