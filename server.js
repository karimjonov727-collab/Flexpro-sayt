// FlexPro sayt — statik sahifa + /api/lead → Telegram guruh
// Env: BOT_TOKEN, CHAT_ID, PORT (Railway beradi)
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const CHAT_ID = process.env.CHAT_ID || '';
const PUB = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    if (!BOT_TOKEN || !CHAT_ID) return reject(new Error('BOT_TOKEN yoki CHAT_ID env ornatilmagan'));
    const body = JSON.stringify({ chat_id: CHAT_ID, text });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/sendMessage',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.ok) resolve(j); else reject(new Error('Telegram: ' + data.slice(0, 200)));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Telegram timeout')));
    req.end(body);
  });
}

// oddiy IP-limit: bir IP dan 1 daqiqada ko'pi bilan 5 ariza
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 5;
}

function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Sahifa topilmadi');
    }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.setHeader('Accept-Ranges', 'bytes');
    if (ext === '.mp3') res.setHeader('Cache-Control', 'public, max-age=86400');

    // Safari/iOS audio uchun Range talab qilinadi
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range && st.size > 0) {
      let start = range[1] ? parseInt(range[1], 10) : 0;
      let end = range[2] ? parseInt(range[2], 10) : st.size - 1;
      if (isNaN(start) || isNaN(end) || start > end || end >= st.size) { start = 0; end = st.size - 1; }
      res.statusCode = 206;
      res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + st.size);
      res.setHeader('Content-Length', end - start + 1);
      res.setHeader('Content-Type', type);
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', st.size);
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/lead') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', async () => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      if (rateLimited(ip)) { res.statusCode = 429; return res.end('{"ok":false}'); }
      let name = '', phone = '', manba = '';
      try {
        const j = JSON.parse(body || '{}');
        name = String(j.name || '').slice(0, 100).trim();
        phone = String(j.phone || '').slice(0, 30).trim();
        manba = String(j.manba || '').slice(0, 50).trim();
      } catch (e) { /* bo'sh qoladi */ }
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 7) { res.statusCode = 400; return res.end('{"ok":false,"err":"phone"}'); }

      const vaqt = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });
      const text = '🆕 FLEXPRO saytidan yangi lid!\n\n' +
        '👤 Ism: ' + (name || '—') + '\n' +
        '📞 Tel: ' + phone + '\n' +
        '📍 Forma: ' + (manba || '—') + '\n' +
        '🕒 ' + vaqt + ' (Toshkent)';
      try {
        await sendTelegram(text);
        res.end('{"ok":true}');
      } catch (e1) {
        try {
          await new Promise((r) => setTimeout(r, 1500));
          await sendTelegram(text);
          res.end('{"ok":true}');
        } catch (e2) {
          console.error('Telegram xato:', e2.message, '| lid:', name, phone);
          res.statusCode = 502;
          res.end('{"ok":false}');
        }
      }
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }

  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    return res.end('{"ok":true}');
  }

  let p;
  try { p = decodeURIComponent(String(req.url || '/').split('?')[0]); }
  catch (e) { res.statusCode = 400; return res.end(); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB)) { res.statusCode = 403; return res.end(); }
  serveFile(req, res, file);
});

server.listen(PORT, () => console.log('FlexPro sayt ' + PORT + '-portda ishlayapti'));
