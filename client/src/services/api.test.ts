import {
  API_BASE_URL,
  ApiError,
  addAccountFavorite,
  clearAccountFavorites,
  fetchAccountFavorites,
  fetchCurrentAccount,
  getApiBaseUrl,
  getBuildingById,
  getBuildings,
  getPointsOfInterest,
  loginAccount,
  logoutAccount,
  registerAccount,
  removeAccountFavorite,
  searchPlaces,
  syncAccountFavorites,
} from "./api";
import { buildPoiFilterFavorite } from "../data/favorites";

describe("CalvinFinder API Client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Campus Catalog & Search Endpoints", () => {
    it("fetches all buildings via getBuildings()", async () => {
      const mockBuildings = [
        { id: 1, name: "Science Building", isParkingLot: false },
        { id: 2, name: "Hekman Library", isParkingLot: false },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockBuildings,
      });

      const result = await getBuildings();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/v1/buildings`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        },
      );
      expect(result).toEqual(mockBuildings);
    });

    it("fetches a building by ID via getBuildingById()", async () => {
      const mockBuilding = {
        id: 2,
        name: "Hekman Library",
        isParkingLot: false,
        floors: [{ level: 1, rooms: ["HL 101"] }],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockBuilding,
      });

      const result = await getBuildingById(2);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/v1/buildings/2`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).toEqual(mockBuilding);
    });

    it("fetches points of interest with and without type filtering", async () => {
      const mockPois = [
        { id: 1, type: "restroom", buildingId: 1, floor: 0, label: "Restroom" },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPois,
      });

      const allResult = await getPointsOfInterest();
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/v1/points-of-interest`,
        expect.anything(),
      );
      expect(allResult).toEqual(mockPois);

      await getPointsOfInterest("printer");
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/v1/points-of-interest?type=printer`,
        expect.anything(),
      );
    });

    it("searches places via searchPlaces()", async () => {
      const mockSearchResults = [
        { kind: "building", id: 2, name: "Hekman Library" },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSearchResults,
      });

      const result = await searchPlaces("library");

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/v1/search?q=library`,
        expect.anything(),
      );
      expect(result).toEqual(mockSearchResults);
    });
  });

  describe("Account & Favorites API", () => {
    it("registers an account and forwards guest favorites to be caught and stored", async () => {
      const guestItem = {
        ...buildPoiFilterFavorite("Restrooms"),
        createdAt: "2026-11-12T10:00:00.000Z",
      };

      const mockResponse = {
        token: "tok-123",
        user: {
          id: "uuid-1",
          email: "alice@calvin.edu",
          created_at: "2026-11-12T10:00:00.000Z",
        },
        profile: {
          id: "uuid-1",
          display_name: "Alice",
          settings: {},
          is_admin: false,
        },
        favorites: [guestItem],
        rows: [
          {
            id: 1,
            user_id: "uuid-1",
            building_id: null,
            room_id: null,
            poi_id: 5,
            floor_label: null,
            created_at: "2026-11-12T10:00:00.000Z",
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await registerAccount({
        email: "alice@calvin.edu",
        password: "password123",
        displayName: "Alice",
        guestFavorites: [guestItem],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${getApiBaseUrl()}/auth/register`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "alice@calvin.edu",
            password: "password123",
            displayName: "Alice",
            guestFavorites: [guestItem],
          }),
        }),
      );
      expect(result.favorites).toHaveLength(1);
      expect(result.rows[0].poi_id).toBe(5);
    });

    it("attaches Bearer token for authenticated account and favorites endpoints", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ favorites: [], rows: [] }),
      });

      await loginAccount({ email: "alice@calvin.edu", password: "password123" });
      await fetchCurrentAccount("tok-abc");
      await fetchAccountFavorites("tok-abc");
      await syncAccountFavorites("tok-abc", []);
      await addAccountFavorite("tok-abc", buildPoiFilterFavorite("Printers"));
      await removeAccountFavorite("tok-abc", "poi:Printers");
      await clearAccountFavorites("tok-abc");
      await logoutAccount("tok-abc");

      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls).toHaveLength(8);
      expect(calls[2][0]).toBe(`${getApiBaseUrl()}/favorites`);
      expect(calls[2][1].headers.Authorization).toBe("Bearer tok-abc");
      expect(calls[5][0]).toBe(`${getApiBaseUrl()}/favorites/poi%3APrinters`);
      expect(calls[5][1].method).toBe("DELETE");
    });

    it("throws ApiError with backend status and message on HTTP failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "Invalid email or password" }),
      });

      await expect(
        loginAccount({ email: "bad@calvin.edu", password: "wrong" }),
      ).rejects.toMatchObject({
        name: "ApiError",
        status: 401,
        message: "Invalid email or password",
      });

      await expect(fetchAccountFavorites("expired")).rejects.toBeInstanceOf(
        ApiError,
      );
    });

    it("supports both ApiError constructor signatures", () => {
      const err1 = new ApiError(404, "Not Found");
      expect(err1.status).toBe(404);
      expect(err1.message).toBe("Not Found");

      const err2 = new ApiError("Forbidden", 403);
      expect(err2.status).toBe(403);
      expect(err2.message).toBe("Forbidden");
    });
  });
});
