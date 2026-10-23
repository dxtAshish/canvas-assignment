import { h } from '../../../../utils/dom.js';

export const imageElement = {
  label: 'Image',

  defaults: () => ({
    width: 280,
    height: 180,
    content: { url: '', alt: '', fit: 'cover' },
  }),

  mount(container, element, ctx) {
    let current = null;

    function placeholder(text, isError = false) {
      return h('div', { class: `image-placeholder${isError ? ' is-error' : ''}` },
        h('span', { style: { fontSize: '22px' }, 'aria-hidden': 'true' }, isError ? '⚠' : '🖼'),
        h('span', {}, text),
        h('span', { 'data-edit-only': '' }, 'Double-click to upload'));
    }

    function render(model) {
      const { url, alt, fit } = model.content;
      const key = `${url}|${alt}|${fit}`;
      if (key === current) return;
      current = key;

      if (!url) {
        container.replaceChildren(placeholder('No image yet'));
        return;
      }
      const img = h('img', { class: 'image-element', src: url, alt: alt || '', draggable: false, style: { objectFit: fit } });
      img.addEventListener('error', () => container.replaceChildren(placeholder('Image could not be loaded', true)), { once: true });
      container.replaceChildren(img);
    }
    render(element);

    container.addEventListener('dblclick', () => {
      if (!ctx.isPreview()) ctx.requestUpload();
    });

    return { update: render, destroy() {} };
  },
};
