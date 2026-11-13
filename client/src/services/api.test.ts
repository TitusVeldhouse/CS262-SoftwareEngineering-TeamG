import {
  ApiError,
  addAccountFavorite,
  clearAccountFavorites,
  fetchAccountFavorites,
  fetchCurrentAccount,
  getApiBaseUrl,
  loginAccount,
  logoutAccount,
  registerAccount,
  removeAccountFavorite,
  syncAccountFavorites,
} from "./api";
import { buildPoiFilterFavorite } from "../data/favorites";

describe("Account & Favorites API Client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

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
});
