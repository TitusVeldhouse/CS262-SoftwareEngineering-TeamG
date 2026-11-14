/**
 * Campus catalog aligned with the domain model in docs/initialDatabaseDesign.png
 * (buildings, floors, rooms, points_of_interest) while preserving existing API fields.
 */

const buildings = [
  {
    id: 1,
    code: 'SB',
    name: 'Science Building',
    kind: 'academic',
    aliases: [],
    campus_x: 25.7,
    campus_y: 54.6,
    isParkingLot: false,
    floors: [
      { level: 0, label: 'Level 0', rooms: ['SB 001', 'SB 002', 'SB 003'] },
      { level: 1, label: 'Level 1', rooms: ['SB 101', 'SB 102', 'SB 103'] },
      { level: 2, label: 'Level 2', rooms: ['SB 201', 'SB 202', 'SB 203'] },
      { level: 3, label: 'Level 3', rooms: ['SB 301', 'SB 302', 'SB 303'] },
    ],
  },
  {
    id: 2,
    code: 'HL',
    name: 'Hekman Library',
    kind: 'academic',
    aliases: ['Library', 'Hekman'],
    campus_x: 31.2,
    campus_y: 62.3,
    isParkingLot: false,
    floors: [
      { level: 1, label: 'Level 1', rooms: ['HL 101', 'HL 102', 'HL 103'] },
      { level: 2, label: 'Level 2', rooms: ['HL 201', 'HL 202', 'HL 203'] },
      { level: 3, label: 'Level 3', rooms: ['HL 301', 'HL 302', 'HL 303'] },
      { level: 4, label: 'Level 4', rooms: ['HL 401', 'HL 402', 'HL 403'] },
    ],
  },
  {
    id: 3,
    code: 'HH',
    name: 'Hiemenga Hall',
    kind: 'academic',
    aliases: ['Hiemenga'],
    campus_x: 28.3,
    campus_y: 64.1,
    isParkingLot: false,
    floors: [
      { level: 2, label: 'Level 2', rooms: ['HH 211', 'HH 213', 'HH 221', 'HH 230', 'HH 235'] },
      { level: 3, label: 'Level 3', rooms: ['HH 311', 'HH 323'] },
      { level: 4, label: 'Level 4', rooms: ['HH 411'] },
    ],
  },
  {
    id: 4,
    code: 'CFAC',
    name: 'Covenant Fine Arts Center',
    kind: 'academic',
    aliases: ['CFAC'],
    campus_x: 37.4,
    campus_y: 58.1,
    isParkingLot: false,
    floors: [{ level: 1, label: 'Level 1', rooms: ['CFAC 100', 'CFAC 115'] }],
  },
  {
    id: 5,
    code: 'SC',
    name: 'Spoelhof University Center',
    kind: 'student_life',
    aliases: ['Spoelhof Center', 'SUC'],
    campus_x: 24.2,
    campus_y: 63.3,
    isParkingLot: false,
    floors: [{ level: 1, label: 'Level 1', rooms: ['SUC 110', 'SUC 120'] }],
  },
  {
    id: 6,
    code: 'SFH',
    name: 'Spoelhof Fieldhouse',
    kind: 'athletic',
    aliases: ['Fieldhouse', 'SFH'],
    campus_x: 23.8,
    campus_y: 39.7,
    isParkingLot: false,
    floors: [{ level: 1, label: 'Level 1', rooms: ['SFH 100', 'SFH 120'] }],
  },
  {
    id: 7,
    code: 'DC',
    name: 'Devos Communication Center',
    kind: 'academic',
    aliases: ['Devos Communication Building', 'DCC'],
    campus_x: 46.6,
    campus_y: 61.8,
    isParkingLot: false,
    floors: [
      { level: 0, label: 'Level 0', rooms: ['DCC 010'] },
      { level: 1, label: 'Level 1', rooms: ['DCC 110'] },
      { level: 2, label: 'Level 2', rooms: ['DCC 210'] },
    ],
  },
  {
    id: 8,
    code: 'DH',
    name: 'Devries Hall',
    kind: 'academic',
    aliases: ['DeVries Hall'],
    campus_x: 23.5,
    campus_y: 55.0,
    isParkingLot: false,
    floors: [{ level: 1, label: 'Level 1', rooms: [] }],
  },
  {
    id: 9,
    code: 'NH',
    name: 'North Hall',
    kind: 'academic',
    aliases: [],
    campus_x: 26.6,
    campus_y: 51.8,
    isParkingLot: false,
    floors: [{ level: 1, label: 'Level 1', rooms: [] }],
  },
  {
    id: 10,
    code: 'CH',
    name: 'Chapel',
    kind: 'chapel',
    aliases: ['Loft', 'Calvin Chapel'],
    campus_x: 27.4,
    campus_y: 66.5,
    isParkingLot: false,
    floors: [
      { level: 1, label: 'Level 1', rooms: ['CHP 100', 'CHP 105'] },
      { level: 2, label: 'Level 2', rooms: ['CHP 200'] },
    ],
  },
  {
    id: 11,
    code: 'CA',
    name: 'Commons Annex',
    kind: 'student_life',
    aliases: [],
    campus_x: 32.5,
    campus_y: 58.7,
    isParkingLot: false,
    floors: [{ level: 1, label: 'Level 1', rooms: [] }],
  },
  {
    id: 12,
    code: 'CM',
    name: 'Commons',
    kind: 'dining',
    aliases: ['Commons Dining'],
    campus_x: 32.8,
    campus_y: 56.5,
    isParkingLot: false,
    floors: [{ level: 1, label: 'Level 1', rooms: ['COM 100', 'COM 110'] }],
  },
  {
    id: 13,
    code: 'BIC',
    name: 'Bunker Interpretive Center',
    kind: 'academic',
    aliases: ['Bunker'],
    campus_x: null,
    campus_y: null,
    isParkingLot: false,
    floors: [{ level: 1, label: 'Level 1', rooms: ['BIC 101'] }],
  },
];

