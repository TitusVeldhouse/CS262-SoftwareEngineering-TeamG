
const { buildings, pointsOfInterest } = require('../data');

/**
 * Checks whether a text contains a search term.
 * Matching is case-insensitive.
 */
function matches(text, term) {
    return typeof text === 'string' &&
        text.toLowerCase().includes(term);
}

/**
 * Searches buildings, rooms, and points of interest.
 *
 * @param {string} query
 * @returns {Array}
 */
function searchAll(query) {
    const term = query.trim().toLowerCase();

    if (!term) {
        return [];
    }

    // Search buildings
    const buildingResults = buildings
        .filter(building => matches(building.name, term))
        .map(building => ({
            kind: 'building',
            id: building.id,
            name: building.name
        }));

    // Search rooms
    const roomResults = buildings.flatMap(building =>
        building.floors.flatMap(floor =>
            floor.rooms
                .filter(room => matches(room, term))
                .map(room => ({
                    kind: 'room',
                    buildingId: building.id,
                    floor: floor.level,
                    name: room
                }))
        )
    );

    // Search points of interest
    const poiResults = pointsOfInterest
        .filter(point =>
            matches(point.label, term) ||
            matches(point.type, term)
        )
        .map(point => ({
            kind: 'poi',
            id: point.id,
            name: point.label
        }));

    return [
        ...buildingResults,
        ...roomResults,
        ...poiResults
    ];
}

module.exports = {
    searchAll
};
