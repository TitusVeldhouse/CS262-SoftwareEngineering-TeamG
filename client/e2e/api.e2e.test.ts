/**
 * End-to-end tests: client API code <-> real Express server.
 *
 * Nothing is mocked. global-setup.js starts the real server (server/app.js) in
 * its own process on a free port and points EXPO_PUBLIC_API_URL at it, so
 * every call below goes through the same src/services/api.ts functions the
 * app uses, over real HTTP, and the server answers from its real data layer.
 *
 * Today the server's data layer is server/data.js (plus an in-memory account
 * store). When the server is switched to Supabase, these same tests will
 * exercise client -> server -> database without changes, as long as the seed
 * data still contains the places named here.
 *
 * Run with: npm run test:e2e   (from client/ or the repo root)
 */
import {
  addAccountFavorite,
  API_BASE_URL,
  ApiError,
  clearAccountFavorites,
  fetchAccountFavorites,
  fetchCurrentAccount,
  getBuildingById,
  getBuildings,
  getPointsOfInterest,
  loginAccount,
  logoutAccount,
  registerAccount,
  removeAccountFavorite,
  searchPlaces,
  syncAccountFavorites,
  updateAccountProfile,
} from "../src/services/api";
import {
  buildBuildingFavorite,
  buildFloorFavorite,
  buildPoiFilterFavorite,
  buildRoomFavorite,
} from "../src/data/favorites";

// Each test signs up its own account so tests never depend on each other.
let accountCounter = 0;
function newCredentials() {
  accountCounter += 1;
  return { email: `e2e-user-${accountCounter}@calvin.edu`, password: "correct-horse" };
}

async function signUp(displayName?: string) {
  const credentials = newCredentials();
  const session = await registerAccount({ ...credentials, displayName });
  return { ...credentials, ...session };
}

const classroom211 = buildRoomFavorite(
  { id: "HH-211", roomNumber: "211", name: "Classroom 211", type: "classroom" },
  "Hiemenga Hall",
  "Level 2",
);