// Normalized floors table derived from buildings.
const floorsTable = [];
let nextFloorId = 1;
const floorLookup = new Map();

for (const building of buildings) {
  for (const floor of building.floors) {
    const row = {
      id: nextFloorId++,
      building_id: building.id,
      level: floor.level,
      label: floor.label,
      plan_path: null,
      plan_width: null,
      plan_height: null,
    };
    floorsTable.push(row);
    floorLookup.set(`${building.id}:${floor.level}`, row);
  }
}

const CLIENT_ROOMS_SEED = [
  { buildingId: 1, level: 0, clientRoomId: 'SB-001', roomNumber: '001', name: 'Room 001', type: 'classroom', aliases: ['SB 001'], x: 240, y: 360 },
  { buildingId: 1, level: 0, clientRoomId: 'SB-002', roomNumber: '002', name: 'Room 002', type: 'classroom', aliases: ['SB 002'], x: 260, y: 360 },
  { buildingId: 1, level: 0, clientRoomId: 'SB-003', roomNumber: '003', name: 'Room 003', type: 'classroom', aliases: ['SB 003'], x: 280, y: 360 },
  { buildingId: 1, level: 0, clientRoomId: 'SB-010', roomNumber: '010', name: 'Physics Lab 010', type: 'lab', aliases: ['SB 010'], x: 300, y: 420 },
  { buildingId: 1, level: 1, clientRoomId: 'SB-101', roomNumber: '101', name: 'Room 101', type: 'classroom', aliases: ['SB 101'], x: 320, y: 400 },
  { buildingId: 1, level: 1, clientRoomId: 'SB-102', roomNumber: '102', name: 'Room 102', type: 'classroom', aliases: ['SB 102'], x: 350, y: 400 },
  { buildingId: 1, level: 1, clientRoomId: 'SB-103', roomNumber: '103', name: 'Room 103', type: 'classroom', aliases: ['SB 103'], x: 380, y: 400 },
  { buildingId: 1, level: 1, clientRoomId: 'SB-110', roomNumber: '110', name: 'Science Lecture Hall 110', type: 'lecture_hall', aliases: ['SB Aud', 'Science Auditorium'], x: 520, y: 440 },
  { buildingId: 1, level: 1, clientRoomId: 'SB-120', roomNumber: '120', name: 'Chemistry Lab 120', type: 'lab', aliases: [], x: 610, y: 440 },
  { buildingId: 1, level: 2, clientRoomId: 'SB-201', roomNumber: '201', name: 'Room 201', type: 'classroom', aliases: ['SB 201'], x: 320, y: 400 },
  { buildingId: 1, level: 2, clientRoomId: 'SB-202', roomNumber: '202', name: 'Room 202', type: 'classroom', aliases: ['SB 202'], x: 350, y: 400 },
  { buildingId: 1, level: 2, clientRoomId: 'SB-203', roomNumber: '203', name: 'Room 203', type: 'classroom', aliases: ['SB 203'], x: 380, y: 400 },
  { buildingId: 1, level: 3, clientRoomId: 'SB-301', roomNumber: '301', name: 'Room 301', type: 'classroom', aliases: ['SB 301'], x: 320, y: 400 },
  { buildingId: 1, level: 3, clientRoomId: 'SB-302', roomNumber: '302', name: 'Room 302', type: 'classroom', aliases: ['SB 302'], x: 350, y: 400 },
  { buildingId: 1, level: 3, clientRoomId: 'SB-303', roomNumber: '303', name: 'Room 303', type: 'classroom', aliases: ['SB 303'], x: 380, y: 400 },

  { buildingId: 2, level: 1, clientRoomId: 'HEK-CIRC', roomNumber: '101', name: 'Circulation Desk', type: 'facility', aliases: ['Front Desk', 'Library Help', 'HL 101'], x: 500, y: 400 },
  { buildingId: 2, level: 2, clientRoomId: 'HEK-CAFE', roomNumber: '205', name: "Peet's Coffee & Study Lounge", type: 'dining', aliases: ['Coffee', 'Cafe'], x: 350, y: 420 },
  { buildingId: 2, level: 2, clientRoomId: 'HEK-201', roomNumber: '201', name: 'Group Study Room 201', type: 'study', aliases: ['HL 201'], x: 560, y: 390 },
  { buildingId: 2, level: 4, clientRoomId: 'HEK-CAYVAN', roomNumber: '401', name: 'Cayvan Media Center', type: 'study', aliases: ['Media Library', 'Audio Center', 'HL 401'], x: 520, y: 380 },

  { buildingId: 3, level: 2, clientRoomId: 'HH-211', roomNumber: '211', name: 'Classroom 211', type: 'classroom', aliases: ['HH 211'], x: 450, y: 380 },
  { buildingId: 3, level: 2, clientRoomId: 'HH-213', roomNumber: '213', name: 'Classroom 213', type: 'classroom', aliases: ['HH 213'], x: 520, y: 380 },
  { buildingId: 3, level: 2, clientRoomId: 'HH-221', roomNumber: '221', name: 'Classroom 221', type: 'classroom', aliases: ['HH 221'], x: 680, y: 410 },
  { buildingId: 3, level: 2, clientRoomId: 'HH-SAS', roomNumber: '230', name: 'Student Academic Services', type: 'office', aliases: ['SAS', 'Academic Advising'], x: 310, y: 480 },
  { buildingId: 3, level: 2, clientRoomId: 'HH-ISD', roomNumber: '235', name: 'Intercultural Student Development', type: 'office', aliases: ['ISD'], x: 380, y: 480 },
  { buildingId: 3, level: 3, clientRoomId: 'HH-311', roomNumber: '311', name: 'Classroom 311', type: 'classroom', aliases: ['HH 311'], x: 450, y: 380 },
  { buildingId: 3, level: 3, clientRoomId: 'HH-323', roomNumber: '323', name: 'Seminar Room 323', type: 'classroom', aliases: ['HH 323'], x: 580, y: 390 },
  { buildingId: 3, level: 4, clientRoomId: 'HH-411', roomNumber: '411', name: 'History Department Office', type: 'office', aliases: ['HH 411'], x: 460, y: 390 },

  { buildingId: 4, level: 1, clientRoomId: 'CFAC-AUD', roomNumber: '100', name: 'CFAC Auditorium', type: 'auditorium', aliases: ['Performance Hall', 'Main Stage'], x: 500, y: 450 },
  { buildingId: 4, level: 1, clientRoomId: 'CFAC-RECITAL', roomNumber: '115', name: 'Recital Hall', type: 'auditorium', aliases: [], x: 350, y: 420 },

  { buildingId: 5, level: 1, clientRoomId: 'SUC-ADM', roomNumber: '110', name: 'Admissions & Welcome Center', type: 'office', aliases: ['Visitor Center', 'Admissions'], x: 450, y: 400 },
  { buildingId: 5, level: 1, clientRoomId: 'SUC-REG', roomNumber: '120', name: "Registrar's Office", type: 'office', aliases: [], x: 550, y: 420 },

  { buildingId: 6, level: 1, clientRoomId: 'SFH-ARENA', roomNumber: '100', name: 'Van Noord Arena', type: 'auditorium', aliases: ['Basketball Arena', 'Gym'], x: 500, y: 400 },
  { buildingId: 6, level: 1, clientRoomId: 'SFH-POOL', roomNumber: '120', name: 'Venema Aquatic Center', type: 'facility', aliases: ['Pool', 'Swimming Pool'], x: 400, y: 450 },

  { buildingId: 7, level: 0, clientRoomId: 'DCC-010', roomNumber: '010', name: 'TV Production Studio', type: 'lab', aliases: ['Studio', 'Control Room'], x: 400, y: 350 },
  { buildingId: 7, level: 1, clientRoomId: 'DCC-110', roomNumber: '110', name: 'Speech & Media Classroom 110', type: 'classroom', aliases: [], x: 450, y: 410 },
  { buildingId: 7, level: 2, clientRoomId: 'DCC-210', roomNumber: '210', name: 'Communication Department Office', type: 'office', aliases: [], x: 480, y: 430 },

  { buildingId: 10, level: 1, clientRoomId: 'CHP-SANCT', roomNumber: '100', name: 'Sanctuary', type: 'auditorium', aliases: ['Worship Center', 'Main Hall'], x: 600, y: 500 },
  { buildingId: 10, level: 1, clientRoomId: 'CHP-PRAYER', roomNumber: '105', name: 'Prayer Chapel', type: 'facility', aliases: [], x: 400, y: 450 },
  { buildingId: 10, level: 2, clientRoomId: 'CHP-BALC', roomNumber: '200', name: 'Chapel Balcony', type: 'auditorium', aliases: [], x: 600, y: 350 },

  { buildingId: 12, level: 1, clientRoomId: 'COM-DINING', roomNumber: '100', name: 'Commons Dining Hall', type: 'dining', aliases: ['Uppercrust', 'Cafeteria'], x: 480, y: 400 },
  { buildingId: 12, level: 1, clientRoomId: 'COM-JOHNNY', roomNumber: '110', name: "Johnny's Cafe", type: 'dining', aliases: ['Johnnys', 'Snack Bar'], x: 380, y: 450 },

  { buildingId: 13, level: 1, clientRoomId: 'BIC-EXHIBIT', roomNumber: '101', name: 'Ecosystem Exhibit Hall', type: 'facility', aliases: ['Nature Center', 'Preserve'], x: 500, y: 380 },
];

