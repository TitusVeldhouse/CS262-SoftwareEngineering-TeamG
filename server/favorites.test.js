const request = require('supertest');
const app = require('./app');
const { accountStore, resolveFavoriteTarget, projectFavoriteRow } = require('./accountStore');

describe('Server-Side Favorites List Ingestion & Management', () => {
  let userToken;
  let userId;
  let otherUserToken;
  let otherUserId;

  beforeEach(async () => {
    accountStore.reset();

    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'tester@calvin.edu',
      password: 'password123',
      displayName: 'Test User',
    });
    userToken = reg.body.token;
    userId = reg.body.user.id;

    const otherReg = await request(app).post('/api/v1/auth/register').send({
      email: 'other@calvin.edu',
      password: 'password123',
      displayName: 'Other User',
    });
    otherToken = otherReg.body.token;
    otherUserId = otherReg.body.user.id;
  });

  describe('Direct Model/Store Helpers (resolveFavoriteTarget & projectFavoriteRow)', () => {
    it('resolves building targets and enforces single foreign-key rule', () => {
      const target = resolveFavoriteTarget({
        id: 'building:Hiemenga Hall',
        kind: 'building',
        title: 'Hiemenga Hall',
        building: 'Hiemenga Hall',
      });
      expect(target.building_id).toBe(3);
      expect(target.room_id).toBeNull();
      expect(target.poi_id).toBeNull();
      expect(target.floor_label).toBeNull();
    });

    it('resolves floor targets with building_id and floor_label', () => {
      const target = resolveFavoriteTarget({
        id: 'floor:Science Building:Level 2',
        kind: 'floor',
        title: 'Science Building · Level 2',
        building: 'Science Building',
        floor: 'Level 2',
      });
      expect(target.building_id).toBe(1);
      expect(target.room_id).toBeNull();
      expect(target.poi_id).toBeNull();
      expect(target.floor_label).toBe('Level 2');
    });

    it('resolves room targets to room_id', () => {
      const target = resolveFavoriteTarget({
        id: 'room:HH-211',
        kind: 'room',
        title: 'Classroom 211',
        roomId: 'HH-211',
      });
      expect(target.building_id).toBeNull();
      expect(target.room_id).toBeGreaterThan(0);
      expect(target.poi_id).toBeNull();
    });

    it('resolves POI targets to poi_id', () => {
      const target = resolveFavoriteTarget({
        id: 'poi:Restrooms',
        kind: 'poi',
        title: 'Restrooms',
        poiFilter: 'Restrooms',
      });
      expect(target.building_id).toBeNull();
      expect(target.room_id).toBeNull();
      expect(target.poi_id).toBe(5);
    });

    it('throws error when multiple FK targets are provided', () => {
      expect(() => {
        resolveFavoriteTarget({ building_id: 1, room_id: 2 });
      }).toThrow('Favorite must reference exactly one target');
    });

    it('throws error when target does not exist', () => {
      expect(() => {
        resolveFavoriteTarget({ id: 'room:UNKNOWN-9999' });
      }).toThrow('Unknown room: UNKNOWN-9999');
    });
  });

  describe('Receiving and Syncing Lists via PUT /api/v1/favorites', () => {
    it('receives a full list of mixed favorite kinds and persists them under the user account', async () => {
      const mixedList = [
        {
          id: 'building:Hekman Library',
          kind: 'building',
          title: 'Hekman Library',
          campusLocation: 'Hekman Library',
          building: 'Hekman Library',
        },
        {
          id: 'floor:Hiemenga Hall:Level 2',
          kind: 'floor',
          title: 'Hiemenga Hall · Level 2',
          building: 'Hiemenga Hall',
          floor: 'Level 2',
        },
        {
          id: 'room:HH-211',
          kind: 'room',
          title: 'Classroom 211',
          building: 'Hiemenga Hall',
          floor: 'Level 2',
          roomId: 'HH-211',
          roomNumber: '211',
        },
        {
          id: 'poi:Restrooms',
          kind: 'poi',
          title: 'Restrooms',
          poiFilter: 'Restrooms',
        },
      ];

      const res = await request(app)
        .put('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ favorites: mixedList });

      expect(res.status).toBe(200);
      expect(res.body.favorites).toHaveLength(4);
      expect(res.body.rows).toHaveLength(4);

      // Verify each stored row adheres to the domain model constraint
      for (const row of res.body.rows) {
        expect(row.user_id).toBe(userId);
        const fkCount =
          (row.building_id !== null ? 1 : 0) +
          (row.room_id !== null ? 1 : 0) +
          (row.poi_id !== null ? 1 : 0);
        expect(fkCount).toBe(1);
      }
    });

    it('deduplicates redundant items sent within the same favorites list', async () => {
      const duplicateList = [
        {
          id: 'building:Science Building',
          kind: 'building',
          title: 'Science Building',
          campusLocation: 'Science Building',
          building: 'Science Building',
        },
        {
          id: 'building:Science Building',
          kind: 'building',
          title: 'Science Building',
          campusLocation: 'Science Building',
          building: 'Science Building',
        },
      ];

      const res = await request(app)
        .put('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ favorites: duplicateList });

      expect(res.status).toBe(200);
      expect(res.body.favorites).toHaveLength(1);
      expect(res.body.rows).toHaveLength(1);
    });

    it('replaces previous favorites list completely when merge is not specified', async () => {
      // Step 1: Send initial list of 2 items
      await request(app)
        .put('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          favorites: [
            { id: 'building:Hekman Library', kind: 'building', title: 'Hekman Library', building: 'Hekman Library' },
            { id: 'poi:Printers', kind: 'poi', title: 'Printers', poiFilter: 'Printers' },
          ],
        });

      // Step 2: Send new list containing 1 different item
      const replaceRes = await request(app)
        .put('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          favorites: [
            { id: 'room:HH-211', kind: 'room', title: 'Classroom 211', roomId: 'HH-211' },
          ],
        });

      expect(replaceRes.status).toBe(200);
      expect(replaceRes.body.favorites).toHaveLength(1);
      expect(replaceRes.body.favorites[0].id).toBe('room:HH-211');
    });

    it('merges with existing favorites when merge: true is received', async () => {
      // Initial list
      await request(app)
        .put('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          favorites: [
            { id: 'building:Hekman Library', kind: 'building', title: 'Hekman Library', building: 'Hekman Library' },
          ],
        });

      // Merge a second item
      const mergeRes = await request(app)
        .put('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          favorites: [
            { id: 'poi:Restrooms', kind: 'poi', title: 'Restrooms', poiFilter: 'Restrooms' },
          ],
          merge: true,
        });

      expect(mergeRes.status).toBe(200);
      expect(mergeRes.body.favorites).toHaveLength(2);
      expect(mergeRes.body.favorites.map((f) => f.id)).toEqual(
        expect.arrayContaining(['building:Hekman Library', 'poi:Restrooms'])
      );
    });

    it('receives an empty array to clear all favorites for the user', async () => {
      // Seed 1 item
      await request(app)
        .post('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ id: 'building:Hekman Library', kind: 'building', title: 'Hekman Library', building: 'Hekman Library' });

      // Put empty list
      const emptyRes = await request(app)
        .put('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ favorites: [] });

      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body.favorites).toEqual([]);
      expect(emptyRes.body.rows).toEqual([]);
    });

    it('rejects malformed favorites payloads with 400 Bad Request', async () => {
      const notAnArray = await request(app)
        .put('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ favorites: 'not-an-array' });
      expect(notAnArray.status).toBe(400);
      expect(notAnArray.body.error).toMatch(/must be an array/i);

      const invalidItem = await request(app)
        .put('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          favorites: [{ id: 'room:NON_EXISTENT_ROOM_XYZ' }],
        });
      expect(invalidItem.status).toBe(400);
      expect(invalidItem.body.error).toMatch(/unknown room/i);
    });
  });

  describe('Receiving Guest Favorites Lists During Auth', () => {
    it('catches and ingests a guest favorites list during user registration', async () => {
      const regWithList = await request(app).post('/api/v1/auth/register').send({
        email: 'newguest@calvin.edu',
        password: 'password123',
        displayName: 'Guest User',
        guestFavorites: [
          {
            id: 'poi:Water Fountains',
            kind: 'poi',
            title: 'Water Fountains',
            poiFilter: 'Water Fountains',
          },
        ],
      });

      expect(regWithList.status).toBe(201);
      expect(regWithList.body.favorites).toHaveLength(1);
      expect(regWithList.body.favorites[0].id).toBe('poi:Water Fountains');
    });

    it('catches and ingests a guest favorites list during user login', async () => {
      const loginWithList = await request(app).post('/api/v1/auth/login').send({
        email: 'tester@calvin.edu',
        password: 'password123',
        guestFavorites: [
          {
            id: 'room:HH-211',
            kind: 'room',
            title: 'Classroom 211',
            roomId: 'HH-211',
          },
        ],
      });

      expect(loginWithList.status).toBe(200);
      expect(loginWithList.body.favorites).toHaveLength(1);
      expect(loginWithList.body.favorites[0].id).toBe('room:HH-211');
    });
  });

  describe('User Isolation When Receiving Favorites Lists', () => {
    it('ensures lists received from User A never leak into or overwrite User B', async () => {
      // User A sends 2 favorites
      await request(app)
        .put('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          favorites: [
            { id: 'building:Hekman Library', kind: 'building', title: 'Hekman Library', building: 'Hekman Library' },
            { id: 'poi:Printers', kind: 'poi', title: 'Printers', poiFilter: 'Printers' },
          ],
        });

      // User B sends 1 favorite
      await request(app)
        .put('/api/v1/favorites')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          favorites: [
            { id: 'building:Science Building', kind: 'building', title: 'Science Building', building: 'Science Building' },
          ],
        });

      // User A reads their list
      const resA = await request(app)
        .get('/api/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`);
      expect(resA.status).toBe(200);
      expect(resA.body.favorites).toHaveLength(2);
      expect(resA.body.favorites.map((f) => f.id)).toEqual(
        expect.arrayContaining(['building:Hekman Library', 'poi:Printers'])
      );

      // User B reads their list
      const resB = await request(app)
        .get('/api/v1/favorites')
        .set('Authorization', `Bearer ${otherToken}`);
      expect(resB.status).toBe(200);
      expect(resB.body.favorites).toHaveLength(1);
      expect(resB.body.favorites[0].id).toBe('building:Science Building');
    });
  });
});
