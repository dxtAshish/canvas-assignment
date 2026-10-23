import { h } from '../../../utils/dom.js';
import { rules } from '../../../utils/validators.js';
import { LIMITS, CHART_PALETTE, SECTION_LABEL_SPACE } from '../config.js';
import { sectionMinSize } from '../canvas/geometry.js';

// Read lazily: LIMITS is populated from the API after this module loads.
const datasets = () => LIMITS.DATASETS || [];
const datasetSeries = (key) => datasets().find((d) => d.key === key)?.series || ['Series 1'];

/**
 * Properties panel for the current selection (or dashboard settings when nothing
 * is selected). Inputs are declared as bindings ({ get, apply, validate }) so the
 * panel can refresh values in place without stealing focus while the user types;
 * it only rebuilds when the *shape* of the form changes.
 */
export function createInspector({ root, store, actions, hooks }) {
  let structureKey = null;
  let bindings = [];

  /* ------------------------------ field factory ------------------------------ */

  function field({ label, type = 'text', get, apply, validate, options, attrs = {}, coalesce, live = false, hint }) {
    const id = `insp-${Math.random().toString(36).slice(2, 9)}`;
    let input;
    if (type === 'select') {
      input = h('select', { id, ...attrs }, options.map((o) => h('option', { value: o.value }, o.label)));
    } else if (type === 'textarea') {
      input = h('textarea', { id, rows: 3, ...attrs });
    } else {
      input = h('input', { id, type, ...attrs });
    }
    const error = h('p', { class: 'field__error', role: 'alert' });
    const wrapper = h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('p', { class: 'field__hint' }, hint) : null, error);

    const setError = (message) => {
      error.textContent = message || '';
      wrapper.classList.toggle('has-error', Boolean(message));
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    };
    const handler = () => {
      const raw = input.value;
      const message = validate?.(raw);
      setError(message);
      if (message) return;
      apply(type === 'number' ? Number(raw) : raw, { coalesce: coalesce || (live ? `${id}` : undefined) });
    };
    input.addEventListener(live ? 'input' : 'change', handler);

    bindings.push({ input, get });
    input.value = String(get());
    return wrapper;
  }

  const group = (title, ...children) => h('div', { class: 'inspector__group' }, title ? h('h3', {}, title) : null, ...children);
  const button = (label, onClick, extra = '') => h('button', { type: 'button', class: `btn btn--sm ${extra}`, onClick }, label);

  /* ------------------------------ geometry group ----------------------------- */

  function geometryGroup(kind, id) {
    const get = (key) => () => {
      const found = store.locate(id);
      return (kind === 'section' ? found.section : found.element)[key];
    };
    const range = (key) => {
      const found = store.locate(id);
      if (kind === 'section') {
        const s = found.section;
        const cw = store.doc.settings.canvasWidth;
        const min = sectionMinSize(s);
        return {
          x: [0, cw - s.width],
          y: [SECTION_LABEL_SPACE, LIMITS.CANVAS.MAX_Y],
          width: [min.width, cw - s.x],
          height: [min.height, LIMITS.SECTION.MAX_HEIGHT],
        }[key];
      }
      const { section: s, element: e } = found;
      return {
        x: [0, s.width - e.width],
        y: [0, s.height - e.height],
        width: [LIMITS.ELEMENT.MIN_WIDTH, s.width - e.x],
        height: [LIMITS.ELEMENT.MIN_HEIGHT, s.height - e.y],
      }[key];
    };
    const numberField = (key, label) => field({
      label,
      type: 'number',
      attrs: { step: 1, inputmode: 'numeric' },
      get: get(key),
      validate: (v) => {
        const [min, max] = range(key);
        return rules.integerRange(label, min, Math.max(min, max))(v);
      },
      apply: (value) => actions.setRect(id, { [key]: value }),
    });
    return group('Position & size',
      h('div', { class: 'grid-2' }, numberField('x', 'X'), numberField('y', 'Y')),
      h('div', { class: 'grid-2' }, numberField('width', 'Width'), numberField('height', 'Height')));
  }

  function arrangeGroup(kind) {
    return group('Arrange',
      h('div', { class: 'button-row' },
        button('Bring to front', () => actions.reorder('front')),
        button('Send to back', () => actions.reorder('back'))),
      h('div', { class: 'button-row' },
        button('Duplicate', () => actions.duplicateSelected()),
        button(`Delete ${kind}`, () => hooks.confirmDelete(), 'btn--danger')));
  }

  /* --------------------------------- panels --------------------------------- */

  function dashboardPanel() {
    const { settings, sections } = store.doc;
    const elementCount = sections.reduce((n, s) => n + s.elements.length, 0);
    const minWidth = () => Math.max(LIMITS.CANVAS.MIN_WIDTH, ...store.doc.sections.map((s) => s.x + s.width));

    return [
      h('div', { class: 'inspector__header' }, h('h2', {}, 'Dashboard')),
      group('Canvas',
        field({
          label: 'Canvas width (px)',
          type: 'number',
          attrs: { step: 10 },
          get: () => store.doc.settings.canvasWidth,
          validate: (v) => rules.integerRange('Canvas width', minWidth(), LIMITS.CANVAS.MAX_WIDTH)(v),
          apply: (canvasWidth) => actions.updateSettings({ canvasWidth }),
          hint: 'Sections must fit inside the canvas width.',
        }),
        field({
          label: 'Background color',
          type: 'color',
          live: true,
          get: () => store.doc.settings.backgroundColor,
          validate: rules.hexColor('Background color'),
          apply: (backgroundColor, opts) => actions.updateSettings({ backgroundColor }, opts),
        })),
      group('Details',
        field({
          label: 'Description',
          type: 'textarea',
          live: true,
          attrs: { maxlength: 500 },
          get: () => store.doc.settings.description,
          validate: rules.maxLength('Description', 500),
          apply: (description, opts) => actions.updateSettings({ description }, opts),
        }),
        h('p', { class: 'field__hint' }, `${sections.length} sections · ${elementCount} elements`)),
      h('div', { class: 'inspector__empty' },
        h('strong', {}, 'Nothing selected'),
        'Click a section or element on the canvas to edit its properties.'),
    ];
  }

  function sectionPanel(id) {
    return [
      h('div', { class: 'inspector__header' }, h('h2', {}, 'Section')),
      group('Appearance',
        field({
          label: 'Title',
          live: true,
          attrs: { maxlength: 100, placeholder: 'Untitled section' },
          get: () => store.locate(id).section.title,
          validate: rules.maxLength('Title', 100),
          apply: (title, opts) => actions.updateSection(id, { title }, opts),
        }),
        field({
          label: 'Background color',
          type: 'color',
          live: true,
          get: () => store.locate(id).section.backgroundColor,
          validate: rules.hexColor('Background color'),
          apply: (backgroundColor, opts) => actions.updateSection(id, { backgroundColor }, opts),
        })),
      geometryGroup('section', id),
      arrangeGroup('section'),
    ];
  }

  function textGroup(id) {
    const content = () => store.locate(id).element.content;
    const transparent = h('input', { type: 'checkbox', checked: content().backgroundColor === 'transparent' });
    const colorField = field({
      label: 'Background color',
      type: 'color',
      live: true,
      get: () => (content().backgroundColor === 'transparent' ? '#ffffff' : content().backgroundColor),
      validate: rules.hexColor('Background color'),
      apply: (backgroundColor, opts) => actions.updateElementContent(id, { backgroundColor }, opts),
    });
    transparent.addEventListener('change', () => {
      actions.updateElementContent(id, { backgroundColor: transparent.checked ? 'transparent' : '#ffffff' });
    });
    return group('Text',
      h('p', { class: 'field__hint' }, 'Double-click the text on the canvas to edit it. Use the toolbar at the top for bold, italic, font size and color.'),
      button('Edit text', () => store.setUi({ editingId: id }), 'btn--primary'),
      h('label', { class: 'toggle' }, transparent, 'Transparent background'),
      colorField);
  }

  function imageGroup(id) {
    const content = store.locate(id).element.content;
    const uploadBtn = button(content.url ? 'Replace image' : 'Upload image', () => hooks.requestImageUpload(id, uploadBtn), 'btn--primary');
    return group('Image',
      content.url ? h('img', { class: 'image-thumb', src: content.url, alt: '' }) : null,
      h('p', { class: 'field__hint' }, `PNG, JPEG, GIF or WEBP up to ${Math.round(LIMITS.UPLOAD_MAX_BYTES / 1024 / 1024)} MB.`),
      h('div', { class: 'button-row' }, uploadBtn,
        content.url ? button('Remove', () => actions.updateElementContent(id, { url: '' })) : null),
      field({
        label: 'Alt text (accessibility)',
        live: true,
        attrs: { maxlength: 200, placeholder: 'Describe the image' },
        get: () => store.locate(id).element.content.alt,
        validate: rules.maxLength('Alt text', 200),
        apply: (alt, opts) => actions.updateElementContent(id, { alt }, opts),
      }),
      field({
        label: 'Fit',
        type: 'select',
        options: [
          { value: 'cover', label: 'Cover (fill & crop)' },
          { value: 'contain', label: 'Contain (show whole image)' },
          { value: 'fill', label: 'Stretch' },
        ],
        get: () => store.locate(id).element.content.fit,
        apply: (fit) => actions.updateElementContent(id, { fit }),
      }));
  }

  function chartGroups(id) {
    const content = () => store.locate(id).element.content;
    const update = (patch, opts) => actions.updateElementContent(id, patch, opts);
    const c = content();

    const basics = group('Chart',
      field({
        label: 'Chart type',
        type: 'select',
        options: [{ value: 'bar', label: 'Bar chart' }, { value: 'line', label: 'Line chart' }],
        get: () => content().chartType,
        apply: (chartType) => update({ chartType }),
      }),
      field({
        label: 'Title',
        live: true,
        attrs: { maxlength: 100 },
        get: () => content().title,
        validate: rules.maxLength('Title', 100),
        apply: (title, opts) => update({ title }, opts),
      }),
      field({
        label: 'Data source',
        type: 'select',
        options: [{ value: 'manual', label: 'Manual data (edit below)' }, { value: 'dynamic', label: 'Dynamic (generated by API)' }],
        get: () => content().source,
        apply: (source) => update(source === 'dynamic' ? dynamicPatch(content(), content().dataset) : manualPatch(content())),
      }));

    if (c.source === 'dynamic') {
      return [basics, group('Dynamic data',
        field({
          label: 'Dataset',
          type: 'select',
          options: datasets().map((d) => ({ value: d.key, label: d.title })),
          get: () => content().dataset,
          apply: (dataset) => update(dynamicPatch(content(), dataset)),
        }),
        field({
          label: `Data points (${LIMITS.CHART.MIN_POINTS}–${LIMITS.CHART.MAX_POINTS})`,
          type: 'number',
          get: () => content().points,
          validate: rules.integerRange('Data points', LIMITS.CHART.MIN_POINTS, LIMITS.CHART.MAX_POINTS),
          apply: (points) => update({ points }),
        }),
        field({
          label: 'Auto refresh',
          type: 'select',
          options: LIMITS.CHART.REFRESH_OPTIONS.map((s) => ({ value: String(s), label: s ? `Every ${s} seconds` : 'Off' })),
          get: () => content().refreshSeconds,
          apply: (value) => update({ refreshSeconds: Number(value) }),
        }),
        button('Regenerate data now', () => hooks.refreshChart(id)),
        ...seriesStyleFields(id, content, update)),
      ];
    }
    return [basics, manualDataGroup(id, content, update)];
  }

  function seriesStyleFields(id, content, update) {
    return content().series.map((_, i) => field({
      label: `Series ${i + 1} color`,
      type: 'color',
      live: true,
      get: () => content().series[i]?.color || CHART_PALETTE[i],
      validate: rules.hexColor('Color'),
      apply: (color, opts) => update({ series: content().series.map((s, j) => (j === i ? { ...s, color } : s)) }, opts),
    }));
  }

  /** Spreadsheet-like editor for manual chart data with per-cell validation. */
  function manualDataGroup(id, content, update) {
    const c = content();
    const cell = (get, onValid, validator, attrs = {}) => {
      const input = h('input', { value: String(get()), ...attrs });
      input.addEventListener('change', () => {
        const message = validator(input.value);
        input.classList.toggle('has-error', Boolean(message));
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
        input.title = message || '';
        if (!message) onValid(input.value);
      });
      bindings.push({ input, get });
      return input;
    };
    const labelRule = (v) => rules.maxLength('Label', 30)(v);
    const numberRule = (v) => rules.number('Value')(v) || (Math.abs(Number(v)) > 1e9 ? 'Value is too large' : null);

    const setLabel = (row, value) => update({ labels: content().labels.map((l, i) => (i === row ? value.trim() : l)) });
    const setValue = (row, si, value) => update({
      series: content().series.map((s, j) => (j === si ? { ...s, data: s.data.map((d, i) => (i === row ? Number(value) : d)) } : s)),
    });
    const setSeries = (si, patch) => update({ series: content().series.map((s, j) => (j === si ? { ...s, ...patch } : s)) });

    const header = h('tr', {}, h('th', {}, 'Label'), c.series.map((s, si) => h('th', {},
      h('div', { style: { display: 'flex', gap: '2px' } },
        cell(() => content().series[si].label, (v) => setSeries(si, { label: v.trim() }),
          (v) => rules.maxLength('Series name', 40)(v), { 'aria-label': `Series ${si + 1} name`, maxlength: 40 }),
        (() => {
          const color = h('input', { type: 'color', value: s.color, 'aria-label': `Series ${si + 1} color`, style: { width: '26px', padding: 0 } });
          color.addEventListener('input', () => setSeries(si, { color: color.value }, { coalesce: `color:${id}:${si}` }));
          bindings.push({ input: color, get: () => content().series[si].color });
          return color;
        })(),
        c.series.length > 1 ? h('button', {
          type: 'button', class: 'btn btn--ghost btn--icon', title: 'Remove series', 'aria-label': `Remove series ${si + 1}`,
          onClick: () => update({ series: content().series.filter((_, j) => j !== si) }),
        }, '×') : null))), h('th'));

    const rows = c.labels.map((_, row) => h('tr', {},
      h('td', {}, cell(() => content().labels[row], (v) => setLabel(row, v), labelRule, { 'aria-label': `Label ${row + 1}`, maxlength: 30 })),
      c.series.map((s, si) => h('td', {}, cell(() => content().series[si].data[row] ?? 0, (v) => setValue(row, si, v), numberRule, {
        inputmode: 'decimal', 'aria-label': `${s.label || `Series ${si + 1}`} value ${row + 1}`,
      }))),
      h('td', {}, c.labels.length > 1 ? h('button', {
        type: 'button', class: 'btn btn--ghost btn--icon', title: 'Remove row', 'aria-label': `Remove row ${row + 1}`,
        onClick: () => update({
          labels: content().labels.filter((_, i) => i !== row),
          series: content().series.map((s) => ({ ...s, data: s.data.filter((_, i) => i !== row) })),
        }),
      }, '×') : null)));

    const canAddRow = c.labels.length < LIMITS.CHART.MAX_POINTS;
    const canAddSeries = c.series.length < LIMITS.CHART.MAX_SERIES;
    return group('Data',
      h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'data-table' }, h('thead', {}, header), h('tbody', {}, rows))),
      h('div', { class: 'button-row' },
        button('+ Row', () => update({
          labels: [...content().labels, `Item ${content().labels.length + 1}`],
          series: content().series.map((s) => ({ ...s, data: [...s.data, 0] })),
        }), canAddRow ? '' : 'is-disabled'),
        button('+ Series', () => update({
          series: [...content().series, {
            label: `Series ${content().series.length + 1}`,
            color: CHART_PALETTE[content().series.length % CHART_PALETTE.length],
            data: content().labels.map(() => 0),
          }],
        }), canAddSeries ? '' : 'is-disabled')),
      h('p', { class: 'field__hint' }, `Up to ${LIMITS.CHART.MAX_POINTS} rows and ${LIMITS.CHART.MAX_SERIES} series.`));
  }

  function elementPanel(id) {
    const { element } = store.locate(id);
    const typeGroups = {
      text: () => [textGroup(id)],
      image: () => [imageGroup(id)],
      chart: () => chartGroups(id),
    }[element.type]();
    const title = { text: 'Text', image: 'Image', chart: 'Chart' }[element.type];
    return [
      h('div', { class: 'inspector__header' }, h('h2', {}, title)),
      ...typeGroups,
      geometryGroup('element', id),
      arrangeGroup('element'),
    ];
  }

  /* --------------------------------- render ---------------------------------- */

  function computeKey() {
    const sel = store.ui.selection;
    if (!sel) return 'dashboard';
    const found = store.locate(sel.id);
    if (!found) return 'dashboard';
    if (found.kind === 'section') return `section:${sel.id}`;
    const { element } = found;
    if (element.type === 'chart') {
      const c = element.content;
      return `chart:${sel.id}:${c.source}:${c.labels.length}:${c.series.length}`;
    }
    if (element.type === 'image') return `image:${sel.id}:${element.content.url}`;
    return `${element.type}:${sel.id}:${element.content.backgroundColor === 'transparent'}`;
  }

  function rebuild(key) {
    bindings = [];
    const sel = store.ui.selection;
    let content;
    if (key === 'dashboard') content = dashboardPanel();
    else if (sel.kind === 'section') content = sectionPanel(sel.id);
    else content = elementPanel(sel.id);
    root.replaceChildren(...content);
    root.querySelectorAll('.is-disabled').forEach((b) => { b.disabled = true; });
  }

  /**
   * Refreshes input values from the store without touching the focused input or
   * inputs that currently show a validation error (so the message stays visible).
   */
  function sync() {
    for (const { input, get } of bindings) {
      if (document.activeElement === input || input.getAttribute('aria-invalid') === 'true') continue;
      try {
        const value = String(get());
        if (input.value !== value) input.value = value;
      } catch {
        /* item was removed; the next rebuild will drop this binding */
      }
    }
  }

  return {
    render() {
      if (!store.doc) return;
      const key = computeKey();
      if (key !== structureKey || key === 'dashboard') {
        // The dashboard panel shows live counts; rebuild it unless the user is typing in it.
        if (key === structureKey && root.contains(document.activeElement)) {
          sync();
          return;
        }
        structureKey = key;
        rebuild(key);
      } else {
        sync();
      }
    },
  };
}

/* Helpers for switching chart data source */

export function dynamicPatch(content, dataset) {
  const names = datasetSeries(dataset);
  return {
    source: 'dynamic',
    dataset,
    series: names.map((label, i) => ({ label, color: content.series[i]?.color || CHART_PALETTE[i % CHART_PALETTE.length], data: [] })),
  };
}

export function manualPatch(content) {
  const labels = content.labels.length ? content.labels : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return {
    source: 'manual',
    labels,
    series: content.series.map((s, i) => ({
      ...s,
      label: s.label || `Series ${i + 1}`,
      data: labels.map((_, row) => (Number.isFinite(s.data[row]) ? s.data[row] : Math.round(20 + Math.random() * 80))),
    })),
  };
}
