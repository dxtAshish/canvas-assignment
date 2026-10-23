import { validateValues } from '../utils/validators.js';
import { setLoading, h } from '../utils/dom.js';
import { ApiError } from '../api/httpClient.js';

/**
 * Reusable form controller: client-side validation (on blur + submit), inline
 * field errors, server error mapping (422 details -> fields) and a loading state.
 *
 *   bindForm(formEl, { schema, onSubmit: async (values) => {...} })
 */
export function bindForm(form, { schema = {}, onSubmit, loadingText }) {
  const submitBtn = form.querySelector('[type="submit"]');
  const formError = form.querySelector('[data-form-error]');
  const touched = new Set();

  const values = () => Object.fromEntries(new FormData(form).entries());

  function setFieldError(name, message) {
    const slot = form.querySelector(`[data-error-for="${name}"]`);
    const input = form.elements[name];
    if (slot) slot.textContent = message || '';
    slot?.closest('.field')?.classList.toggle('has-error', Boolean(message));
    if (input instanceof HTMLElement) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function showFormError(message, extra = []) {
    if (!formError) return;
    formError.replaceChildren(message, extra.length ? h('ul', {}, extra.map((m) => h('li', {}, m))) : '');
    formError.hidden = !message;
  }

  function clearErrors() {
    Object.keys(schema).forEach((name) => setFieldError(name, ''));
    form.querySelectorAll('[data-error-for]').forEach((slot) => setFieldError(slot.dataset.errorFor, ''));
    showFormError('');
  }

  function validate(onlyField) {
    const errors = validateValues(schema, values());
    const fields = onlyField ? [onlyField] : Object.keys(schema);
    fields.forEach((name) => setFieldError(name, errors[name]));
    return errors;
  }

  form.addEventListener('focusout', (e) => {
    const name = e.target.name;
    if (!name || !(name in schema)) return;
    touched.add(name);
    validate(name);
  });
  form.addEventListener('input', (e) => {
    if (touched.has(e.target.name)) validate(e.target.name);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showFormError('');
    Object.keys(schema).forEach((name) => touched.add(name));
    const errors = validate();
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      form.elements[firstInvalid]?.focus();
      return;
    }

    setLoading(submitBtn, true, loadingText);
    try {
      await onSubmit(values());
    } catch (err) {
      applyServerError(err);
    } finally {
      setLoading(submitBtn, false);
    }
  });

  /** Maps API errors to fields where possible; otherwise shows a form-level message. */
  function applyServerError(err) {
    if (!(err instanceof ApiError)) {
      showFormError('Unexpected error. Please try again.');
      return;
    }
    const unmatched = [];
    for (const { field, message } of err.details || []) {
      if (form.querySelector(`[data-error-for="${field}"]`)) setFieldError(field, message);
      else unmatched.push(message);
    }
    if (!err.details?.length || unmatched.length) showFormError(err.message, unmatched);
  }

  return { clearErrors, setFieldError, showFormError, reset: () => { form.reset(); touched.clear(); clearErrors(); } };
}
