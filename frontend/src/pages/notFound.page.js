import { authApi } from '../api/auth.api.js';
import { mountNavbar } from '../components/navbar.js';

// The 404 page is public; show the user menu only if a session exists.
authApi.me().then(mountNavbar).catch(() => {});
