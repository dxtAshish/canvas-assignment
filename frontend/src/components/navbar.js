import { authApi } from '../api/auth.api.js';
import { ROUTES } from '../config/routes.js';
import { toast } from './toast.js';

/**
 * Fills the shared navbar (`[data-navbar-user]`) with the signed-in user and
 * wires the "Sign out" button.
 */
export function mountNavbar(user) {
  const slot = document.querySelector('[data-navbar-user]');
  if (!slot || !user) return;

  const name = slot.querySelector('[data-user-name]');
  name.textContent = `Hi, ${user.name}`;
  name.title = user.email;
  slot.hidden = false;

  slot.querySelector('[data-action="logout"]').addEventListener('click', async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    try {
      await authApi.logout();
      window.location.assign(ROUTES.LOGIN);
    } catch (err) {
      button.disabled = false;
      toast(err.message, 'error');
    }
  });
}
