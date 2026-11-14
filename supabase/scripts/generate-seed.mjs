// Builds supabase/seed.sql from the data files the client and server already use.
//
// Usage (from the repo root):  node supabase/scripts/generate-seed.mjs
//
// Sources:
//   client/src/data/floorplan-manifest.ts  buildings + floors (floor plan images)
//   client/src/data/campus-layout.ts       rooms (PRELOADED_ROOMS) + RoomType values
//   client/src/app/finder.tsx              campus map pin positions + alternate names
//   client/assets/images/campus-map.png    campus map pixel size (read from the PNG header)
//   server/data.js                         points of interest
//
// The .ts files are read as plain text with regular expressions, so no new
// npm packages are needed. Output is deterministic: running the script twice on
// the same inputs gives a byte-identical seed.sql. Anything that could not be
// imported cleanly is printed and also written as a comment at the top of seed.sql.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromRoot = (relativePath) => join(repoRoot, relativePath);
const readText = (relativePath) => readFileSync(fromRoot(relativePath), 'utf8');

const CAMPUS_MAP_NAME = 'Calvin University Campus Map';
const CAMPUS_MAP_IMAGE = 'campus-map.png';
const FLOORPLAN_PREFIX = '../../assets/floorplans/';
const MIGRATIONS_DIR = 'supabase/migrations';
const OUTPUT_PATH = 'supabase/seed.sql';

// Notes about skipped or cleaned-up data, reported at the end.
const anomalies = [];

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

// Returns the text between the first `startMarker` and the next `endMarker`.
function sliceBetween(text, startMarker, endMarker, sourceName) {
  const start = text.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Could not find "${startMarker}" in ${sourceName}`);
  }
  const end = text.indexOf(endMarker, start);
  if (end === -1) {
    throw new Error(`Could not find the end of "${startMarker}" in ${sourceName}`);
  }
  return text.slice(start, end);
}

// Reads one `key: "value"` field from a block of TS object text.
function readStringField(block, key) {
  const match = block.match(new RegExp(`\\b${key}:\\s*"([^"]*)"`));
  return match ? match[1] : null;
}

