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


describe('unknown routes', () => {
  it('returns a 404', async () => {
    const res = await request(app).get('/api/v1/nothing');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });
});