#!/usr/bin/env node
// Live smoke test against YOUR configured model (reads .env). Takes ~20 s and a handful of requests.
//   node .claude/agent/selftest.js          (or: npm run selftest)
// Checks: plain reply · tool calling (find a note + edit it) · the dashboard's stream-json protocol · Google (if connected).
// Writes selftest-report.txt next to where you run it so you can share the result.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { loadEnv } = require('./env');
const { resolveConfig } = require('./providers');

const repo = path.resolve(__dirname, '..', '..');
loadEnv([path.join(process.cwd(), '.env'), path.join(repo, '.env')]);
const cfg = resolveConfig(process.env);
const AGENT = path.join(__dirname, 'vault-agent.js');
const lines = [];
const log = s => { console.log(s); lines.push(s); };

function run(args, cwd, input) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const c = spawn(process.execPath, [AGENT, ...args], { cwd, env: process.env });
    let out = '', err = '';
    c.stdout.on('data', d => out += d); c.stderr.on('data', d => err += d);
    if (input != null) c.stdin.end(input);
    const kill = setTimeout(() => c.kill(), 120000);
    c.on('close', code => { clearTimeout(kill); resolve({ code, out, err, ms: Date.now() - t0 }); });
  });
}
function hint(text) {
  if (/\b429\b|RESOURCE_EXHAUSTED|rate/i.test(text)) return 'Rate-limited — wait a minute (free tiers allow only a few requests per minute) or pick JARVIS_FAST_MODEL.';
  if (/\b40[13]\b|API key|PERMISSION_DENIED|unauthor/i.test(text)) return 'The API key was rejected — check it in .env.';
  if (/\b404\b|not found|model/i.test(text)) return 'Model not found — check JARVIS_MODEL (model ids change; see your provider\'s model list).';
  if (/tool|function/i.test(text)) return 'This model may not support tool calling — choose one that does.';
  return '';
}

(async () => {
  log('V.A.U.L.T. self-test — ' + new Date().toISOString());
  log('Provider: ' + cfg.provider + ' · model: ' + cfg.model + ' · ' + cfg.baseUrl);
  if (cfg.problems.length) { log('✗ Not configured: ' + cfg.problems.join(' ')); return finish(1); }

  const v = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-selftest-'));
  fs.cpSync(path.join(repo, '.claude', 'skills'), path.join(v, '.claude', 'skills'), { recursive: true });
  fs.writeFileSync(path.join(v, 'CLAUDE.md'), '# Test vault\nNotes live in School/.\n');
  fs.mkdirSync(path.join(v, 'School'));
  fs.writeFileSync(path.join(v, 'School', 'Chemistry notes.md'), '---\ntitle: Chemistry notes\n---\n## Moles\nOne mole contains 6.022 × 10^23 particles (Avogadro constant).\n');
  let fails = 0;
  const step = async (name, fn) => {
    try { const d = await fn(); log('✓ ' + name + (d ? ' — ' + d : '')); }
    catch (e) { fails++; log('✗ ' + name + ' — ' + e.message.slice(0, 400)); const h = hint(e.message); if (h) log('  → ' + h); }
  };

  await step('1. Plain reply', async () => {
    const r = await run(['-p', 'Reply with exactly the word READY and nothing else.'], v);
    if (r.code !== 0 || !/READY/i.test(r.out)) throw new Error('exit ' + r.code + ': ' + (r.out + r.err).trim());
    return (r.ms / 1000).toFixed(1) + ' s';
  });
  await step('2. Tool calling (search the vault, then edit a note)', async () => {
    const r = await run(['-p', 'Find the note in this vault that mentions Avogadro, then append this exact line to the end of that note: "- Checked by self-test." Use your tools. Then reply DONE.'], v);
    const txt = fs.readFileSync(path.join(v, 'School', 'Chemistry notes.md'), 'utf8');
    if (!txt.includes('Checked by self-test')) throw new Error('note was not edited. Output: ' + (r.out + r.err).trim().slice(0, 300));
    return (r.ms / 1000).toFixed(1) + ' s';
  });
  await step('3. Dashboard protocol (stream-json, two turns, memory)', async () => {
    const m = t => JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: t }] } }) + '\n';
    const r = await run(['-p', '--input-format', 'stream-json', '--output-format', 'stream-json'], v, m('My favourite number is 42. Just say OK.') + m('What is my favourite number? Answer with the number only.'));
    const ev = r.out.trim().split('\n').map(l => { try { return JSON.parse(l); } catch { return {}; } });
    const res = ev.filter(e => e.type === 'result');
    if (res.length !== 2 || res.some(e => e.is_error)) throw new Error((res.find(e => e.is_error) || {}).result || 'expected 2 results, got ' + res.length + ': ' + r.out.slice(0, 300));
    if (!/42/.test(res[1].result)) throw new Error('second turn forgot the first: "' + res[1].result + '"');
    if (!ev.some(e => e.type === 'stream_event')) throw new Error('no streaming deltas');
    return 'streamed, remembered context';
  });
  const google = require('./google');
  if (google.isConnected(repo)) {
    await step('4. Google Calendar', async () => (await google.execute(repo, 'calendar_list_events', { days_ahead: 1 })).split('\n').length - 1 + ' event line(s)');
  } else log('– 4. Google: not connected (optional)');
  fs.rmSync(v, { recursive: true, force: true });
  log(fails ? '\n' + fails + ' check(s) failed.' : '\nAll checks passed — Jarvis works with ' + cfg.provider + ' / ' + cfg.model + '.');
  finish(fails ? 1 : 0);
})();

function finish(code) {
  try { fs.writeFileSync(path.join(process.cwd(), 'selftest-report.txt'), lines.join('\n').replace(/(key|token)=\S+/gi, '$1=***') + '\n'); } catch {}
  process.exit(code);
}
