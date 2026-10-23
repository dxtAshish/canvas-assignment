import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS } from '../src/features/builder/config.js';
import {
  fitRect, sectionMinSize, sectionBounds, elementBounds, findFreeSpot, snapTo, canvasHeight,
} from '../src/features/builder/canvas/geometry.js';

before(() => {
  // Same shape as GET /api/meta/config
  Object.assign(LIMITS, {
    CANVAS: { MIN_WIDTH: 800, MAX_WIDTH: 2400, MAX_Y: 20000 },
    SECTION: { MIN_WIDTH: 120, MIN_HEIGHT: 80, MAX_HEIGHT: 5000 },
    ELEMENT: { MIN_WIDTH: 40, MIN_HEIGHT: 30 },
  });
});

const section = (elements = []) => ({ x: 20, y: 30, width: 600, height: 400, elements });

describe('builder geometry', () => {
  it('snaps to the grid only when enabled', () => {
    assert.equal(snapTo(14, true), 10);
    assert.equal(snapTo(16, true), 20);
    assert.equal(snapTo(14.4, false), 14);
  });

  it('keeps elements inside their section', () => {
    const rect = fitRect({ x: 580, y: -10, width: 100, height: 50 }, elementBounds(section()));
    assert.deepEqual(rect, { x: 500, y: 0, width: 100, height: 50 });
  });

  it('shrinks oversized rectangles to the bounds', () => {
    const rect = fitRect({ x: 0, y: 0, width: 5000, height: 10 }, elementBounds(section()));
    assert.equal(rect.width, 600);
    assert.equal(rect.height, 30); // min height
  });

  it('never lets a section shrink smaller than its content', () => {
    const s = section([{ x: 300, y: 200, width: 200, height: 150 }]);
    assert.deepEqual(sectionMinSize(s), { width: 500, height: 350 });
    assert.equal(sectionBounds(s, 1200).minWidth, 500);
  });

  it('finds a free spot that does not overlap existing elements', () => {
    const s = section([{ x: 20, y: 20, width: 300, height: 200 }]);
    const spot = findFreeSpot(s, 200, 100);
    assert.ok(spot.x >= 330 || spot.y >= 230, `overlapping spot ${JSON.stringify(spot)}`);
    assert.equal(findFreeSpot(section([{ x: 0, y: 0, width: 600, height: 400 }]), 100, 100), null);
  });

  it('grows the canvas below the lowest section', () => {
    assert.equal(canvasHeight([]), 800);
    assert.equal(canvasHeight([{ y: 900, height: 300 }]), 1440);
  });
});