const roomsTable = CLIENT_ROOMS_SEED.map((item, idx) => {
  const floorRow = floorLookup.get(`${item.buildingId}:${item.level}`);
  return {
    id: idx + 1,
    floor_id: floorRow ? floorRow.id : null,
    client_room_id: item.clientRoomId,
    room_number: item.roomNumber,
    name: item.name,
    type: item.type,
    aliases: item.aliases,
    x: item.x,
    y: item.y,
  };
});

const pointsOfInterest = [
  {
    id: 1,
    category: 'restroom',
    type: 'restroom',
    buildingId: 1,
    floor: 0,
    floor_id: floorLookup.get('1:0')?.id ?? null,
    label: 'Restroom',
    description: 'Restroom in Science Building Level 0',
    x: 200,
    y: 250,
  },
  {
    id: 2,
    category: 'printer',
    type: 'printer',
    buildingId: 2,
    floor: 3,
    floor_id: floorLookup.get('2:3')?.id ?? null,
    label: 'Printer',
    description: 'Student printer in Hekman Library Level 3',
    x: 410,
    y: 310,
  },
  {
    id: 3,
    category: 'water fountain',
    type: 'water fountain',
    buildingId: 1,
    floor: 2,
    floor_id: floorLookup.get('1:2')?.id ?? null,
    label: 'Water Fountain',
    description: 'Water fountain in Science Building Level 2',
    x: 290,
    y: 340,
  },
  {
    id: 4,
    category: 'vending machine',
    type: 'vending machine',
    buildingId: 2,
    floor: 1,
    floor_id: floorLookup.get('2:1')?.id ?? null,
    label: 'Vending Machine',
    description: 'Vending machines in Hekman Library Level 1',
    x: 340,
    y: 380,
  },
  {
    id: 5,
    category: 'restroom',
    type: 'filter',
    buildingId: null,
    floor: null,
    floor_id: null,
    label: 'Restrooms',
    description: 'Campus-wide Restrooms POI filter',
    x: null,
    y: null,
  },
  {
    id: 6,
    category: 'printer',
    type: 'filter',
    buildingId: null,
    floor: null,
    floor_id: null,
    label: 'Printers',
    description: 'Campus-wide Printers POI filter',
    x: null,
    y: null,
  },
  {
    id: 7,
    category: 'water fountain',
    type: 'filter',
    buildingId: null,
    floor: null,
    floor_id: null,
    label: 'Water Fountains',
    description: 'Campus-wide Water Fountains POI filter',
    x: null,
    y: null,
  },
  {
    id: 8,
    category: 'vending machine',
    type: 'filter',
    buildingId: null,
    floor: null,
    floor_id: null,
    label: 'Vending Machines',
    description: 'Campus-wide Vending Machines POI filter',
    x: null,
    y: null,
  },
];

