const request = require('supertest');
const app = require('./app');
const { accountStore } = require('./accountStore');


describe('GET /api/v1/buildings', () => {
    it('Returns a list of the buildings', async () => {
        const res = await request(app).get('/api/v1/buildings');
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0]).toHaveProperty('name');
    });
});

describe('GET /api/v1/buildings/:id', () => {
    it('Returns one building with floors', async () => {
        const res = await request(app).get('/api/v1/buildings/1');
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(1);
        expect(Array.isArray(res.body.floors)).toBe(true);
    });
});

    it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/v1/buildings/999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
});


    it('returns 400 for a non-numeric id', async () => {
    const res = await request(app).get('/api/v1/buildings/abc');
    expect(res.status).toBe(400);
});

describe('GET /api/v1/points-of-interest', () => {
    it('returns all points of interest', async () => {
    const res = await request(app).get('/api/v1/points-of-interest');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(1);
  });


   it('filters by type', async () => {
    const res = await request(app).get('/api/v1/points-of-interest?type=printer');
    expect(res.status).toBe(200);
    expect(res.body.every(p => p.type === 'printer')).toBe(true);
  });

    it('returns an empty list for a type with no matches', async () => {
    const res = await request(app).get('/api/v1/points-of-interest?type=zzz');
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/v1/search', () => {
  it('finds a room by its number', async () => {
    const res = await request(app).get('/api/v1/search?q=sb 101');
    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({ kind: 'room', buildingId: 1, floor: 1, name: 'SB 101' });
  });

  it('finds a building by partial name', async () => {
    const res = await request(app).get('/api/v1/search?q=hekman');
    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({ kind: 'building', id: 2, name: 'Hekman Library' });
  });

  it('finds a point of interest by type or label', async () => {
    const res = await request(app).get('/api/v1/search?q=printer');
    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({ kind: 'poi', id: 2, name: 'Printer' });
  });

  it('matches case-insensitively', async () => {
    const lower = await request(app).get('/api/v1/search?q=hekman library');
    const upper = await request(app).get('/api/v1/search?q=HEKMAN LIBRARY');
    expect(upper.status).toBe(200);
    expect(upper.body).toEqual(lower.body);
    expect(upper.body).toContainEqual({ kind: 'building', id: 2, name: 'Hekman Library' });
  });

  it('returns 400 when q is missing', async () => {
    const res = await request(app).get('/api/v1/search');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Query parameter q is required' });
  });

  it('returns 400 when q is only whitespace', async () => {
    const res = await request(app).get('/api/v1/search?q=%20%20%20');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Query parameter q is required' });
  });

  it('returns an empty list when nothing matches', async () => {
    const res = await request(app).get('/api/v1/search?q=zzz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});


describe('unknown routes', () => {
  it('returns a 404', async () => {
    const res = await request(app).get('/api/v1/nothing');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });
});

describe('Account Auth & Favorites Domain Model (/api/v1/auth & /api/v1/favorites)', () => {
  beforeEach(() => {
    accountStore.reset();
  });

  it('requires authentication for /api/v1/auth/me and /api/v1/favorites', async () => {
    const meRes = await request(app).get('/api/v1/auth/me');
    expect(meRes.status).toBe(401);

    const favRes = await request(app).get('/api/v1/favorites');
    expect(favRes.status).toBe(401);

    const putRes = await request(app).put('/api/v1/favorites').send({ favorites: [] });
    expect(putRes.status).toBe(401);
  });

  it('registers a user with profile defaults, logs in, and revokes token on logout', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'Student@Calvin.edu',
      password: 'password123',
      displayName: 'Calvin Student',
    });

    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeTruthy();
    expect(reg.body.user.email).toBe('student@calvin.edu');
    expect(reg.body.user.password_hash).toBeUndefined();
    expect(reg.body.profile).toEqual({
      id: reg.body.user.id,
      display_name: 'Calvin Student',
      settings: {},
      is_admin: false,
    });
    expect(reg.body.favorites).toEqual([]);

    // Duplicate email rejected
    const dup = await request(app).post('/api/v1/auth/register').send({
      email: 'student@calvin.edu',
      password: 'password123',
    });
    expect(dup.status).toBe(409);

    // /me succeeds with Bearer token
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.profile.display_name).toBe('Calvin Student');

    // Update profile settings (FR-16)
    const patchProfile = await request(app)
      .patch('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ settings: { defaultBuilding: 'Hiemenga Hall' } });
    expect(patchProfile.status).toBe(200);
    expect(patchProfile.body.profile.settings).toEqual({
      defaultBuilding: 'Hiemenga Hall',
    });

    // Logout revokes token
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(logout.status).toBe(200);

    const afterLogout = await request(app)
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(afterLogout.status).toBe(401);

    // Wrong password rejected
    const badLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'student@calvin.edu',
      password: 'wrong-password',
    });
    expect(badLogin.status).toBe(401);
  });

  it('catches guest favorites on login, enforces the "one of" domain FK constraint, and returns user-scoped favorites', async () => {
    const userA = await request(app).post('/api/v1/auth/register').send({
      email: 'alice@calvin.edu',
      password: 'password123',
      displayName: 'Alice',
    });

    const userB = await request(app).post('/api/v1/auth/register').send({
      email: 'bob@calvin.edu',
      password: 'password123',
      displayName: 'Bob',
    });

    // Save a building favorite directly for Alice via client payload
    const addRes = await request(app)
      .post('/api/v1/favorites')
      .set('Authorization', `Bearer ${userA.body.token}`)
      .send({
        id: 'building:Hiemenga Hall',
        kind: 'building',
        title: 'Hiemenga Hall',
        campusLocation: 'Hiemenga Hall',
        building: 'Hiemenga Hall',
      });
    expect(addRes.status).toBe(201);
    expect(addRes.body.row).toMatchObject({
      user_id: userA.body.user.id,
      building_id: 3,
      room_id: null,
      poi_id: null,
    });

    // Reject payload violating "one of" FK constraint
    const badTarget = await request(app)
      .post('/api/v1/favorites')
      .set('Authorization', `Bearer ${userA.body.token}`)
      .send({ building_id: 1, room_id: 1 });
    expect(badTarget.status).toBe(400);

    // Logout Alice, then log back in carrying temporary guest favorites (room + POI)
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${userA.body.token}`);

    const loginA = await request(app).post('/api/v1/auth/login').send({
      email: 'alice@calvin.edu',
      password: 'password123',
      guestFavorites: [
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
      ],
    });

    expect(loginA.status).toBe(200);
    expect(loginA.body.favorites).toHaveLength(3);
    expect(loginA.body.favorites.map((f) => f.id)).toEqual(
      expect.arrayContaining([
        'building:Hiemenga Hall',
        'room:HH-211',
        'poi:Restrooms',
      ])
    );

    // Verify stored domain rows follow building_id / room_id / poi_id "one of" rule
    for (const row of loginA.body.rows) {
      const nonNullCount =
        (row.building_id !== null ? 1 : 0) +
        (row.room_id !== null ? 1 : 0) +
        (row.poi_id !== null ? 1 : 0);
      expect(nonNullCount).toBe(1);
      expect(row.user_id).toBe(userA.body.user.id);
    }

    // Bob should still see an empty favorites list
    const bobFavs = await request(app)
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${userB.body.token}`);
    expect(bobFavs.status).toBe(200);
    expect(bobFavs.body.favorites).toEqual([]);

    // Delete one item by client place ID and verify returned list updates
    const delOne = await request(app)
      .delete('/api/v1/favorites/poi%3ARestrooms')
      .set('Authorization', `Bearer ${loginA.body.token}`);
    expect(delOne.status).toBe(200);
    expect(delOne.body.favorites).toHaveLength(2);
    expect(delOne.body.favorites.some((f) => f.id === 'poi:Restrooms')).toBe(false);
  });
});