// Referential layout file mapping Calvin University rooms in a hierarchy:
// Campus -> Building -> Floor -> Room
//
// This enables route planning between any two rooms by backtracking upwards:
// 1. Same floor: plot directly on the shared floor plan.
// 2. Different floors, same building: backtrack to the building level (stairs / elevator).
// 3. Different buildings: backtrack all the way up to the Campus Master Plan (outdoor walkways).

import { FLOOR_PLANS } from "./floorplan-manifest";
import { CAMPUS_TO_MANIFEST_BUILDINGS } from "../app/finder";

export type MapPoint = readonly [number, number];

export type RoomType =
  | "classroom"
  | "lecture_hall"
  | "lab"
  | "office"
  | "auditorium"
  | "study"
  | "dining"
  | "restroom"
  | "facility"
  | "lounge";

export type Room = {
  /** Unique room identifier across campus e.g. "HH-211" */
  id: string;
  /** Room number or short identifier e.g. "211" */
  roomNumber: string;
  /** Human-readable room title or landmark e.g. "Student Academic Services" */
  name?: string;
  /** Room classification */
  type?: RoomType;
  /** Pixel coordinates [x, y] on source floor plan image */
  coordinates?: MapPoint;
  /** Alternate aliases or search tags e.g. ["SAS", "Academic Advising"] */
  aliases?: readonly string[];
};

export type FloorLayout = {
  label: string;
  asset: number;
  width: number;
  height: number;
  /** Rooms on this floor, keyed by room id */
  rooms: Record<string, Room>;
};

export type BuildingLayout = {
  name: string;
  campusLocationName?: string;
  /** Floors in this building, keyed by floor label e.g. "Level 2" */
  floors: Record<string, FloorLayout>;
};

export type CampusLayout = {
  buildings: Record<string, BuildingLayout>;
};

export type SharedMapScope = "same_room" | "floor" | "building" | "campus";

export type SharedMapResolution = {
  scope: SharedMapScope;
  sharedMapTitle: string;
  buildingFrom: string;
  floorFrom: string;
  roomFrom: Room;
  buildingTo: string;
  floorTo: string;
  roomTo: Room;
  routeSummary: string;
  backtrackSteps: string[];
};

export type RoomHierarchyLocation = {
  room: Room;
  floor: FloorLayout;
  building: BuildingLayout;
};

// Reverse lookup map from manifest building name to finder location name
const MANIFEST_TO_CAMPUS_NAME: Record<string, string> = {};
for (const [campusName, manifestName] of Object.entries(CAMPUS_TO_MANIFEST_BUILDINGS)) {
  MANIFEST_TO_CAMPUS_NAME[manifestName] = campusName;
}

