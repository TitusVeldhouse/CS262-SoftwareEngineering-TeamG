/**
 * Database queries for campus data (buildings, floors, rooms, points of
 * interest, and search).
 *
 * This file only fetches rows; it does not decide what the API returns. The
 * services in server/business/ turn these rows into the response shapes the
 * client expects. Keeping the queries here means tests can replace this one
 * module with fake rows (see business.test.js).
 *
 * The Supabase client builds a database query from chained calls, for example
 *   client.from('buildings').select('id, name').order('name')
 * means "select id, name from buildings order by name". A name inside the
 * select list followed by parentheses, such as floors(level, label), pulls in
 * the related rows through the foreign key (here: the building's floors).
 */
const { getCatalogClient } = require('./supabase');

/**
 * Supabase returns { data, error } instead of throwing. This turns an error
 * into a thrown Error so Express sends it to the JSON error handler.
 */
function unwrap({ data, error }, action) {
  if (error) {
    throw new Error(`Could not ${action}: ${error.message}`);
  }
  return data;
}

/** All buildings, id and name only, sorted by name. */
async function listBuildings() {
  const result = await getCatalogClient()
    .from('buildings')
    .select('id, name')
    .order('name');
  return unwrap(result, 'load buildings');
}

/**
 * One building with its floors and each floor's room numbers, or null if no
 * building has this id. Floors and rooms come back unsorted; the service
 * sorts them.
 */
async function getBuildingWithFloors(id) {
  const result = await getCatalogClient()
    .from('buildings')
    .select('id, code, name, aliases, campus_x, campus_y, floors(level, label, rooms(room_number))')
    .eq('id', id)
    .maybeSingle();
  return unwrap(result, 'load the building');
}

/**
 * Points of interest with the level and building of their floor.
 * Every filter is optional:
 *   type        a poi_type value as stored, e.g. 'water_fountain'
 *   id          one POI id
 *   buildingId  only POIs in this building
 */
async function listPointsOfInterest({ type, id, buildingId } = {}) {
  // "!inner" makes this a normal join, so the building filter below removes
  // POIs instead of just leaving their floor empty.
  let query = getCatalogClient()
    .from('points_of_interest')
    .select('id, type, label, floors!inner(level, building_id)')
    .order('id');

  if (type !== undefined) query = query.eq('type', type);
  if (id !== undefined) query = query.eq('id', id);
  if (buildingId !== undefined) query = query.eq('floors.building_id', buildingId);

  return unwrap(await query, 'load points of interest');
}

/**
 * Runs the search_locations database function (case-insensitive "contains"
 * search over buildings, rooms, and POIs; see the initial migration).
 */
async function searchLocations(q) {
  const result = await getCatalogClient().rpc('search_locations', { q });
  return unwrap(result, 'search');
}

/**
 * Room numbers and building codes for the given room ids. Search results only
 * carry a room's name, so this fills in what the API's room label needs.
 */
async function listRoomLabels(roomIds) {
  if (roomIds.length === 0) return [];
  const result = await getCatalogClient()
    .from('rooms')
    .select('id, room_number, floors(buildings(code))')
    .in('id', roomIds);
  return unwrap(result, 'load room labels');
}

module.exports = {
  listBuildings,
  getBuildingWithFloors,
  listPointsOfInterest,
  searchLocations,
  listRoomLabels,
};
