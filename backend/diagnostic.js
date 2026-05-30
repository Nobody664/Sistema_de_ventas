const http = require('http');
const port = parseInt(process.env.PORT || '10000', 10);
const srv = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
});
srv.listen(port, '0.0.0.0', () => {
  console.log('DIAGNOSTIC SERVER UP on port', port);
});
