'use strict';

const dashboardService = require('../services/dashboard.service');

async function list(req, res) {
  res.json({ data: await dashboardService.list(req.user.id) });
}

async function create(req, res) {
  const dashboard = await dashboardService.create(req.user.id, req.body);
  res.status(201).location(`/api/dashboards/${dashboard.id}`).json({ data: dashboard });
}

async function show(req, res) {
  res.json({ data: await dashboardService.getLayout(req.validated.params.id, req.user.id) });
}

async function update(req, res) {
  res.json({ data: await dashboardService.update(req.validated.params.id, req.user.id, req.body) });
}

async function remove(req, res) {
  await dashboardService.remove(req.validated.params.id, req.user.id);
  res.status(204).end();
}

async function saveLayout(req, res) {
  res.json({ data: await dashboardService.saveLayout(req.validated.params.id, req.user.id, req.body) });
}

async function reorder(req, res) {
  await dashboardService.reorder(req.user.id, req.body.ids);
  res.status(204).end();
}

module.exports = {
  list, create, show, update, reorder, remove, saveLayout,
};
