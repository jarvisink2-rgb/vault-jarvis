// Talking to the agent: a warm long-lived worker for conversation (/ask) and one-shot runs for skills (/run).
'use strict';
const { VAULT, honor } = require('./config');
const { spawnAgent, AGENT_HINT, PERMISSIONS, ASK_ARGS } = require('./backend');
const { grantArgs } = require('./grants');
const { changesSince } = require('./vault');
const { retrievalBlock } = require('./search');
const { logExchange, distillMemory } = require('./memory');
const { askPrefix } = require('./persona');
const { notify } = require('./net');

let current = null; // one claude task at a time — new request interrupts the old
let askSession = { id: null, last: 0, turns: 0 }; // persistent conversation memory
let lastCtxChange = Date.now(); // vault-change high-water mark for per-turn context

let worker = null; // persistent warm claude process — instant turns
function killWorker() { if (worker && worker.child) { try { worker.child.kill('SIGTERM'); } catch {} } worker = null; }
function spawnWorker(resumeSid) {
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json',
    '--include-partial-messages', '--verbose', ...PERMISSIONS, ...grantArgs(), ...ASK_ARGS];
  if (resumeSid) args.push('--resume', resumeSid);
  const child = spawnAgent(args, { cwd: VAULT, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  const w = { child, sid: resumeSid || null, busy: false, pendingRes: null, wrote: false, buf: '', err: '', reply: '', lastQ: '' };
  child.stdout.on('data', d => { w.buf += d; let i;
    while ((i = w.buf.indexOf('\n')) >= 0) { const line = w.buf.slice(0, i).trim(); w.buf = w.buf.slice(i + 1);
      if (!line) continue; let j; try { j = JSON.parse(line); } catch { continue; }
      if (j.type === 'system' && j.subtype === 'init' && j.session_id) { w.sid = j.session_id; askSession.id = j.session_id; }
      else if (j.type === 'stream_event' && j.event && j.event.type === 'content_block_delta' && j.event.delta && j.event.delta.type === 'text_delta') {
        w.reply += j.event.delta.text;
        if (w.pendingRes) { w.pendingRes.write(j.event.delta.text); w.wrote = true; } }
      else if (j.type === 'assistant' && !w.wrote && w.pendingRes && j.message && Array.isArray(j.message.content)) {
        for (const c of j.message.content) { if (c.type === 'text' && c.text) { w.pendingRes.write(c.text + '\n'); w.reply += c.text + '\n'; } } }
      else if (j.type === 'result') { askSession.last = Date.now(); askSession.turns++; w.busy = false;
        logExchange(w.lastQ, w.reply || j.result || ''); w.lastQ = ''; w.reply = '';
        if (w.pendingRes) { if (!w.wrote && j.result) w.pendingRes.write(j.result); try { w.pendingRes.end(); } catch {} w.pendingRes = null; } } } });
  child.stderr.on('data', d => w.err += d);
  child.on('close', () => { if (w.pendingRes) { if (!w.wrote && w.err) w.pendingRes.write(w.err.slice(-800)); try { w.pendingRes.end(); } catch {} }
    if (worker === w) worker = null; });
  child.on('error', e => { if (w.pendingRes) { try { w.pendingRes.end('Could not start the agent: ' + e.message + '. ' + AGENT_HINT); } catch {} w.pendingRes = null; }
    if (worker === w) worker = null; });
  worker = w; return w;
}
function interruptWorker() { // stop current answer, keep the memory
  if (current) { try { current.kill('SIGTERM'); } catch {} current = null; }
  if (worker && worker.busy) { const sid = worker.sid || askSession.id; killWorker(); if (sid) spawnWorker(sid); }
}
function runAsk(q, res, ctx, lang) {
  const stale = (Date.now() - askSession.last) > 20 * 60 * 1000 || askSession.turns >= 40;
  if (stale && askSession.id) { askSession = { id: null, last: Date.now(), turns: 0 }; killWorker(); distillMemory('session-end'); }
  interruptWorker();
  if (!worker) spawnWorker(askSession.id);
  const first = !askSession.id;
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'x-accel-buffering': 'no' });
  worker.pendingRes = res; worker.wrote = false; worker.busy = true; worker.lastQ = q; worker.reply = '';
  const pre = ctx ? '[Context: through the dashboard you (Jarvis) just said to him: "' + ctx + '" — he is replying to that.] ' : '';
  const delta = first ? [] : changesSince(lastCtxChange).slice(-6);
  lastCtxChange = Date.now();
  const vaultNote = delta.length ? '[Vault update since last turn (may include your own edits): ' + delta.map(c => c.f + (c.gone ? ' (deleted)' : '')).join(', ') + '.] ' : '';
  const langNote = lang === 'zh' ? '[Language setting: reply in Traditional Chinese 繁體中文.] ' : lang === 'en' ? '[Language setting: reply in English.] ' : '';
  let retrieval = ''; try { retrieval = retrievalBlock(q); } catch {} // never let the index break a turn
  const msg = { type: 'user', message: { role: 'user', content: [{ type: 'text', text: (first ? askPrefix() : '') + langNote + vaultNote + retrieval + pre + q }] } };
  try { worker.child.stdin.write(JSON.stringify(msg) + '\n'); }
  catch (e) { killWorker(); try { res.end(honor('worker restart needed — ask again, Boss.')); } catch {} }
  res.on('close', () => { if (worker && worker.pendingRes === res) worker.pendingRes = null; });
}

function runClaude(prompt, res, extra, label) {
  if (current) { try { current.kill('SIGTERM'); } catch {} current = null; } // barge-in: cancel previous
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'x-accel-buffering': 'no' });
  const child = spawnAgent(['-p', prompt, ...PERMISSIONS, ...grantArgs(), ...(extra || [])], { cwd: VAULT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  current = child;
  child.stdout.on('data', d => res.write(d));
  child.stderr.on('data', d => res.write(d));
  child.on('close', () => { if (current === child) current = null; if (label) notify(honor(label + ' complete, Boss.')); try { res.end(); } catch {} });
  child.on('error', e => { try { res.end('Could not start the agent: ' + e.message + '. ' + AGENT_HINT); } catch {} });
}


module.exports = { runAsk, runClaude, interruptWorker, killWorker };
