import { h } from '../utils/dom.js';

/**
 * Promise-based confirmation dialog built on the native <dialog> element.
 * Resolves true when confirmed, false when cancelled/escaped.
 */
export function confirmDialog({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const confirmBtn = h('button', { type: 'submit', class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, value: 'confirm' }, confirmText);
    const dialog = h('dialog', { class: 'modal', 'aria-labelledby': 'confirm-title' },
      h('form', { method: 'dialog' },
        h('h2', { class: 'modal__title', id: 'confirm-title' }, title),
        h('p', { class: 'modal__body' }, message),
        h('div', { class: 'modal__actions' },
          h('button', { type: 'submit', class: 'btn btn--ghost', value: 'cancel' }, 'Cancel'),
          confirmBtn)));

    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
    confirmBtn.focus();
  });
}
