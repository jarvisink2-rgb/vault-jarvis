'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { start } = require('./mock-llm');
const { ROOT, tempVault, llmEnv, run } = require('./helpers');
const AGENT = path.join(ROOT, '.claude', 'agent', 'vault-agent.js');

test('one-shot run: tool loop edits a note, echoes Gemini thought signatures, accepts Claude CLI flags', async () => {
  const llm = await start((body, n) => {
    const tools = body.messages.filter(m => m.role === 'tool').length;
    if (tools === 0) return { content: 'Looking. ', tool_calls: [{ name: 'grep', args: { pattern: 'photosynthesis' }, extra: { extra_content: { google: { thought_signature: 'SIG' } } } }] };
    if (tools === 1) return { tool_calls: [{ name: 'edit_file', args: { path: 'School/Biology.md', old_string: '', new_string: '- Light reactions happen in the thylakoids.' } }] };
    return { content: 'Added a line to Biology.' };
  });
  const v = tempVault();
  const r = await run([AGENT, '-p', 'add a fact', '--permission-mode', 'acceptEdits', '--allowedTools', 'WebSearch', 'mcp__x', '--model', 'sonnet'], { cwd: v, env: llmEnv(llm.url) });
  llm.close();
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /Added a line to Biology/);
  assert.match(fs.readFileSync(path.join(v, 'School', 'Biology.md'), 'utf8'), /thylakoids/);
  const second = llm.log[1].body;
  const asst = second.messages.find(m => m.role === 'assistant');
  assert.deepStrictEqual(asst.tool_calls[0].extra_content, { google: { thought_signature: 'SIG' } });
  assert.ok(second.messages.find(m => m.role === 'tool').content.includes('Biology.md'));
  assert.strictEqual(llm.log[0].headers.authorization, 'Bearer test');
});

test('stream-json worker: init, text deltas, result, and resume keeps history', async () => {
  const llm = await start(body => ({ content: 'turn ' + body.messages.filter(m => m.role === 'user').length }));
  const v = tempVault();
  const msg = t => JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: t }] } }) + '\n';
  const args = [AGENT, '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
  const r1 = await run(args, { cwd: v, env: llmEnv(llm.url), input: msg('hi') + msg('again') });
  const ev = r1.out.trim().split('\n').map(JSON.parse);
  assert.strictEqual(ev[0].type, 'system'); assert.strictEqual(ev[0].subtype, 'init');
  const sid = ev[0].session_id;
  const results = ev.filter(e => e.type === 'result').map(e => e.result);
  assert.deepStrictEqual(results, ['turn 1', 'turn 2']);
  assert.ok(ev.some(e => e.type === 'stream_event' && e.event.delta.type === 'text_delta'));
  const r2 = await run(args.concat('--resume', sid), { cwd: v, env: llmEnv(llm.url), input: msg('third') });
  llm.close();
  assert.ok(r2.out.includes('"result":"turn 3"'), r2.out);
});

test('sandbox: no escaping the vault, read-only grants, no writes into .git', async () => {
  const { Sandbox, execute } = require(path.join(ROOT, '.claude', 'agent', 'tools.js'));
  const v = tempVault();
  const ro = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ro-'));
  fs.writeFileSync(path.join(ro, 'a.md'), 'secret coursework');
  const sb = new Sandbox(v, [ro], false);
  await assert.rejects(execute(sb, 'read_file', { path: path.join(require('os').homedir(), 'x.txt') }), /outside the vault/);
  await assert.rejects(execute(sb, 'read_file', { path: '../x' }), /outside the vault/);
  assert.match((await execute(sb, 'read_file', { path: path.join(ro, 'a.md') })).text, /secret coursework/);
  await assert.rejects(execute(sb, 'write_file', { path: path.join(ro, 'b.md'), content: 'x' }), /READ ONLY/);
  await assert.rejects(execute(sb, 'write_file', { path: '.git/config', content: 'x' }), /\.git/);
  if (process.platform !== 'win32') { // symlinks need admin rights on Windows
    fs.symlinkSync('/etc', path.join(v, 'escape'));
    await assert.rejects(execute(sb, 'read_file', { path: 'escape/hosts' }), /outside the vault/);
  }
  assert.match((await execute(sb, 'move_file', { from: 'TO DO.md', to: 'School/TO DO.md' })).text, /Moved/);
  assert.match((await execute(sb, 'move_file', { from: 'School/TO DO.md', to: 'School/Biology.md' })).text, /already exists/);
  assert.match((await execute(sb, 'list_files', { pattern: '**/*.md' })).text, /School[\\/]Biology\.md/);
});

test('unconfigured provider gives a clear message', async () => {
  const v = tempVault();
  const env = { ...process.env, JARVIS_PROVIDER: 'gemini' };
  for (const k of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'JARVIS_API_KEY']) delete env[k];
  const r = await run([AGENT, '-p', 'hi'], { cwd: v, env });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /GEMINI_API_KEY/);
});
