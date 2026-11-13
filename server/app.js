
const express = require('express');
const cors = require('cors');

const buildingService = require('./business/buildingService');
const pointOfInterestService = require('./business/pointOfInterestService');
const searchService = require('./business/searchService');

const app = express();

app.use(cors());
app.use(express.json());

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
            error: 'ID must be an integer'
        });
    }

    const building = buildingService.getBuildingById(id);

    if (!building) {
        return res.status(404).json({
            error: 'Building not found'
        });
    }

    res.json(building);
});

// GET points of interest and filter by type
app.get('/api/v1/points-of-interest', (req, res) => {
    const { type } = req.query;

    const result = pointOfInterestService
        .getPointsOfInterestByType(type);

    res.json(result);
});

// GET global search
app.get('/api/v1/search', (req, res) => {
    const { q } = req.query;

    if (typeof q !== 'string' || q.trim() === '') {
        return res.status(400).json({
            error: 'Query parameter q is required'
        });
    }

    const results = searchService.searchAll(q);

    res.json(results);
});

// JSON error responses
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found'
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);

    res.status(500).json({
        error: 'Internal Server Error'
    });
});

module.exports = app;