describe("client <-> server end-to-end", () => {
  it("talks to the test server, not a hardcoded address", () => {
    expect(API_BASE_URL).toBe(process.env.EXPO_PUBLIC_API_URL);
    expect(API_BASE_URL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  describe("campus data", () => {
    it("loads the building list", async () => {
      const buildings = await getBuildings();

      expect(buildings.length).toBeGreaterThan(0);
      for (const building of buildings) {
        expect(typeof building.id).toBe("number");
        expect(typeof building.name).toBe("string");
      }
      expect(buildings.map((b) => b.name)).toEqual(
        expect.arrayContaining(["Science Building", "Hekman Library", "Hiemenga Hall"]),
      );
    });

    it("loads one building with its floors and rooms", async () => {
      const buildings = await getBuildings();
      const hiemenga = buildings.find((b) => b.name === "Hiemenga Hall");
      expect(hiemenga).toBeDefined();

      const building = await getBuildingById(hiemenga!.id);
      expect(building.name).toBe("Hiemenga Hall");
      const level2 = building.floors.find((floor) => floor.level === 2);
      expect(level2?.rooms).toEqual(expect.arrayContaining(["HH 211"]));
    });

    it("reports a missing building as a 404 ApiError", async () => {
      await expect(getBuildingById(99999)).rejects.toMatchObject({
        name: "ApiError",
        status: 404,
      });
    });

    it("loads points of interest, with and without a type filter", async () => {
      const all = await getPointsOfInterest();
      expect(all.length).toBeGreaterThan(0);

      const printers = await getPointsOfInterest("printer");
      expect(printers.length).toBeGreaterThan(0);
      expect(printers.every((poi) => poi.type === "printer")).toBe(true);
      expect(printers.length).toBeLessThanOrEqual(all.length);
    });
  });

  describe("search", () => {
    it("finds a building by name", async () => {
      const results = await searchPlaces("library");
      expect(results).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "building", name: "Hekman Library" })]),
      );
    });

    it("finds a room and says which building and floor it is on", async () => {
      const buildings = await getBuildings();
      const hiemengaId = buildings.find((b) => b.name === "Hiemenga Hall")!.id;

      const results = await searchPlaces("HH 211");
      expect(results).toEqual(
        expect.arrayContaining([
          { kind: "room", buildingId: hiemengaId, floor: 2, name: "HH 211" },
        ]),
      );
    });

    it("finds a point of interest by type", async () => {
      const results = await searchPlaces("printer");
      expect(results).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "poi", name: "Printer" })]),
      );
    });

    it("ignores letter case and surrounding spaces", async () => {
      const results = await searchPlaces("  HEKMAN  ");
      expect(results.some((r) => r.kind === "building" && r.name === "Hekman Library")).toBe(true);
    });

    it("rejects a blank search with a 400 ApiError", async () => {
      await expect(searchPlaces("   ")).rejects.toMatchObject({ name: "ApiError", status: 400 });
    });
  });

  describe("accounts", () => {
    it("signs up, then reads the account back with the token", async () => {
      const session = await signUp("E2E Tester");
      expect(session.token).toEqual(expect.any(String));
      expect(session.user.email).toBe(session.email);

      const me = await fetchCurrentAccount(session.token);
      expect(me.user.id).toBe(session.user.id);
      expect(me.profile.display_name).toBe("E2E Tester");
    });

    it("logs in with the right password and refuses the wrong one", async () => {
      const { email, password } = await signUp();

      const session = await loginAccount({ email, password });
      expect(session.user.email).toBe(email);

      await expect(loginAccount({ email, password: "wrong-password" })).rejects.toMatchObject({
        name: "ApiError",
        status: 401,
      });
    });

    it("refuses to sign up the same email twice", async () => {
      const { email, password } = await signUp();
      await expect(registerAccount({ email, password })).rejects.toBeInstanceOf(ApiError);
    });

    it("saves profile changes", async () => {
      const session = await signUp();
      const { profile } = await updateAccountProfile(session.token, {
        display_name: "Renamed",
        settings: { theme: "dark" },
      });
      expect(profile.display_name).toBe("Renamed");

      const me = await fetchCurrentAccount(session.token);
      expect(me.profile.display_name).toBe("Renamed");
      expect(me.profile.settings).toMatchObject({ theme: "dark" });
    });

    it("stops accepting the token after logout", async () => {
      const session = await signUp();
      await logoutAccount(session.token);
      await expect(fetchCurrentAccount(session.token)).rejects.toMatchObject({
        name: "ApiError",
        status: 401,
      });
    });

    it("refuses account requests without a valid token", async () => {
      await expect(fetchAccountFavorites("not-a-real-token")).rejects.toMatchObject({
        name: "ApiError",
        status: 401,
      });
    });
  });

  describe("favorites", () => {
    it("adds, lists, and removes favorites for a signed-in user", async () => {
      const session = await signUp();

      const added = await addAccountFavorite(session.token, classroom211);
      expect(added.favorite.id).toBe("room:HH-211");
      expect(added.row.room_id).toEqual(expect.any(Number));

      await addAccountFavorite(session.token, buildPoiFilterFavorite("Printers"));
      const listed = await fetchAccountFavorites(session.token);
      expect(listed.favorites.map((f) => f.id).sort()).toEqual(["poi:Printers", "room:HH-211"]);

      const afterRemove = await removeAccountFavorite(session.token, "room:HH-211");
      expect(afterRemove.favorites.map((f) => f.id)).toEqual(["poi:Printers"]);
    });

    it("keeps favorites after logging out and back in", async () => {
      const { email, password, token } = await signUp();
      await addAccountFavorite(token, buildBuildingFavorite("Hiemenga Hall"));
      await logoutAccount(token);

      const session = await loginAccount({ email, password });
      const listed = await fetchAccountFavorites(session.token);
      expect(listed.favorites.map((f) => f.id)).toContain("building:Hiemenga Hall");
    });

    it("carries guest favorites into a new account on sign-up", async () => {
      const guestFloor = {
        ...buildFloorFavorite("Hiemenga Hall", "Level 2"),
        createdAt: "2026-11-15T12:00:00.000Z",
      };
      const session = await registerAccount({ ...newCredentials(), guestFavorites: [guestFloor] });

      const listed = await fetchAccountFavorites(session.token);
      expect(listed.favorites.map((f) => f.id)).toContain("floor:Hiemenga Hall:Level 2");
    });

    it("replaces or merges the whole list with sync", async () => {
      const session = await signUp();
      await addAccountFavorite(session.token, classroom211);
      const printers = { ...buildPoiFilterFavorite("Printers"), createdAt: "2026-11-15T12:00:00.000Z" };

      const merged = await syncAccountFavorites(session.token, [printers], { merge: true });
      expect(merged.favorites.map((f) => f.id).sort()).toEqual(["poi:Printers", "room:HH-211"]);

      const replaced = await syncAccountFavorites(session.token, [printers]);
      expect(replaced.favorites.map((f) => f.id)).toEqual(["poi:Printers"]);

      const cleared = await clearAccountFavorites(session.token);
      expect(cleared.favorites).toEqual([]);
    });

    it("keeps each user's favorites private", async () => {
      const alice = await signUp();
      const bob = await signUp();
      await addAccountFavorite(alice.token, classroom211);

      const bobsList = await fetchAccountFavorites(bob.token);
      expect(bobsList.favorites).toEqual([]);

      // Bob clearing his own list must not touch Alice's.
      await clearAccountFavorites(bob.token);
      const alicesList = await fetchAccountFavorites(alice.token);
      expect(alicesList.favorites.map((f) => f.id)).toEqual(["room:HH-211"]);
    });

    it("rejects a favorite that points at nothing real", async () => {
      const session = await signUp();
      await expect(
        addAccountFavorite(session.token, {
          id: "room:NOPE-000",
          kind: "room",
          title: "Not a room",
          roomId: "NOPE-000",
        }),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });
});
