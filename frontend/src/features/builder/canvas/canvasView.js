import { h } from '../../../utils/dom.js';
import { elementTypes } from '../elements/registry.js';
import { makeInteractive, addResizeHandles } from './interactions.js';
import { canvasHeight, sectionBounds, elementBounds } from './geometry.js';
import { SECTION_LABEL_SPACE } from '../config.js';

const STACK_BREAKPOINT = 760; // preview below this width stacks sections vertically
const DRAG_MIME = 'application/x-dashboard-item';

const applyRect = (node, { x, y, width, height }) => {
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.width = `${width}px`;
  node.style.height = `${height}px`;
};

function showSizeBadge(node, rect, mode) {
  let badge = node.querySelector(':scope > .size-badge');
  if (!badge) {
    badge = h('span', { class: 'size-badge' });
    node.append(badge);
  }
  badge.textContent = mode === 'resize' ? `${rect.width} × ${rect.height}` : `x ${rect.x}, y ${rect.y}`;
}
const hideSizeBadge = (node) => node.querySelector(':scope > .size-badge')?.remove();

/**
 * Renders the document onto the canvas and keeps DOM nodes in sync with the store
 * using keyed reconciliation, so charts and text editors are not recreated on
 * every change. Live drag/resize feedback writes styles directly and commits
 * to the store once on pointer release (= one undo step).
 */
