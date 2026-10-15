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


// JSON error responses
app.use((req, res) => {
    res.status(404).json({error: 'Route not found'});
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({error: 'Internal Server Error'});
});

module.exports = app;