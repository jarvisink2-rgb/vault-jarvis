// Network helpers: request auth, LAN address, Tailscale remote access, desktop notifications.
'use strict';
const { spawn } = require('child_process');
const os = require('os');
const { KEY } = require('./config');

// ---------- Request gate ----------
// Threat model: any web page open in the owner's browser can send requests to localhost, and DNS
// rebinding can make a hostile domain resolve to 127.0.0.1. So being "local" is NOT proof of anything:
//   1. Host header must be one of ours (defeats DNS rebinding),
//   2. an Origin header, when present, must be one of ours (defeats cross-site requests),
//   3. every API call must carry the 128-bit key (x-key header, compared in constant time),
//   4. repeated bad keys from one address are rate-limited.
// The only keyless route is GET / from this machine: it returns the HUD with the key embedded, and
// other origins cannot read that response (same-origin policy; frame-ancestors restricts framing).
const crypto = require('crypto');
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function allowedHosts() {
  const h = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
  const ip = lanIP(); if (ip) h.add(ip);
  if (tsUrl) h.add(tsUrl.replace(/^https?:\/\//, '').toLowerCase());
  for (const x of String(process.env.JARVIS_ALLOWED_HOSTS || '').split(',')) if (x.trim()) h.add(x.trim().toLowerCase());
  return h;
}
function hostOf(v) {
  const s = String(v || '').toLowerCase().trim();
  if (s.startsWith('[')) return s.slice(0, s.indexOf(']') + 1);      // [::1]:3333
  return s.replace(/:\d+$/, '');
}
function keyOk(k) {
  if (typeof k !== 'string' || !k) return false;
  const a = Buffer.from(k), b = Buffer.from(KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function cookieKey(req) { const m = /(?:^|;\s*)jarvis_key=([0-9a-f]+)/.exec(req.headers.cookie || ''); return m ? m[1] : ''; }
function queryKey(req) { try { return new URL(req.url, 'http://x').searchParams.get('key') || ''; } catch { return ''; } }
const fails = new Map(); // ip -> { n, t }
function limited(ip) { const f = fails.get(ip); return f && f.n >= 20 && Date.now() - f.t < 10 * 60e3; }
function noteFail(ip) { const f = fails.get(ip); const now = Date.now();
  if (!f || now - f.t > 10 * 60e3) fails.set(ip, { n: 1, t: now }); else { f.n++; f.t = now; } }

// Returns null when allowed, else { status, msg }.
// kind: 'page' (GET / , manifest, icon: key may come from ?key= or the cookie) | 'api' (x-key header only)
function gate(req, kind) {
  const ip = req.socket.remoteAddress || '';
  if (!allowedHosts().has(hostOf(req.headers.host))) return { status: 421, msg: 'unknown host' };
  const origin = req.headers.origin;
  if (origin && origin !== 'null') {
    let oh = ''; try { oh = new URL(origin).host; } catch {}
    if (!allowedHosts().has(hostOf(oh))) return { status: 403, msg: 'cross-origin request refused' };
  } else if (origin === 'null') return { status: 403, msg: 'opaque origin refused' };
  const sent = kind === 'page' ? (req.headers['x-key'] || queryKey(req) || cookieKey(req)) : req.headers['x-key'];
  if (keyOk(sent)) return null;                     // the right key always works — nobody can lock the owner out
  const proxied = !!(req.headers['x-forwarded-for'] || req.headers['tailscale-user-login']);
  const local = LOOPBACK.has(ip) && !proxied;
  if (kind === 'page' && local) return null;
  // Only a WRONG key counts as a guess (a keyless <img> ping from some web page is not one), and this
  // machine is never rate-limited: every local page shares 127.0.0.1, so a hostile tab could lock you out.
  if (sent && !local) { noteFail(ip); if (limited(ip)) return { status: 429, msg: 'too many bad keys — wait 10 minutes' }; }
  return { status: 401, msg: 'unauthorized' };
}
function authed(req, kind) { return gate(req, kind || 'api') === null; }

function lanIP() { const ifs = os.networkInterfaces();
  for (const k in ifs) for (const a of ifs[k]) if (a.family === 'IPv4' && !a.internal) return a.address;
  return null; }
// ---------- Tailscale: remote (anywhere) phone access ----------
const TS_APP = '/Applications/Tailscale.app/Contents/MacOS/Tailscale';
let tsUrl = null;
function tsProbe(bin) {
  let c; try { c = spawn(bin, ['status', '--json']); } catch { tsUrl = null; return; }
  let o = '';
  c.stdout.on('data', d => o += d);
  c.on('close', code => {
    if (code !== 0) { if (bin === 'tailscale') tsProbe(TS_APP); else tsUrl = null; return; }
    try { const j = JSON.parse(o);
      const dns = j.Self && j.Self.DNSName ? j.Self.DNSName.replace(/\.+$/, '') : null;
      tsUrl = (dns && j.BackendState === 'Running') ? 'https://' + dns : null;
    } catch { tsUrl = null; }
  });
  c.on('error', () => { if (bin === 'tailscale') tsProbe(TS_APP); else tsUrl = null; });
}
tsProbe('tailscale'); setInterval(() => tsProbe('tailscale'), 120000).unref();
function notify(msg) { if (process.platform === 'darwin') { try {
  spawn('osascript', ['-e', 'display notification ' + JSON.stringify(msg) + ' with title "JARVIS"']).on('error', () => {}); } catch {} } }
// acceptEdits + allow calendar MCP tools headlessly. Full autonomy: ['--dangerously-skip-permissions']

module.exports = { gate, authed, keyOk, lanIP, notify, getTsUrl: () => tsUrl };
