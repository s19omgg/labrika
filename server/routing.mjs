export function labrikaRoutes(req, res, next) {
  const pathname = (req.url || '/').split('?')[0];
  const routes = {
    '/': '/index.html',
    '/admin': '/admin/index.html',
    '/admin/': '/admin/index.html'
  };
  if (routes[pathname]) req.url = routes[pathname];
  next();
}
