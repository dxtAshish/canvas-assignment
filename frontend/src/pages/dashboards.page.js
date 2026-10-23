import { dashboardApi } from '../api/dashboard.api.js';
import { bindForm } from '../components/formController.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { mountNavbar } from '../components/navbar.js';
import { makeSortable } from '../components/sortable.js';
import { toast } from '../components/toast.js';
import { ROUTES } from '../config/routes.js';
import { requireAuth } from '../guards/authGuard.js';
import { h, formatDate } from '../utils/dom.js';
import { rules } from '../utils/validators.js';

const list = document.getElementById('dashboard-list');
const dialog = document.getElementById('dashboard-dialog');
const form = document.getElementById('dashboard-form');
let editing = null; // dashboard being renamed, or null when creating

/* ------------------------------ rendering ------------------------------ */

function renderSkeleton() {
  list.setAttribute('aria-busy', 'true');
  list.replaceChildren(...Array.from({ length: 3 }, () => h('div', { class: 'skeleton' })));
}

function renderError(message) {
  list.setAttribute('aria-busy', 'false');
  list.replaceChildren(h('div', { class: 'empty-state' },
    h('h2', {}, 'Could not load dashboards'),
    h('p', { class: 'muted' }, message),
    h('button', { class: 'btn btn--primary', type: 'button', onClick: load }, 'Try again')));
}

function renderEmpty() {
  list.replaceChildren(h('div', { class: 'empty-state' },
    h('h2', {}, 'No dashboards yet'),
    h('p', { class: 'muted' }, 'Create your first dashboard and start adding sections, text, images and charts.'),
    h('button', { class: 'btn btn--primary', type: 'button', onClick: () => openDialog() }, '+ New dashboard')));
}

function card(dashboard) {
  const href = ROUTES.builder(dashboard.id);
  return h('article', { class: 'dash-card', dataset: { id: dashboard.id } },
    h('button', {
      type: 'button',
      class: 'dash-card__handle',
      'data-sort-handle': '',
      title: 'Drag to reorder',
      'aria-label': `Reorder "${dashboard.name}" (use arrow keys)`,
    }, '⠿'),
    h('a', { class: 'dash-card__preview', href, 'aria-hidden': 'true', tabindex: '-1' }, h('span'), h('span'), h('span')),
    h('div', { class: 'dash-card__body' },
      h('h2', { class: 'dash-card__title' }, h('a', { href }, dashboard.name)),
      dashboard.description ? h('p', { class: 'dash-card__desc' }, dashboard.description) : null,
      h('p', { class: 'dash-card__meta' },
        `${dashboard.sectionCount} sections · ${dashboard.elementCount} elements · Updated ${formatDate(dashboard.updatedAt)}`)),
    h('div', { class: 'dash-card__actions' },
      h('a', { class: 'btn btn--primary btn--sm', href }, 'Open builder'),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => openDialog(dashboard) }, 'Edit'),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: (e) => remove(dashboard, e.currentTarget) }, 'Delete')));
}

async function load() {
  renderSkeleton();
  try {
    const dashboards = await dashboardApi.list();
    list.setAttribute('aria-busy', 'false');
    if (dashboards.length === 0) renderEmpty();
    else list.replaceChildren(...dashboards.map(card));
  } catch (err) {
    renderError(err.message);
  }
}

/* --------------------------- drag-and-drop order --------------------------- */

makeSortable(list, {
  itemSelector: '.dash-card',
  getId: (item) => Number(item.dataset.id),
  onSort: async (ids) => {
    try {
      await dashboardApi.reorder(ids);
      toast('Order saved', 'success');
    } catch (err) {
      toast(`Could not save the new order: ${err.message}`, 'error');
      throw err; // makeSortable rolls the cards back
    }
  },
});

/* ------------------------------- actions ------------------------------- */

async function remove(dashboard, button) {
  const ok = await confirmDialog({
    title: 'Delete dashboard?',
    message: `"${dashboard.name}" and all its sections and elements will be permanently deleted.`,
    confirmText: 'Delete',
    danger: true,
  });
  if (!ok) return;
  button.disabled = true;
  try {
    await dashboardApi.remove(dashboard.id);
    toast('Dashboard deleted', 'success');
    load();
  } catch (err) {
    button.disabled = false;
    toast(err.message, 'error');
  }
}

const formController = bindForm(form, {
  schema: {
    name: [rules.required('Name'), rules.maxLength('Name', 100)],
    description: [rules.maxLength('Description', 500)],
  },
  onSubmit: async ({ name, description, canvasWidth }) => {
    const payload = { name: name.trim(), description: description.trim() };
    if (editing) {
      await dashboardApi.update(editing.id, payload);
      dialog.close();
      toast('Dashboard updated', 'success');
      load();
    } else {
      const created = await dashboardApi.create({ ...payload, canvasWidth: Number(canvasWidth) });
      window.location.assign(ROUTES.builder(created.id));
    }
  },
});

function openDialog(dashboard = null) {
  editing = dashboard;
  formController.reset();
  form.querySelector('#dashboard-dialog-title').textContent = dashboard ? 'Edit dashboard' : 'New dashboard';
  form.querySelector('[type="submit"]').textContent = dashboard ? 'Save changes' : 'Create';
  form.querySelector('[data-create-only]').hidden = Boolean(dashboard);
  if (dashboard) {
    form.elements.name.value = dashboard.name;
    form.elements.description.value = dashboard.description;
  }
  dialog.showModal();
  form.elements.name.focus();
}

document.querySelector('[data-action="new-dashboard"]').addEventListener('click', () => openDialog());
form.querySelector('[data-action="close-dialog"]').addEventListener('click', () => dialog.close());

requireAuth().then((user) => {
  mountNavbar(user);
  load();
});
