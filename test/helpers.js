'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');

// A throwaway vault with the repo's .claude/ runtime and a couple of notes.
function tempVault() {
  const v = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-test-'));
  fs.cpSync(path.join(ROOT, '.claude'), path.join(v, '.claude'), { recursive: true, filter: s => !/agent-sessions|jarvis\.json|google-token/.test(s) });
  fs.writeFileSync(path.join(v, 'CLAUDE.md'), '# Test vault\n');
  fs.mkdirSync(path.join(v, 'School'));
  fs.writeFileSync(path.join(v, 'School', 'Biology.md'), '---\ntitle: Biology\ntags: [bio]\n---\n## Photosynthesis\nPhotosynthesis converts light energy into chemical energy in chloroplasts.\n');
  fs.writeFileSync(path.join(v, 'TO DO.md'), '# TO DO\n## Today\n- [ ] revise biology\n');
  return v;
}
function llmEnv(url, extra) {
  const e = { ...process.env, JARVIS_PROVIDER: 'custom', JARVIS_BASE_URL: url, JARVIS_API_KEY: 'test', JARVIS_MODEL: 'mock-1', ...extra };
  for (const k of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_CLIENT_ID', 'JARVIS_AGENT']) delete e[k];
  return e;
}
function run(args, opts) {
  return new Promise(resolve => {
    const c = spawn(process.execPath, args, opts);
    let out = '', err = '';
    c.stdout.on('data', d => out += d); c.stderr.on('data', d => err += d);
    if (opts.input != null) c.stdin.end(opts.input);
    c.on('close', code => resolve({ code, out, err }));
  });
}
module.exports = { ROOT, tempVault, llmEnv, run };
