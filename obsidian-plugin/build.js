#!/usr/bin/env node
// Builds the Obsidian plugin: embeds the Jarvis runtime (agent, dashboard, skills, starter files)
// into dist/main.js, so installing the plugin is all a user needs to do.
//   node obsidian-plugin/build.js
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const SKIP = /(^|\/)(node_modules|agent-sessions|__pycache__)(\/|$)|\.bak|\.pre-improve$|google-token\.json$|convo-log\.json$|persona-learned\.txt$|nudges\.json$|folders\.json$|jarvis\.json$|\.jarvis-key$|\.DS_Store$|(^|\/)memory\/(memory|profile)\.md$/;

function walk(rel, out) {
  const abs = path.join(root, rel);
  const st = fs.statSync(abs);
  if (st.isDirectory()) for (const e of fs.readdirSync(abs).sort()) walk(rel + '/' + e, out);
  else if (!SKIP.test(rel)) out.push(rel);
}
const files = [];
for (const d of ['.claude/agent', '.claude/dashboard', '.claude/skills', '.claude/agents', '.claude/commands', '.claude/automations', '.claude/memory']) walk(d, files);
files.push('.claude/start.js', 'CLAUDE.md', 'TO DO.md', 'Exams.md', 'Home.md', 'raw/README.md', 'wiki/README.md', 'output/README.md');

const runtime = {};
const h = crypto.createHash('sha1');
for (const f of files) { const b = fs.readFileSync(path.join(root, f)); runtime[f] = b.toString('base64'); h.update(f).update(b); }
const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).version + '+' + h.digest('hex').slice(0, 10);

const src = fs.readFileSync(path.join(__dirname, 'src', 'plugin.js'), 'utf8');
const out = '/* V.A.U.L.T. Jarvis ' + version + ' — built by obsidian-plugin/build.js. Source: https://github.com/jarvisink2-rgb/vault-jarvis (MIT) */\n' +
  'const RUNTIME = ' + JSON.stringify(runtime) + ';\nconst RUNTIME_VERSION = ' + JSON.stringify(version) + ';\n' + src;
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'main.js'), out);
fs.copyFileSync(path.join(root, 'manifest.json'), path.join(dist, 'manifest.json'));
fs.copyFileSync(path.join(__dirname, 'styles.css'), path.join(dist, 'styles.css'));
console.log('dist/main.js  ' + (out.length / 1024).toFixed(0) + ' KB  · ' + files.length + ' runtime files · ' + version);
