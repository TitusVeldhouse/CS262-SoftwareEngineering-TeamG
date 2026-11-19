const catalogRepository = require('../db/catalogRepository');
const { isValidId } = require('./buildingService');

// The values of the poi_type enum in the database.
const POI_TYPES = ['restroom', 'printer', 'water_fountain', 'vending_machine', 'elevator', 'other'];

/**
 * The database spells types with underscores ('water_fountain'), but the API
 * has always used spaces ('water fountain') and the client compares against
 * that spelling, so responses keep the spaces.
 * @param {string} databaseType
 */
function toApiType(databaseType) {
  return databaseType.replace(/_/g, ' ');
}

/**
 * Turns a ?type= value into the database spelling. Accepts either spelling and
 * any letter case: 'Water Fountain', 'water fountain', 'water_fountain'.
 * Returns null when it is not a known type.
 * @param {string} type
 */
function toDatabaseType(type) {
  const normalized = type.trim().toLowerCase().replace(/\s+/g, '_');
  return POI_TYPES.includes(normalized) ? normalized : null;
}

/**
 * Maps a database row (with its joined floor) to the API shape:
 *   { id, type, buildingId, floor, label }
 * where floor is the floor's level number.
 */
function toApiPoint(row) {
  return {
    id: row.id,
    type: toApiType(row.type),
    buildingId: row.floors.building_id,
    floor: row.floors.level,
    label: row.label,
  };
}

/**
 * Returns all points of interest.
 */
async function getAllPointsOfInterest() {
  const rows = await catalogRepository.listPointsOfInterest();
  return rows.map(toApiPoint);
}

/**
 * Returns points of interest filtered by type. The comparison ignores letter
 * case and accepts spaces or underscores. A blank type returns everything;
 * an unknown type returns an empty list.
 *
 * @param {string|null} type
 */
async function getPointsOfInterestByType(type) {
  if (typeof type !== 'string' || type.trim() === '') {
    return getAllPointsOfInterest();
  }

  const databaseType = toDatabaseType(type);
  if (!databaseType) {
    return [];
  }

  const rows = await catalogRepository.listPointsOfInterest({ type: databaseType });
  return rows.map(toApiPoint);
}

/**
 * Returns a point of interest by its ID, or null if it does not exist.
 * @param {number} id
 */
async function getPointOfInterestById(id) {
  if (!isValidId(id)) {
    return null;
  }

  const rows = await catalogRepository.listPointsOfInterest({ id });
  return rows.length > 0 ? toApiPoint(rows[0]) : null;
}

/**
 * Returns all points of interest located in a building.
 * @param {number} buildingId
 */
async function getPointsOfInterestByBuilding(buildingId) {
  if (!isValidId(buildingId)) {
    return [];
  }

  const rows = await catalogRepository.listPointsOfInterest({ buildingId });
  return rows.map(toApiPoint);
}

module.exports = {
  getAllPointsOfInterest,
  getPointsOfInterestByType,
  getPointOfInterestById,
  getPointsOfInterestByBuilding,
};
