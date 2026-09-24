#!/usr/bin/env node
// V.A.U.L.T. — Jarvis Vault OS HUD. Run: node server.js → http://localhost:3333 (Chrome)
// Server-side logic lives in lib/, the browser HUD in public/ (index.html + style.css + app.js).
'use strict';
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { DASH, VAULT, PORT, HOST, KEY, readSettings, writeSettings, honor } = require('./lib/config');
const { gate, lanIP } = require('./lib/net');
const { readGrants, writeGrants } = require('./lib/grants');
const { mdFiles, linkGraph, readNote, resolveWiki } = require('./lib/vault');
const { vaultSearch, chunkCount } = require('./lib/search');
const { SKILLS } = require('./lib/skills');
const { PY, tts, startWhisper, sttProxy, stopWhisper } = require('./lib/voice');
const { stats, counters } = require('./lib/stats');
const { runAsk, runClaude, interruptWorker, killWorker } = require('./lib/agent');
const { nudge, greet } = require('./lib/nudges');

// ---------- The HUD page: public/ files inlined into one response (works as a phone PWA) ----------
// Values are escaped for where they land: JSON inside <script> (no "</script>" breakout), text inside HTML.
// The owner's name is applied by the page itself (see OWNER in app.js) — the JS source is never regex-rewritten.
const jsonForScript = v => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const htmlEsc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function page() {
  const rd = f => fs.readFileSync(path.join(DASH, 'public', f), 'utf8');
  const s = readSettings();
  const skills = SKILLS.map(({ id, label, input }) => ({ id, label, input }));
  const pr = { he: 'sir', she: "ma'am", they: s.ownerName }[s.pronoun] || s.ownerName;
  const owner = { name: s.ownerName, sir: pr };
  const html = rd('index.html').replace(/\bBoss\b/g, () => htmlEsc(s.ownerName));
  return html.replace('/*__CSS__*/', () => rd('style.css')).replace('/*__JS__*/', () => rd('app.js'))
    .replace('__SKILLS__', () => jsonForScript(skills)).replace('__OWNER__', () => jsonForScript(owner)).replace(/__KEY__/g, KEY);
}

startWhisper();
process.on('exit', stopWhisper);
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// Read a request body with a hard size cap (413 beyond it). Returns a Buffer, or null if refused.
function readBody(req, res, limit) {
  return new Promise(resolve => {
    const bufs = []; let len = 0, done = false;
    req.on('data', d => { if (done) return; len += d.length;
      if (len > limit) { done = true; try { res.writeHead(413); res.end('too large'); } catch {} req.destroy(); return resolve(null); }
      bufs.push(d); });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(bufs)); } });
    req.on('error', () => { if (!done) { done = true; resolve(null); } });
  });
}
const json = b => { try { return JSON.parse(b.toString('utf8')); } catch { return {}; } };
const LIMIT = { ask: 64e3, run: 64e3, tts: 16e3, folders: 20e3, settings: 5e3, stt: 15e6, upload: 125e6 };

