import {
  CAMPUS_LAYOUT,
  findRoom,
  findFirstSharedMap,
  getAllRooms,
  getRoomsOnFloor,
  getRoomsInBuilding,
  getRoomBreadcrumbs,
  addRoomToLayout,
  type Room,
} from "../data/campus-layout";
import { FLOOR_PLANS } from "../data/floorplan-manifest";

describe("Campus Layout Referential Hierarchy - building{floor{room}}", () => {
  it("structures all buildings and floors according to the building{floor{room}} layout", () => {
    expect(CAMPUS_LAYOUT).toBeDefined();
    expect(CAMPUS_LAYOUT.buildings).toBeDefined();

    // Verify all buildings from manifest are present in layout
    const manifestBuildings = new Set(FLOOR_PLANS.map((p) => p.building));
    for (const buildingName of manifestBuildings) {
      const building = CAMPUS_LAYOUT.buildings[buildingName];
      expect(building).toBeDefined();
      expect(building.name).toBe(buildingName);
      expect(building.floors).toBeDefined();
    }
  });

  it("verifies every floor in every building has required dimension, asset, and room storage", () => {
    for (const building of Object.values(CAMPUS_LAYOUT.buildings)) {
      expect(Object.keys(building.floors).length).toBeGreaterThan(0);

      for (const floor of Object.values(building.floors)) {
        expect(floor.label).toBeTruthy();
        expect(floor.asset).toBeDefined();
        expect(floor.width).toBeGreaterThan(0);
        expect(floor.height).toBeGreaterThan(0);
        expect(typeof floor.rooms).toBe("object");
      }
    }
  });
});

describe("Campus Layout - Room Lookup & Search", () => {
  it("finds a room by unique room ID", () => {
    const result = findRoom("HH-211");
    expect(result).not.toBeNull();
    expect(result!.room.id).toBe("HH-211");
    expect(result!.building.name).toBe("Hiemenga Hall");
    expect(result!.floor.label).toBe("Level 2");
  });

  it("finds a room by room number", () => {
    const result = findRoom("211");
    expect(result).not.toBeNull();
    expect(result!.room.roomNumber).toBe("211");
    expect(result!.building.name).toBe("Hiemenga Hall");
  });

  it("finds a room by human-friendly name or landmark", () => {
    const result = findRoom("Student Academic Services");
    expect(result).not.toBeNull();
    expect(result!.room.id).toBe("HH-SAS");
    expect(result!.building.name).toBe("Hiemenga Hall");
    expect(result!.floor.label).toBe("Level 2");
  });

  it("finds a room by alias tag", () => {
    const result = findRoom("SAS");
    expect(result).not.toBeNull();
    expect(result!.room.id).toBe("HH-SAS");

    const coffeeResult = findRoom("Coffee");
    expect(coffeeResult).not.toBeNull();
    expect(coffeeResult!.building.name).toBe("Hekman Library");
  });

  it("returns null when searching for an unknown room", () => {
    expect(findRoom("NONEXISTENT-ROOM-999")).toBeNull();
    expect(findRoom("")).toBeNull();
  });
});

