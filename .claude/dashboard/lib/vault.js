// Vault file system: note listing, exams, change feed ("nervous system"), link graph, note reads, stats.
'use strict';
const fs = require('fs');
const path = require('path');
const { VAULT } = require('./config');

function mdFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) out.push(p);
    }
  })(VAULT);
  return out;
}

function exams() {
  try {
    const s = fs.readFileSync(path.join(VAULT, 'Exams.md'), 'utf8');
    const out = []; const re = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*([^|]+?)\s*\|/gm;
    const today = new Date(); today.setHours(0, 0, 0, 0); let m;
    while ((m = re.exec(s))) {
      const days = Math.round((new Date(m[1] + 'T00:00:00') - today) / 86400000);
      if (days >= 0) out.push({ name: m[2], date: m[1], days });
    }
    return out.sort((a, b) => a.days - b.days).slice(0, 5);
  } catch { return []; }
}
function examLine(e) { return e.name + (e.days === 0 ? ' is today' : e.days === 1 ? ' is tomorrow' : ' in ' + e.days + ' days'); }

// ---------- Vault nervous system: Jarvis feels every note change ----------
let recentChanges = []; // {f, t, gone}
let vaultStamp = Date.now(); // bumped on every note change; invalidates the BM25 index below
function noteChange(f, gone) {
  const now = Date.now();
  vaultStamp = now; // retrieval index is stale from this moment — rebuilt lazily on next search
  const last = recentChanges[recentChanges.length - 1];
  if (last && last.f === f && !gone && now - last.t < 5000) { last.t = now; return; }
  recentChanges.push({ f, t: now, gone: !!gone });
  if (recentChanges.length > 60) recentChanges = recentChanges.slice(-60);
}
let mtimeMap = new Map(), scanReady = false;
function scanVault() {
  try {
    const seen = new Set();
    for (const f of mdFiles()) {
      const rel = path.relative(VAULT, f); seen.add(rel);
      let mt; try { mt = fs.statSync(f).mtimeMs; } catch { continue; }
      const prev = mtimeMap.get(rel);
      if (scanReady && (prev === undefined || mt > prev + 500)) noteChange(rel);
      mtimeMap.set(rel, mt);
    }
    for (const rel of [...mtimeMap.keys()]) if (!seen.has(rel)) { mtimeMap.delete(rel); if (scanReady) noteChange(rel, true); }
    scanReady = true;
  } catch {}
}
scanVault(); setInterval(scanVault, 20000).unref();
function changesSince(t) { return recentChanges.filter(c => c.t > t); }
function fmtAgo(t) { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; }
function vaultIndex() {
  try { return mdFiles().map(f => path.relative(VAULT, f)).sort().join('\n'); } catch { return ''; }
}


function linkGraph() {
  const files = mdFiles().map(f => path.relative(VAULT, f));
  const byName = new Map();
  for (const rel of files) byName.set(path.basename(rel, '.md').toLowerCase(), rel);
  const nodes = files.map(rel => ({ id: rel, n: path.basename(rel, '.md'), g: rel.includes(path.sep) ? rel.split(path.sep)[0] : '/', d: 0 }));
  const pos = new Map(nodes.map((n, i) => [n.id, i]));
  const links = [], seen = new Set();
  for (const rel of files) {
    let s; try { s = fs.readFileSync(path.join(VAULT, rel), 'utf8'); } catch { continue; }
    for (const m of s.match(/\[\[([^\]]+)\]\]/g) || []) {
      const target = m.slice(2, -2).split('|')[0].split('#')[0].trim().toLowerCase();
      const dest = byName.get(target); if (!dest || dest === rel) continue;
      const key = rel + '\0' + dest; if (seen.has(key)) continue; seen.add(key);
      links.push({ s: pos.get(rel), t: pos.get(dest) });
      nodes[pos.get(rel)].d++; nodes[pos.get(dest)].d++;
    }
  }
  return { nodes, links };
}
// Safe read of any vault note — never escapes VAULT, markdown only
function readNote(rel) {
  const abs = path.resolve(VAULT, String(rel || '').replace(/^\/+/, ''));
  if (!abs.startsWith(VAULT + path.sep) || !abs.endsWith('.md')) return null;
  try { return { file: path.relative(VAULT, abs), text: fs.readFileSync(abs, 'utf8').slice(0, 200000) }; } catch { return null; }
}
function resolveWiki(name) {
  const want = String(name || '').split('|')[0].split('#')[0].trim().toLowerCase();
  if (!want) return null;
  for (const f of mdFiles()) { const rel = path.relative(VAULT, f);
    if (path.basename(rel, '.md').toLowerCase() === want) return rel; }
  for (const f of mdFiles()) { const rel = path.relative(VAULT, f);
    if (path.basename(rel, '.md').toLowerCase().includes(want)) return rel; }
  return null;
}


function getVaultStamp() { return vaultStamp; }
module.exports = { mdFiles, exams, examLine, changesSince, fmtAgo, vaultIndex, linkGraph, readNote, resolveWiki, getVaultStamp };