// Initial catalog of known rooms across Calvin buildings
const PRELOADED_ROOMS: Array<{
  building: string;
  floor: string;
  room: Room;
}> = [
  // Hiemenga Hall
  {
    building: "Hiemenga Hall",
    floor: "Level 2",
    room: {
      id: "HH-211",
      roomNumber: "211",
      name: "Classroom 211",
      type: "classroom",
      coordinates: [450, 380],
    },
  },
  {
    building: "Hiemenga Hall",
    floor: "Level 2",
    room: {
      id: "HH-213",
      roomNumber: "213",
      name: "Classroom 213",
      type: "classroom",
      coordinates: [520, 380],
    },
  },
  {
    building: "Hiemenga Hall",
    floor: "Level 2",
    room: {
      id: "HH-221",
      roomNumber: "221",
      name: "Classroom 221",
      type: "classroom",
      coordinates: [680, 410],
    },
  },
  {
    building: "Hiemenga Hall",
    floor: "Level 2",
    room: {
      id: "HH-SAS",
      roomNumber: "230",
      name: "Student Academic Services",
      type: "office",
      aliases: ["SAS", "Academic Advising"],
      coordinates: [310, 480],
    },
  },
  {
    building: "Hiemenga Hall",
    floor: "Level 2",
    room: {
      id: "HH-ISD",
      roomNumber: "235",
      name: "Intercultural Student Development",
      type: "office",
      aliases: ["ISD"],
      coordinates: [380, 480],
    },
  },
  {
    building: "Hiemenga Hall",
    floor: "Level 3",
    room: {
      id: "HH-311",
      roomNumber: "311",
      name: "Classroom 311",
      type: "classroom",
      coordinates: [450, 380],
    },
  },
  {
    building: "Hiemenga Hall",
    floor: "Level 3",
    room: {
      id: "HH-323",
      roomNumber: "323",
      name: "Seminar Room 323",
      type: "classroom",
      coordinates: [580, 390],
    },
  },
  {
    building: "Hiemenga Hall",
    floor: "Level 4",
    room: {
      id: "HH-411",
      roomNumber: "411",
      name: "History Department Office",
      type: "office",
      coordinates: [460, 390],
    },
  },

  // Science Building
  {
    building: "Science Building",
    floor: "Level 0",
    room: {
      id: "SB-010",
      roomNumber: "010",
      name: "Physics Lab 010",
      type: "lab",
      coordinates: [300, 420],
    },
  },
  {
    building: "Science Building",
    floor: "Level 1",
    room: {
      id: "SB-110",
      roomNumber: "110",
      name: "Science Lecture Hall 110",
      type: "lecture_hall",
      aliases: ["SB Aud", "Science Auditorium"],
      coordinates: [520, 440],
    },
  },
  {
    building: "Science Building",
    floor: "Level 1",
    room: {
      id: "SB-120",
      roomNumber: "120",
      name: "Chemistry Lab 120",
      type: "lab",
      coordinates: [610, 440],
    },
  },

  // Devos Communication Center
  {
    building: "Devos Communication Center",
    floor: "Level 0",
    room: {
      id: "DCC-010",
      roomNumber: "010",
      name: "TV Production Studio",
      type: "lab",
      aliases: ["Studio", "Control Room"],
      coordinates: [400, 350],
    },
  },
  {
    building: "Devos Communication Center",
    floor: "Level 1",
    room: {
      id: "DCC-110",
      roomNumber: "110",
      name: "Speech & Media Classroom 110",
      type: "classroom",
      coordinates: [450, 410],
    },
  },
  {
    building: "Devos Communication Center",
    floor: "Level 2",
    room: {
      id: "DCC-210",
      roomNumber: "210",
      name: "Communication Department Office",
      type: "office",
      coordinates: [480, 430],
    },
  },

  // Hekman Library
  {
    building: "Hekman Library",
    floor: "Level 1",
    room: {
      id: "HEK-CIRC",
      roomNumber: "101",
      name: "Circulation Desk",
      type: "facility",
      aliases: ["Front Desk", "Library Help"],
      coordinates: [500, 400],
    },
  },
  {
    building: "Hekman Library",
    floor: "Level 1",
    room: {
      id: "HEK-CAFE",
      roomNumber: "105",
      name: "Peet's Coffee & Study Lounge",
      type: "dining",
      aliases: ["Coffee", "Cafe"],
      coordinates: [350, 420],
    },
  },
  {
    building: "Hekman Library",
    floor: "Level 2",
    room: {
      id: "HEK-201",
      roomNumber: "201",
      name: "Group Study Room 201",
      type: "study",
      coordinates: [560, 390],
    },
  },
  {
    building: "Hekman Library",
    floor: "Level 4",
    room: {
      id: "HEK-CAYVAN",
      roomNumber: "401",
      name: "Cayvan Media Center",
      type: "study",
      aliases: ["Media Library", "Audio Center"],
      coordinates: [520, 380],
    },
  },

  // Chapel
  {
    building: "Chapel",
    floor: "Level 1",
    room: {
      id: "CHP-SANCT",
      roomNumber: "100",
      name: "Sanctuary",
      type: "auditorium",
      aliases: ["Worship Center", "Main Hall"],
      coordinates: [600, 500],
    },
  },
  {
    building: "Chapel",
    floor: "Level 1",
    room: {
      id: "CHP-PRAYER",
      roomNumber: "105",
      name: "Prayer Chapel",
      type: "facility",
      coordinates: [400, 450],
    },
  },
  {
    building: "Chapel",
    floor: "Level 2",
    room: {
      id: "CHP-BALC",
      roomNumber: "200",
      name: "Chapel Balcony",
      type: "auditorium",
      coordinates: [600, 350],
    },
  },

  // Covenant Fine Arts Center
  {
    building: "Covenant Fine Arts Center",
    floor: "Level 1",
    room: {
      id: "CFAC-AUD",
      roomNumber: "100",
      name: "CFAC Auditorium",
      type: "auditorium",
      aliases: ["Performance Hall", "Main Stage"],
      coordinates: [500, 450],
    },
  },
  {
    building: "Covenant Fine Arts Center",
    floor: "Level 1",
    room: {
      id: "CFAC-RECITAL",
      roomNumber: "115",
      name: "Recital Hall",
      type: "auditorium",
      coordinates: [350, 420],
    },
  },

  // Spoelhof University Center
  {
    building: "Spoelhof University Center",
    floor: "Level 1",
    room: {
      id: "SUC-ADM",
      roomNumber: "110",
      name: "Admissions & Welcome Center",
      type: "office",
      aliases: ["Visitor Center", "Admissions"],
      coordinates: [450, 400],
    },
  },
  {
    building: "Spoelhof University Center",
    floor: "Level 1",
    room: {
      id: "SUC-REG",
      roomNumber: "120",
      name: "Registrar's Office",
      type: "office",
      coordinates: [550, 420],
    },
  },

  // Spoelhof Fieldhouse
  {
    building: "Spoelhof Fieldhouse",
    floor: "Level 1",
    room: {
      id: "SFH-ARENA",
      roomNumber: "100",
      name: "Van Noord Arena",
      type: "auditorium",
      aliases: ["Basketball Arena", "Gym"],
      coordinates: [500, 400],
    },
  },
  {
    building: "Spoelhof Fieldhouse",
    floor: "Level 1",
    room: {
      id: "SFH-POOL",
      roomNumber: "120",
      name: "Venema Aquatic Center",
      type: "facility",
      aliases: ["Pool", "Swimming Pool"],
      coordinates: [400, 450],
    },
  },

  // Commons
  {
    building: "Commons",
    floor: "Level 1",
    room: {
      id: "COM-DINING",
      roomNumber: "100",
      name: "Commons Dining Hall",
      type: "dining",
      aliases: ["Uppercrust", "Cafeteria"],
      coordinates: [480, 400],
    },
  },
  {
    building: "Commons",
    floor: "Level 1",
    room: {
      id: "COM-JOHNNY",
      roomNumber: "110",
      name: "Johnny's Cafe",
      type: "dining",
      aliases: ["Johnnys", "Snack Bar"],
      coordinates: [380, 450],
    },
  },

  // Bunker Interpretive Center
  {
    building: "Bunker Interpretive Center",
    floor: "Level 1",
    room: {
      id: "BIC-EXHIBIT",
      roomNumber: "101",
      name: "Ecosystem Exhibit Hall",
      type: "facility",
      aliases: ["Nature Center", "Preserve"],
      coordinates: [500, 380],
    },
  },
];