function readQuotedStrings(text) {
  return [...text.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
}

// Removes stray whitespace and punctuation around a building name,
// e.g. 'Spoelhof Fieldhouse Complex,' -> 'Spoelhof Fieldhouse Complex'.
function cleanBuildingName(rawName) {
  const cleaned = rawName.replace(/^[\s,;:.]+|[\s,;:.]+$/g, '').replace(/\s+/g, ' ');
  if (cleaned !== rawName) {
    anomalies.push(`Building name cleaned: "${rawName}" -> "${cleaned}".`);
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// Source readers
// ---------------------------------------------------------------------------

function readPngSize(relativePath) {
  const header = readFileSync(fromRoot(relativePath)).subarray(0, 24);
  const pngSignature = '89504e470d0a1a0a';
  if (header.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error(`${relativePath} is not a PNG file`);
  }
  // The IHDR chunk always comes first: width and height are big-endian
  // 32-bit integers at byte offsets 16 and 20.
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function readFloorPlanManifest() {
  const source = 'client/src/data/floorplan-manifest.ts';
  const text = readText(source);
  const entryPattern =
    /\{\s*building:\s*"([^"]*)",\s*label:\s*"([^"]*)",\s*width:\s*(\d+),\s*height:\s*(\d+),\s*asset:\s*require\("([^"]*)"\)/g;
  const entries = [...text.matchAll(entryPattern)].map((match) => ({
    rawBuilding: match[1],
    label: match[2],
    width: Number(match[3]),
    height: Number(match[4]),
    assetPath: match[5],
  }));

  // Guard against entries the regex silently missed (e.g. a reordered field).
  const expectedCount = (text.match(/\bbuilding:\s*"/g) ?? []).length;
  if (entries.length !== expectedCount) {
    throw new Error(`Parsed ${entries.length} of ${expectedCount} entries in ${source}`);
  }
  return entries;
}

function readRoomTypes() {
  const source = 'client/src/data/campus-layout.ts';
  const union = sliceBetween(readText(source), 'export type RoomType', ';', source);
  return readQuotedStrings(union);
}

function readPreloadedRooms() {
  const source = 'client/src/data/campus-layout.ts';
  const section = sliceBetween(readText(source), 'const PRELOADED_ROOMS', '\n];', source);
  // Each entry starts with `building: "..."`; split there and read fields per chunk.
  const chunks = section.split(/(?=\bbuilding:\s*")/).slice(1);
  return chunks.map((chunk) => {
    const aliasesMatch = chunk.match(/\baliases:\s*\[([^\]]*)\]/);
    const coordinatesMatch = chunk.match(/\bcoordinates:\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/);
    const room = {
      building: readStringField(chunk, 'building'),
      floorLabel: readStringField(chunk, 'floor'),
      id: readStringField(chunk, 'id'),
      roomNumber: readStringField(chunk, 'roomNumber'),
      name: readStringField(chunk, 'name'),
      type: readStringField(chunk, 'type'),
      aliases: aliasesMatch ? readQuotedStrings(aliasesMatch[1]) : [],
      x: coordinatesMatch ? Number(coordinatesMatch[1]) : null,
      y: coordinatesMatch ? Number(coordinatesMatch[2]) : null,
    };
    if (!room.building || !room.floorLabel || !room.id || !room.roomNumber) {
      throw new Error(`Incomplete room entry in ${source}:\n${chunk}`);
    }
    return room;
  });
}

function readCampusLocations() {
  const source = 'client/src/app/finder.tsx';
  const text = readText(source);

  const locationsBlock = sliceBetween(text, 'export const LOCATIONS', '] as const', source);
  const locationPattern = /\{\s*name:\s*"([^"]*)",\s*top:\s*"([\d.]+)%",\s*left:\s*"([\d.]+)%"\s*\}/g;
  const locations = [...locationsBlock.matchAll(locationPattern)].map((match) => ({
    campusName: match[1],
    top: Number(match[2]),
    left: Number(match[3]),
  }));

  const aliasBlock = sliceBetween(text, 'export const CAMPUS_TO_MANIFEST_BUILDINGS', '};', source);
  const campusToManifest = new Map(
    [...aliasBlock.matchAll(/"([^"]*)":\s*"([^"]*)"/g)].map((match) => [match[1], match[2]]),
  );
  return { locations, campusToManifest };
}

function readServerPointsOfInterest() {
  // server/data.js is plain CommonJS, so it can be loaded directly.
  const require = createRequire(import.meta.url);
  return require(fromRoot('server/data.js'));
}

// Makes sure the room_type enum in the migration still matches the client.
function checkRoomTypesMatchMigration(roomTypes) {
  const migrationsPath = fromRoot(MIGRATIONS_DIR);
  const migrationText = readFileSync(join(migrationsPath, findInitialMigration(migrationsPath)), 'utf8');
  const enumBlock = sliceBetween(migrationText, 'create type public.room_type', ');', 'the migration');
  const enumValues = [...enumBlock.matchAll(/'([^']*)'/g)].map((match) => match[1]);
  if (enumValues.join(',') !== roomTypes.join(',')) {
    throw new Error(
      `room_type enum in the migration (${enumValues.join(', ')}) does not match ` +
        `RoomType in campus-layout.ts (${roomTypes.join(', ')})`,
    );
  }
}

function findInitialMigration(migrationsPath) {
  const match = readdirSync(migrationsPath).find((file) => file.endsWith('_initial_schema.sql'));
  if (!match) {
    throw new Error(`No *_initial_schema.sql found in ${MIGRATIONS_DIR}`);
  }
  return match;
}

// ---------------------------------------------------------------------------
// Building the seed data
// ---------------------------------------------------------------------------

// 'Level 2' -> 2, 'Sub-Basement' -> -1. 'Storage Loft' is resolved later, once
// the building's highest level is known. Returns null for labels to skip.
function parseLevel(label) {
  const levelMatch = label.match(/^Level (-?\d+)$/);
  if (levelMatch) return Number(levelMatch[1]);
  if (label === 'Sub-Basement') return -1;
  if (label === 'Storage Loft') return 'storage_loft';
  if (label === 'Overall Map') return null;
  throw new Error(`Unknown floor label "${label}" in floorplan-manifest.ts`);
}

function buildFloors(manifest) {
  const floorsByBuilding = new Map();
  for (const entry of manifest) {
    const building = cleanBuildingName(entry.rawBuilding);
    if (!floorsByBuilding.has(building)) floorsByBuilding.set(building, []);

    const level = parseLevel(entry.label);
    if (level === null) {
      anomalies.push(
        `Skipped "${entry.label}" for "${building}": it is an overview image, not a floor.`,
      );
      continue;
    }
    floorsByBuilding.get(building).push({
      building,
      level,
      label: entry.label,
      planPath: entry.assetPath.replace(FLOORPLAN_PREFIX, ''),
      planWidth: entry.width,
      planHeight: entry.height,
    });
  }

  for (const [building, floors] of floorsByBuilding) {
    const numericLevels = floors.map((floor) => floor.level).filter((level) => typeof level === 'number');
    const topLevel = numericLevels.length > 0 ? Math.max(...numericLevels) : 0;
    for (const floor of floors) {
      if (floor.level === 'storage_loft') {
        floor.level = topLevel + 1;
        anomalies.push(`"${building}" Storage Loft stored as level ${floor.level} (one above its top level).`);
      }
    }
    const levels = floors.map((floor) => floor.level);
    if (new Set(levels).size !== levels.length) {
      throw new Error(`Two floors of "${building}" map to the same level: ${levels.join(', ')}`);
    }
    if (floors.length === 0) {
      anomalies.push(`Building "${building}" has no floors (its only manifest image was skipped).`);
    }
    floors.sort((a, b) => a.level - b.level);
  }
  return floorsByBuilding;
}

function buildBuildings(floorsByBuilding, rooms, campusLocations) {
  const { locations, campusToManifest } = campusLocations;

  // Short codes come from room ids such as 'HH-211' -> 'HH'.
  const codeByBuilding = new Map();
  for (const room of rooms) {
    const code = room.id.split('-')[0];
    const existing = codeByBuilding.get(room.building);
    if (existing && existing !== code) {
      throw new Error(`"${room.building}" has rooms with two codes: ${existing} and ${code}`);
    }
    codeByBuilding.set(room.building, code);
  }

  const buildings = new Map(
    [...floorsByBuilding.keys()].map((name) => [
      name,
      { name, code: codeByBuilding.get(name) ?? null, aliases: [], campusX: null, campusY: null },
    ]),
  );

  for (const location of locations) {
    const manifestName = campusToManifest.get(location.campusName);
    const building = manifestName && buildings.get(manifestName);
    if (!building) {
      anomalies.push(`Campus pin "${location.campusName}" has no matching manifest building; skipped.`);
      continue;
    }
    building.campusX = location.left;
    building.campusY = location.top;
    // Only store the campus name as an alias when it is actually different;
    // search is case-insensitive, so 'DeVries Hall' vs 'Devries Hall' is not.
    if (location.campusName.toLowerCase() !== manifestName.toLowerCase()) {
      building.aliases.push(location.campusName);
    }
  }

  // Plain code-point order (not localeCompare) so the output is identical on
  // every machine regardless of its locale settings.
  return [...buildings.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function buildRooms(rooms, floorsByBuilding) {
  const seeded = [];
  for (const room of rooms) {
    const floor = (floorsByBuilding.get(room.building) ?? []).find((f) => f.label === room.floorLabel);
    if (!floor) {
      anomalies.push(`Room ${room.id}: no floor "${room.floorLabel}" in "${room.building}"; skipped.`);
      continue;
    }
    // The client-side room id (e.g. 'HH-211') is what users see and type, so
    // keep it searchable by adding it to the aliases.
    seeded.push({ ...room, level: floor.level, aliases: [room.id, ...room.aliases] });
  }
  return seeded;
}

function buildPointsOfInterest({ buildings, pointsOfInterest }, floorsByBuilding) {
  const poiTypeMap = { 'water fountain': 'water_fountain', 'vending machine': 'vending_machine' };
  const allowedTypes = ['restroom', 'printer', 'water_fountain', 'vending_machine', 'elevator', 'other'];

  const seeded = [];
  for (const poi of pointsOfInterest) {
    const serverBuilding = buildings.find((building) => building.id === poi.buildingId);
    const buildingName = serverBuilding?.name;
    const floor = (floorsByBuilding.get(buildingName) ?? []).find((f) => f.level === poi.floor);
    if (!floor) {
      anomalies.push(
        `POI ${poi.id} (${poi.label}): no level ${poi.floor} in "${buildingName ?? `building ${poi.buildingId}`}"; skipped.`,
      );
      continue;
    }
    const type = poiTypeMap[poi.type] ?? poi.type;
    if (!allowedTypes.includes(type)) {
      throw new Error(`POI ${poi.id} has unknown type "${poi.type}"`);
    }
    seeded.push({ building: buildingName, level: floor.level, type, label: poi.label, x: null, y: null });
  }
  return seeded;
}

// ---------------------------------------------------------------------------
// SQL output
// ---------------------------------------------------------------------------

function sqlText(value) {
  return value === null || value === undefined ? 'null' : `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  return value === null || value === undefined ? 'null' : String(value);
}

function sqlTextArray(values) {
  return `array[${values.map(sqlText).join(', ')}]::text[]`;
}

function valuesList(rows) {
  return rows.map((row) => `  (${row.join(', ')})`).join(',\n');
}

function renderSeed({ campusMap, buildings, floors, rooms, pois }) {
  const lines = [
    '-- =============================================================================',
    '-- CalvinFinder seed data',
    '-- =============================================================================',
    '-- GENERATED FILE: do not edit by hand.',
    '-- Regenerate with:  node supabase/scripts/generate-seed.mjs',
    '--',
    '-- Runs after the migration on an empty database (supabase db reset does this).',
    '-- Rows are linked by natural keys (building name, floor level), never by',
    '-- hard-coded ids, so the auto-numbered ids can be anything.',
    '--',
    '-- Import notes:',
    ...(anomalies.length > 0 ? anomalies.map((note) => `--   * ${note}`) : ['--   (none)']),
    '',
    '',
    '-- Campus map ------------------------------------------------------------------',
    'insert into public.campus_map (name, image_path, width, height) values',
    valuesList([[sqlText(campusMap.name), sqlText(campusMap.imagePath), campusMap.width, campusMap.height]]) + ';',
    '',
    '',
    '-- Buildings -------------------------------------------------------------------',
    'insert into public.buildings (campus_map_id, name, code, aliases, campus_x, campus_y)',
    'select cm.id, v.name, v.code, v.aliases, v.campus_x, v.campus_y',
    'from (values',
    valuesList(
      buildings.map((b) => [
        sqlText(b.name),
        sqlText(b.code),
        sqlTextArray(b.aliases),
        `${sqlNumber(b.campusX)}::numeric`,
        `${sqlNumber(b.campusY)}::numeric`,
      ]),
    ),
    ') as v (name, code, aliases, campus_x, campus_y)',
    `join public.campus_map cm on cm.name = ${sqlText(campusMap.name)};`,
    '',
    '',
    '-- Floors ----------------------------------------------------------------------',
    'insert into public.floors (building_id, level, label, plan_path, plan_width, plan_height)',
    'select b.id, v.level, v.label, v.plan_path, v.plan_width, v.plan_height',
    'from (values',
    valuesList(
      floors.map((f) => [
        sqlText(f.building),
        f.level,
        sqlText(f.label),
        sqlText(f.planPath),
        f.planWidth,
        f.planHeight,
      ]),
    ),
    ') as v (building_name, level, label, plan_path, plan_width, plan_height)',
    'join public.buildings b on b.name = v.building_name;',
    '',
    '',
    '-- Rooms -----------------------------------------------------------------------',
    'insert into public.rooms (floor_id, room_number, name, type, aliases, x, y)',
    'select f.id, v.room_number, v.name, v.type::public.room_type, v.aliases, v.x, v.y',
    'from (values',
    valuesList(
      rooms.map((r) => [
        sqlText(r.building),
        r.level,
        sqlText(r.roomNumber),
        sqlText(r.name),
        sqlText(r.type),
        sqlTextArray(r.aliases),
        `${sqlNumber(r.x)}::numeric`,
        `${sqlNumber(r.y)}::numeric`,
      ]),
    ),
    ') as v (building_name, level, room_number, name, type, aliases, x, y)',
    'join public.buildings b on b.name = v.building_name',
    'join public.floors f on f.building_id = b.id and f.level = v.level;',
    '',
    '',
    '-- Points of interest ----------------------------------------------------------',
    'insert into public.points_of_interest (floor_id, type, label, x, y)',
    'select f.id, v.type::public.poi_type, v.label, v.x, v.y',
    'from (values',
    valuesList(
      pois.map((p) => [
        sqlText(p.building),
        p.level,
        sqlText(p.type),
        sqlText(p.label),
        `${sqlNumber(p.x)}::numeric`,
        `${sqlNumber(p.y)}::numeric`,
      ]),
    ),
    ') as v (building_name, level, type, label, x, y)',
    'join public.buildings b on b.name = v.building_name',
    'join public.floors f on f.building_id = b.id and f.level = v.level;',
    '',
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const roomTypes = readRoomTypes();
  checkRoomTypesMatchMigration(roomTypes);

  const manifest = readFloorPlanManifest();
  const sourceRooms = readPreloadedRooms();
  for (const room of sourceRooms) {
    if (room.type && !roomTypes.includes(room.type)) {
      throw new Error(`Room ${room.id} has unknown type "${room.type}"`);
    }
  }

  const floorsByBuilding = buildFloors(manifest);
  const buildings = buildBuildings(floorsByBuilding, sourceRooms, readCampusLocations());
  const floors = buildings.flatMap((building) => floorsByBuilding.get(building.name));
  const rooms = buildRooms(sourceRooms, floorsByBuilding);
  const pois = buildPointsOfInterest(readServerPointsOfInterest(), floorsByBuilding);
  const campusMap = {
    name: CAMPUS_MAP_NAME,
    imagePath: CAMPUS_MAP_IMAGE,
    ...readPngSize(`client/assets/images/${CAMPUS_MAP_IMAGE}`),
  };

  writeFileSync(fromRoot(OUTPUT_PATH), renderSeed({ campusMap, buildings, floors, rooms, pois }));

  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(
    `  campus_map: 1, buildings: ${buildings.length}, floors: ${floors.length}, ` +
      `rooms: ${rooms.length}, points_of_interest: ${pois.length}`,
  );
  console.log(anomalies.length > 0 ? 'Import notes:' : 'Import notes: none');
  for (const note of anomalies) console.log(`  * ${note}`);
}

main();
