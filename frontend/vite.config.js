import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:5000';

/** HTML entry points (multi-page app). */
const PAGES = {
  login: 'login.html',
  register: 'register.html',
  dashboards: 'dashboards.html',
  builder: 'builder.html',
  notFound: '404.html',
};

/** Clean URLs -> HTML entry points. Mirrors backend/src/routes/web.routes.js. */
const ROUTES = [
  [/^\/login\/?$/, `/${PAGES.login}`],
  [/^\/register\/?$/, `/${PAGES.register}`],
  [/^\/dashboards\/?$/, `/${PAGES.dashboards}`],
  [/^\/dashboards\/\d+\/?$/, `/${PAGES.builder}`],
];

function cleanUrls() {
  const middleware = (req, res, next) => {
    const [pathname, query] = req.url.split('?');
    if (pathname === '/') {
      res.statusCode = 302;
      res.setHeader('Location', '/dashboards');
      res.end();
      return;
    }
    const route = ROUTES.find(([pattern]) => pattern.test(pathname));
    if (route) req.url = route[1] + (query ? `?${query}` : '');
    next();
  };
  return {
    name: 'clean-urls',
    configureServer: (server) => { server.middlewares.use(middleware); },
    configurePreviewServer: (server) => { server.middlewares.use(middleware); },
  };
}

// changeOrigin stays false so the API's same-origin (CSRF) check sees the browser's host.
const proxy = {
  '/api': { target: API_TARGET, changeOrigin: false },
  '/uploads': { target: API_TARGET, changeOrigin: false },
};

export default defineConfig({
  appType: 'mpa',
  plugins: [cleanUrls()],
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, proxy },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(Object.entries(PAGES).map(([name, file]) => [name, `${root}${file}`])),
    },
  },
});
