const catalogRepository = require('../db/catalogRepository');

/**
 * Label used for a room in API responses, e.g. 'HH 211': the building's short
 * code and the room number. Buildings without a code just use the number.
 * @param {string|null} buildingCode
 * @param {string} roomNumber
 */
function formatRoomLabel(buildingCode, roomNumber) {
  return buildingCode ? `${buildingCode} ${roomNumber}` : roomNumber;
}

/**
 * True for ids the database could hold. Anything else cannot match a row, so
 * callers answer "not found" without asking the database.
 */
function isValidId(id) {
  return Number.isSafeInteger(id) && id > 0;
}

/**
 * Returns a summary list of all buildings: [{ id, name }].
 * Floors and rooms are left out.
 */
async function getAllBuildings() {
  const rows = await catalogRepository.listBuildings();
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

/**
 * Returns a building with its floors and rooms, or null if it does not exist.
 *
 * Database rows are mapped back to the shape the API has always returned:
 *   { id, code, name, aliases, campus_x, campus_y,
 *     floors: [{ level, label, rooms: ['HH 211', ...] }] }
 * Floors are sorted by level and rooms by room number.
 * @param {number} id
 */
async function getBuildingById(id) {
  if (!isValidId(id)) {
    return null;
  }

  const row = await catalogRepository.getBuildingWithFloors(id);
  if (!row) {
    return null;
  }

  const floors = [...(row.floors ?? [])]
    .sort((a, b) => a.level - b.level)
    .map((floor) => ({
      level: floor.level,
      label: floor.label,
      rooms: (floor.rooms ?? [])
        .map((room) => room.room_number)
        .sort()
        .map((roomNumber) => formatRoomLabel(row.code, roomNumber)),
    }));

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    aliases: row.aliases,
    campus_x: row.campus_x,
    campus_y: row.campus_y,
    floors,
  };
}

/**
 * Returns the room labels of every floor in a building, or null if the
 * building does not exist.
 * @param {number} buildingId
 * @returns {Promise<string[]|null>}
 */
async function getBuildingRooms(buildingId) {
  const building = await getBuildingById(buildingId);

  if (!building) {
    return null;
  }

  return building.floors.flatMap((floor) => floor.rooms);
}

module.exports = {
  formatRoomLabel,
  isValidId,
  getAllBuildings,
  getBuildingById,
  getBuildingRooms,
};
