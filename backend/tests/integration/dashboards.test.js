'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, pool, newUserAgent, demoAgent, textElement, chartElement, section,
} = require('../helpers');

after(() => pool.end());

describe('Dashboards API', () => {
  let alice;
  let bob;
  let dashboard;

  before(async () => {
    ({ agent: alice } = await newUserAgent());
    ({ agent: bob } = await newUserAgent());
  });

  it('requires authentication', async () => {
    await request(app).get('/api/dashboards').expect(401);
  });

  it('validates dashboard creation', async () => {
    const res = await alice.post('/api/dashboards').send({ name: '', canvasWidth: 50 }).expect(422);
    const fields = res.body.error.details.map((d) => d.field);
    assert.deepEqual(fields.sort(), ['canvasWidth', 'name']);
  });

  it('creates, lists, updates and reads a dashboard', async () => {
    const created = await alice.post('/api/dashboards').send({ name: '  KPIs  ', description: 'Main' }).expect(201);
    dashboard = created.body.data;
    assert.equal(dashboard.name, 'KPIs');
    assert.equal(dashboard.version, 1);

    const list = await alice.get('/api/dashboards').expect(200);
    assert.equal(list.body.data.length, 1);

    const updated = await alice.patch(`/api/dashboards/${dashboard.id}`).send({ name: 'KPIs v2' }).expect(200);
    assert.equal(updated.body.data.name, 'KPIs v2');
    assert.equal(updated.body.data.version, 2);
    dashboard = updated.body.data;

    const read = await alice.get(`/api/dashboards/${dashboard.id}`).expect(200);
    assert.deepEqual(read.body.data.sections, []);
  });

  it('isolates dashboards between users (404, not 403)', async () => {
    await bob.get(`/api/dashboards/${dashboard.id}`).expect(404);
    await bob.patch(`/api/dashboards/${dashboard.id}`).send({ name: 'hijack' }).expect(404);
    await bob.put(`/api/dashboards/${dashboard.id}/layout`).send({ version: 2, sections: [] }).expect(404);
    await bob.delete(`/api/dashboards/${dashboard.id}`).expect(404);
    const list = await bob.get('/api/dashboards').expect(200);
    assert.equal(list.body.data.length, 0);
  });

  it('rejects invalid ids', async () => {
    await alice.get('/api/dashboards/abc').expect(422);
    await alice.get('/api/dashboards/-1').expect(422);
  });

  it('saves and reloads a layout with settings, sanitizing rich text', async () => {
    const payload = {
      version: dashboard.version,
      settings: { name: 'Saved', description: 'd', canvasWidth: 1200, backgroundColor: '#ffffff' },
      sections: [section([
        textElement({ content: { html: '<p onclick="x()">Hi <b>there</b><script>alert(1)</script><img src=x onerror=alert(1)><span style="font-size:200px;position:fixed">big</span></p>', backgroundColor: '#ffffff' } }),
        chartElement(),
      ])],
    };
    const res = await alice.put(`/api/dashboards/${dashboard.id}/layout`).send(payload).expect(200);
    const saved = res.body.data;
    assert.equal(saved.version, dashboard.version + 1);
    assert.equal(saved.name, 'Saved');
    assert.equal(saved.sections.length, 1);
    assert.equal(saved.sections[0].elements.length, 2);

    const html = saved.sections[0].elements.find((e) => e.type === 'text').content.html;
    assert.ok(!html.includes('script'));
    assert.ok(!html.includes('onclick'));
    assert.ok(!html.includes('onerror'));
    assert.ok(!html.includes('position'));
    assert.ok(html.includes('font-size:96px'), 'font size is clamped to the maximum');
    assert.ok(html.includes('<b>there</b>'));

    const reloaded = await alice.get(`/api/dashboards/${dashboard.id}`).expect(200);
    assert.deepEqual(reloaded.body.data.sections, saved.sections);
    dashboard = reloaded.body.data;
  });

  it('rejects stale versions with 409 VERSION_CONFLICT', async () => {
    const res = await alice.put(`/api/dashboards/${dashboard.id}/layout`)
      .send({ version: dashboard.version - 1, sections: [] }).expect(409);
    assert.equal(res.body.error.code, 'VERSION_CONFLICT');
  });

  it('rejects elements outside their section and sections outside the canvas', async () => {
    const res = await alice.put(`/api/dashboards/${dashboard.id}/layout`).send({
      version: dashboard.version,
      sections: [section([textElement({ x: 500, width: 200 })], { x: 1100, width: 600 })],
    }).expect(422);
    const fields = res.body.error.details.map((d) => d.field);
    assert.ok(fields.includes('sections.0.width'));
    assert.ok(fields.includes('sections.0.elements.0'));
  });

  it('rejects manual chart series that do not match the labels', async () => {
    const bad = chartElement();
    bad.content.series[0].data = [1, 2];
    const res = await alice.put(`/api/dashboards/${dashboard.id}/layout`)
      .send({ version: dashboard.version, sections: [section([bad])] }).expect(422);
    assert.equal(res.body.error.details[0].field, 'sections.0.elements.0.content.series.0.data');
  });

  it('rejects unknown element types and malformed content', async () => {
    const res = await alice.put(`/api/dashboards/${dashboard.id}/layout`).send({
      version: dashboard.version,
      sections: [section([{ ...textElement(), type: 'video' }, chartElement({ content: { chartType: 'pie', series: [] } })])],
    }).expect(422);
    const fields = res.body.error.details.map((d) => d.field);
    assert.ok(fields.includes('sections.0.elements.0.type'));
    assert.ok(fields.some((f) => f.startsWith('sections.0.elements.1.content')));
  });

  it('rejects images that belong to someone else', async () => {
    const res = await alice.put(`/api/dashboards/${dashboard.id}/layout`).send({
      version: dashboard.version,
      sections: [section([{
        type: 'image', x: 0, y: 0, width: 100, height: 100, content: { url: '/uploads/sample-banner-0001.png', alt: '', fit: 'cover' },
      }])],
    }).expect(422);
    assert.match(res.body.error.message, /images/);
  });

  it('strips data from dynamic charts (regenerated by the API)', async () => {
    const dynamic = chartElement();
    dynamic.content.source = 'dynamic';
    dynamic.content.dataset = 'traffic';
    dynamic.content.labels = ['x'];
    const res = await alice.put(`/api/dashboards/${dashboard.id}/layout`)
      .send({ version: dashboard.version, sections: [section([dynamic])] }).expect(200);
    const content = res.body.data.sections[0].elements[0].content;
    assert.deepEqual(content.labels, []);
    assert.deepEqual(content.series[0].data, []);
    dashboard = res.body.data;
  });

  it('prevents shrinking the canvas below existing sections', async () => {
    const res = await alice.patch(`/api/dashboards/${dashboard.id}`).send({ canvasWidth: 600 }).expect(422);
    assert.equal(res.body.error.details[0].field, 'canvasWidth');
  });

  it('handles malformed JSON and unknown routes', async () => {
    const res = await alice.post('/api/dashboards').set('Content-Type', 'application/json').send('{bad json').expect(400);
    assert.equal(res.body.error.code, 'BAD_REQUEST');
    await alice.get('/api/nope').expect(404);
  });

  it('blocks cross-origin state-changing requests', async () => {
    await alice.post('/api/dashboards').set('Origin', 'https://evil.example').send({ name: 'x' }).expect(403);
  });

  it('reorders dashboards (drag and drop) without touching their updated date', async () => {
    const second = (await alice.post('/api/dashboards').send({ name: 'Second' }).expect(201)).body.data;
    let list = (await alice.get('/api/dashboards').expect(200)).body.data;
    assert.equal(list[0].id, second.id, 'new dashboards are listed first');

    const reversed = list.map((d) => d.id).reverse();
    await alice.put('/api/dashboards/order').send({ ids: reversed }).expect(204);
    list = (await alice.get('/api/dashboards').expect(200)).body.data;
    assert.deepEqual(list.map((d) => d.id), reversed);
    const moved = list.find((d) => d.id === second.id);
    assert.equal(new Date(moved.updatedAt).getTime(), new Date(second.updatedAt).getTime());

    await alice.delete(`/api/dashboards/${second.id}`).expect(204);
  });

  it('validates reorder requests and rejects other users\' dashboards', async () => {
    await alice.put('/api/dashboards/order').send({ ids: [] }).expect(422);
    await alice.put('/api/dashboards/order').send({ ids: [dashboard.id, dashboard.id] }).expect(422);
    await alice.put('/api/dashboards/order').send({ ids: ['x'] }).expect(422);
    const res = await bob.put('/api/dashboards/order').send({ ids: [dashboard.id] }).expect(422);
    assert.match(res.body.error.details[0].message, /Unknown dashboard/);
  });

  it('deletes a dashboard and cascades its layout', async () => {
    await alice.delete(`/api/dashboards/${dashboard.id}`).expect(204);
    await alice.get(`/api/dashboards/${dashboard.id}`).expect(404);
    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM sections WHERE dashboard_id = ?', [dashboard.id]);
    assert.equal(rows[0].n, 0);
  });

  it('serves the seeded sample dashboard to the demo user', async () => {
    const demo = await demoAgent();
    const res = await demo.get('/api/dashboards/1').expect(200);
    assert.equal(res.body.data.sections.length, 4);
    const types = res.body.data.sections.flatMap((s) => s.elements.map((e) => e.type)).sort();
    assert.deepEqual(types, ['chart', 'chart', 'image', 'text', 'text']);
  });
});

describe('Chart data API', () => {
  it('generates dynamic data for a dataset', async () => {
    const demo = await demoAgent();
    const res = await demo.get('/api/chart-data/sales?points=5').expect(200);
    assert.equal(res.body.data.labels.length, 5);
    assert.equal(res.body.data.series[0].data.length, 5);
    assert.equal(res.headers['cache-control'], 'no-store');
  });

  it('validates dataset and points', async () => {
    const demo = await demoAgent();
    await demo.get('/api/chart-data/unknown').expect(422);
    await demo.get('/api/chart-data/sales?points=500').expect(422);
  });
});
