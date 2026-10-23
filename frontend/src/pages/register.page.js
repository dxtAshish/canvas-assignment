import { authApi } from '../api/auth.api.js';
import { bindForm } from '../components/formController.js';
import { attachPasswordToggles } from '../components/passwordToggle.js';
import { redirectIfAuthenticated } from '../guards/authGuard.js';
import { ROUTES } from '../config/routes.js';
import { rules } from '../utils/validators.js';

redirectIfAuthenticated();

const form = document.getElementById('register-form');
attachPasswordToggles(form); // password + confirm password

bindForm(form, {
  loadingText: 'Creating account…',
  schema: {
    name: [rules.required('Name'), rules.minLength('Name', 2), rules.maxLength('Name', 50), rules.personName()],
    email: [rules.required('Email'), rules.email(), rules.maxLength('Email', 254)],
    password: [rules.required('Password'), rules.minLength('Password', 8), rules.maxLength('Password', 72), rules.password()],
    confirmPassword: [rules.required('Confirm password'), rules.matches('password', 'Passwords do not match')],
  },
  onSubmit: async ({ name, email, password }) => {
    await authApi.register({ name: name.trim(), email: email.trim(), password });
    window.location.assign(ROUTES.DASHBOARDS);
  },
});
