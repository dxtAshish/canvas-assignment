import { metaApi } from '../../api/meta.api.js';

/** Builder UI constants. */
export const GRID = 10;
export const SECTION_LABEL_SPACE = 24; // room above a section for its title label
export const CHART_PALETTE = ['#4f46e5', '#0ea5e9', '#16a34a', '#f59e0b', '#ef4444'];

/**
 * Validation limits from the backend (GET /api/meta/config), so client-side
 * rules always match the API. Populated by loadBuilderConfig() before mounting.
 */
export const LIMITS = {};

export async function loadBuilderConfig() {
  Object.assign(LIMITS, await metaApi.getConfig());
  return LIMITS;
}

let counter = 0;
/** Client-side keys for sections/elements (never sent to the server). */
export const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${(counter += 1).toString(36)}`;
