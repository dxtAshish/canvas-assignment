/**
 * Rich-text helpers for the text element: a whitelist sanitizer (mirrors the
 * server's sanitize-html config) and formatting commands for the toolbar.
 */
const ALLOWED_TAGS = new Set(['P', 'DIV', 'BR', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE']);
const ALLOWED_STYLES = ['font-size', 'color', 'background-color', 'text-align', 'font-weight', 'font-style', 'text-decoration'];
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT']);

function cleanNode(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE || DROP_WITH_CONTENT.has(child.tagName)) {
      child.remove();
      continue;
    }
    cleanNode(child);
    if (!ALLOWED_TAGS.has(child.tagName)) {
      child.replaceWith(...child.childNodes); // unwrap unknown tags, keep their text
      continue;
    }
    const kept = ALLOWED_STYLES
      .map((prop) => [prop, child.style.getPropertyValue(prop)])
      .filter(([, value]) => value && !/url\(|expression/i.test(value));
    for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
    kept.forEach(([prop, value]) => child.style.setProperty(prop, value));
    if (!child.getAttribute('style')) child.removeAttribute('style');
  }
}

export function sanitizeHtml(html) {
  // DOMParser documents are inert: scripts do not run and images do not load.
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  cleanNode(doc.body);
  return doc.body.innerHTML.trim();
}

/** Applies a font size (px) to the current selection inside `editor`. */
export function applyFontSize(editor, px) {
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  for (const font of editor.querySelectorAll('font[size="7"]')) {
    const span = document.createElement('span');
    span.style.fontSize = `${px}px`;
    span.append(...font.childNodes);
    span.querySelectorAll('[style]').forEach((n) => n.style.removeProperty('font-size'));
    font.replaceWith(span);
  }
}

/** Runs a toolbar command; returns true when the content may have changed. */
export function runCommand(editor, cmd, value) {
  editor.focus();
  if (cmd === 'fontSize') {
    if (!value) return false;
    applyFontSize(editor, Number(value));
    return true;
  }
  document.execCommand('styleWithCSS', false, cmd === 'foreColor');
  document.execCommand(cmd, false, value);
  // execCommand may produce <font color> despite styleWithCSS in some browsers.
  for (const font of editor.querySelectorAll('font[color]')) {
    const span = document.createElement('span');
    span.style.color = font.getAttribute('color');
    span.append(...font.childNodes);
    font.replaceWith(span);
  }
  return true;
}

export function commandStates() {
  const state = {};
  for (const cmd of ['bold', 'italic', 'underline', 'insertUnorderedList', 'justifyLeft', 'justifyCenter']) {
    try {
      state[cmd] = document.queryCommandState(cmd);
    } catch {
      state[cmd] = false;
    }
  }
  return state;
}

/** Font size (px) at the caret, used to reflect the current size in the toolbar. */
export function currentFontSize() {
  const node = window.getSelection()?.anchorNode;
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return el instanceof Element ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : null;
}
