'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawn } = require('child_process');
const { start } = require('./mock-llm');
const { tempVault, llmEnv } = require('./helpers');

async function boot(env) {
  const v = tempVault();
  const port = 4000 + Math.floor(Math.random() * 2000);
  const c = spawn(process.execPath, [path.join(v, '.claude', 'dashboard', 'server.js')], { env: { ...env, PORT: String(port), JARVIS_KEY: 'k' }, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base + '/stats')).ok) break; } catch {} await new Promise(r => setTimeout(r, 150)); }
  return { v, base, stop: () => c.kill() };
}

test('dashboard: page, stats, search, notes, ask, skill run, settings, owner name', async () => {
  const llm = await start(body => ({ content: 'Right away.' }));
  // JARVIS_PYTHON points nowhere: a computer without Python must still run Jarvis (regression: Windows crash in 1.0.1)
  const s = await boot(llmEnv(llm.url, { JARVIS_OWNER_NAME: 'Maya', JARVIS_OWNER_PRONOUN: 'she', JARVIS_CURRICULUM: 'A-Level', JARVIS_PYTHON: 'python-that-does-not-exist' }));
  try {
    const page = await (await fetch(s.base + '/')).text();
    assert.match(page, /V\.A\.U\.L\.T\./); assert.match(page, /Speak or type, Maya/); assert.doesNotMatch(page, /\bBoss\b/);
    const st = await (await fetch(s.base + '/stats')).json(); assert.ok(st.notes >= 2); assert.deepStrictEqual(st.todos, ['revise biology']);
    const hits = await (await fetch(s.base + '/search?q=photosynthesis chloroplasts')).json(); assert.strictEqual(hits.hits[0].file.replace(/\\/g, '/'), 'School/Biology.md');
    assert.ok((await (await fetch(s.base + '/notes')).json()).notes.length >= 2);
    assert.match(await (await fetch(s.base + '/ask', { method: 'POST', body: JSON.stringify({ q: 'what do my notes say about photosynthesis?' }) })).text(), /Right away/);
    const sys = llm.log[0].body.messages[0].content, user = llm.log[0].body.messages.find(m => m.role === 'user').content;
    assert.match(user, /Address her as "Maya"/); assert.match(user, /A-Level/); assert.match(user, /VAULT RETRIEVAL/); assert.match(sys, /quiz-me/);
    assert.match(await (await fetch(s.base + '/run', { method: 'POST', body: JSON.stringify({ id: 'morning-report' }) })).text(), /Right away/);
    const set = await (await fetch(s.base + '/settings', { method: 'POST', body: JSON.stringify({ ownerName: 'Sam', pronoun: 'they' }) })).json();
    assert.strictEqual(set.ownerName, 'Maya'); // env overrides the file
    for (let i = 0; i < 8; i++) { // greetings are random: none may use the default name or honorific
      const g = (await (await fetch(s.base + '/greet')).json()).text;
      assert.doesNotMatch(g, /\bBoss\b|\bsir\b/i, g);
    }
  } finally { s.stop(); llm.close(); }
});

test('dashboard: remote requests need the key', async () => {
  const { authed } = require('../.claude/dashboard/lib/net.js');
  const mk = (ip, url, key) => ({ socket: { remoteAddress: ip }, url, headers: key ? { 'x-key': key } : {} });
  assert.ok(authed(mk('127.0.0.1', '/')));
  assert.ok(!authed(mk('192.168.1.5', '/')));
});
