const SVG_NS = 'http://www.w3.org/2000/svg';

// Feather-style icons: open eye = "show password", crossed eye = "hide password".
const ICONS = {
  show: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'circle:12,12,3'],
  hide: [
    'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94',
    'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19',
    'M14.12 14.12a3 3 0 1 1-4.24-4.24',
    'M1 1l22 22',
  ],
};

function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const shape of ICONS[name]) {
    let node;
    if (shape.startsWith('circle:')) {
      const [cx, cy, r] = shape.slice(7).split(',');
      node = document.createElementNS(SVG_NS, 'circle');
      node.setAttribute('cx', cx);
      node.setAttribute('cy', cy);
      node.setAttribute('r', r);
    } else {
      node = document.createElementNS(SVG_NS, 'path');
      node.setAttribute('d', shape);
    }
    svg.append(node);
  }
  return svg;
}

/** Adds a show/hide (eye) button to one password input. */
export function attachPasswordToggle(input) {
  if (input.dataset.passwordToggle) return;
  input.dataset.passwordToggle = 'true';

  const wrapper = document.createElement('div');
  wrapper.className = 'password-field';
  input.replaceWith(wrapper);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'password-field__toggle';
  if (input.id) button.setAttribute('aria-controls', input.id);
  wrapper.append(input, button);

  const render = () => {
    const visible = input.type === 'text';
    button.replaceChildren(icon(visible ? 'hide' : 'show'));
    button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    button.setAttribute('aria-pressed', String(visible));
    button.title = visible ? 'Hide password' : 'Show password';
  };

  // Keep focus (and the caret position) in the input while toggling.
  button.addEventListener('mousedown', (e) => e.preventDefault());
  button.addEventListener('click', () => {
    const { selectionStart, selectionEnd } = input;
    input.type = input.type === 'password' ? 'text' : 'password';
    render();
    if (document.activeElement === input) input.setSelectionRange(selectionStart, selectionEnd);
  });

  render();
}

/** Enhances every password input inside `root`. */
export function attachPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(attachPasswordToggle);
}
