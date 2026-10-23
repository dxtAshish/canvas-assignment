'use strict';

const fs = require('fs');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, pool, newUserAgent, demoAgent } = require('../helpers');

const PNG = fs.readFileSync(path.resolve(__dirname, '../../database/assets/sample-banner.png'));
const createdFiles = [];

after(async () => {
  createdFiles.forEach((file) => fs.rmSync(file, { force: true }));
  await pool.end();
});

describe('Image uploads', () => {
  let agent;
  before(async () => {
    ({ agent } = await newUserAgent());
  });

  it('requires authentication', async () => {
    await request(app).post('/api/uploads/images').attach('image', PNG, 'a.png').expect(401);
  });

  it('uploads a valid PNG and serves it only to its owner', async () => {
    const res = await agent.post('/api/uploads/images').attach('image', PNG, { filename: 'chart.png', contentType: 'image/png' }).expect(201);
    const { url, mimeType } = res.body.data;
    assert.match(url, /^\/uploads\/[0-9a-f-]+\.png$/);
    assert.equal(mimeType, 'image/png');
    createdFiles.push(path.resolve(__dirname, '../..', `.${url}`));

    const img = await agent.get(url).expect(200);
    assert.equal(img.headers['content-type'], 'image/png');
    assert.equal(img.headers['x-content-type-options'], 'nosniff');

    const demo = await demoAgent();
    await demo.get(url).expect(404);
    await request(app).get(url).expect(401);
  });

  it('rejects files whose content is not a real image (spoofed MIME type)', async () => {
    const res = await agent.post('/api/uploads/images')
      .attach('image', Buffer.from('<html><script>alert(1)</script></html>'), { filename: 'evil.png', contentType: 'image/png' })
      .expect(422);
    assert.match(res.body.error.details[0].message, /PNG, JPEG, GIF and WEBP/);
  });

  it('rejects disallowed types such as SVG', async () => {
    await agent.post('/api/uploads/images')
      .attach('image', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), { filename: 'x.svg', contentType: 'image/svg+xml' })
      .expect(422);
  });

  it('rejects requests without a file', async () => {
    const res = await agent.post('/api/uploads/images').field('foo', 'bar').expect(400);
    assert.equal(res.body.error.details[0].field, 'image');
  });

  it('rejects files above the size limit', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
    const res = await agent.post('/api/uploads/images').attach('image', big, { filename: 'big.png', contentType: 'image/png' }).expect(413);
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  });
});
