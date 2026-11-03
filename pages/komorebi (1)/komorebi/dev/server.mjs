// Komorebi dev server — không cần cài thêm gói nào, chỉ cần Node 18+
//   node dev/server.mjs          → chạy với Supabase giả lập (mặc định)
//   node dev/server.mjs --real   → chạy với Supabase thật (dùng public/config.js)
//   node dev/server.mjs --port 8080
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DEV, '../public');
const args = process.argv.slice(2);
const REAL = args.includes('--real');
const PORT = Number(args[args.indexOf('--port') + 1]) || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };

async function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(url.pathname);
    // config.js: bản giả lập = cấu hình mock + thư viện Supabase giả
    if (p === '/config.js' && !REAL) {
      const body = (await fs.readFile(path.join(DEV, 'config.mock.js'), 'utf8')) + '\n' + (await fs.readFile(path.join(DEV, 'mock-supabase.js'), 'utf8'));
      return send(res, 200, body, TYPES['.js']);
    }
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden', 'text/plain');
    try {
      const st = await fs.stat(file);
      if (st.isFile()) return send(res, 200, await fs.readFile(file), TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    } catch (e) { /* không có file → rơi xuống SPA fallback */ }
    // Giống _redirects trên Netlify: mọi đường dẫn khác đều trả về index.html
    return send(res, 200, await fs.readFile(path.join(ROOT, 'index.html')), TYPES['.html']);
  } catch (e) {
    send(res, 500, String(e), 'text/plain');
  }
}).listen(PORT, () => {
  console.log(`\n🍃 Komorebi đang chạy tại  http://localhost:${PORT}`);
  console.log(REAL ? '   Chế độ: Supabase THẬT (public/config.js)' : '   Chế độ: Supabase GIẢ LẬP — dữ liệu chỉ nằm trong trình duyệt của cưng');
  if (!REAL) console.log('   Tài khoản demo: uploader@komorebi.local / 123456  ·  reader@komorebi.local / 123456');
  console.log('   Dừng: Ctrl + C\n');
});
