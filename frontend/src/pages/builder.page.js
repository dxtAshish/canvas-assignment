import { dashboardApi } from '../api/dashboard.api.js';
import { uploadApi } from '../api/upload.api.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { toast } from '../components/toast.js';
import { dashboardIdFromPath } from '../config/routes.js';
import { requireAuth } from '../guards/authGuard.js';
import { h, qs, setLoading } from '../utils/dom.js';
import { rules } from '../utils/validators.js';
import { LIMITS, GRID, loadBuilderConfig } from '../features/builder/config.js';
import { createStore } from '../features/builder/store/builderStore.js';
import { createActions } from '../features/builder/actions/builderActions.js';
import { createCanvasView, DRAG_MIME } from '../features/builder/canvas/canvasView.js';
import { createInspector } from '../features/builder/inspector/inspector.js';
import { createTextToolbar } from '../features/builder/toolbar/textToolbar.js';
import { fromApi, toApi, idFromErrorPath } from '../features/builder/serializer.js';

const DASHBOARD_ID = dashboardIdFromPath();

const root = qs('#builder-root');
const stage = qs('#stage');
const overlay = qs('#stage-loading');
const nameInput = qs('#dashboard-name');
const saveStatus = qs('#save-status');
const saveBtn = qs('[data-action="save"]');
const undoBtn = qs('[data-action="undo"]');
const redoBtn = qs('[data-action="redo"]');
const previewBtn = qs('[data-action="toggle-preview"]');
const snapToggle = qs('[data-action="toggle-snap"]');
const imageInput = qs('#image-input');

const store = createStore();
const actions = createActions(store);
let saving = false;
let lastSaveFailed = false;

/* ---------------------------------------------------------------------------
 * Hooks shared with the canvas and inspector
 * ------------------------------------------------------------------------- */

let uploadTarget = null;

const hooks = {
  /** Commits pending inspector edits before the canvas takes over the pointer. */
  blurInputs() {
    const active = document.activeElement;
    if (active && active !== document.body && active.matches('input, textarea, select')) active.blur();
  },

  requestImageUpload(elementId, button = null) {
    uploadTarget = { elementId, button };
    imageInput.value = '';
    imageInput.click();
  },

  refreshChart(elementId) {
    canvasView.getElementInstance(elementId)?.refresh?.();
  },

  async confirmDelete() {
    const sel = store.ui.selection;
    if (!sel) return;
    if (sel.kind === 'section') {
      const { section } = store.locate(sel.id);
      if (section.elements.length > 0) {
        const ok = await confirmDialog({
          title: 'Delete section?',
          message: `"${section.title || 'Untitled section'}" and its ${section.elements.length} element(s) will be removed. You can undo this with Ctrl+Z.`,
          confirmText: 'Delete',
          danger: true,
        });
        if (!ok) return;
      }
    }
    actions.removeSelected();
    toast('Deleted. Press Ctrl+Z to undo.', 'info');
  },
};

const canvasView = createCanvasView({
  store, actions, stage, hooks, scaler: qs('#canvas-scaler'), canvas: qs('#canvas'),
});
const inspector = createInspector({ root: qs('#inspector'), store, actions, hooks });
const textToolbar = createTextToolbar({
  root: qs('#text-toolbar'),
  store,
  getEditor: () => canvasView.getElementInstance(store.ui.editingId)?.editor ?? null,
});

/* ---------------------------------------------------------------------------
 * Top bar
 * ------------------------------------------------------------------------- */

const validateName = (value) => rules.required('Dashboard name')(value) || rules.maxLength('Dashboard name', 100)(value);

function renderTopbar() {
  const { doc, ui } = store;
  if (!doc) return;
  if (document.activeElement !== nameInput && !nameInput.classList.contains('has-error')) {
    nameInput.value = doc.settings.name;
  }
  const dirty = store.isDirty;
  undoBtn.disabled = !store.canUndo || ui.preview;
  redoBtn.disabled = !store.canRedo || ui.preview;
  if (saving !== saveBtn.classList.contains('is-loading')) setLoading(saveBtn, saving, 'Saving…');
  saveBtn.disabled = saving || !dirty;

  let state = 'saved';
  let text = 'All changes saved';
  if (saving) [state, text] = ['saving', 'Saving…'];
  else if (lastSaveFailed && dirty) [state, text] = ['error', 'Save failed — retry'];
  else if (dirty) [state, text] = ['dirty', 'Unsaved changes'];
  saveStatus.dataset.state = state;
  saveStatus.textContent = text;

  root.classList.toggle('is-preview', ui.preview);
  previewBtn.textContent = ui.preview ? 'Exit preview' : 'Preview';
  previewBtn.setAttribute('aria-pressed', String(ui.preview));
  snapToggle.checked = ui.snap;
  document.title = `${doc.settings.name || 'Untitled'}${dirty ? ' •' : ''} · Dashboard Builder`;
}

