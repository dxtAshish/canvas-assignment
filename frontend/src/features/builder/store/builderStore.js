/**
 * Central state container for the builder.
 *
 * - `doc` is the persisted document (settings + sections + elements). Every change
 *   goes through `update()`, which records undo history and notifies subscribers.
 * - `ui` holds transient view state (selection, text editing, preview) that is not
 *   part of undo history and never saved.
 */
const HISTORY_LIMIT = 100;
const COALESCE_MS = 800;

const clone = (value) => structuredClone(value);

export function createStore() {
  let doc = null;
  let ui = { selection: null, editingId: null, preview: false, snap: true };
  let version = null;
  let savedSnapshot = '';
  const undoStack = [];
  const redoStack = [];
  let lastCoalesce = { key: null, at: 0 };
  const listeners = new Set();

  const emit = (reason) => listeners.forEach((fn) => fn({ doc, ui, reason }));

  /** Drops selection/editing state that points at items that no longer exist. */
  function pruneUi() {
    const sel = ui.selection;
    if (sel && !locate(sel.id)) ui = { ...ui, selection: null };
    if (ui.editingId && !locate(ui.editingId)) ui = { ...ui, editingId: null };
  }

  function locate(id) {
    for (const section of doc?.sections || []) {
      if (section.id === id) return { kind: 'section', section };
      const element = section.elements.find((el) => el.id === id);
      if (element) return { kind: 'element', section, element };
    }
    return null;
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    init(initialDoc, initialVersion) {
      doc = initialDoc;
      version = initialVersion;
      savedSnapshot = JSON.stringify(doc);
      undoStack.length = 0;
      redoStack.length = 0;
      ui = { ...ui, selection: null, editingId: null };
      emit('init');
    },

    get doc() { return doc; },
    get ui() { return ui; },
    get version() { return version; },
    locate,

    /**
     * Applies `mutator(draft)` to a copy of the document.
     * `coalesce`: consecutive updates with the same key (e.g. typing) share one undo step.
     */
    update(mutator, { coalesce = null } = {}) {
      const before = doc;
      const draft = clone(doc);
      mutator(draft);
      const now = Date.now();
      const merge = coalesce && lastCoalesce.key === coalesce && now - lastCoalesce.at < COALESCE_MS;
      if (!merge) {
        undoStack.push(before);
        if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      }
      lastCoalesce = { key: coalesce, at: now };
      redoStack.length = 0;
      doc = draft;
      pruneUi();
      emit('update');
    },

    undo() {
      if (!undoStack.length) return;
      redoStack.push(doc);
      doc = undoStack.pop();
      lastCoalesce = { key: null, at: 0 };
      pruneUi();
      emit('history');
    },

    redo() {
      if (!redoStack.length) return;
      undoStack.push(doc);
      doc = redoStack.pop();
      lastCoalesce = { key: null, at: 0 };
      pruneUi();
      emit('history');
    },

    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },

    setUi(patch) {
      ui = { ...ui, ...patch };
      emit('ui');
    },

    select(id) {
      if (ui.selection?.id === id && !ui.editingId) return;
      const found = id ? locate(id) : null;
      ui = { ...ui, selection: found ? { id, kind: found.kind } : null, editingId: ui.editingId === id ? id : null };
      emit('ui');
    },

    /** Marks `snapshot` (the doc that was sent) as saved; later edits remain dirty. */
    markSaved(snapshot, newVersion) {
      savedSnapshot = JSON.stringify(snapshot);
      version = newVersion;
      emit('saved');
    },

    setVersion(newVersion) {
      version = newVersion;
    },

    get isDirty() {
      return doc !== null && JSON.stringify(doc) !== savedSnapshot;
    },
  };
}