function findBuildingRow(query) {
  if (query == null) return null;
  if (typeof query === 'number') {
    return buildings.find((b) => b.id === query) ?? null;
  }
  const normalized = String(query).trim().toLowerCase();
  if (!normalized) return null;
  return (
    buildings.find(
      (b) =>
        b.name.toLowerCase() === normalized ||
        b.code.toLowerCase() === normalized ||
        b.aliases.some((alias) => alias.toLowerCase() === normalized)
    ) ?? null
  );
}

function findFloorRow(floorId) {
  return floorsTable.find((f) => f.id === floorId) ?? null;
}

function findRoomRow(query) {
  if (query == null) return null;
  if (typeof query === 'number') {
    return roomsTable.find((r) => r.id === query) ?? null;
  }
  const normalized = String(query).trim().toLowerCase();
  if (!normalized) return null;
  return (
    roomsTable.find(
      (r) =>
        r.client_room_id.toLowerCase() === normalized ||
        r.room_number.toLowerCase() === normalized ||
        (r.name && r.name.toLowerCase() === normalized) ||
        r.aliases.some((alias) => alias.toLowerCase() === normalized)
    ) ?? null
  );
}

function findPoiRow(query) {
  if (query == null) return null;
  if (typeof query === 'number') {
    return pointsOfInterest.find((p) => p.id === query) ?? null;
  }
  const normalized = String(query).trim().toLowerCase();
  if (!normalized) return null;
  return (
    pointsOfInterest.find(
      (p) =>
        p.label.toLowerCase() === normalized ||
        p.category.toLowerCase() === normalized
    ) ?? null
  );
}

module.exports = {
  buildings,
  floorsTable,
  roomsTable,
  pointsOfInterest,
  findBuildingRow,
  findFloorRow,
  findRoomRow,
  findPoiRow,
};
