import { clamp, snapTo } from './geometry.js';

const HANDLE_DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const DRAG_THRESHOLD_PX = 3;

/** Appends the 8 resize handles to a node (shown via CSS when `.is-selected`). */
export function addResizeHandles(node) {
  for (const dir of HANDLE_DIRECTIONS) {
    const handle = document.createElement('span');
    handle.className = `handle handle--${dir}`;
    handle.dataset.handle = dir;
    handle.setAttribute('aria-hidden', 'true');
    node.append(handle);
  }
}

function resizeRect(start, dir, dx, dy, b, snap) {
  let { x, y, width, height } = start;
  const right = start.x + start.width;
  const bottom = start.y + start.height;

  if (dir.includes('e')) width = clamp(snapTo(right + dx, snap) - x, b.minWidth, b.maxX - x);
  if (dir.includes('s')) height = clamp(snapTo(bottom + dy, snap) - y, b.minHeight, Math.min(b.maxHeight, b.maxY - y));
  if (dir.includes('w')) {
    x = clamp(snapTo(start.x + dx, snap), b.minX, right - b.minWidth);
    width = right - x;
  }
  if (dir.includes('n')) {
    y = clamp(snapTo(start.y + dy, snap), Math.max(b.minY, bottom - b.maxHeight), bottom - b.minHeight);
    height = bottom - y;
  }
  return { x, y, width, height };
}

function moveRect(start, dx, dy, b, snap) {
  return {
    ...start,
    x: clamp(snapTo(start.x + dx, snap), b.minX, b.maxX - start.width),
    y: clamp(snapTo(start.y + dy, snap), b.minY, b.maxY - start.height),
  };
}

/**
 * Makes `node` draggable and resizable with pointer events (mouse, touch, pen).
 * Reused for both sections and elements; all coordinates are in canvas units,
 * so pointer deltas are divided by the current canvas zoom (`getScale`).
 *
 * options:
 *   getRect()      -> current { x, y, width, height }
 *   getBounds()    -> { minX, minY, maxX, maxY, minWidth, minHeight, maxHeight }
 *   getScale()     -> canvas zoom factor
 *   isSnapping()   -> snap to grid?
 *   canStart(e)    -> false to ignore (e.g. preview mode, text editing)
 *   onSelect()     -> pointer down on the node
 *   onPreview(rect, mode) -> live feedback during interaction (no state commit)
 *   onCommit(rect, mode)  -> final rect once the pointer is released
 */
export function makeInteractive(node, options) {
  let session = null;

  function onPointerDown(e) {
    if (e.button !== 0) return;
    // The innermost interactive node handles the event; parents never see it.
    e.stopPropagation();
    if (!options.canStart(e)) return;
    options.onSelect?.(e);
    e.preventDefault();

    const handle = e.target.closest('[data-handle]');
    session = {
      mode: handle && handle.parentElement === node ? 'resize' : 'move',
      dir: handle?.dataset.handle,
      startX: e.clientX,
      startY: e.clientY,
      start: options.getRect(),
      bounds: options.getBounds(),
      scale: options.getScale(),
      snap: options.isSnapping(),
      moved: false,
      rect: null,
    };
    node.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!session) return;
    const rawDx = e.clientX - session.startX;
    const rawDy = e.clientY - session.startY;
    if (!session.moved && Math.hypot(rawDx, rawDy) < DRAG_THRESHOLD_PX) return;
    if (!session.moved) {
      session.moved = true;
      document.body.classList.add('is-interacting');
    }
    const dx = rawDx / session.scale;
    const dy = rawDy / session.scale;
    session.rect = session.mode === 'resize'
      ? resizeRect(session.start, session.dir, dx, dy, session.bounds, session.snap)
      : moveRect(session.start, dx, dy, session.bounds, session.snap);
    options.onPreview(session.rect, session.mode);
  }

  function finish(commit) {
    if (!session) return;
    const { moved, rect, mode } = session;
    session = null;
    document.body.classList.remove('is-interacting');
    if (moved && rect) {
      if (commit) options.onCommit(rect, mode);
      else options.onCancel?.();
    }
  }

  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('pointermove', onPointerMove);
  node.addEventListener('pointerup', () => finish(true));
  node.addEventListener('pointercancel', () => finish(false));
  node.addEventListener('lostpointercapture', () => finish(true));

  return {
    destroy() {
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
    },
  };
}
