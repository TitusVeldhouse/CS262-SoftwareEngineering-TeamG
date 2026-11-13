
const { pointsOfInterest } = require('../data');

/**
 * Returns all points of interest.
 */
function getAllPointsOfInterest() {
    return pointsOfInterest;
}

/**
 * Returns points of interest filtered by type.
 * The comparison is case-insensitive.
 *
 * @param {string|null} type
 */
function getPointsOfInterestByType(type) {
    if (!type || type.trim() === '') {
        return getAllPointsOfInterest();
    }

    const normalizedType = type.trim().toLowerCase();

    return pointsOfInterest.filter(
        point => point.type.toLowerCase() === normalizedType
    );
}

/**
 * Returns a point of interest by its ID.
 * @param {number} id
 */
function getPointOfInterestById(id) {
    if (!Number.isInteger(id)) {
        return null;
    }

    return pointsOfInterest.find(point => point.id === id) || null;
}

/**
 * Returns all points of interest located in a building.
 * @param {number} buildingId
 */
function getPointsOfInterestByBuilding(buildingId) {
    return pointsOfInterest.filter(
        point => point.buildingId === buildingId
    );
}

module.exports = {
    getAllPointsOfInterest,
    getPointsOfInterestByType,
    getPointOfInterestById,
    getPointsOfInterestByBuilding
};
