/**
 * Unit tests for the campus-data services.
 *
 * The database is replaced by a mock of db/catalogRepository.js, so these
 * tests run without Supabase. Each test feeds in rows shaped like what
 * Supabase returns and checks that the service turns them into the API
 * response shapes. The real queries are covered by
 * catalog.integration.test.js and the pgTAP tests in supabase/tests/.
 */
const catalogRepository = require('./db/catalogRepository');
const buildingService = require('./business/buildingService');
const pointOfInterestService = require('./business/pointOfInterestService');
const searchService = require('./business/searchService');

jest.mock('./db/catalogRepository');

// A building row as Supabase returns it, with floors and rooms out of order.
const hiemengaRow = {
  id: 17,
  code: 'HH',
  name: 'Hiemenga Hall',
  aliases: [],
  campus_x: 28.3,
  campus_y: 64.1,
  floors: [
    { level: 3, label: 'Level 3', rooms: [{ room_number: '323' }, { room_number: '311' }] },
    { level: 2, label: 'Level 2', rooms: [{ room_number: '213' }, { room_number: '211' }] },
  ],
};

// POI rows with their joined floor.
const printerRow = { id: 2, type: 'printer', label: 'Printer', floors: { level: 3, building_id: 16 } };
const fountainRow = {
  id: 3,
  type: 'water_fountain',
  label: 'Water Fountain',
  floors: { level: 2, building_id: 28 },
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe('Building Business Logic', () => {
  test('Returns all buildings in summary format', async () => {
    catalogRepository.listBuildings.mockResolvedValue([
      { id: 16, name: 'Hekman Library' },
      { id: 17, name: 'Hiemenga Hall' },
    ]);

    const buildings = await buildingService.getAllBuildings();

    expect(buildings).toEqual([
      { id: 16, name: 'Hekman Library' },
      { id: 17, name: 'Hiemenga Hall' },
    ]);
    expect(buildings[0]).not.toHaveProperty('isParkingLot');
    expect(buildings[0]).not.toHaveProperty('floors');
  });

  test('Returns a building by ID with sorted floors and labelled rooms', async () => {
    catalogRepository.getBuildingWithFloors.mockResolvedValue(hiemengaRow);

    const building = await buildingService.getBuildingById(17);

    expect(catalogRepository.getBuildingWithFloors).toHaveBeenCalledWith(17);
    expect(building).toEqual({
      id: 17,
      code: 'HH',
      name: 'Hiemenga Hall',
      aliases: [],
      campus_x: 28.3,
      campus_y: 64.1,
      floors: [
        { level: 2, label: 'Level 2', rooms: ['HH 211', 'HH 213'] },
        { level: 3, label: 'Level 3', rooms: ['HH 311', 'HH 323'] },
      ],
    });
  });

  test('Labels rooms with just the number when the building has no code', async () => {
    catalogRepository.getBuildingWithFloors.mockResolvedValue({
      ...hiemengaRow,
      code: null,
      floors: [{ level: 1, label: 'Level 1', rooms: [{ room_number: '101' }] }],
    });

    const building = await buildingService.getBuildingById(17);

    expect(building.floors[0].rooms).toEqual(['101']);
  });

  test('Returns null for an unknown building', async () => {
    catalogRepository.getBuildingWithFloors.mockResolvedValue(null);

    expect(await buildingService.getBuildingById(999)).toBeNull();
  });

  test('Returns null without querying for ids the database cannot hold', async () => {
    expect(await buildingService.getBuildingById(0)).toBeNull();
    expect(await buildingService.getBuildingById(-5)).toBeNull();
    expect(await buildingService.getBuildingById(1e20)).toBeNull();
    expect(catalogRepository.getBuildingWithFloors).not.toHaveBeenCalled();
  });

  test('Returns all rooms from a building', async () => {
    catalogRepository.getBuildingWithFloors.mockResolvedValue(hiemengaRow);

    const rooms = await buildingService.getBuildingRooms(17);

    expect(rooms).toEqual(['HH 211', 'HH 213', 'HH 311', 'HH 323']);
  });

  test('Returns null for the rooms of an unknown building', async () => {
    catalogRepository.getBuildingWithFloors.mockResolvedValue(null);

    expect(await buildingService.getBuildingRooms(999)).toBeNull();
  });
});

describe('Points of Interest Business Logic', () => {
  test('Returns all points of interest in the API shape', async () => {
    catalogRepository.listPointsOfInterest.mockResolvedValue([printerRow, fountainRow]);

    const points = await pointOfInterestService.getAllPointsOfInterest();

    expect(points).toEqual([
      { id: 2, type: 'printer', buildingId: 16, floor: 3, label: 'Printer' },
      // The database spelling 'water_fountain' is sent with a space.
      { id: 3, type: 'water fountain', buildingId: 28, floor: 2, label: 'Water Fountain' },
    ]);
  });

  test('Filters points by type', async () => {
    catalogRepository.listPointsOfInterest.mockResolvedValue([printerRow]);

    const points = await pointOfInterestService.getPointsOfInterestByType('printer');

    expect(catalogRepository.listPointsOfInterest).toHaveBeenCalledWith({ type: 'printer' });
    expect(points).toHaveLength(1);
    expect(points[0].type).toBe('printer');
  });

  test('Filters points case-insensitively', async () => {
    catalogRepository.listPointsOfInterest.mockResolvedValue([printerRow]);

    await pointOfInterestService.getPointsOfInterestByType('  PRINTER ');

    expect(catalogRepository.listPointsOfInterest).toHaveBeenCalledWith({ type: 'printer' });
  });

  test('Accepts the type spelled with a space or an underscore', async () => {
    catalogRepository.listPointsOfInterest.mockResolvedValue([fountainRow]);

    await pointOfInterestService.getPointsOfInterestByType('Water Fountain');
    await pointOfInterestService.getPointsOfInterestByType('water_fountain');

    expect(catalogRepository.listPointsOfInterest).toHaveBeenNthCalledWith(1, {
      type: 'water_fountain',
    });
    expect(catalogRepository.listPointsOfInterest).toHaveBeenNthCalledWith(2, {
      type: 'water_fountain',
    });
  });

  test('Returns an empty list for an unknown type without querying', async () => {
    expect(await pointOfInterestService.getPointsOfInterestByType('helipad')).toEqual([]);
    expect(catalogRepository.listPointsOfInterest).not.toHaveBeenCalled();
  });

  test('Returns every point for a blank type', async () => {
    catalogRepository.listPointsOfInterest.mockResolvedValue([printerRow, fountainRow]);

    const points = await pointOfInterestService.getPointsOfInterestByType('   ');

    expect(catalogRepository.listPointsOfInterest).toHaveBeenCalledWith();
    expect(points).toHaveLength(2);
  });

  test('Returns a point by ID, or null when it does not exist', async () => {
    catalogRepository.listPointsOfInterest.mockResolvedValueOnce([printerRow]);
    catalogRepository.listPointsOfInterest.mockResolvedValueOnce([]);

    expect(await pointOfInterestService.getPointOfInterestById(2)).toMatchObject({ id: 2 });
    expect(await pointOfInterestService.getPointOfInterestById(999)).toBeNull();
  });

  test('Returns points from a specific building', async () => {
    catalogRepository.listPointsOfInterest.mockResolvedValue([printerRow]);

    const points = await pointOfInterestService.getPointsOfInterestByBuilding(16);

    expect(catalogRepository.listPointsOfInterest).toHaveBeenCalledWith({ buildingId: 16 });
    expect(points.every((point) => point.buildingId === 16)).toBe(true);
  });
});

describe('Search Business Logic', () => {
  test('Maps building, room, and POI rows to the search result shapes', async () => {
    catalogRepository.searchLocations.mockResolvedValue([
      { kind: 'building', id: 17, name: 'Hiemenga Hall', building_id: 17, floor_level: null },
      { kind: 'room', id: 40, name: 'Classroom 211', building_id: 17, floor_level: 2 },
      { kind: 'poi', id: 2, name: 'Printer', building_id: 16, floor_level: 3 },
    ]);
    catalogRepository.listRoomLabels.mockResolvedValue([
      { id: 40, room_number: '211', floors: { buildings: { code: 'HH' } } },
    ]);

    const results = await searchService.searchAll('hiemenga');

    expect(catalogRepository.listRoomLabels).toHaveBeenCalledWith([40]);
    expect(results).toEqual([
      { kind: 'building', id: 17, name: 'Hiemenga Hall' },
      { kind: 'room', buildingId: 17, floor: 2, name: 'HH 211' },
      { kind: 'poi', id: 2, name: 'Printer' },
    ]);
  });

  test('Sends the trimmed query to the database', async () => {
    catalogRepository.searchLocations.mockResolvedValue([]);
    catalogRepository.listRoomLabels.mockResolvedValue([]);

    await searchService.searchAll('  HEKMAN  ');

    expect(catalogRepository.searchLocations).toHaveBeenCalledWith('HEKMAN');
  });

  test('Returns an empty array when nothing matches', async () => {
    catalogRepository.searchLocations.mockResolvedValue([]);
    catalogRepository.listRoomLabels.mockResolvedValue([]);

    expect(await searchService.searchAll('xyz123')).toEqual([]);
  });

  test('Returns an empty array for blank queries without querying', async () => {
    expect(await searchService.searchAll('   ')).toEqual([]);
    expect(catalogRepository.searchLocations).not.toHaveBeenCalled();
  });
});
