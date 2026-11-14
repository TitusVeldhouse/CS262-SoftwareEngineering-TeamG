const express = require('express');
const cors = require('cors');

const buildingService = require('./business/buildingService');
const pointOfInterestService = require('./business/pointOfInterestService');
const searchService = require('./business/searchService');
const { accountStore } = require('./accountStore');

const app = express();

app.use(cors());
app.use(express.json());

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  const auth = accountStore.authenticateToken(token);
  if (!auth) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.authToken = token;
  req.user = auth.user;
  req.profile = auth.profile;
  return next();
}

// GET all buildings
app.get('/api/v1/buildings', (req, res) => {
  const result = buildingService.getAllBuildings();
  res.json(result);
});

// GET one building including its rooms and floors
app.get('/api/v1/buildings/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({
      error: 'ID must be an integer',
    });
  }

  const building = buildingService.getBuildingById(id);

  if (!building) {
    return res.status(404).json({
      error: 'Building not found',
    });
  }

  res.json(building);
});

// GET points of interest and filter by type
app.get('/api/v1/points-of-interest', (req, res) => {
  const { type } = req.query;

  const result = pointOfInterestService.getPointsOfInterestByType(type);

  res.json(result);
});

// GET global search
app.get('/api/v1/search', (req, res) => {
  const { q } = req.query;

  if (typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json({
      error: 'Query parameter q is required',
    });
  }

  const results = searchService.searchAll(q);

  res.json(results);
});

// ---------------------------------------------------------------------------
// Account Auth & Profile Endpoints (auth_users & profiles from domain model)
// ---------------------------------------------------------------------------

app.post('/api/v1/auth/register', (req, res) => {
  try {
    const result = accountStore.register(req.body || {});
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.post('/api/v1/auth/login', (req, res) => {
  try {
    const result = accountStore.login(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
  }
});

app.post('/api/v1/auth/logout', (req, res) => {
  const token = extractBearerToken(req);
  if (token) {
    accountStore.revokeToken(token);
  }
  res.json({ ok: true });
});

app.get('/api/v1/auth/me', requireAuth, (req, res) => {
  res.json({
    user: req.user,
    profile: req.profile,
  });
});

app.patch('/api/v1/auth/profile', requireAuth, (req, res) => {
  try {
    const profile = accountStore.updateProfile(req.user.id, req.body || {});
    res.json({ profile });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Logged-in User Favorites Endpoints (favorites table from domain model)
// ---------------------------------------------------------------------------

app.get('/api/v1/favorites', requireAuth, (req, res) => {
  const { rows, places } = accountStore.listFavorites(req.user.id);
  res.json({ favorites: places, rows });
});

app.post('/api/v1/favorites', requireAuth, (req, res) => {
  try {
    const result = accountStore.addFavorite(req.user.id, req.body);
    res.status(201).json({
      row: result.row,
      favorite: result.place,
      favorites: result.places,
      rows: result.rows,
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.put('/api/v1/favorites', requireAuth, (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body) ? body : body.favorites;
    const mergeExisting = Boolean(body && !Array.isArray(body) && body.merge);
    const { rows, places } = accountStore.syncFavorites(req.user.id, items, {
      mergeExisting,
    });
    res.json({ favorites: places, rows });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.delete('/api/v1/favorites', requireAuth, (req, res) => {
  const { rows, places } = accountStore.clearFavorites(req.user.id);
  res.json({ favorites: places, rows });
});

app.delete('/api/v1/favorites/:favoriteId', requireAuth, (req, res) => {
  try {
    const { rows, places } = accountStore.removeFavorite(
      req.user.id,
      req.params.favoriteId
    );
    res.json({ favorites: places, rows });
  } catch (err) {
    res.status(err.status || 404).json({ error: err.message });
  }
});

// JSON error responses
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
  });
});

module.exports = app;
