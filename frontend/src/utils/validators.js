/**
 * Client-side validation rules. They mirror the server's Joi schemas so users get
 * instant feedback; the server remains the source of truth.
 * Each rule returns an error message string, or null when valid.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME = /^[\p{L}\p{M}' .-]+$/u;

export const rules = {
  required: (label) => (v) => (String(v ?? '').trim() ? null : `${label} is required`),
  minLength: (label, n) => (v) => (String(v ?? '').trim().length >= n ? null : `${label} must be at least ${n} characters`),
  maxLength: (label, n) => (v) => (String(v ?? '').length <= n ? null : `${label} must be at most ${n} characters`),
  email: () => (v) => (EMAIL.test(String(v).trim()) ? null : 'Please enter a valid email address'),
  personName: () => (v) => (NAME.test(String(v).trim())
    ? null : 'Name may only contain letters, spaces, apostrophes, dots and hyphens'),
  password: () => (v) => {
    if (!/[a-z]/.test(v)) return 'Password must contain at least one lowercase character';
    if (!/[A-Z]/.test(v)) return 'Password must contain at least one uppercase character';
    if (!/\d/.test(v)) return 'Password must contain at least one digit character';
    return null;
  },
  matches: (otherField, message) => (v, values) => (v === values[otherField] ? null : message),
  integerRange: (label, min, max) => (v) => {
    const n = Number(v);
    if (String(v).trim() === '' || !Number.isInteger(n)) return `${label} must be a whole number`;
    if (n < min || n > max) return `${label} must be between ${min} and ${max}`;
    return null;
  },
  number: (label) => (v) => (String(v).trim() !== '' && Number.isFinite(Number(v)) ? null : `${label} must be a number`),
  hexColor: (label) => (v) => (/^#[0-9a-fA-F]{6}$/.test(v) ? null : `${label} must be a hex color like #1a2b3c`),
};

/** Runs a { field: [rules] } schema against a values object. Returns { field: message }. */
export function validateValues(schema, values) {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(schema)) {
    for (const rule of fieldRules) {
      const message = rule(values[field], values);
      if (message) {
        errors[field] = message;
        break;
      }
    }
  }
  return errors;
}
