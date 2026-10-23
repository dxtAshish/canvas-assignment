'use strict';

const { withTransaction } = require('../config/database');
const { ELEMENT, IMAGE } = require('../constants/limits');
const dashboardModel = require('../models/dashboard.model');
const sectionModel = require('../models/section.model');
const elementModel = require('../models/element.model');
const uploadModel = require('../models/upload.model');
const ApiError = require('../utils/ApiError');
const sanitizeRichText = require('../utils/sanitizeHtml');

async function getOwnedOrThrow(id, userId, executor) {
  const dashboard = await dashboardModel.findByIdForUser(id, userId, executor);
  if (!dashboard) throw ApiError.notFound('Dashboard not found.');
  return dashboard;
}

/** Loads a dashboard with its sections and their nested elements. */
async function getLayout(id, userId, executor) {
  const dashboard = await getOwnedOrThrow(id, userId, executor);
  const [sections, elements] = await Promise.all([
    sectionModel.listByDashboard(id, executor),
    elementModel.listByDashboard(id, executor),
  ]);

  const bySection = new Map(sections.map((s) => [s.id, { ...s, elements: [] }]));
  for (const { sectionId, ...element } of elements) {
    bySection.get(sectionId)?.elements.push(element);
  }
  return { ...dashboard, sections: [...bySection.values()] };
}

const list = (userId) => dashboardModel.listByUser(userId);

const create = (userId, data) => dashboardModel.create(userId, data);

async function update(id, userId, fields) {
  return withTransaction(async (conn) => {
    await getOwnedOrThrow(id, userId, conn);
    if (fields.canvasWidth) {
      const sections = await sectionModel.listByDashboard(id, conn);
      const rightEdge = Math.max(0, ...sections.map((s) => s.x + s.width));
      if (rightEdge > fields.canvasWidth) {
        throw ApiError.validation('Canvas width is smaller than the current layout.', [{
          field: 'canvasWidth',
          message: `Canvas width must be at least ${rightEdge}px to fit existing sections`,
        }]);
      }
    }
    return dashboardModel.update(id, userId, fields, conn);
  });
}

/** Persists the drag-and-drop order of the user's dashboards. */
async function reorder(userId, ids) {
  return withTransaction(async (conn) => {
    const owned = await dashboardModel.filterOwnedIds(ids, userId, conn);
    const unknown = ids.filter((dashboardId) => !owned.has(dashboardId));
    if (unknown.length) {
      // Same response for "missing" and "someone else's" (no ID enumeration).
      throw ApiError.validation('Some dashboards could not be found.', unknown.map((dashboardId) => ({
        field: 'ids', message: `Unknown dashboard: ${dashboardId}`,
      })));
    }
    await dashboardModel.updateSortOrder(ids, userId, conn);
  });
}

async function remove(id, userId) {
  const deleted = await dashboardModel.remove(id, userId);
  if (!deleted) throw ApiError.notFound('Dashboard not found.');
}

/* --------------------------- layout validation --------------------------- */

/**
 * Cross-field rules Joi cannot express on its own: geometry must stay inside
 * the parent bounds and manual chart series must match their labels.
 */
function collectLayoutProblems(sections, canvasWidth) {
  const problems = [];
  const add = (field, message) => problems.push({ field, message });
  let elementTotal = 0;

  sections.forEach((section, si) => {
    const sPath = `sections.${si}`;
    if (section.x + section.width > canvasWidth) {
      add(`${sPath}.width`, `Section "${section.title || si + 1}" extends beyond the ${canvasWidth}px canvas`);
    }

    section.elements.forEach((el, ei) => {
      elementTotal += 1;
      const ePath = `${sPath}.elements.${ei}`;
      if (el.x + el.width > section.width || el.y + el.height > section.height) {
        add(ePath, `A ${el.type} element in section "${section.title || si + 1}" extends beyond its section`);
      }
      if (el.type === 'chart' && el.content.source === 'manual') {
        const { labels, series } = el.content;
        if (labels.length < 1) add(`${ePath}.content.labels`, 'A chart with manual data needs at least one label');
        series.forEach((s, i) => {
          if (s.data.length !== labels.length) {
            add(`${ePath}.content.series.${i}.data`, `Series "${s.label || i + 1}" must have exactly ${labels.length} values`);
          }
        });
      }
    });
  });

  if (elementTotal > ELEMENT.MAX_PER_DASHBOARD) {
    add('sections', `A dashboard can contain at most ${ELEMENT.MAX_PER_DASHBOARD} elements`);
  }
  return problems;
}

/** Normalizes element content before persistence (sanitizing user HTML, dropping derived data). */
function normalizeContent(el) {
  if (el.type === 'text') return { ...el.content, html: sanitizeRichText(el.content.html) };
  if (el.type === 'chart' && el.content.source === 'dynamic') {
    // Dynamic charts are regenerated from the API, so only series styling is stored.
    return { ...el.content, labels: [], series: el.content.series.map((s) => ({ ...s, data: [] })) };
  }
  return el.content;
}

async function assertImagesOwned(sections, userId, conn) {
  const names = new Set();
  for (const section of sections) {
    for (const el of section.elements) {
      if (el.type === 'image' && el.content.url) names.add(el.content.url.match(IMAGE.URL_PATTERN)[1]);
    }
  }
  if (names.size === 0) return;
  const owned = await uploadModel.filterOwnedNames([...names], userId, conn);
  const foreign = [...names].filter((n) => !owned.has(n));
  if (foreign.length) {
    throw ApiError.validation('The layout references images that do not exist or are not yours.', foreign.map((n) => ({
      field: 'image', message: `Unknown image: ${n}`,
    })));
  }
}

/**
 * Replaces the whole layout atomically. Optimistic locking: the client sends the
 * version it loaded; if somebody saved in between, the save is rejected with 409.
 */
async function saveLayout(id, userId, { version, settings, sections }) {
  return withTransaction(async (conn) => {
    const dashboard = await dashboardModel.findByIdForUser(id, userId, conn, { forUpdate: true });
    if (!dashboard) throw ApiError.notFound('Dashboard not found.');
    if (dashboard.version !== version) {
      throw ApiError.conflict(
        'This dashboard was changed elsewhere (another tab or device). Reload to get the latest version.',
        'VERSION_CONFLICT',
      );
    }

    const canvasWidth = settings?.canvasWidth ?? dashboard.canvasWidth;
    const problems = collectLayoutProblems(sections, canvasWidth);
    if (problems.length) throw ApiError.validation('The layout contains invalid positions or data.', problems);
    await assertImagesOwned(sections, userId, conn);

    await sectionModel.deleteByDashboard(id, conn);
    const elementRows = [];
    for (const section of sections) {
      const sectionId = await sectionModel.create(id, section, conn);
      for (const el of section.elements) {
        elementRows.push({ ...el, sectionId, content: normalizeContent(el) });
      }
    }
    await elementModel.bulkCreate(elementRows, conn);
    await dashboardModel.update(id, userId, settings || {}, conn); // also bumps version + updated_at

    return getLayout(id, userId, conn);
  });
}

module.exports = {
  list, create, getLayout, update, reorder, remove, saveLayout, collectLayoutProblems,
};
