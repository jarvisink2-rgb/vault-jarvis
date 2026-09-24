'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');
const { start } = require('./mock-llm');
const { ROOT } = require('./helpers');

test('Obsidian plugin: installs runtime into an empty vault, runs the server, protects user edits', async () => {
  execFileSync(process.execPath, [path.join(ROOT, 'obsidian-plugin', 'build.js')]);
  const origLoad = Module._load;
  Module._load = function (req, ...a) { return req === 'obsidian' ? origLoad(path.join(__dirname, 'stubs', 'obsidian'), ...a) : origLoad(req, ...a); };
  const ob = require('obsidian');
  const Plugin = require(path.join(ROOT, 'dist', 'main.js'));
  const llm = await start(() => ({ content: 'Hello from the model.' }));
  const v = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-plugin-'));
  let ready;
  const app = { vault: { adapter: new ob.FileSystemAdapter(v) }, workspace: { onLayoutReady: f => { ready = f; }, getLeavesOfType: () => [] } };
  const p = new Plugin(app);
  const port = 6000 + Math.floor(Math.random() * 2000);
  p._d = { provider: 'custom', baseUrl: llm.url, apiKey: 'test', model: 'mock-1', port, ownerName: 'Maya', pronoun: 'she' };
  try {
    await p.onload(); await ready();
    assert.ok(await p.ensureServer(), p.lastError);
    for (const f of ['CLAUDE.md', 'TO DO.md', '.claude/dashboard/server.js', '.claude/agent/vault-agent.js', '.claude/skills/quiz-me/SKILL.md', '.claude/memory/profile.md'])
      assert.ok(fs.existsSync(path.join(v, f)), f);
    assert.ok(await p.alive());
    assert.match(await (await fetch('http://127.0.0.1:' + port + '/ask', { method: 'POST', body: JSON.stringify({ q: 'hi' }) })).text(), /Hello from the model/);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(v, '.claude', 'jarvis.json'), 'utf8')).ownerName, 'Maya');
    fs.appendFileSync(path.join(v, '.claude', 'skills', 'quiz-me', 'SKILL.md'), '\nmine\n');
    fs.appendFileSync(path.join(v, '.claude', 'dashboard', 'lib', 'skills.js'), '\n// tweak\n');
    p.settings.runtimeVersion = 'old'; p.stopServer();
    await p.installRuntime(false);
    assert.ok(fs.readFileSync(path.join(v, '.claude', 'skills', 'quiz-me', 'SKILL.md'), 'utf8').endsWith('mine\n'));
    assert.ok(fs.readdirSync(path.join(v, '.claude', 'dashboard', 'lib')).some(f => f.startsWith('skills.js.bak-')));
  } finally {
    p.stopServer(); try { await fetch('http://127.0.0.1:' + port + '/shutdown', { method: 'POST' }); } catch {}
    llm.close(); Module._load = origLoad;
  }
});
