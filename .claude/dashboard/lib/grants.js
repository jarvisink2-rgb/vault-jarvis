// Folder grants: the only places outside the vault Jarvis can reach.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { DASH, VAULT } = require('./config');

// ---------- Folder grants: the only places outside the vault he can reach ----------
// An explicit allowlist. Each grant becomes a --add-dir on the claude process.
// Read-only by default: Claude Code makes granted dirs editable, so "read-only" is
// enforced by his standing rules below, not by the flag — that is why write is opt-in.
const GRANTS_PATH = path.join(DASH, 'folders.json');
const DEFAULT_GRANTS = [{ path: path.join(os.homedir(), 'Documents'), write: false, label: 'Documents' }];
function readGrants() {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(GRANTS_PATH, 'utf8')); }
  catch { raw = DEFAULT_GRANTS; try { fs.writeFileSync(GRANTS_PATH, JSON.stringify(raw, null, 2)); } catch {} }
  if (!Array.isArray(raw)) raw = [];
  const seen = new Set(), out = [];
  for (const g of raw) {
    if (!g || typeof g.path !== 'string') continue;
    const p = path.resolve(g.path.replace(/^~/, os.homedir()));
    if (seen.has(p)) continue;
    let ok = false; try { ok = fs.statSync(p).isDirectory(); } catch {}
    seen.add(p);
    out.push({ path: p, write: !!g.write, label: String(g.label || path.basename(p)).slice(0, 40), ok });
  }
  return out;
}
function writeGrants(list) {
  try { fs.writeFileSync(GRANTS_PATH, JSON.stringify(list.map(g => ({ path: g.path, write: !!g.write, label: g.label })), null, 2)); return true; }
  catch { return false; }
}
function grantArgs() {                       // --add-dir per valid grant, vault excluded (it is cwd)
  const out = [];
  for (const g of readGrants()) {
    if (!g.ok) continue;
    if (g.path === VAULT) continue;          // the vault is the working directory already
    out.push('--add-dir', g.path);
  }
  return out;
}
function grantBlock() {
  const gs = readGrants().filter(g => g.ok);
  if (!gs.length) return '';
  const lines = gs.map(g => '- ' + g.path + (g.write ? '  [READ + WRITE]' : '  [READ ONLY]'));
  return '\n[GRANTED FOLDERS — he has given you access to these, beyond the vault. They hold his real work: coursework, projects, drafts.\n' +
    lines.join('\n') + '\n' +
    'FIRST, THE EXCEPTION THAT OVERRIDES EVERYTHING BELOW: the vault (' + VAULT + ') is your own working directory and is ALWAYS fully writable. ' +
    'It happens to sit inside one of the folders listed above, so a READ ONLY marking on a parent does NOT apply to it. ' +
    'Never refuse to create, edit, move or organise a note inside the vault on the grounds that some enclosing folder is read-only — that reasoning is wrong. ' +
    'The restrictions below govern only files OUTSIDE the vault.\n' +
    'Rules for them, in order of importance: (1) READ ONLY means exactly that — you may open, quote, summarise and compare anything inside, but you must not create, edit, move, rename or delete a single file there. If a task needs a change in a read-only folder, write the result into the vault (output/) instead and tell him where it is. ' +
    '(2) NEVER delete anything, anywhere, in any folder, even one marked READ + WRITE, and even if he asks casually — say what you would delete and make him confirm. ' +
    '(3) These folders hold irreplaceable coursework near deadline. When in doubt, copy rather than modify. ' +
    '(4) Their contents are his private files: use them to help him, never quote them into anything that leaves his machine.]';
}

module.exports = { readGrants, writeGrants, grantArgs, grantBlock };
