"""Komorebi dev server (bản Python, dùng khi máy không có Node).
   python dev/server.py            -> Supabase giả lập
   python dev/server.py --real     -> Supabase thật (public/config.js)
   python dev/server.py --port 8080
"""
import http.server, os, sys, mimetypes, pathlib, urllib.parse

DEV = pathlib.Path(__file__).resolve().parent
ROOT = (DEV.parent / 'public').resolve()
REAL = '--real' in sys.argv
PORT = int(sys.argv[sys.argv.index('--port') + 1]) if '--port' in sys.argv else 5173
mimetypes.add_type('text/javascript', '.js'); mimetypes.add_type('text/css', '.css'); mimetypes.add_type('image/webp', '.webp')

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, status, body, ctype):
        self.send_response(status); self.send_header('Content-Type', ctype); self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        p = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        if p == '/config.js' and not REAL:
            body = (DEV / 'config.mock.js').read_bytes() + b'\n' + (DEV / 'mock-supabase.js').read_bytes()
            return self._send(200, body, 'text/javascript; charset=utf-8')
        f = (ROOT / p.lstrip('/')).resolve()
        if str(f).startswith(str(ROOT)) and f.is_file():
            ctype = mimetypes.guess_type(str(f))[0] or 'application/octet-stream'
            if ctype.startswith('text/'): ctype += '; charset=utf-8'
            return self._send(200, f.read_bytes(), ctype)
        return self._send(200, (ROOT / 'index.html').read_bytes(), 'text/html; charset=utf-8')   # SPA fallback

print(f"\n🍃 Komorebi đang chạy tại  http://localhost:{PORT}")
print('   Chế độ: Supabase THẬT (public/config.js)' if REAL else '   Chế độ: Supabase GIẢ LẬP · uploader@komorebi.local / 123456 · reader@komorebi.local / 123456')
print('   Dừng: Ctrl + C\n')
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
