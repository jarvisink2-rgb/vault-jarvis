// Persistent memory: pinned profile, memory.md, learned persona notes, conversation log + background distillation.
'use strict';
const fs = require('fs');
const path = require('path');
const { DASH, VAULT, honor, readSettings } = require('./config');
const { spawnAgent, ASK_ARGS } = require('./backend');

// ---------- Persistent memory: inject memory.md into each new session ----------
const MEM_PATH = path.join(VAULT, '.claude', 'memory', 'memory.md');
// Pinned owner profile — injected verbatim, first, on every session. Never truncated,
// never distilled, never rewritten by the nightly consolidation. This is the "forever" memory.
const PROFILE_PATH = path.join(VAULT, '.claude', 'memory', 'profile.md');
function profileSnippet() {
  try { return fs.readFileSync(PROFILE_PATH, 'utf8').trim(); } catch { return ''; }
}
function memorySnippet() {
  try { let m = fs.readFileSync(MEM_PATH, 'utf8').trim();
    if (m.length > 2600) m = m.slice(0, 1200) + '\n…(consolidate soon — file over budget)…\n' + m.slice(-1300);
    return m; } catch { return ''; }
}
function personaLearned() {
  try { return fs.readFileSync(path.join(DASH, 'persona-learned.txt'), 'utf8').trim().slice(0, 1200); } catch { return ''; }
}

// ---------- Persistent memory: transcript log + background distillation ----------
const CONVO_LOG = path.join(DASH, 'convo-log.json');
let convoLog = []; try { convoLog = JSON.parse(fs.readFileSync(CONVO_LOG, 'utf8')); } catch {}
let distilling = false;
function saveConvoLog() { try { fs.writeFileSync(CONVO_LOG, JSON.stringify(convoLog.slice(-30))); } catch {} }
function logExchange(q, a) {
  if (!q) return;
  convoLog.push({ t: Date.now(), q: String(q).slice(0, 500), a: String(a || '').slice(0, 1200) });
  saveConvoLog();
  if (convoLog.length >= 12) distillMemory('periodic');
}
function distillMemory(reason) {
  if (distilling || convoLog.length < 2) return;
  distilling = true;
  const batch = convoLog; convoLog = []; saveConvoLog();
  const lines = batch.map(e => readSettings().ownerName + ': ' + e.q + '\nJarvis: ' + e.a).join('\n---\n').slice(0, 7000);
  const prompt = honor('Memory distillation (' + reason + '). Below is a recent dashboard conversation between the owner (Boss) and Jarvis. ' +
    'Read .claude/memory/memory.md first, then append ONLY durable NEW facts as dated YYYY-MM-DD bullets in the right sections ' +
    '(## Owner, ## Preferences, ## Study for study weak spots, ## Company, ## Running jokes, ## Decisions — create a section if missing). ' +
    'No duplicates of existing bullets, no small talk, no transient tasks, no restating what is already there. ' +
    'NEVER touch .claude/memory/profile.md — that file is pinned and hand-maintained. Do not copy facts out of it into memory.md either. ' +
    'If nothing durable was learned, change nothing. Keep the file under 200 lines. Reply with one line saying what changed.\n\nTRANSCRIPT:\n') + lines;
  let child;
  try { child = spawnAgent(['-p', prompt, '--permission-mode', 'acceptEdits', ...ASK_ARGS], { cwd: VAULT, env: process.env, stdio: 'ignore' }); }
  catch { distilling = false; convoLog = batch.concat(convoLog); saveConvoLog(); return; }
  const t = setTimeout(() => { try { child.kill(); } catch {} }, 180000);
  child.on('close', code => { clearTimeout(t); distilling = false;
    if (code !== 0) { convoLog = batch.concat(convoLog).slice(-30); saveConvoLog(); } });
  child.on('error', () => { clearTimeout(t); distilling = false; convoLog = batch.concat(convoLog).slice(-30); saveConvoLog(); });
}
// Recover facts from a previous run (crash/shutdown) once the server settles
setTimeout(() => {
  if (convoLog.length >= 2 && Date.now() - (convoLog[convoLog.length - 1].t || 0) > 20 * 60 * 1000) distillMemory('recovered');
}, 15000);


module.exports = { MEM_PATH, PROFILE_PATH, profileSnippet, memorySnippet, personaLearned, logExchange, distillMemory, convoCount: () => convoLog.length };
