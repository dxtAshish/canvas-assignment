import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rules, validateValues } from '../src/utils/validators.js';
import { safeRedirect } from '../src/utils/safeRedirect.js';
import { dashboardIdFromPath } from '../src/config/routes.js';

describe('validators', () => {
  it('validates a registration-like schema', () => {
    const schema = {
      email: [rules.required('Email'), rules.email()],
      password: [rules.required('Password'), rules.minLength('Password', 8), rules.password()],
      confirm: [rules.matches('password', 'Passwords do not match')],
    };
    assert.deepEqual(validateValues(schema, { email: 'a@b.co', password: 'Passw0rd', confirm: 'Passw0rd' }), {});
    assert.deepEqual(validateValues(schema, { email: 'nope', password: 'password', confirm: 'x' }), {
      email: 'Please enter a valid email address',
      password: 'Password must contain at least one uppercase character',
      confirm: 'Passwords do not match',
    });
  });

  it('checks integer ranges and hex colors', () => {
    assert.equal(rules.integerRange('Width', 40, 500)('120'), null);
    assert.equal(rules.integerRange('Width', 40, 500)('9999'), 'Width must be between 40 and 500');
    assert.equal(rules.integerRange('Width', 40, 500)('1.5'), 'Width must be a whole number');
    assert.equal(rules.hexColor('Color')('#a1b2c3'), null);
    assert.ok(rules.hexColor('Color')('red'));
  });
});

describe('safeRedirect (open-redirect protection)', () => {
  it('allows same-site paths only', () => {
    assert.equal(safeRedirect('/dashboards/3'), '/dashboards/3');
    assert.equal(safeRedirect('//evil.com'), '/dashboards');
    assert.equal(safeRedirect('https://evil.com'), '/dashboards');
    assert.equal(safeRedirect(null), '/dashboards');
  });
});

describe('dashboardIdFromPath', () => {
  it('parses builder URLs', () => {
    assert.equal(dashboardIdFromPath('/dashboards/42'), 42);
    assert.equal(dashboardIdFromPath('/dashboards/42/'), 42);
    assert.equal(dashboardIdFromPath('/dashboards/abc'), null);
    assert.equal(dashboardIdFromPath('/dashboards'), null);
  });
});