describe("Campus Layout - Hierarchical Backtracking to First Shared Map", () => {
  it("resolves direct indoor route when rooms share the same floor of the same building", () => {
    // Both on Hiemenga Hall Level 2
    const resolution = findFirstSharedMap("HH-211", "HH-213");

    expect(resolution).not.toBeNull();
    expect(resolution!.scope).toBe("floor");
    expect(resolution!.buildingFrom).toBe("Hiemenga Hall");
    expect(resolution!.buildingTo).toBe("Hiemenga Hall");
    expect(resolution!.floorFrom).toBe("Level 2");
    expect(resolution!.floorTo).toBe("Level 2");
    expect(resolution!.sharedMapTitle).toBe("Hiemenga Hall - Level 2");
    expect(resolution!.backtrackSteps[0]).toContain("Navigate from 211 directly to 213");
  });

  it("backtracks to building level (stairs/elevator) when rooms are on different floors of the same building", () => {
    // HH-211 is on Level 2, HH-311 is on Level 3
    const resolution = findFirstSharedMap("HH-211", "HH-311");

    expect(resolution).not.toBeNull();
    expect(resolution!.scope).toBe("building");
    expect(resolution!.buildingFrom).toBe("Hiemenga Hall");
    expect(resolution!.buildingTo).toBe("Hiemenga Hall");
    expect(resolution!.floorFrom).toBe("Level 2");
    expect(resolution!.floorTo).toBe("Level 3");
    expect(resolution!.sharedMapTitle).toContain("Stairs / Elevator");
    expect(resolution!.backtrackSteps.some((step) => step.includes("stairs or elevator"))).toBe(true);
  });

  it("backtracks all the way up to the Campus Master Plan when rooms are in different buildings", () => {
    // HH-211 is in Hiemenga Hall, SB-110 is in Science Building
    const resolution = findFirstSharedMap("HH-211", "SB-110");

    expect(resolution).not.toBeNull();
    expect(resolution!.scope).toBe("campus");
    expect(resolution!.buildingFrom).toBe("Hiemenga Hall");
    expect(resolution!.buildingTo).toBe("Science Building");
    expect(resolution!.sharedMapTitle).toBe("Campus Master Plan");
    expect(resolution!.routeSummary).toContain("Outdoor campus route");
    expect(resolution!.backtrackSteps.some((step) => step.includes("outdoor campus paths"))).toBe(true);
  });

  it("detects same room destination", () => {
    const resolution = findFirstSharedMap("HH-211", "HH-211");

    expect(resolution).not.toBeNull();
    expect(resolution!.scope).toBe("same_room");
    expect(resolution!.routeSummary).toContain("already at");
    expect(resolution!.backtrackSteps.length).toBe(0);
  });

  it("returns null if either room cannot be found", () => {
    expect(findFirstSharedMap("HH-211", "UNKNOWN-ROOM")).toBeNull();
    expect(findFirstSharedMap("UNKNOWN-ROOM", "HH-211")).toBeNull();
  });
});

describe("Campus Layout - Query and Breadcrumb Utilities", () => {
  it("retrieves all rooms in a flat list with building and floor context", () => {
    const allRooms = getAllRooms();

    expect(allRooms.length).toBeGreaterThan(0);
    for (const item of allRooms) {
      expect(item.id).toBeTruthy();
      expect(item.roomNumber).toBeTruthy();
      expect(item.building).toBeTruthy();
      expect(item.floor).toBeTruthy();
    }
  });

  it("filters rooms for a specific floor", () => {
    const rooms = getRoomsOnFloor("Hiemenga Hall", "Level 2");

    expect(rooms.length).toBeGreaterThan(0);
    const roomNumbers = rooms.map((r) => r.roomNumber);
    expect(roomNumbers).toContain("211");
    expect(roomNumbers).toContain("213");
    expect(roomNumbers).toContain("221");
  });

  it("filters all rooms across a building", () => {
    const hiemengaRooms = getRoomsInBuilding("Hiemenga Hall");

    expect(hiemengaRooms.length).toBeGreaterThanOrEqual(5);
    const ids = hiemengaRooms.map((r) => r.id);
    expect(ids).toContain("HH-211");
    expect(ids).toContain("HH-311");
    expect(ids).toContain("HH-411");
  });

  it("builds a full hierarchical breadcrumb path from Campus to Room", () => {
    const breadcrumbs = getRoomBreadcrumbs("HH-SAS");

    expect(breadcrumbs).toEqual([
      "Campus Master Plan",
      "Hiemenga Hall",
      "Level 2",
      "Student Academic Services (230)",
    ]);
  });

  it("supports dynamic addition of rooms to the layout", () => {
    const newRoom: Room = {
      id: "HH-TEST-999",
      roomNumber: "999",
      name: "Temporary Test Lab",
      type: "lab",
    };

    const added = addRoomToLayout("Hiemenga Hall", "Level 2", newRoom);
    expect(added).toBe(true);

    const lookup = findRoom("HH-TEST-999");
    expect(lookup).not.toBeNull();
    expect(lookup!.room.name).toBe("Temporary Test Lab");
  });
});

