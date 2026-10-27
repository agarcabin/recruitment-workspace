const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.env.PORT || 4173);
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/favicon.ico') {res.writeHead(204);res.end();return;}
  if (pathname !== '/' && pathname !== '/index.html') {res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(__dirname, 'index.html'), (error, data) => {
    if (error) {res.writeHead(500);res.end('Unable to read index.html');return;}
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
