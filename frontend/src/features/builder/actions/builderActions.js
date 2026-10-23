import { LIMITS, uid, SECTION_LABEL_SPACE } from '../config.js';
import { elementTypes } from '../elements/registry.js';
import {
  fitRect, sectionBounds, elementBounds, nextSectionY, topZ, snapTo, findFreeSpot,
} from '../canvas/geometry.js';
import { toast } from '../../../components/toast.js';

/**
 * High-level editing operations. Each one validates limits, mutates the store
 * through a single `update()` (= one undo step) and selects the result.
 */
export function createActions(store) {
  const findSection = (doc, id) => doc.sections.find((s) => s.id === id);
  const findElement = (doc, id) => {
    for (const section of doc.sections) {
      const element = section.elements.find((el) => el.id === id);
      if (element) return { section, element };
    }
    return null;
  };
  const totalElements = (doc) => doc.sections.reduce((n, s) => n + s.elements.length, 0);

  /** Section that new elements should go into: the selected one or the selected element's parent. */
  function targetSectionId() {
    const sel = store.ui.selection;
    if (!sel) return null;
    if (sel.kind === 'section') return sel.id;
    return store.locate(sel.id)?.section.id ?? null;
  }

  function addSection(position = null) {
    const { doc } = store;
    if (doc.sections.length >= LIMITS.SECTION.MAX_PER_DASHBOARD) {
      toast(`A dashboard can have at most ${LIMITS.SECTION.MAX_PER_DASHBOARD} sections.`, 'warning');
      return null;
    }
    const canvasWidth = doc.settings.canvasWidth;
    const width = Math.min(560, canvasWidth - 40);
    const height = 300;
    const rect = position
      ? { x: position.x - width / 2, y: position.y - SECTION_LABEL_SPACE, width, height }
      : { x: 20, y: nextSectionY(doc.sections), width, height };
    const section = {
      id: uid('s'),
      title: `Section ${doc.sections.length + 1}`,
      backgroundColor: '#ffffff',
      zIndex: topZ(doc.sections),
      elements: [],
      ...fitRect({ ...rect, x: snapTo(rect.x, true), y: snapTo(rect.y, true) }, sectionBounds({ elements: [] }, canvasWidth)),
    };
    store.update((draft) => { draft.sections.push(section); });
    store.select(section.id);
    return section.id;
  }

  /**
   * Adds an element of `kind` (text | image | chart-bar | chart-line) into a section.
   * Without a target section, the selected section is used; if there is none a new
   * section is created to hold the element.
   */
  function addElement(kind, { sectionId = targetSectionId(), position = null } = {}) {
    const [type, variant] = kind.split('-');
    const definition = elementTypes[type];
    if (!definition) return null;

    if (totalElements(store.doc) >= LIMITS.ELEMENT.MAX_PER_DASHBOARD) {
      toast(`A dashboard can have at most ${LIMITS.ELEMENT.MAX_PER_DASHBOARD} elements.`, 'warning');
      return null;
    }
    let targetId = sectionId && findSection(store.doc, sectionId) ? sectionId : store.doc.sections.at(-1)?.id;
    if (!targetId) targetId = addSection();
    if (!targetId) return null;

    const section = findSection(store.doc, targetId);
    if (section.elements.length >= LIMITS.ELEMENT.MAX_PER_SECTION) {
      toast(`A section can hold at most ${LIMITS.ELEMENT.MAX_PER_SECTION} elements. Add a new section.`, 'warning');
      return null;
    }

    const defaults = definition.defaults(variant);
    const width = Math.min(defaults.width, section.width - 40);
    const height = Math.min(defaults.height, section.height - 40);
    const offset = (section.elements.length % 6) * 20;
    // Dropped: centre on the pointer. Clicked: first free spot, else cascade.
    const desired = position
      ? { x: position.x - width / 2, y: position.y - height / 2, width, height }
      : findFreeSpot(section, width, height) || { x: 20 + offset, y: 20 + offset, width, height };
    const rect = fitRect(desired, elementBounds(section));

    const element = { id: uid('e'), type, zIndex: topZ(section.elements), content: defaults.content, ...rect };
    store.update((draft) => { findSection(draft, targetId).elements.push(element); });
    store.select(element.id);
    return element.id;
  }

  function setRect(id, rect) {
    store.update((draft) => {
      const section = findSection(draft, id);
      const target = section || findElement(draft, id)?.element;
      if (target) Object.assign(target, rect);
    });
  }

  function updateSection(id, patch, options) {
    store.update((draft) => Object.assign(findSection(draft, id), patch), options);
  }

  function updateElementContent(id, patch, options) {
    store.update((draft) => {
      const found = findElement(draft, id);
      if (found) found.element.content = { ...found.element.content, ...patch };
    }, options);
  }

  function updateSettings(patch, options) {
    store.update((draft) => { draft.settings = { ...draft.settings, ...patch }; }, options);
  }

  function removeSelected() {
    const sel = store.ui.selection;
    if (!sel) return;
    store.update((draft) => {
      if (sel.kind === 'section') {
        draft.sections = draft.sections.filter((s) => s.id !== sel.id);
      } else {
        const found = findElement(draft, sel.id);
        if (found) found.section.elements = found.section.elements.filter((el) => el.id !== sel.id);
      }
    });
    store.select(null);
  }

  function duplicateSelected() {
    const sel = store.ui.selection;
    if (!sel) return;
    const { doc } = store;

    if (sel.kind === 'section') {
      if (doc.sections.length >= LIMITS.SECTION.MAX_PER_DASHBOARD) {
        toast(`A dashboard can have at most ${LIMITS.SECTION.MAX_PER_DASHBOARD} sections.`, 'warning');
        return;
      }
      const source = findSection(doc, sel.id);
      if (totalElements(doc) + source.elements.length > LIMITS.ELEMENT.MAX_PER_DASHBOARD) {
        toast('Duplicating this section would exceed the element limit.', 'warning');
        return;
      }
      const copy = structuredClone(source);
      copy.id = uid('s');
      copy.title = `${source.title || 'Section'} (copy)`.slice(0, 100);
      copy.elements.forEach((el) => { el.id = uid('e'); });
      copy.zIndex = topZ(doc.sections);
      Object.assign(copy, fitRect({ ...source, y: nextSectionY(doc.sections) }, sectionBounds(copy, doc.settings.canvasWidth)));
      store.update((draft) => { draft.sections.push(copy); });
      store.select(copy.id);
      return;
    }

    const { section, element } = findElement(doc, sel.id);
    if (section.elements.length >= LIMITS.ELEMENT.MAX_PER_SECTION || totalElements(doc) >= LIMITS.ELEMENT.MAX_PER_DASHBOARD) {
      toast('Element limit reached for this section.', 'warning');
      return;
    }
    const copy = {
      ...structuredClone(element),
      id: uid('e'),
      zIndex: topZ(section.elements),
      ...fitRect({ ...element, x: element.x + 20, y: element.y + 20 }, elementBounds(section)),
    };
    store.update((draft) => { findSection(draft, section.id).elements.push(copy); });
    store.select(copy.id);
  }

  /** Re-numbers z-indexes after moving the item to the front or back of its siblings. */
  function reorder(direction) {
    const sel = store.ui.selection;
    if (!sel) return;
    store.update((draft) => {
      const siblings = sel.kind === 'section' ? draft.sections : findElement(draft, sel.id).section.elements;
      const ordered = [...siblings].sort((a, b) => a.zIndex - b.zIndex);
      const item = ordered.find((s) => s.id === sel.id);
      const rest = ordered.filter((s) => s !== item);
      const next = direction === 'front' ? [...rest, item] : [item, ...rest];
      next.forEach((s, i) => { s.zIndex = i + 1; });
    });
  }

  function nudge(dx, dy) {
    const sel = store.ui.selection;
    if (!sel) return;
    const found = store.locate(sel.id);
    const item = found.kind === 'section' ? found.section : found.element;
    const bounds = found.kind === 'section'
      ? sectionBounds(found.section, store.doc.settings.canvasWidth)
      : elementBounds(found.section);
    const rect = fitRect({ ...item, x: item.x + dx, y: item.y + dy }, bounds);
    if (rect.x !== item.x || rect.y !== item.y) {
      store.update((draft) => {
        const target = sel.kind === 'section' ? findSection(draft, sel.id) : findElement(draft, sel.id).element;
        target.x = rect.x;
        target.y = rect.y;
      }, { coalesce: `nudge:${sel.id}` });
    }
  }

  return {
    addSection,
    addElement,
    setRect,
    updateSection,
    updateElementContent,
    updateSettings,
    removeSelected,
    duplicateSelected,
    reorder,
    nudge,
  };
}