/**
 * Constructs the referential campus layout mapping:
 * building -> floor -> room
 */
export function buildCampusLayout(): CampusLayout {
  const layout: CampusLayout = {
    buildings: {},
  };

  // 1. Populate all buildings and floors directly from the official manifest
  for (const plan of FLOOR_PLANS) {
    if (!layout.buildings[plan.building]) {
      layout.buildings[plan.building] = {
        name: plan.building,
        campusLocationName: MANIFEST_TO_CAMPUS_NAME[plan.building],
        floors: {},
      };
    }

    if (!layout.buildings[plan.building].floors[plan.label]) {
      layout.buildings[plan.building].floors[plan.label] = {
        label: plan.label,
        asset: plan.asset,
        width: plan.width,
        height: plan.height,
        rooms: {},
      };
    }
  }

  // 2. Populate preloaded rooms into their respective floors
  for (const item of PRELOADED_ROOMS) {
    const building = layout.buildings[item.building];
    if (!building) continue;
    const floor = building.floors[item.floor];
    if (!floor) continue;

    floor.rooms[item.room.id] = item.room;
  }

  return layout;
}

/** Master referential layout instance holding building { floor { room } } */
export const CAMPUS_LAYOUT: CampusLayout = buildCampusLayout();

/**
 * Adds or updates a room in the campus layout hierarchy.
 */
