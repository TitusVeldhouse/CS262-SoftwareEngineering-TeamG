const express = require('express');
const cors = require('cors');
const { buildings, pointsOfInterest } = require('./data');

const app = express();
app.use(cors());
app.use(express.json());

//Versions included in the API
// GET all buildings
app.get('/api/v1/buildings', (req, res) => {
    res.json(buildings.map((id, name, isParkingLot) => ({id, name, isParkingLot})));
});

// GET one building including its rooms and floors
app.get('/api/v1/buildings/:id', (req, res) => { const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({error: 'ID must be an integer'});
    const building = buildings.find(b => b.id === id);
    if (!building) {
        return res.status(404).json({error: 'Building not found'});
    }
    res.json(building);
});

// GET points of interst and filter
app.get('/api/v1/points-of-interest', (req, res) => {
  const { type } = req.query;
  res.json(type?pointsOfInterest.filter(p => p.type === type) : pointsOfInterest);
});

/**
 * GET /api/v1/search?q=<text>
 *
 * Searches buildings, rooms, and points of interest for a case-insensitive
 * substring match.
 *
 * Query parameters:
 *   q (string, required): the search text. Leading and trailing whitespace is trimmed.
 *
 * Responses:
 *   200: an array of results, empty if nothing matches. Each result is one of:
 *     { kind: 'building', id: number, name: string }
 *       matched on the building name.
 *     { kind: 'room', buildingId: number, floor: number, name: string }
 *       matched on the room number (e.g. 'SB 101'); floor is the level number.
 *     { kind: 'poi', id: number, name: string }
 *       matched on the POI label or type; name is the label.
 *   400: { error: 'Query parameter q is required' } when q is missing or blank.
 */
app.get('/api/v1/search', (req, res) => {
  const { q } = req.query;
  if (typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }
  const term = q.trim().toLowerCase();
  const matches = (text) => text.toLowerCase().includes(term);

  const buildingResults = buildings
    .filter((b) => matches(b.name))
    .map((b) => ({ kind: 'building', id: b.id, name: b.name }));

  const roomResults = buildings.flatMap((b) =>
    b.floors.flatMap((f) =>
      f.rooms
        .filter(matches)
        .map((room) => ({ kind: 'room', buildingId: b.id, floor: f.level, name: room }))
    )
  );

  const poiResults = pointsOfInterest
    .filter((p) => matches(p.label) || matches(p.type))
    .map((p) => ({ kind: 'poi', id: p.id, name: p.label }));

  res.json([...buildingResults, ...roomResults, ...poiResults]);
});


// JSON error responses
app.use((req, res) => {
    res.status(404).json({error: 'Route not found'});
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({error: 'Internal Server Error'});
});

module.exports = app;