nameInput.addEventListener('input', () => {
  const message = validateName(nameInput.value);
  nameInput.classList.toggle('has-error', Boolean(message));
  nameInput.title = message || '';
  if (!message) actions.updateSettings({ name: nameInput.value }, { coalesce: 'dashboard-name' });
});
nameInput.addEventListener('blur', () => {
  if (nameInput.classList.contains('has-error')) toast(validateName(nameInput.value), 'warning');
});
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') nameInput.blur();
});

/* ---------------------------------------------------------------------------
 * Save / load
 * ------------------------------------------------------------------------- */

async function save({ force = false } = {}) {
  if (saving || (!store.isDirty && !force)) return;
  const nameError = validateName(nameInput.value);
  if (nameError) {
    toast(nameError, 'error');
    nameInput.focus();
    return;
  }
  if (store.ui.editingId) canvasView.getElementInstance(store.ui.editingId)?.flush?.();

  const snapshot = store.doc;
  saving = true;
  renderTopbar();
  try {
    const result = await dashboardApi.saveLayout(DASHBOARD_ID, toApi(snapshot, store.version));
    lastSaveFailed = false;
    saving = false;
    store.markSaved(snapshot, result.version);
    toast('Dashboard saved', 'success');
  } catch (err) {
    saving = false;
    lastSaveFailed = true;
    renderTopbar();
    await handleSaveError(err);
  }
}

async function handleSaveError(err) {
  if (err.code === 'VERSION_CONFLICT') {
    const overwrite = await confirmDialog({
      title: 'Dashboard changed elsewhere',
      message: `${err.message} Do you want to overwrite it with your version instead?`,
      confirmText: 'Overwrite with my changes',
      danger: true,
    });
    if (!overwrite) return;
    try {
      const latest = await dashboardApi.get(DASHBOARD_ID);
      store.setVersion(latest.version);
      await save({ force: true });
    } catch (e) {
      toast(e.message, 'error');
    }
    return;
  }
  if (err.status === 422 && err.details?.length) {
    const first = err.details[0];
    const id = idFromErrorPath(store.doc, first.field);
    if (id) store.select(id);
    const more = err.details.length > 1 ? ` (+${err.details.length - 1} more issue(s))` : '';
    toast(`${err.message} ${first.message}${more}`, 'error');
    return;
  }
  toast(err.message || 'Could not save the dashboard.', 'error');
}

async function load() {
  overlay.hidden = false;
  overlay.replaceChildren(h('span', { class: 'spinner spinner--lg', 'aria-hidden': 'true' }), h('p', {}, 'Loading dashboard…'));
  try {
    // Limits are needed before rendering (validation + inspector options).
    if (!LIMITS.CANVAS) await loadBuilderConfig();
    const dashboard = await dashboardApi.get(DASHBOARD_ID);
    store.init(fromApi(dashboard), dashboard.version);
    nameInput.disabled = false;
    overlay.hidden = true;
  } catch (err) {
    overlay.replaceChildren(
      h('p', { style: { fontSize: '28px', margin: 0 }, 'aria-hidden': 'true' }, '⚠'),
      h('p', { style: { color: 'var(--color-text)', fontWeight: 600, margin: 0 } }, 'Could not load this dashboard'),
      h('p', { style: { margin: 0 } }, err.message),
      h('div', { class: 'button-row' },
        h('button', { type: 'button', class: 'btn btn--primary', onClick: load }, 'Try again'),
        h('a', { class: 'btn', href: '/dashboards' }, 'Back to dashboards')));
  }
}

