const http = require('http');
const httpProxy = require('http-proxy-middleware');

// Crear proxy para redirigir al servidor Next.js
const proxy = httpProxy.createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true
});

// Crear servidor en puerto 8080
const server = http.createServer((req, res) => {
  proxy(req, res);
});

server.listen(8080, '0.0.0.0', () => {
  console.log('Proxy server running on http://0.0.0.0:8080');
  console.log('Redirecting to http://localhost:3000');
});