export function createCanvasView({ store, actions, stage, scaler, canvas, hooks }) {
  const sectionViews = new Map();
  let scale = 1;
  let stacked = false;

  const isPreview = () => store.ui.preview;
  const isSnapping = () => store.ui.snap;

  /* --------------------------------- elements -------------------------------- */

  function createElementView(sectionId, element) {
    const body = h('div', { class: 'element__body' });
    const node = h('div', { class: 'element', dataset: { id: element.id, type: element.type } }, body);
    addResizeHandles(node);

    const view = { id: element.id, sectionId, node, model: element, instance: null };
    view.instance = elementTypes[element.type].mount(body, element, {
      isPreview,
      commit: (html) => actions.updateElementContent(view.id, { html }, { coalesce: `text:${view.id}` }),
      onExitEdit: () => store.setUi({ editingId: null }),
      requestUpload: () => hooks.requestImageUpload(view.id),
    });

    makeInteractive(node, {
      canStart: () => !isPreview() && store.ui.editingId !== view.id,
      onSelect: () => {
        hooks.blurInputs();
        store.select(view.id);
      },
      getRect: () => ({ ...view.model }),
      getBounds: () => elementBounds(store.locate(view.id).section),
      getScale: () => scale,
      isSnapping,
      onPreview: (rect, mode) => {
        applyRect(node, rect);
        showSizeBadge(node, rect, mode);
      },
      onCommit: (rect) => {
        hideSizeBadge(node);
        actions.setRect(view.id, rect);
      },
      onCancel: () => {
        hideSizeBadge(node);
        applyRect(node, view.model);
      },
    });

    node.addEventListener('dblclick', (e) => {
      if (isPreview() || element.type !== 'text') return;
      e.stopPropagation();
      store.select(view.id);
      store.setUi({ editingId: view.id });
    });
    return view;
  }

  function updateElementView(view, element, ui) {
    view.model = element;
    applyRect(view.node, element);
    view.node.style.zIndex = element.zIndex;
    view.node.classList.toggle('is-selected', ui.selection?.id === element.id);
    const editing = ui.editingId === element.id;
    view.node.classList.toggle('is-editing', editing);
    view.instance.update(element);
    view.instance.setEditing?.(editing);
  }

  /* --------------------------------- sections -------------------------------- */

  function createSectionView(section) {
    const label = h('div', { class: 'section__label' });
    const placeholder = h('div', { class: 'section__placeholder', 'data-edit-only': '' }, 'Empty section — add text, images or charts from the left panel');
    const inner = h('div', { class: 'section__inner' }, placeholder);
    const node = h('div', { class: 'section', dataset: { id: section.id } }, label, inner);
    addResizeHandles(node);

    const view = { id: section.id, node, inner, label, placeholder, model: section, elements: new Map() };

    makeInteractive(node, {
      canStart: () => !isPreview(),
      onSelect: () => {
        hooks.blurInputs();
        store.select(view.id);
      },
      getRect: () => ({ ...view.model }),
      getBounds: () => sectionBounds(view.model, store.doc.settings.canvasWidth),
      getScale: () => scale,
      isSnapping,
      onPreview: (rect, mode) => {
        applyRect(node, rect);
        inner.style.width = `${rect.width}px`;
        inner.style.height = `${rect.height}px`;
        showSizeBadge(node, rect, mode);
      },
      onCommit: (rect) => {
        hideSizeBadge(node);
        actions.setRect(view.id, rect);
      },
      onCancel: () => {
        hideSizeBadge(node);
        render();
      },
    });

    // Drop target for elements dragged from the palette.
    node.addEventListener('dragover', (e) => {
      if (isPreview() || !e.dataTransfer.types.includes(DRAG_MIME)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      node.classList.add('is-drop-target');
    });
    node.addEventListener('dragleave', (e) => {
      if (!node.contains(e.relatedTarget)) node.classList.remove('is-drop-target');
    });
    node.addEventListener('drop', (e) => {
      node.classList.remove('is-drop-target');
      const kind = e.dataTransfer.getData(DRAG_MIME);
      if (!kind || isPreview()) return;
      e.preventDefault();
      e.stopPropagation();
      if (kind === 'section') {
        actions.addSection(toCanvasPoint(e));
        return;
      }
      const box = inner.getBoundingClientRect();
      actions.addElement(kind, {
        sectionId: view.id,
        position: { x: (e.clientX - box.left) / scale, y: (e.clientY - box.top) / scale },
      });
    });
    return view;
  }

  function updateSectionView(view, section, ui, stackScale) {
    view.model = section;
    view.node.style.zIndex = section.zIndex;
    view.node.style.backgroundColor = section.backgroundColor;
    view.node.classList.toggle('is-selected', ui.selection?.id === section.id);
    view.label.textContent = section.title || 'Untitled section';
    view.label.hidden = isPreview() && !section.title;
    view.placeholder.hidden = section.elements.length > 0;

    view.inner.style.width = `${section.width}px`;
    view.inner.style.height = `${section.height}px`;
    if (stackScale) {
      view.node.style.left = '';
      view.node.style.top = '';
      view.node.style.width = `${section.width * stackScale}px`;
      view.node.style.height = `${section.height * stackScale}px`;
      view.node.style.order = String(section.y * 10000 + section.x);
      view.inner.style.transform = `scale(${stackScale})`;
    } else {
      applyRect(view.node, section);
      view.node.style.order = '';
      view.inner.style.transform = '';
    }

    const seen = new Set();
    for (const element of section.elements) {
      seen.add(element.id);
      let ev = view.elements.get(element.id);
      if (!ev) {
        ev = createElementView(section.id, element);
        view.elements.set(element.id, ev);
        view.inner.append(ev.node);
      }
      updateElementView(ev, element, ui);
    }
    for (const [id, ev] of view.elements) {
      if (!seen.has(id)) {
        ev.instance.destroy();
        ev.node.remove();
        view.elements.delete(id);
      }
    }
  }

  /* ---------------------------------- canvas --------------------------------- */

  function toCanvasPoint(e) {
    const box = canvas.getBoundingClientRect();
    return { x: (e.clientX - box.left) / scale, y: (e.clientY - box.top) / scale };
  }

  function renderEmptyState(doc) {
    let empty = canvas.querySelector('.canvas__empty');
    if (doc.sections.length === 0 && !isPreview()) {
      if (!empty) {
        empty = h('div', { class: 'canvas__empty' },
          h('strong', {}, 'Your canvas is empty'),
          'Add a section, then drop text, images and charts into it.',
          h('div', {}, h('button', { type: 'button', class: 'btn btn--primary', onClick: () => actions.addSection() }, '+ Add section')));
        canvas.append(empty);
      }
    } else {
      empty?.remove();
    }
  }

  function render() {
    const { doc, ui } = store;
    if (!doc) return;
    const { canvasWidth, backgroundColor } = doc.settings;
    const available = stage.clientWidth - 48;

    stacked = isPreview() && stage.clientWidth < STACK_BREAKPOINT;
    canvas.classList.toggle('is-stacked', stacked);
    canvas.style.backgroundColor = backgroundColor;

    if (stacked) {
      scale = 1;
      scaler.style.width = `${Math.max(0, stage.clientWidth - 24)}px`;
      scaler.style.height = 'auto';
    } else {
      const height = canvasHeight(doc.sections);
      scale = Math.max(0.3, Math.min(1, available / canvasWidth));
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${height}px`;
      canvas.style.transform = `scale(${scale})`;
      scaler.style.width = `${canvasWidth * scale}px`;
      scaler.style.height = `${height * scale}px`;
    }

    const stackWidth = stage.clientWidth - 48;
    const seen = new Set();
    for (const section of doc.sections) {
      seen.add(section.id);
      let view = sectionViews.get(section.id);
      if (!view) {
        view = createSectionView(section);
        sectionViews.set(section.id, view);
        canvas.append(view.node);
      }
      updateSectionView(view, section, ui, stacked ? Math.min(1, stackWidth / section.width) : null);
    }
    for (const [id, view] of sectionViews) {
      if (!seen.has(id)) {
        view.elements.forEach((ev) => ev.instance.destroy());
        view.node.remove();
        sectionViews.delete(id);
      }
    }
    renderEmptyState(doc);
  }

  // Clicking empty canvas clears the selection.
  canvas.addEventListener('pointerdown', (e) => {
    if (e.target === canvas || e.target === scaler) {
      hooks.blurInputs();
      store.select(null);
    }
  });
  stage.addEventListener('pointerdown', (e) => {
    if (e.target === stage || e.target === scaler) store.select(null);
  });

  // Dropping on the bare canvas: a section is placed at the pointer; an element
  // gets a new section created around it.
  canvas.addEventListener('dragover', (e) => {
    if (isPreview() || !e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    canvas.classList.add('is-drop-target');
  });
  canvas.addEventListener('dragleave', (e) => {
    if (!canvas.contains(e.relatedTarget)) canvas.classList.remove('is-drop-target');
  });
  canvas.addEventListener('drop', (e) => {
    canvas.classList.remove('is-drop-target');
    const kind = e.dataTransfer.getData(DRAG_MIME);
    if (!kind || isPreview()) return;
    e.preventDefault();
    const point = toCanvasPoint(e);
    const sectionId = actions.addSection({ x: point.x, y: point.y + SECTION_LABEL_SPACE });
    if (sectionId && kind !== 'section') actions.addElement(kind, { sectionId });
  });

  new ResizeObserver(() => render()).observe(stage);

  return {
    render,
    getElementInstance: (id) => {
      for (const view of sectionViews.values()) {
        const ev = view.elements.get(id);
        if (ev) return ev.instance;
      }
      return null;
    },
    get scale() { return scale; },
  };
}

export { DRAG_MIME };
