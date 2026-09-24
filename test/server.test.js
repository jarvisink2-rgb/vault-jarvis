'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawn } = require('child_process');
const { start } = require('./mock-llm');
const { llmEnv, boot } = require('./helpers');

test('dashboard: page, stats, search, notes, ask, skill run, settings, owner name', async () => {
  const llm = await start(body => ({ content: 'Right away.' }));
  // JARVIS_PYTHON points nowhere: a computer without Python must still run Jarvis (regression: Windows crash in 1.0.1)
  const s = await boot(llmEnv(llm.url, { JARVIS_OWNER_NAME: 'Maya', JARVIS_OWNER_PRONOUN: 'she', JARVIS_CURRICULUM: 'A-Level', JARVIS_PYTHON: 'python-that-does-not-exist' }));
  try {
    const page = await (await fetch(s.base + '/')).text();
    assert.match(page, /V\.A\.U\.L\.T\./); assert.match(page, /OWNER = \{"name":"Maya","sir":"ma'am"\}/);
    const st = await (await s.f('/stats')).json(); assert.ok(st.notes >= 2); assert.deepStrictEqual(st.todos, ['revise biology']);
    const hits = await (await s.f('/search?q=photosynthesis chloroplasts')).json(); assert.strictEqual(hits.hits[0].file.replace(/\\/g, '/'), 'School/Biology.md');
    assert.ok((await (await s.f('/notes')).json()).notes.length >= 2);
    assert.match(await (await s.f('/ask', { method: 'POST', body: JSON.stringify({ q: 'what do my notes say about photosynthesis?' }) })).text(), /Right away/);
    const sys = llm.log[0].body.messages[0].content, user = llm.log[0].body.messages.find(m => m.role === 'user').content;
    assert.match(user, /Address her as "Maya"/); assert.match(user, /A-Level/); assert.match(user, /VAULT RETRIEVAL/); assert.match(sys, /quiz-me/);
    assert.match(await (await s.f('/run', { method: 'POST', body: JSON.stringify({ id: 'morning-report' }) })).text(), /Right away/);
    const set = await (await s.f('/settings', { method: 'POST', body: JSON.stringify({ ownerName: 'Sam', pronoun: 'they' }) })).json();
    assert.strictEqual(set.ownerName, 'Maya'); // env overrides the file
    for (let i = 0; i < 8; i++) { // greetings are random: none may use the default name or honorific
      const g = (await (await s.f('/greet')).json()).text;
      assert.doesNotMatch(g, /\bBoss\b|\bsir\b/i, g);
    }
  } finally { s.stop(); llm.close(); }
});

