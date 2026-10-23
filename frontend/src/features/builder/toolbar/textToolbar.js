import { runCommand, commandStates, currentFontSize } from '../elements/text/richText.js';

/**
 * Formatting toolbar for the text element currently being edited.
 * Buttons use mousedown + preventDefault so the editor keeps its text selection.
 */
export function createTextToolbar({ root, store, getEditor }) {
  const sizeSelect = root.querySelector('[data-cmd="fontSize"]');
  const colorInput = root.querySelector('[data-cmd="foreColor"]');
  let savedRange = null;

  const editingId = () => store.ui.editingId;

  /** The text element listens for `input` and commits (deduplicated, debounced). */
  function commit() {
    getEditor()?.dispatchEvent(new Event('input'));
  }

  function restoreSelection() {
    const editor = getEditor();
    if (!editor || !savedRange) return;
    editor.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }

  function refreshState() {
    if (root.hidden) return;
    const states = commandStates();
    root.querySelectorAll('button[data-cmd]').forEach((btn) => {
      btn.classList.toggle('is-active', Boolean(states[btn.dataset.cmd]));
      btn.setAttribute('aria-pressed', String(Boolean(states[btn.dataset.cmd])));
    });
    const size = currentFontSize();
    sizeSelect.value = [...sizeSelect.options].some((o) => o.value === String(size)) ? String(size) : '';
  }

  root.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    e.preventDefault(); // keep focus/selection inside the editor
    const editor = getEditor();
    if (editor && runCommand(editor, btn.dataset.cmd)) commit();
    refreshState();
  });

  // Selects and color pickers take focus, so remember the selection beforehand.
  const remember = () => {
    const selection = window.getSelection();
    const editor = getEditor();
    if (editor && selection.rangeCount && editor.contains(selection.anchorNode)) {
      savedRange = selection.getRangeAt(0).cloneRange();
    }
  };
  sizeSelect.addEventListener('pointerdown', remember);
  colorInput.addEventListener('pointerdown', remember);

  sizeSelect.addEventListener('change', () => {
    restoreSelection();
    if (runCommand(getEditor(), 'fontSize', sizeSelect.value)) commit();
  });
  colorInput.addEventListener('change', () => {
    restoreSelection();
    if (runCommand(getEditor(), 'foreColor', colorInput.value)) commit();
  });

  document.addEventListener('selectionchange', () => {
    const editor = getEditor();
    const selection = window.getSelection();
    if (editor && selection.rangeCount && editor.contains(selection.anchorNode)) {
      savedRange = selection.getRangeAt(0).cloneRange();
      refreshState();
    }
  });

  return {
    render() {
      const visible = Boolean(editingId()) && !store.ui.preview;
      root.hidden = !visible;
      if (!visible) savedRange = null;
      else refreshState();
    },
  };
}
