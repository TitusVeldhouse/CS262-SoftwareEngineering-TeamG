const catalogRepository = require('../db/catalogRepository');
const { formatRoomLabel } = require('./buildingService');

/**
 * Searches buildings, rooms, and points of interest.
 *
 * The search itself runs in the database (search_locations). It ignores letter
 * case and surrounding spaces, and returns buildings first, then rooms, then
 * POIs, each sorted by name.
 *
 * Each database row is mapped back to the response shapes the API has always
 * used:
 *   building -> { kind: 'building', id, name }
 *   room     -> { kind: 'room', buildingId, floor, name: 'HH 211' }
 *   poi      -> { kind: 'poi', id, name }
 *
 * @param {string} query
 * @returns {Promise<Array>}
 */
async function searchAll(query) {
  const term = query.trim();

  if (!term) {
    return [];
  }

  const rows = await catalogRepository.searchLocations(term);

  // The search rows give a room's name ('Classroom 211'), but the API labels
  // rooms by building code and number ('HH 211'), so look those up.
  const roomIds = rows.filter((row) => row.kind === 'room').map((row) => row.id);
  const roomLabels = new Map(
    (await catalogRepository.listRoomLabels(roomIds)).map((room) => [
      room.id,
      formatRoomLabel(room.floors?.buildings?.code ?? null, room.room_number),
    ])
  );

  return rows.map((row) => {
    if (row.kind === 'room') {
      return {
        kind: 'room',
        buildingId: row.building_id,
        floor: row.floor_level,
        name: roomLabels.get(row.id) ?? row.name,
      };
    }
    return {
      kind: row.kind,
      id: row.id,
      name: row.name,
    };
  });
}

module.exports = {
  searchAll,
};