export function addRoomToLayout(
  buildingName: string,
  floorLabel: string,
  room: Room,
): boolean {
  const building = CAMPUS_LAYOUT.buildings[buildingName];
  if (!building) return false;
  const floor = building.floors[floorLabel];
  if (!floor) return false;

  floor.rooms[room.id] = room;
  return true;
}

/**
 * Searches for a room by ID, room number, or name (case-insensitive) across all buildings and floors.
 * Returns the room along with its floor and building context.
 */
export function findRoom(query: string): RoomHierarchyLocation | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  for (const building of Object.values(CAMPUS_LAYOUT.buildings)) {
    for (const floor of Object.values(building.floors)) {
      for (const room of Object.values(floor.rooms)) {
        if (
          room.id.toLowerCase() === normalized ||
          room.roomNumber.toLowerCase() === normalized ||
          room.name?.toLowerCase() === normalized ||
          room.aliases?.some((alias) => alias.toLowerCase() === normalized)
        ) {
          return { room, floor, building };
        }
      }
    }
  }

  return null;
}

/**
 * Resolves the first shared map between two rooms by backtracking upwards through the layout hierarchy:
 * - Same floor: Direct floor plan route.
 * - Different floor, same building: Backtrack to building level (stairs / elevator transition).
 * - Different buildings: Backtrack all the way up to the Campus Master Plan.
 */
