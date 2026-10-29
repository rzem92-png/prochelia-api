import http from 'node:http';
import net from 'node:net';
import { createHash, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 8080);
const TOKEN = String(process.env.DOCUMENT_SCAN_TOKEN || '');
const CLAMD_HOST = String(process.env.CLAMD_HOST || 'clamav');
const CLAMD_PORT = Number(process.env.CLAMD_PORT || 3310);
const MAX_BYTES = Number(process.env.MAX_SCAN_BYTES || 10 * 1024 * 1024);
const TIMEOUT_MS = Number(process.env.SCAN_TIMEOUT_MS || 25000);

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(data);
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function clamScan(bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: CLAMD_HOST, port: CLAMD_PORT });
    let response = Buffer.alloc(0);
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      err ? reject(err) : resolve(value);
    };
    socket.setTimeout(TIMEOUT_MS, () => finish(new Error('CLAMD_TIMEOUT')));
    socket.on('error', () => finish(new Error('CLAMD_UNAVAILABLE')));
    socket.on('data', chunk => {
      response = Buffer.concat([response, chunk]);
      if (response.includes(0)) {
        const message = response.toString('utf8').replace(/\0/g, '').trim();
        if (/:\s*OK$/i.test(message)) finish(null, { verdict: 'CLEAN', message });
        else if (/:\s*.+\sFOUND$/i.test(message)) finish(null, { verdict: 'INFECTED', message });
        else finish(new Error('CLAMD_SCAN_ERROR'));
      }
      if (response.length > 4096) finish(new Error('CLAMD_RESPONSE_TOO_LARGE'));
    });
    socket.on('connect', () => {
      socket.write(Buffer.from('zINSTREAM\0', 'utf8'));
      const chunkSize = Buffer.alloc(4);
      chunkSize.writeUInt32BE(bytes.length, 0);
      socket.write(chunkSize);
      socket.write(bytes);
      socket.write(Buffer.alloc(4));
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (!TOKEN) return json(res, 503, { ok: false, error: 'SCANNER_SECRET_NOT_CONFIGURED' });
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true, service: 'PROCHÉLIA ClamAV Gateway', scanner: 'ClamAV', status: 'gateway_online' });
  }
  if (req.method !== 'POST' || req.url !== '/scan') {
    res.setHeader('allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }
  if (!safeEqual(req.headers.authorization || '', 'Bearer ' + TOKEN)) {
    return json(res, 401, { ok: false, error: 'UNAUTHORIZED' });
  }
  const claimedHash = String(req.headers['x-prochelia-sha256'] || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(claimedHash)) return json(res, 400, { ok: false, error: 'SHA256_REQUIRED' });
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_BYTES) {
      tooLarge = true;
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('error', () => {
    if (!res.headersSent) json(res, tooLarge ? 413 : 400, { ok: false, error: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED' });
  });
  req.on('end', async () => {
    if (tooLarge || res.destroyed || res.writableEnded) return;
    const bytes = Buffer.concat(chunks);
    const actualHash = sha256(bytes);
    if (actualHash !== claimedHash) return json(res, 422, { ok: false, error: 'SHA256_MISMATCH', sha256: actualHash });
    try {
      const scan = await clamScan(bytes);
      const threat = scan.verdict === 'INFECTED' ? scan.message.replace(/^.*?:\s*/, '').replace(/\s+FOUND$/i, '').slice(0, 200) : null;
      return json(res, 200, {
        verdict: scan.verdict,
        engine: 'ClamAV',
        signature_version: process.env.CLAMAV_SIGNATURE_VERSION || 'managed-by-clamav-container',
        sha256: actualHash,
        scan_id: req.headers['x-prochelia-document-id'] ? String(req.headers['x-prochelia-document-id']).slice(0, 80) : null,
        threat_name: threat
      });
    } catch (err) {
      return json(res, 503, { ok: false, error: err?.message === 'CLAMD_TIMEOUT' ? 'SCAN_TIMEOUT' : 'SCANNER_UNAVAILABLE' });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  if (!TOKEN) console.error('DOCUMENT_SCAN_TOKEN is missing; scan endpoint remains unavailable.');
  console.log('PROCHÉLIA ClamAV Gateway listening on', PORT);
});
