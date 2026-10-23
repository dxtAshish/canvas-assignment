import { h, debounce } from '../../../../utils/dom.js';
import { sanitizeHtml } from './richText.js';

export const textElement = {
  label: 'Text',

  defaults: () => ({
    width: 320,
    height: 120,
    content: {
      html: '<p><span style="font-size:20px"><b>New heading</b></span></p><p>Double-click to edit this text.</p>',
      backgroundColor: 'transparent',
    },
  }),

  /**
   * ctx.commit(html) persists content; ctx.onExitEdit() ends edit mode.
   * The editor is only made contenteditable while editing so drags never
   * accidentally select text.
   */
  mount(container, element, ctx) {
    const editor = h('div', { class: 'text-element', spellcheck: 'true' });
    container.append(editor);

    let editing = false;
    let lastHtml = null;

    const commit = debounce(() => {
      const html = sanitizeHtml(editor.innerHTML);
      if (html !== lastHtml) {
        lastHtml = html;
        ctx.commit(html);
      }
    }, 400);

    editor.addEventListener('input', () => commit());
    editor.addEventListener('blur', () => commit.flush());
    // Paste as plain text: keeps formatting predictable and blocks foreign HTML.
    editor.addEventListener('paste', (e) => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        commit.flush();
        ctx.onExitEdit();
      }
    });

    function render(model) {
      editor.style.backgroundColor = model.content.backgroundColor === 'transparent' ? '' : model.content.backgroundColor;
      // Never overwrite the DOM while the user is typing (would reset the caret).
      if (!editing && model.content.html !== lastHtml) {
        lastHtml = model.content.html;
        editor.innerHTML = sanitizeHtml(model.content.html);
      }
    }
    render(element);

    return {
      editor,
      update: render,
      setEditing(value) {
        if (value === editing) return;
        editing = value;
        editor.contentEditable = value ? 'true' : 'false';
        if (value) {
          editor.focus();
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          commit.flush();
          window.getSelection()?.removeAllRanges();
        }
      },
      flush: () => commit.flush(),
      destroy() {
        commit.cancel();
      },
    };
  },
};
