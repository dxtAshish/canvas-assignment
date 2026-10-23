import { LIMITS, GRID, SECTION_LABEL_SPACE } from '../config.js';

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const snapTo = (value, enabled, grid = GRID) => (enabled ? Math.round(value / grid) * grid : Math.round(value));

/** Smallest size a section may shrink to without cutting off its elements. */
export function sectionMinSize(section) {
  return section.elements.reduce((min, el) => ({
    width: Math.max(min.width, el.x + el.width),
    height: Math.max(min.height, el.y + el.height),
  }), { width: LIMITS.SECTION.MIN_WIDTH, height: LIMITS.SECTION.MIN_HEIGHT });
}

/** Movement/resizing bounds for a section on the canvas. */
export function sectionBounds(section, canvasWidth) {
  const min = sectionMinSize(section);
  return {
    minX: 0,
    minY: SECTION_LABEL_SPACE,
    maxX: canvasWidth,
    maxY: LIMITS.CANVAS.MAX_Y + LIMITS.SECTION.MAX_HEIGHT,
    minWidth: min.width,
    minHeight: min.height,
    maxHeight: LIMITS.SECTION.MAX_HEIGHT,
  };
}

/** Movement/resizing bounds for an element inside its section. */
export function elementBounds(section) {
  return {
    minX: 0,
    minY: 0,
    maxX: section.width,
    maxY: section.height,
    minWidth: LIMITS.ELEMENT.MIN_WIDTH,
    minHeight: LIMITS.ELEMENT.MIN_HEIGHT,
    maxHeight: section.height,
  };
}

/** Forces a rectangle inside bounds, shrinking it if needed. */
export function fitRect(rect, bounds) {
  const width = clamp(Math.round(rect.width), bounds.minWidth, bounds.maxX - bounds.minX);
  const height = clamp(Math.round(rect.height), bounds.minHeight, Math.min(bounds.maxHeight, bounds.maxY - bounds.minY));
  return {
    width,
    height,
    x: clamp(Math.round(rect.x), bounds.minX, bounds.maxX - width),
    y: clamp(Math.round(rect.y), bounds.minY, bounds.maxY - height),
  };
}

const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * First position (scanning rows top-left to bottom-right) where a width×height
 * box fits inside the section without overlapping other elements, or null.
 */
export function findFreeSpot(section, width, height, padding = 20, step = 20) {
  const others = section.elements.map((el) => ({
    x: el.x - padding / 2, y: el.y - padding / 2, width: el.width + padding, height: el.height + padding,
  }));
  for (let y = padding; y + height + padding <= section.height; y += step) {
    for (let x = padding; x + width + padding <= section.width; x += step) {
      const candidate = { x, y, width, height };
      if (!others.some((o) => overlaps(candidate, o))) return candidate;
    }
  }
  return null;
}

/** Canvas grows with content so there is always room to add more below. */
export function canvasHeight(sections) {
  const bottom = sections.reduce((max, s) => Math.max(max, s.y + s.height), 0);
  return Math.max(800, bottom + 240);
}

/** Next free vertical slot below existing sections. */
export function nextSectionY(sections) {
  if (!sections.length) return SECTION_LABEL_SPACE + 16;
  return snapTo(sections.reduce((max, s) => Math.max(max, s.y + s.height), 0) + SECTION_LABEL_SPACE + 20, true);
}

export const topZ = (items) => items.reduce((max, item) => Math.max(max, item.zIndex), 0) + 1;
