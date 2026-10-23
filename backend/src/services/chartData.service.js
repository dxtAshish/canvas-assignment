'use strict';

/**
 * Generates dummy-but-plausible chart data on every request so charts bound
 * to a "dynamic" source render freshly generated data (and can live-refresh).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const randomBetween = (min, max) => Math.round(min + Math.random() * (max - min));

/** Random walk keeps consecutive points close to each other, like real metrics. */
function randomWalk(count, start, step, min, max) {
  const values = [];
  let current = start;
  for (let i = 0; i < count; i += 1) {
    current = Math.min(max, Math.max(min, current + randomBetween(-step, step)));
    values.push(current);
  }
  return values;
}

function lastMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return `${MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
  });
}

function lastMinutes(count, stepMinutes) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now - (count - 1 - i) * stepMinutes * 60000);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  });
}

const DATASETS = {
  sales: {
    title: 'Monthly sales (USD k)',
    generate: (points) => ({
      labels: lastMonths(points),
      series: [
        { label: 'Revenue', data: randomWalk(points, 60, 12, 20, 140) },
        { label: 'Target', data: randomWalk(points, 70, 5, 50, 120) },
      ],
    }),
  },
  traffic: {
    title: 'Website visitors (last minutes)',
    generate: (points) => ({
      labels: lastMinutes(points, 5),
      series: [{ label: 'Visitors', data: randomWalk(points, 400, 80, 50, 1200) }],
    }),
  },
  signups: {
    title: 'Weekly sign-ups',
    generate: (points) => ({
      labels: Array.from({ length: points }, (_, i) => `W${i + 1}`),
      series: [
        { label: 'Free', data: randomWalk(points, 120, 30, 10, 400) },
        { label: 'Paid', data: randomWalk(points, 40, 10, 0, 200) },
      ],
    }),
  },
  cpu: {
    title: 'Server CPU usage (%)',
    generate: (points) => ({
      labels: lastMinutes(points, 1),
      series: [{ label: 'CPU %', data: randomWalk(points, 45, 15, 2, 100) }],
    }),
  },
};

const DATASET_KEYS = Object.keys(DATASETS);

/** Dataset catalogue including series names (lets the UI style series before data arrives). */
function listDatasets() {
  return DATASET_KEYS.map((key) => ({
    key,
    title: DATASETS[key].title,
    series: DATASETS[key].generate(2).series.map((s) => s.label),
  }));
}

function generate(dataset, points) {
  const definition = DATASETS[dataset];
  return {
    dataset,
    title: definition.title,
    generatedAt: new Date().toISOString(),
    ...definition.generate(points),
  };
}

module.exports = { DATASET_KEYS, listDatasets, generate };
