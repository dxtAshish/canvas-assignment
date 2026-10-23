/**
 * Tiny hyperscript helper. Text is always assigned via textContent, so user
 * data never becomes HTML by accident.
 *   h('button', { class: 'btn', onClick: fn, dataset: { id: 1 } }, 'Save')
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in el && typeof value !== 'string') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Toggles a button's loading state and returns a function that restores it. */
export function setLoading(button, loading, loadingText) {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.textContent;
    if (loadingText) button.textContent = loadingText;
    button.classList.add('is-loading');
    button.disabled = true;
  } else {
    if (button.dataset.label) button.textContent = button.dataset.label;
    button.classList.remove('is-loading');
    button.disabled = false;
  }
}

export function debounce(fn, wait) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.flush = (...args) => { clearTimeout(timer); fn(...args); };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export const formatDate = (value) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));
