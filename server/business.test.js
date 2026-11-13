
const buildingService = require('./business/buildingService');

const pointOfInterestService =
    require('./business/pointOfInterestService');

const searchService = require('./business/searchService');

describe('Building Business Logic', () => {

    test('Returns all buildings in summary format', () => {
        const buildings = buildingService.getAllBuildings();

        expect(buildings.length).toBeGreaterThan(0);

        expect(buildings[0]).toHaveProperty('id');
        expect(buildings[0]).toHaveProperty('name');
        expect(buildings[0]).toHaveProperty('isParkingLot');

        expect(buildings[0]).not.toHaveProperty('floors');
    });

    test('Returns a building by ID', () => {
        const building = buildingService.getBuildingById(1);

        expect(building).not.toBeNull();
        expect(building.name).toBe('Science Building');
    });

    test('Returns null for an unknown building', () => {
        expect(buildingService.getBuildingById(999)).toBeNull();
    });

    test('Returns all rooms from a building', () => {
        const rooms = buildingService.getBuildingRooms(1);

        expect(rooms).toContain('SB 101');
        expect(rooms).toContain('SB 201');
    });
});

describe('Points of Interest Business Logic', () => {

    test('Returns all points of interest', () => {
        const points = pointOfInterestService
            .getAllPointsOfInterest();

        expect(points.length).toBeGreaterThan(0);
    });

    test('Filters points by type', () => {
        const points = pointOfInterestService
            .getPointsOfInterestByType('printer');

        expect(points.length).toBe(1);
        expect(points[0].type).toBe('printer');
    });

    test('Filters points case-insensitively', () => {
        const points = pointOfInterestService
            .getPointsOfInterestByType('PRINTER');

        expect(points.length).toBe(1);
    });

    test('Returns points from a specific building', () => {
        const points = pointOfInterestService
            .getPointsOfInterestByBuilding(1);

        expect(points.every(point => point.buildingId === 1))
            .toBe(true);
    });
});

describe('Search Business Logic', () => {

    test('Finds buildings by name', () => {
        const results = searchService.searchAll('hekman');

        expect(results).toContainEqual({
            kind: 'building',
            id: 2,
            name: 'Hekman Library'
        });
    });

    test('Finds rooms by number', () => {
        const results = searchService.searchAll('sb 101');

        expect(results).toContainEqual({
            kind: 'room',
            buildingId: 1,
            floor: 1,
            name: 'SB 101'
        });
    });

    test('Finds points of interest', () => {
        const results = searchService.searchAll('printer');

        expect(results).toContainEqual({
            kind: 'poi',
            id: 2,
            name: 'Printer'
        });
    });

    test('Search is case-insensitive', () => {
        const lower = searchService.searchAll('hekman');
        const upper = searchService.searchAll('HEKMAN');

        expect(upper).toEqual(lower);
    });

    test('Returns an empty array when nothing matches', () => {
        expect(searchService.searchAll('xyz123')).toEqual([]);
    });

    test('Returns an empty array for blank queries', () => {
        expect(searchService.searchAll('   ')).toEqual([]);
    });
});