export function findFirstSharedMap(
  startRoomIdOrQuery: string,
  destRoomIdOrQuery: string,
): SharedMapResolution | null {
  const fromLoc = findRoom(startRoomIdOrQuery);
  const toLoc = findRoom(destRoomIdOrQuery);

  if (!fromLoc || !toLoc) {
    return null;
  }

  const { room: roomFrom, floor: floorFrom, building: buildingFrom } = fromLoc;
  const { room: roomTo, floor: floorTo, building: buildingTo } = toLoc;

  // 1. Same Room
  if (roomFrom.id === roomTo.id) {
    return {
      scope: "same_room",
      sharedMapTitle: `${buildingFrom.name} - ${floorFrom.label}`,
      buildingFrom: buildingFrom.name,
      floorFrom: floorFrom.label,
      roomFrom,
      buildingTo: buildingTo.name,
      floorTo: floorTo.label,
      roomTo,
      routeSummary: `You are already at ${roomFrom.name || roomFrom.roomNumber}.`,
      backtrackSteps: [],
    };
  }

  // 2. Same Floor of Same Building -> Shared Map is the Floor Plan
  if (
    buildingFrom.name === buildingTo.name &&
    floorFrom.label === floorTo.label
  ) {
    return {
      scope: "floor",
      sharedMapTitle: `${buildingFrom.name} - ${floorFrom.label}`,
      buildingFrom: buildingFrom.name,
      floorFrom: floorFrom.label,
      roomFrom,
      buildingTo: buildingTo.name,
      floorTo: floorTo.label,
      roomTo,
      routeSummary: `Direct indoor path on ${floorFrom.label} of ${buildingFrom.name}.`,
      backtrackSteps: [
        `Navigate from ${roomFrom.roomNumber} directly to ${roomTo.roomNumber} on ${floorFrom.label}`,
      ],
    };
  }

  // 3. Same Building, Different Floors -> Backtrack upwards to Building
  if (buildingFrom.name === buildingTo.name) {
    return {
      scope: "building",
      sharedMapTitle: `${buildingFrom.name} (Stairs / Elevator)`,
      buildingFrom: buildingFrom.name,
      floorFrom: floorFrom.label,
      roomFrom,
      buildingTo: buildingTo.name,
      floorTo: floorTo.label,
      roomTo,
      routeSummary: `Transition between ${floorFrom.label} and ${floorTo.label} in ${buildingFrom.name}.`,
      backtrackSteps: [
        `Exit ${roomFrom.roomNumber} on ${floorFrom.label}`,
        `Backtrack to nearest stairs or elevator in ${buildingFrom.name}`,
        `Transition between ${floorFrom.label} and ${floorTo.label}`,
        `Arrive at ${roomTo.roomNumber} on ${floorTo.label}`,
      ],
    };
  }

  // 4. Different Buildings -> Backtrack upwards to Campus Master Plan
  return {
    scope: "campus",
    sharedMapTitle: "Campus Master Plan",
    buildingFrom: buildingFrom.name,
    floorFrom: floorFrom.label,
    roomFrom,
    buildingTo: buildingTo.name,
    floorTo: floorTo.label,
    roomTo,
    routeSummary: `Outdoor campus route: exit ${buildingFrom.name}, cross campus paths, enter ${buildingTo.name}.`,
    backtrackSteps: [
      `Exit ${roomFrom.roomNumber} on ${floorFrom.label}`,
      `Backtrack down/up to ground exit of ${buildingFrom.name}`,
      `Navigate across Calvin outdoor campus paths from ${buildingFrom.name} to ${buildingTo.name}`,
      `Enter ${buildingTo.name}`,
      `Proceed to ${floorTo.label}`,
      `Arrive at ${roomTo.roomNumber}`,
    ],
  };
}

/**
 * Returns a flat array of all rooms across all buildings and floors with their hierarchy context.
 */
export function getAllRooms(): Array<
  Room & { building: string; floor: string }
> {
  const all: Array<Room & { building: string; floor: string }> = [];

  for (const building of Object.values(CAMPUS_LAYOUT.buildings)) {
    for (const floor of Object.values(building.floors)) {
      for (const room of Object.values(floor.rooms)) {
        all.push({
          ...room,
          building: building.name,
          floor: floor.label,
        });
      }
    }
  }

  return all;
}

/**
 * Returns all rooms on a specific floor of a building.
 */
export function getRoomsOnFloor(
  buildingName: string,
  floorLabel: string,
): Room[] {
  const building = CAMPUS_LAYOUT.buildings[buildingName];
  if (!building) return [];
  const floor = building.floors[floorLabel];
  if (!floor) return [];
  return Object.values(floor.rooms);
}

/**
 * Returns all rooms in a building across all floors.
 */
export function getRoomsInBuilding(buildingName: string): Room[] {
  const building = CAMPUS_LAYOUT.buildings[buildingName];
  if (!building) return [];

  const rooms: Room[] = [];
  for (const floor of Object.values(building.floors)) {
    rooms.push(...Object.values(floor.rooms));
  }
  return rooms;
}

/**
 * Returns hierarchical breadcrumb trail for a given room:
 * e.g. ["Campus Master Plan", "Hiemenga Hall", "Level 2", "Student Academic Services (230)"]
 */
export function getRoomBreadcrumbs(roomIdOrQuery: string): string[] | null {
  const loc = findRoom(roomIdOrQuery);
  if (!loc) return null;

  return [
    "Campus Master Plan",
    loc.building.name,
    loc.floor.label,
    loc.room.name
      ? `${loc.room.name} (${loc.room.roomNumber})`
      : `Room ${loc.room.roomNumber}`,
  ];
}