/* ---------------------------------------------------------------------------
 * Image upload
 * ------------------------------------------------------------------------- */

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  const target = uploadTarget;
  uploadTarget = null;
  if (!file || !target) return;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    toast('Only PNG, JPEG, GIF and WEBP images are allowed.', 'error');
    return;
  }
  if (file.size > LIMITS.UPLOAD_MAX_BYTES) {
    toast(`Image is too large. Maximum size is ${Math.round(LIMITS.UPLOAD_MAX_BYTES / 1024 / 1024)} MB.`, 'error');
    return;
  }

  setLoading(target.button, true, 'Uploading…');
  toast('Uploading image…', 'info');
  try {
    const upload = await uploadApi.uploadImage(file);
    if (!store.locate(target.elementId)) return; // element was deleted meanwhile
    const { element } = store.locate(target.elementId);
    actions.updateElementContent(target.elementId, {
      url: upload.url,
      alt: element.content.alt || file.name.replace(/\.[^.]+$/, '').slice(0, 200),
    });
    toast('Image uploaded', 'success');
  } catch (err) {
    toast(err.details?.[0]?.message || err.message, 'error');
  } finally {
    if (target.button?.isConnected) setLoading(target.button, false);
  }
});

/* ---------------------------------------------------------------------------
 * Palette (click to add, or drag onto the canvas / a section)
 * ------------------------------------------------------------------------- */

const palette = qs('#palette');
palette.addEventListener('click', (e) => {
  const item = e.target.closest('[data-add]');
  if (!item || store.ui.preview) return;
  const kind = item.dataset.add;
  if (kind === 'section') {
    actions.addSection();
  } else {
    const id = actions.addElement(kind);
    if (id && kind === 'image') hooks.requestImageUpload(id);
  }
  root.classList.remove('show-palette');
});
palette.addEventListener('dragstart', (e) => {
  const item = e.target.closest('[data-add]');
  if (!item) return;
  e.dataTransfer.setData(DRAG_MIME, item.dataset.add);
  e.dataTransfer.effectAllowed = 'copy';
  // Close the mobile drawer so the canvas is reachable as a drop target.
  requestAnimationFrame(() => root.classList.remove('show-palette'));
});

/* ---------------------------------------------------------------------------
 * Toolbar buttons
 * ------------------------------------------------------------------------- */

function togglePreview(force) {
  const preview = typeof force === 'boolean' ? force : !store.ui.preview;
  store.setUi({ preview, selection: null, editingId: null });
  root.classList.remove('show-palette', 'show-inspector');
}

const commands = {
  save: () => save(),
  undo: () => store.undo(),
  redo: () => store.redo(),
  'toggle-preview': () => togglePreview(),
  'toggle-palette': () => {
    root.classList.toggle('show-palette');
    root.classList.remove('show-inspector');
  },
  'toggle-inspector': () => {
    root.classList.toggle('show-inspector');
    root.classList.remove('show-palette');
  },
  'close-panels': () => root.classList.remove('show-palette', 'show-inspector'),
};

root.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (target && commands[target.dataset.action]) commands[target.dataset.action]();
});
snapToggle.addEventListener('change', () => store.setUi({ snap: snapToggle.checked }));

/* ---------------------------------------------------------------------------
 * Keyboard shortcuts
 * ------------------------------------------------------------------------- */

document.addEventListener('keydown', (e) => {
  if (!store.doc) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (mod && key === 's') {
    e.preventDefault();
    save();
    return;
  }
  if (document.querySelector('dialog[open]')) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;

  if (store.ui.preview) {
    if (key === 'escape') togglePreview(false);
    return;
  }
  if (mod && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) store.redo();
    else store.undo();
    return;
  }
  if (mod && key === 'y') {
    e.preventDefault();
    store.redo();
    return;
  }
  if (key === 'escape') {
    store.select(null);
    return;
  }
  if (!store.ui.selection) return;

  if (mod && key === 'd') {
    e.preventDefault();
    actions.duplicateSelected();
  } else if (key === 'delete' || key === 'backspace') {
    e.preventDefault();
    hooks.confirmDelete();
  } else if (key === 'enter' && store.ui.selection.kind === 'element' && store.locate(store.ui.selection.id)?.element.type === 'text') {
    e.preventDefault();
    store.setUi({ editingId: store.ui.selection.id });
  } else if (key.startsWith('arrow')) {
    e.preventDefault();
    const step = e.shiftKey ? GRID : 1;
    const delta = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[key];
    actions.nudge(...delta);
  }
});

window.addEventListener('beforeunload', (e) => {
  if (store.isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ---------------------------------------------------------------------------
 * Wiring
 * ------------------------------------------------------------------------- */

store.subscribe(() => {
  canvasView.render();
  inspector.render();
  textToolbar.render();
  renderTopbar();
});

requireAuth().then(load);
