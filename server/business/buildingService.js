
const { buildings } = require('../data');

/**
 * Returns a formatted list of all buildings.
 * Excludes floors and rooms from the summary.
 */
function getAllBuildings() {
    return buildings.map(building => ({
        id: building.id,
        name: building.name,
        isParkingLot: building.isParkingLot
    }));
}

/**
 * Returns a building with its floors and rooms.
 * @param {number} id
 * @returns {object|null}
 */
function getBuildingById(id) {
    if (!Number.isInteger(id)) {
        return null;
    }

    return buildings.find(building => building.id === id) || null;
}

/**
 * Returns all rooms belonging to a building.
 * @param {number} buildingId
 * @returns {string[]|null}
 */
function getBuildingRooms(buildingId) {
    const building = getBuildingById(buildingId);

    if (!building) {
        return null;
    }

    return building.floors.flatMap(floor => floor.rooms);
}

module.exports = {
    getAllBuildings,
    getBuildingById,
    getBuildingRooms
};
