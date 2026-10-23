'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, pool } = require('../helpers');

after(() => pool.end());

describe('Auth API', () => {
  it('rejects invalid registration data with field-level details', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'X', email: 'not-an-email', password: 'short' })
      .expect(422);
    const fields = res.body.error.details.map((d) => d.field);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(fields.includes('name'));
    assert.ok(fields.includes('email'));
    assert.ok(fields.includes('password'));
  });

  it('enforces password complexity', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Jane Doe', email: 'weak@example.com', password: 'alllowercase1' })
      .expect(422);
    assert.match(res.body.error.details[0].message, /uppercase/);
  });

  it('registers a user, sets an httpOnly SameSite cookie and never returns the hash', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Jane Doe', email: 'Jane@Example.com', password: 'Str0ngPass' })
      .expect(201);
    assert.equal(res.body.data.email, 'jane@example.com');
    assert.equal(res.body.data.passwordHash, undefined);
    const cookie = res.headers['set-cookie'][0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
  });

  it('rejects duplicate emails with 409', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Jane Again', email: 'jane@example.com', password: 'Str0ngPass' })
      .expect(409);
    assert.equal(res.body.error.code, 'EMAIL_TAKEN');
  });

  it('rejects wrong credentials with a generic message', async () => {
    const wrongPassword = await request(app).post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'nope' }).expect(401);
    const unknownUser = await request(app).post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'nope' }).expect(401);
    assert.equal(wrongPassword.body.error.message, unknownUser.body.error.message);
  });

  it('logs in, exposes /me and logs out', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'jane@example.com', password: 'Str0ngPass' }).expect(200);
    const me = await agent.get('/api/auth/me').expect(200);
    assert.equal(me.body.data.name, 'Jane Doe');
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('rejects tampered tokens', async () => {
    await request(app).get('/api/auth/me').set('Cookie', 'db_session=abc.def.ghi').expect(401);
  });

  it('exposes the shared validation limits publicly', async () => {
    const res = await request(app).get('/api/meta/config').expect(200);
    assert.equal(res.body.data.CANVAS.MAX_WIDTH, 2400);
    assert.ok(res.body.data.DATASETS.length > 0);
    assert.ok(res.body.data.UPLOAD_MAX_BYTES > 0);
  });

  it('accepts state-changing requests from configured client origins only', async () => {
    await request(app).post('/api/auth/logout').set('Origin', 'http://localhost:5173').expect(204);
    await request(app).post('/api/auth/logout').set('Origin', 'http://evil.example').expect(403);
  });
});
