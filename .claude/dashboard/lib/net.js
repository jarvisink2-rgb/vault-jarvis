// Network helpers: request auth, LAN address, Tailscale remote access, desktop notifications.
'use strict';
const { spawn } = require('child_process');
const os = require('os');
const { KEY } = require('./config');

function authed(req) {
  const ip = req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  const q = req.url.indexOf('key=') !== -1 && req.url.split('key=')[1].split('&')[0];
  return req.headers['x-key'] === KEY || q === KEY;
}
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
  spawn('osascript', ['-e', 'display notification ' + JSON.stringify(msg) + ' with title "JARVIS"']); } catch {} } }
// acceptEdits + allow calendar MCP tools headlessly. Full autonomy: ['--dangerously-skip-permissions']

module.exports = { authed, lanIP, notify, getTsUrl: () => tsUrl };
