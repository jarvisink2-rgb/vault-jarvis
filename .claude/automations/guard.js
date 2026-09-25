#!/usr/bin/env node
// Integrity guard for unattended runs (used by self-improve.sh; works with any backend, including Claude Code).
//   node guard.js snapshot   record hashes + a copy of Jarvis's code
//   node guard.js verify     restore anything changed/added/removed since the snapshot, and report it
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const vi = process.argv.indexOf('--vault');
const vault = vi > 0 ? path.resolve(process.argv[vi + 1]) : path.resolve(__dirname, '..', '..');
const SNAP = path.join(os.tmpdir(), 'jarvis-guard-' + crypto.createHash('sha1').update(vault).digest('hex').slice(0, 10));
const GUARDED = ['.claude/agent', '.claude/dashboard', '.claude/automations', '.claude/start.js', '.claude/jarvis.json', '.env',
  'CLAUDE.md', 'AGENTS.md', 'JARVIS.md', '.claude/skills', '.claude/agents', '.claude/commands',        // his instructions
  'Jarvis.command', 'Jarvis Restart.command', 'Jarvis.bat', 'Jarvis Restart.bat', 'jarvis.sh'];
// folders.json is NOT exempt: an unattended run (e.g. Claude Code backend, no sandbox) must not grant itself new folders.
const ALLOWED = /^\.claude\/dashboard\/(persona-learned\.txt|nudges\.json|convo-log\.json)$|__pycache__|\.pyc$/;

function files() {
  const out = [];
  const walk = rel => {
    const abs = path.join(vault, rel);
    let st; try { st = fs.lstatSync(abs); } catch { return; }
    if (st.isDirectory()) { for (const e of fs.readdirSync(abs)) walk(rel + '/' + e); }
    else if (!ALLOWED.test(rel)) out.push(rel);
  };
  GUARDED.forEach(walk);
  return out;
}
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(vault, f))).digest('hex');

const cmd = process.argv[2];
if (cmd === 'snapshot') {
  fs.rmSync(SNAP, { recursive: true, force: true });
  const manifest = {};
  for (const f of files()) { manifest[f] = hash(f); const d = path.join(SNAP, 'files', f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(vault, f), d); }
  fs.writeFileSync(path.join(SNAP, 'manifest.json'), JSON.stringify(manifest));
  console.log('guard: snapshot of ' + Object.keys(manifest).length + ' files');
} else if (cmd === 'verify') {
  let manifest; try { manifest = JSON.parse(fs.readFileSync(path.join(SNAP, 'manifest.json'), 'utf8')); } catch { console.log('guard: no snapshot'); process.exit(1); }
  const now = new Set(files()), changed = [];
  for (const f of now) if (!(f in manifest)) { fs.rmSync(path.join(vault, f), { force: true }); changed.push('removed new file ' + f); }
  for (const [f, h] of Object.entries(manifest)) {
    let cur = null; try { cur = hash(f); } catch {}
    if (cur !== h) { fs.mkdirSync(path.dirname(path.join(vault, f)), { recursive: true }); fs.copyFileSync(path.join(SNAP, 'files', f), path.join(vault, f)); changed.push('restored ' + f); }
  }
  console.log(changed.length ? 'guard: ' + changed.length + ' unauthorised change(s) reverted:\n  ' + changed.join('\n  ') : 'guard: code unchanged ✓');
  process.exit(changed.length ? 2 : 0);
} else { console.log('usage: guard.js snapshot|verify'); process.exit(1); }
