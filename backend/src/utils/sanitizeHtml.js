'use strict';

const sanitize = require('sanitize-html');
const { TEXT } = require('../constants/limits');

const FONT_SIZE = /^\d{1,2}px$/;
const COLOR = /^(#[0-9a-fA-F]{3,6}|rgba?\([\d\s.,%]+\))$/;

const clampFontSize = (style) => style.replace(/font-size\s*:\s*(\d+)px/gi, (_, px) => {
  const size = Math.min(TEXT.MAX_FONT_PX, Math.max(TEXT.MIN_FONT_PX, Number(px)));
  return `font-size:${size}px`;
});

/**
 * Whitelist-based sanitizer for rich text produced by the text editor.
 * Only formatting tags and a handful of safe inline styles survive, which
 * prevents stored XSS when a saved layout is rendered again.
 */
const OPTIONS = {
  allowedTags: ['p', 'div', 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote'],
  allowedAttributes: { '*': ['style'] },
  allowedStyles: {
    '*': {
      'font-size': [FONT_SIZE],
      color: [COLOR],
      'background-color': [COLOR],
      'text-align': [/^(left|right|center|justify)$/],
      'font-weight': [/^(bold|normal|[1-9]00)$/],
      'font-style': [/^(italic|normal)$/],
      'text-decoration': [/^(underline|line-through|none)$/],
    },
  },
  disallowedTagsMode: 'discard',
  transformTags: {
    '*': (tagName, attribs) => {
      if (attribs.style) attribs.style = clampFontSize(attribs.style);
      return { tagName, attribs };
    },
  },
};

module.exports = function sanitizeRichText(html) {
  return sanitize(String(html ?? ''), OPTIONS).trim();
};
