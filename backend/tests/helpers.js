'use strict';

/**
 * Test bootstrap: uses a separate database (<DB_NAME>_test), recreated from
 * database/schema.sql + seed.sql before each test file.
 */
const path = require('path');
const { execFileSync } = require('child_process');

process.env.NODE_ENV = 'test';
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
process.env.DB_NAME = process.env.TEST_DB_NAME || `${process.env.DB_NAME || 'dashboard_builder'}_test`;

execFileSync(process.execPath, [path.resolve(__dirname, '../scripts/db-setup.js'), '--reset'], {
  env: process.env,
  stdio: 'ignore',
});

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');

let userCounter = 0;

/** Registers a fresh user and returns a supertest agent carrying its session cookie. */
async function newUserAgent() {
  userCounter += 1;
  const agent = request.agent(app);
  const email = `user${Date.now()}${userCounter}@example.com`;
  const res = await agent.post('/api/auth/register').send({ name: 'Test User', email, password: 'Passw0rd!' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.data };
}

async function demoAgent() {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: 'demo@example.com', password: 'Demo@1234' }).expect(200);
  return agent;
}

const textElement = (overrides = {}) => ({
  type: 'text', x: 10, y: 10, width: 200, height: 80, zIndex: 1,
  content: { html: '<p>Hello</p>', backgroundColor: 'transparent' },
  ...overrides,
});

const chartElement = (overrides = {}) => ({
  type: 'chart', x: 10, y: 100, width: 300, height: 200, zIndex: 2,
  content: {
    chartType: 'bar', title: 'Test', source: 'manual', dataset: 'sales', points: 3, refreshSeconds: 0,
    labels: ['A', 'B', 'C'], series: [{ label: 'S1', color: '#4f46e5', data: [1, 2, 3] }],
  },
  ...overrides,
});

const section = (elements = [], overrides = {}) => ({
  title: 'Section', x: 20, y: 30, width: 600, height: 400, zIndex: 1, backgroundColor: '#ffffff', elements, ...overrides,
});

module.exports = { app, request, pool, newUserAgent, demoAgent, textElement, chartElement, section };
