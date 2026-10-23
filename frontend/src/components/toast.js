import { h } from '../utils/dom.js';

const DURATION = { success: 3000, info: 3500, warning: 5000, error: 6000 };

/** Non-blocking notification. type: success | info | warning | error */
export function toast(message, type = 'info') {
  const region = document.getElementById('toast-region');
  if (!region) return;

  const remove = () => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 200);
  };
  const node = h('div', { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' },
    h('span', {}, message),
    h('button', { class: 'toast__close', type: 'button', 'aria-label': 'Dismiss', onClick: remove }, '×'));

  region.append(node);
  setTimeout(remove, DURATION[type] ?? 4000);
}
