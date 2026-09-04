// Dev server แบบ static สำหรับ preview (ไม่ต้องติดตั้ง dependency เพิ่ม)
// รองรับการส่ง host/port จาก CLI เช่น: npm run dev -- --port 7100 --host 127.0.0.1
const http = require('http');
const fs = require('fs');
const path = require('path');

function getArg(name, def) {
    const i = process.argv.indexOf('--' + name);
    if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
    const eq = process.argv.find(a => a.startsWith('--' + name + '='));
    if (eq) return eq.split('=').slice(1).join('=');
    return def;
}

const port = parseInt(getArg('port', process.env.PORT || '7100'), 10);
const host = getArg('host', process.env.HOST || '127.0.0.1');
const root = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(root, path.normalize(urlPath));
    if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found: ' + urlPath);
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(port, host, () => {
    console.log(`Dev server running at http://${host}:${port}/`);
});
