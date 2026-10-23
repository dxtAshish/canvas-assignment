import { authApi } from '../api/auth.api.js';
import { bindForm } from '../components/formController.js';
import { attachPasswordToggles } from '../components/passwordToggle.js';
import { redirectIfAuthenticated } from '../guards/authGuard.js';
import { rules } from '../utils/validators.js';
import { safeRedirect } from '../utils/safeRedirect.js';

redirectIfAuthenticated();

const next = safeRedirect(new URLSearchParams(window.location.search).get('next'));

const form = document.getElementById('login-form');
attachPasswordToggles(form);

bindForm(form, {
  loadingText: 'Signing in…',
  schema: {
    email: [rules.required('Email'), rules.email()],
    password: [rules.required('Password')],
  },
  onSubmit: async ({ email, password }) => {
    await authApi.login({ email: email.trim(), password });
    window.location.assign(next);
  },
});
