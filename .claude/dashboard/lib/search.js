// Retrieval: BM25 index over the vault (cited recall, no embeddings, no deps).
'use strict';
const fs = require('fs');
const path = require('path');
const { VAULT, readSettings } = require('./config');
const { mdFiles, getVaultStamp } = require('./vault');

// ---------- Retrieval: BM25 index over the vault (cited recall, no embeddings, no deps) ----------
const STOP = new Set(('the a an and or of to in is are was were for on at by with as it its this that from be been being not no if ' +
  'then than so such i you he she they we my your our their there here what which who how why when do does did done have has had ' +
  'will would can could should shall may might must about into over under again more most other some any each few own same too very ' +
  'me him her them us also just about please tell show give ' +
  // dashboard conversational filler — spoken every turn, carries no retrieval signal
  'yes yeah yep no nope ok okay sure right thanks thank hello hi hey boss sir jarvis stop wait cool nice great good sorry ' +
  'now then well like get got make made go going come came know think see look need want').split(' '));
// the owner's own name is spoken every turn too — no retrieval signal
for (const w of readSettings().ownerName.toLowerCase().split(/\s+/)) if (w) STOP.add(w);
function tokens(s) {
  const out = [];
  const latin = String(s).toLowerCase().match(/[a-z0-9][a-z0-9'’\-]*/g) || [];
  for (const w of latin) if (w.length > 1 && !STOP.has(w)) out.push(w);
  for (const run of String(s).match(/[一-鿿]+/g) || []) {   // CJK: unigram + bigram, no segmenter needed
    if (run.length === 1) { out.push(run); continue; }
    for (let i = 0; i + 1 < run.length; i++) out.push(run.slice(i, i + 2));
  }
  return out;
}
// Split a note into heading-scoped chunks so a hit can cite "Note.md › ## Section"
function chunkNote(text, cap = 1100) {
  const chunks = []; let head = '', buf = '';
  const flush = () => { const t = buf.trim(); if (t.length > 40) chunks.push({ head, text: t }); buf = ''; };
  for (const line of text.split('\n')) {
    if (/^#{1,6}\s+/.test(line)) { flush(); head = line.replace(/^#+\s*/, '').trim().slice(0, 80); continue; }
    if (buf.length + line.length > cap) flush();
    buf += line + '\n';
  }
  flush();
  return chunks;
}
let IDX = { chunks: [], df: new Map(), avgdl: 1, built: 0 };
function buildIndex() {
  const chunks = [], df = new Map(); let total = 0;
  for (const f of mdFiles()) {
    const rel = path.relative(VAULT, f);
    if (rel.startsWith('node_modules')) continue;
    let s; try { s = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const nameTok = tokens(path.basename(rel, '.md'));
    for (const c of chunkNote(s)) {
      const tf = new Map();
      // filename x3 and heading x2 — those are the words he actually says out loud ("the A3 note")
      for (const w of nameTok.concat(nameTok, nameTok, tokens(c.head), tokens(c.head))) tf.set(w, (tf.get(w) || 0) + 1);
      const body = tokens(c.text);
      for (const w of body) tf.set(w, (tf.get(w) || 0) + 1);
      const len = body.length + nameTok.length || 1;
      for (const w of tf.keys()) df.set(w, (df.get(w) || 0) + 1);
      chunks.push({ file: rel, head: c.head, text: c.text, tf, len });
      total += len;
    }
  }
  IDX = { chunks, df, avgdl: total / (chunks.length || 1) || 1, built: Date.now() };
  return IDX;
}
function freshIndex() { if (IDX.built < getVaultStamp() || !IDX.chunks.length) buildIndex(); return IDX; }
function vaultSearch(q, k = 6) {
  const ix = freshIndex();
  const qt = tokens(q); if (!qt.length || !ix.chunks.length) return [];
  const N = ix.chunks.length, k1 = 1.4, b = 0.75;
  const uniq = [...new Set(qt)];
  const idfOf = w => { const n = ix.df.get(w) || 0; return n ? Math.log(1 + (N - n + 0.5) / (n + 0.5)) : 0; };
  const scored = [];
  for (const c of ix.chunks) {
    let score = 0; const terms = [];
    for (const w of uniq) {
      const f = c.tf.get(w); if (!f) continue;
      terms.push(w);
      score += idfOf(w) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * c.len / ix.avgdl));
    }
    if (score <= 0) continue;
    // Source prior: his own subject notes beat machine-generated reports that merely mention
    // the topic. raw/ is the inbox, output/ is generated deliverables — both are derivative.
    score *= c.file.startsWith('raw' + path.sep) ? 0.6 : c.file.startsWith('output' + path.sep) ? 0.7 : 1;
    // rarest matched term: how specific this hit actually is, independent of chunk length
    scored.push({ file: c.file, head: c.head, text: c.text, score, terms,
      spec: Math.max(0, ...terms.map(idfOf)) });
  }
  scored.sort((a, b2) => b2.score - a.score);
  const out = [], perFile = new Map();          // at most 2 chunks per note — spread the recall
  for (const h of scored) {
    const n = perFile.get(h.file) || 0; if (n >= 2) continue;
    perFile.set(h.file, n + 1); out.push(h);
    if (out.length >= k) break;
  }
  return out;
}
// Passages injected into each /ask turn so he answers from real note text, not guesswork
function retrievalBlock(q, budget = 2600) {
  if (!q || q.trim().length < 4) return '';
  let hits; try { hits = vaultSearch(q, 5); } catch { return ''; }
  if (!hits.length) return '';
  const top = hits[0];
  // Relevance gate — an idle "yes, Boss" must not drag two notes into the prompt.
  // Fire only on a genuinely specific match: decent score, and either several matched
  // terms or one rare one ("normalisation", "光合作用").
  if (top.score < 6) return '';
  if (top.terms.length < 2 && top.spec < 3.4) return '';
  const strong = hits.filter(h => h.score >= top.score * 0.35);
  let out = '', used = 0;
  for (const h of strong) {
    const body = h.text.replace(/\n{2,}/g, '\n').slice(0, 900);
    const piece = '--- ' + h.file + (h.head ? ' › ' + h.head : '') + '\n' + body + '\n';
    if (used + piece.length > budget) break;
    out += piece; used += piece.length;
  }
  if (!out) return '';
  return '[VAULT RETRIEVAL — passages auto-pulled from his notes for THIS request, ranked by relevance. ' +
    'Treat as already-read: answer from them and cite the file by name. They may be incomplete — if the answer is not here, ' +
    'search the vault yourself before saying it does not exist.\n' + out + ']\n';
}
// Wikilink graph: nodes = notes, edges = [[links]] resolved by basename

function chunkCount() { return IDX.chunks.length; }
module.exports = { tokens, vaultSearch, retrievalBlock, chunkCount };
