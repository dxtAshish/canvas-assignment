'use strict';

const chartDataService = require('../services/chartData.service');

function listDatasets(_req, res) {
  res.json({ data: chartDataService.listDatasets() });
}

function getDataset(req, res) {
  const { dataset } = req.validated.params;
  const { points } = req.validated.query;
  res.set('Cache-Control', 'no-store');
  res.json({ data: chartDataService.generate(dataset, points) });
}

module.exports = { listDatasets, getDataset };
