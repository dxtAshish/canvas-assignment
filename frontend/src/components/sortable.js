/**
 * Drag-and-drop reordering for a list or grid of items (pointer events: mouse,
 * pen and touch). Reusable: no knowledge of what the items represent.
 *
 *   makeSortable(container, {
 *     itemSelector: '.card',               // draggable items (direct children of container)
 *     handleSelector: '[data-sort-handle]', // optional grip; required to start a drag on touch
 *     getId: (item) => item.dataset.id,
 *     onSort: async (newIds, oldIds) => {}, // throw/reject to roll back
 *   });
 *
 * Mouse: drag an item anywhere except on buttons/inputs. Touch: drag by the
 * handle (so the page can still scroll). Keyboard: focus the handle and use the
 * arrow keys.
 */
const DRAG_THRESHOLD_PX = 6;
const AUTOSCROLL_EDGE_PX = 70;
const AUTOSCROLL_SPEED = 14;
const INTERACTIVE = 'button, input, textarea, select, [contenteditable="true"]';

export function makeSortable(container, {
  itemSelector, handleSelector = '[data-sort-handle]', getId, onSort,
}) {
  let drag = null;

  const items = () => [...container.querySelectorAll(`:scope > ${itemSelector}`)];
  const ids = () => items().map(getId);

  /** Restores the DOM order from a list of ids (used to roll back a failed save). */
  function applyOrder(orderedIds) {
    const byId = new Map(items().map((item) => [getId(item), item]));
    orderedIds.forEach((itemId) => {
      const item = byId.get(itemId);
      if (item) container.append(item);
    });
  }

  async function commit(before) {
    const after = ids();
    if (after.join() === before.join()) return;
    try {
      await onSort(after, before);
    } catch {
      applyOrder(before);
    }
  }

  /* ------------------------------ pointer drag ------------------------------ */

  function start(e) {
    const { item } = drag;
    const rect = item.getBoundingClientRect();
    drag.active = true;
    drag.offsetX = e.clientX - rect.left;
    drag.offsetY = e.clientY - rect.top;

    drag.placeholder = document.createElement('div');
    drag.placeholder.className = 'sortable-placeholder';
    drag.placeholder.style.height = `${rect.height}px`;
    item.before(drag.placeholder);

    Object.assign(item.style, {
      position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
      width: `${rect.width}px`, height: `${rect.height}px`, zIndex: '1000', pointerEvents: 'none',
    });
    item.classList.add('is-dragging');
    document.body.classList.add('is-sorting');
  }

  function move(e) {
    const { item, placeholder } = drag;
    item.style.left = `${e.clientX - drag.offsetX}px`;
    item.style.top = `${e.clientY - drag.offsetY}px`;

    // The dragged item ignores pointer events, so this finds the item underneath.
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(itemSelector);
    if (target && target !== item && container.contains(target)) {
      const placeholderFirst = placeholder.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING;
      if (placeholderFirst) target.after(placeholder);
      else target.before(placeholder);
    }

    // Auto-scroll when dragging near the top/bottom of the viewport.
    if (e.clientY < AUTOSCROLL_EDGE_PX) window.scrollBy(0, -AUTOSCROLL_SPEED);
    else if (e.clientY > window.innerHeight - AUTOSCROLL_EDGE_PX) window.scrollBy(0, AUTOSCROLL_SPEED);
  }

  function finish() {
    if (!drag) return;
    const { item, placeholder, active, before } = drag;
    drag = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    if (!active) return;

    placeholder.replaceWith(item);
    item.removeAttribute('style');
    item.classList.remove('is-dragging');
    document.body.classList.remove('is-sorting');

    // A drag must not also count as a click (e.g. opening a link inside the item).
    const swallowClick = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    window.addEventListener('click', swallowClick, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallowClick, { capture: true }), 0);

    commit(before);
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
      start(e);
    }
    e.preventDefault();
    move(e);
  }

  function onPointerUp() {
    finish();
  }

  container.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    const item = e.target.closest(itemSelector);
    if (!item || !container.contains(item)) return;
    const onHandle = Boolean(e.target.closest(handleSelector));
    if (!onHandle && (e.pointerType === 'touch' || e.target.closest(INTERACTIVE))) return;

    drag = { item, startX: e.clientX, startY: e.clientY, active: false, before: ids() };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  });

  // Links and images inside items must not start the browser's native drag.
  container.addEventListener('dragstart', (e) => {
    if (e.target.closest?.(itemSelector)) e.preventDefault();
  });

  /* -------------------------------- keyboard -------------------------------- */

  container.addEventListener('keydown', (e) => {
    const handle = e.target.closest(handleSelector);
    if (!handle) return;
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!step) return;
    e.preventDefault();

    const item = handle.closest(itemSelector);
    const list = items();
    const index = list.indexOf(item);
    const target = list[index + step];
    if (!target) return;
    const before = ids();
    if (step < 0) target.before(item);
    else target.after(item);
    handle.focus();
    commit(before);
  });

  return { applyOrder };
}
