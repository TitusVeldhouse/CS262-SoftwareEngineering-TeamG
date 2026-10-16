const request = require('supertest');
const app = require('./app');


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