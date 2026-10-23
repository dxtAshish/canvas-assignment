'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
const sanitizeRichText = require('../../src/utils/sanitizeHtml');
const chartDataService = require('../../src/services/chartData.service');
const { detectImageMime } = require('../../src/services/upload.service');

describe('sanitizeRichText', () => {
  it('keeps supported formatting', () => {
    const html = '<p style="text-align:center"><b>B</b> <i>I</i> <u>U</u> <span style="font-size:24px;color:#ff0000">x</span></p>';
    assert.equal(sanitizeRichText(html), html);
  });

  it('removes scripts, event handlers, links and unsafe styles', () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">x</a><script>bad()</script><p onmouseover="x" style="background:url(evil)">t</p>');
    assert.equal(out, 'x<p>t</p>');
  });

  it('clamps font sizes into the supported range', () => {
    assert.equal(sanitizeRichText('<span style="font-size:2px">a</span>'), '<span style="font-size:8px">a</span>');
  });
});

describe('chartDataService', () => {
  it('generates the requested number of points for every dataset', () => {
    for (const key of chartDataService.DATASET_KEYS) {
      const data = chartDataService.generate(key, 7);
      assert.equal(data.labels.length, 7);
      data.series.forEach((s) => assert.equal(s.data.length, 7));
    }
  });

  it('lists datasets with their series names', () => {
    const sales = chartDataService.listDatasets().find((d) => d.key === 'sales');
    assert.deepEqual(sales.series, ['Revenue', 'Target']);
  });
});

describe('detectImageMime', () => {
  it('detects formats by magic bytes', () => {
    assert.equal(detectImageMime(Buffer.from('GIF89a000000')), 'image/gif');
    assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
    assert.equal(detectImageMime(Buffer.from('RIFF0000WEBPVP8 ')), 'image/webp');
    assert.equal(detectImageMime(Buffer.from('<svg></svg>  ')), null);
  });
});