http.createServer(async (req, res) => {
  const p0 = req.url.split('?')[0];
  if (req.method === 'GET' && p0 === '/health') { res.writeHead(200); return res.end('ok'); }   // liveness only, no data
  const isPage = req.method === 'GET' && (p0 === '/' || p0 === '/manifest.json' || p0 === '/icon.png');
  const denied = gate(req, isPage ? 'page' : 'api');
  if (denied) { res.writeHead(denied.status, { 'content-type': 'text/plain' }); return res.end(denied.msg); }
  if (req.method === 'GET' && p0 === '/manifest.json') {
    res.writeHead(200, { 'content-type': 'application/manifest+json' });
    return res.end(JSON.stringify({ name: 'JARVIS', short_name: 'JARVIS', start_url: '/?key=' + KEY,   // phone home-screen app needs it once
      display: 'standalone', background_color: '#0B0D10', theme_color: '#0B0D10',
      icons: [{ src: '/icon.png?key=' + KEY, sizes: '512x512', type: 'image/png' }] }));
  }
  if (req.method === 'GET' && p0 === '/icon.png') {
    try { const buf = fs.readFileSync(path.join(DASH, 'icon.png'));
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=86400' }); return res.end(buf);
    } catch { res.writeHead(404); return res.end(); }
  }
  if (req.method === 'GET' && (p0 === '/nudge' || p0 === '/greet')) {
    const zh = req.url.indexOf('lang=zh') !== -1;
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ text: p0 === '/nudge' ? nudge(zh) : greet(zh) }));
  }
  if (req.method === 'POST' && p0 === '/stt') {
    const b = await readBody(req, res, LIMIT.stt); if (!b) return;
    return sttProxy(b, res, String(req.headers['x-lang'] || 'auto').slice(0, 8));
  }
  if (req.method === 'POST' && p0 === '/upload') {
    const body = await readBody(req, res, LIMIT.upload); if (!body) return;
    {
      try { const j = JSON.parse(body.toString('utf8'));
        const b64 = String(j.data || '').split(',').pop();
        const safe = String(j.name || 'image.png').replace(/[^\w.\- ]/g, '').slice(-60) || 'image.png';
        const ts = new Date(); const pad = n => String(n).padStart(2, '0');
        const rel = 'raw/' + ts.toISOString().slice(0, 10) + ' ' + pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds()) + ' ' + safe;
        fs.mkdirSync(path.join(VAULT, 'raw'), { recursive: true });
        fs.writeFileSync(path.join(VAULT, rel), Buffer.from(b64, 'base64'));
        const isVideo = /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(safe);
        if (isVideo) {
          const framesRel = rel.replace(/\.[^.]+$/, '') + ' frames';
          const ing = spawn(PY, [path.join(DASH, 'video_ingest.py'), path.join(VAULT, rel), path.join(VAULT, framesRel)], { cwd: VAULT });
          let out = '';
          ing.stdout.on('data', d => out += d);
          const t = setTimeout(() => { try { ing.kill(); } catch {} }, 300000);
          ing.on('close', () => { clearTimeout(t);
            let meta = {}; try { meta = JSON.parse(out.trim().split('\n').pop()); } catch {}
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ file: rel, video: true, frames: meta.frames ? framesRel : null, transcript: !!meta.transcript })); });
          ing.on('error', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ file: rel, video: true, frames: null, transcript: false })); });
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ file: rel }));
      } catch (e) { res.writeHead(400); res.end('bad upload'); }
    }
    return;
  }
  if (req.method === 'GET' && p0 === '/') {
    const hdr = { 'content-type': 'text/html', 'cache-control': 'no-store, must-revalidate', 'pragma': 'no-cache',
      'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
      // only this origin and the Obsidian plugin may frame the HUD (no clickjacking from other sites)
      'content-security-policy': "frame-ancestors 'self' app://obsidian.md" };
    // Opened with ?key=… (phone link): remember it in a strict cookie so the key can leave the address bar.
    if (/[?&]key=/.test(req.url)) hdr['set-cookie'] = 'jarvis_key=' + KEY + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000';
    res.writeHead(200, hdr);
    return res.end(page());
  }
  if (req.method === 'GET' && p0 === '/stats') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(stats()));
  }
  if (req.method === 'GET' && p0 === '/search') {
    const qp = new URL(req.url, 'http://x').searchParams;
    const q = String(qp.get('q') || '');
    let hits = []; try { hits = vaultSearch(q, Math.min(20, parseInt(qp.get('k'), 10) || 8)); } catch {}
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ q, chunks: chunkCount(), hits: hits.map(h => ({
      file: h.file, head: h.head, score: +h.score.toFixed(2), snippet: h.text.replace(/\s+/g, ' ').slice(0, 320) })) }));
  }
  if (req.method === 'GET' && p0 === '/note') {
    const qp = new URL(req.url, 'http://x').searchParams;
    const wiki = qp.get('wiki');
    const rel = wiki ? resolveWiki(wiki) : qp.get('f');
    const n = rel ? readNote(rel) : null;
    res.writeHead(n ? 200 : 404, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(n || { error: 'not-found', asked: wiki || qp.get('f') || '' }));
  }
  if (req.method === 'GET' && p0 === '/notes') {
    let list = [];
    try { list = mdFiles().map(f => ({ f: path.relative(VAULT, f), t: fs.statSync(f).mtimeMs })).sort((a, b) => a.f.localeCompare(b.f)); } catch {}
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ notes: list }));
  }
  if (req.method === 'GET' && p0 === '/graph') {
    let g = { nodes: [], links: [] }; try { g = linkGraph(); } catch {}
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(g));
  }
  if (req.method === 'GET' && p0 === '/folders') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ vault: VAULT, grants: readGrants() }));
  }
  if (req.method === 'POST' && p0 === '/folders') {
    const b = await readBody(req, res, LIMIT.folders); if (!b) return;
    {
      const j = json(b);
      let list = readGrants().map(g => ({ path: g.path, write: g.write, label: g.label }));
      if (j.remove) {
        const rm = path.resolve(String(j.remove));
        list = list.filter(g => g.path !== rm);
      } else if (j.toggleWrite) {
        const t = path.resolve(String(j.toggleWrite));
        list = list.map(g => g.path === t ? { ...g, write: !g.write } : g);
      } else if (j.add) {
        const p = path.resolve(String(j.add).trim().replace(/^~/, os.homedir()));
        let ok = false; try { ok = fs.statSync(p).isDirectory(); } catch {}
        if (!ok) { res.writeHead(400, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ error: 'not-a-folder', path: p })); }
        if (p === path.parse(p).root || p === os.homedir()) { res.writeHead(400, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ error: 'too-broad', path: p })); }   // never the whole disk or whole home folder
        if (!list.some(g => g.path === p)) list.push({ path: p, write: !!j.write, label: j.label || path.basename(p) });
      }
      writeGrants(list);
      killWorker();          // --add-dir is fixed at spawn — restart so the change is live now
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ vault: VAULT, grants: readGrants() }));
    }
    return;
  }
  if (p0 === '/settings') {           // owner name / pronoun / curriculum (used by the Obsidian plugin too)
    if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(readSettings())); }
    if (req.method === 'POST') {
      const b = await readBody(req, res, LIMIT.settings); if (!b) return;
      { const j = json(b);
        const patch = {};
        for (const k of ['ownerName', 'pronoun', 'curriculum']) if (typeof j[k] === 'string') patch[k] = j[k];
        const s = writeSettings(patch); killWorker(); // persona is baked in at session start
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(s)); }
      return;
    }
  }
  if (req.method === 'POST' && p0 === '/shutdown') {   // used by start.js --restart and the Obsidian plugin; key + localhost
    const ip = req.socket.remoteAddress || '';
    if (!/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(ip)) { res.writeHead(403); return res.end('local only'); }
    res.writeHead(200); res.end('bye'); setTimeout(() => process.exit(0), 100); return;
  }
  if (req.method === 'POST' && p0 === '/stop') { interruptWorker(); res.writeHead(200); return res.end('ok'); }
  if (req.method === 'POST' && p0 === '/tts') {
    const b = await readBody(req, res, LIMIT.tts); if (!b) return;
    const j = json(b);
    return tts(String(j.t || ''), res, String(j.lang || '').slice(0, 4), String(j.mode || '').slice(0, 4));
  }
  if (req.method === 'POST' && (p0 === '/run' || p0 === '/ask')) {
    const b = await readBody(req, res, LIMIT.ask); if (!b) return;
    {
      const j = json(b);
      if (p0 === '/ask') {
        if (!j.q) { res.writeHead(400); return res.end('empty'); }
        return runAsk(String(j.q), res, String(j.ctx || '').slice(0, 500), String(j.lang || '').slice(0, 8));
      }
      const skill = SKILLS.find(s => s.id === j.id);
      if (!skill) { res.writeHead(400); return res.end('unknown skill'); }
      counters.skillInvocations++;
      return runClaude(honor(skill.prompt(String(j.input || '').slice(0, 4000))), res, null, skill.label);
    }
  }
  res.writeHead(404); res.end();
}).listen(PORT, HOST, () => {
  console.log('V.A.U.L.T. online → http://localhost:' + PORT + (HOST === '127.0.0.1' ? '  (this computer only — set JARVIS_LAN=1 for same-Wi-Fi phone access)' : ''));
  const ip = lanIP();
  if (ip && HOST !== '127.0.0.1') console.log('📱 Phone (same Wi-Fi) → http://' + ip + ':' + PORT + '/?key=' + KEY);
});
