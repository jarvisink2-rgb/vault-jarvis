#!/usr/bin/env node
// Cross-platform launcher (macOS, Windows, Linux).
//   node .claude/start.js            start Jarvis if it isn't running, then open the HUD
//   node .claude/start.js --restart  stop the running server first (picks up new code/settings)
//   node .claude/start.js --no-open  don't open a browser
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
require('./agent/env.js').loadEnv([path.join(root, '.env')]);
const PORT = process.env.PORT || 3333;
const URL = 'http://localhost:' + PORT;          // what the browser opens
const API = 'http://127.0.0.1:' + PORT;          // what we probe: localhost may resolve to IPv6 ::1
const args = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function up() { try { const r = await fetch(API + '/stats', { signal: AbortSignal.timeout(1000) }); return r.ok; } catch { return false; } }

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : ['xdg-open', [url]];
  const fallback = () => console.log('Open ' + url + ' in Chrome.');
  try { const c = spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }); c.on('error', fallback); c.unref(); } catch { fallback(); }
}

(async () => {
  if (Number(process.versions.node.split('.')[0]) < 18) { console.error('Node.js 18+ is required.'); process.exit(1); }
  if (args.includes('--restart') && await up()) {
    console.log('Taking Jarvis offline…');
    try { await fetch(API + '/shutdown', { method: 'POST' }); } catch {}
    for (let i = 0; i < 20 && await up(); i++) await sleep(250);
  }
  if (await up()) console.log('Jarvis is already online.');
  else {
    console.log('Bringing Jarvis online…');
    const log = path.join(os.tmpdir(), 'jarvis-server.log');
    const out = fs.openSync(log, 'a');
    spawn(process.execPath, [path.join(__dirname, 'dashboard', 'server.js')], {
      cwd: path.join(__dirname, 'dashboard'), detached: true, stdio: ['ignore', out, out], windowsHide: true,
    }).unref();
    let ok = false;
    for (let i = 0; i < 30 && !(ok = await up()); i++) await sleep(300);
    if (!ok) { console.error('Jarvis did not start — see ' + log); process.exit(1); }
    console.log('Online → ' + URL + '   (log: ' + log + ')');
  }
  // Remote (anywhere) phone access if Tailscale is installed and signed in
  const ts = process.platform === 'darwin' && fs.existsSync('/Applications/Tailscale.app/Contents/MacOS/Tailscale')
    ? '/Applications/Tailscale.app/Contents/MacOS/Tailscale' : 'tailscale';
  try { const c = spawn(ts, ['serve', '--bg', String(PORT)], { stdio: 'ignore' }); c.on('error', () => {}); } catch {}
  if (!args.includes('--no-open')) openBrowser(URL);
})();
