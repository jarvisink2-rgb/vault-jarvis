#!/usr/bin/env node
// vault-agent — a drop-in, model-agnostic replacement for the `claude` CLI calls
// V.A.U.L.T. makes. It speaks the same flags and the same stream-json protocol
// the dashboard already parses, but runs the agent loop itself against ANY
// OpenAI-compatible model: Gemini (free tier), Groq, OpenRouter, Ollama (local),
// OpenAI, or Anthropic.
//
//   vault-agent -p "Run the morning-report skill now."            # one-shot, plain text out
//   vault-agent -p --input-format stream-json --output-format stream-json [--resume <id>]
//
// Accepted-and-ignored Claude CLI flags: --permission-mode, --allowedTools,
// --verbose, --include-partial-messages, --dangerously-skip-permissions.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const { resolveConfig } = require('./providers');
const { chat } = require('./llm');
const { SCHEMAS, Sandbox, execute } = require('./tools');
const { loadEnv } = require('./env');
const google = require('./google');

const MAX_STEPS = Number(process.env.JARVIS_MAX_STEPS || 40);
const HISTORY_KEEP = 60; // messages kept when resuming a long session

// ── CLI parsing ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const o = { print: false, prompt: null, inFmt: 'text', outFmt: 'text', resume: null, model: null, addDirs: [], full: false };
  const VARIADIC = new Set(['--allowedTools', '--allowed-tools', '--disallowedTools', '--disallowed-tools']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '-p' || a === '--print') { o.print = true; if (argv[i + 1] && !argv[i + 1].startsWith('--')) o.prompt = next(); }
    else if (a === '--input-format') o.inFmt = next();
    else if (a === '--output-format') o.outFmt = next();
    else if (a === '--resume' || a === '-r') o.resume = next();
    else if (a === '--model') o.model = next();
    else if (a === '--add-dir') o.addDirs.push(next());
    else if (a === '--dangerously-skip-permissions') o.full = true;
    else if (a === '--permission-mode' || a === '--append-system-prompt' || a === '--mcp-config') next();
    else if (VARIADIC.has(a)) { while (argv[i + 1] && !argv[i + 1].startsWith('--')) i++; }
    else if (a === '--version' || a === '-v') { console.log('vault-agent 1.0.0'); process.exit(0); }
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 14).join('\n').replace(/^\/\/ ?/gm, '')); process.exit(0); }
    else if (!a.startsWith('-') && o.prompt == null) o.prompt = a;
  }
  return o;
}

// ── System prompt: what Claude Code would have loaded on its own ─────────────
function frontmatter(txt) {
  const m = txt.match(/^---\n([\s\S]*?)\n---/);
  const out = {};
  if (m) for (const line of m[1].split('\n')) { const k = line.match(/^(\w[\w-]*):\s*(.*)$/); if (k) out[k[1]] = k[2].trim(); }
  return out;
}

function listDefs(dir, file) {
  const out = [];
  let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = file ? path.join(dir, e.name, file) : path.join(dir, e.name);
    if (file ? !e.isDirectory() : !e.name.endsWith('.md')) continue;
    try { const fm = frontmatter(fs.readFileSync(p, 'utf8')); out.push({ name: fm.name || e.name.replace(/\.md$/, ''), description: fm.description || '', path: p }); } catch {}
  }
  return out;
}

function systemPrompt(cwd, sandbox) {
  const now = new Date();
  const parts = [];
  parts.push(
    'You are an autonomous agent operating inside an Obsidian vault (a folder of Markdown notes). ' +
    'You act by calling tools; keep going until the task is fully done, then give a short final answer. ' +
    'Never claim you changed a file unless a tool result confirmed it — re-read after editing when it matters.\n\n' +
    'Environment:\n' +
    '- Vault root (working directory): ' + cwd + '\n' +
    (sandbox.roots.length > 1 ? '- Extra granted folders: ' + sandbox.roots.slice(1).join(', ') + '\n' : '') +
    '- Local time: ' + now.toString() + '\n' +
    '- Today: ' + now.toISOString().slice(0, 10) + '\n\n' +
    'Tool-name mapping — instructions in this vault were written for Claude Code, so translate: ' +
    'Read→read_file, Write→write_file, Edit→edit_file, Glob→list_files, Grep→grep, WebSearch→web_search, WebFetch→web_fetch, Task/Agent→delegate_task, TodoWrite→(just keep a plan in your head). ' +
    (google.isConnected(cwd)
      ? 'Gmail and Google Calendar ARE available: MCP names map as search_threads→gmail_search, get_thread→gmail_read_thread, create_draft→gmail_create_draft, list events→calendar_list_events, create event→calendar_create_event. You can never send email — drafts only. '
      : 'Gmail / Google Calendar are not connected: if a task needs them, say so in one line (setup: README → Gmail & Calendar) and do the rest. ') +
    'Other MCP tools (Notion, Drive, Canva…) are not available with this backend. ' +
    'You have no delete tool on purpose — never try to delete; tell the owner what should be removed.'
  );
  let owner = {};
  try { owner = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'jarvis.json'), 'utf8')); } catch {}
  const name = process.env.JARVIS_OWNER_NAME || owner.ownerName || 'Boss';
  const pron = (process.env.JARVIS_OWNER_PRONOUN || owner.pronoun || 'they').toLowerCase();
  const curr = process.env.JARVIS_CURRICULUM || owner.curriculum || 'IB';
  parts.push('# Owner\nAddress the owner as "' + name + '"; pronouns: ' + ({ he: 'he/him', she: 'she/her', they: 'they/them' }[pron] || 'they/them') + '. ' +
    'Skill files in this vault were written calling the owner "Boss" and "he" — apply the name and pronouns above instead. ' +
    (/^ib$/i.test(curr) ? 'Curriculum: IB.' : 'Curriculum: ' + curr + ' — where a skill cites IB criteria, papers or command terms, use the ' + curr + ' equivalents (check the official specification with web_search if unsure).'));
  for (const f of ['CLAUDE.md', 'AGENTS.md', 'JARVIS.md']) {
    try { const t = fs.readFileSync(path.join(cwd, f), 'utf8').trim(); if (t) parts.push('# Project instructions (' + f + ')\n\n' + t); } catch {}
  }
  const skills = listDefs(path.join(cwd, '.claude', 'skills'), 'SKILL.md');
  if (skills.length) parts.push('# Skills\nWhen a request matches a skill, read its SKILL.md with read_file FIRST and follow it exactly.\n' +
    skills.map(s => '- ' + s.name + ' (' + path.relative(cwd, s.path) + '): ' + s.description).join('\n'));
  const agents = listDefs(path.join(cwd, '.claude', 'agents'));
  if (agents.length) parts.push('# Sub-agents (use with delegate_task, agent=<name>)\n' +
    agents.map(a => '- ' + a.name + ': ' + a.description).join('\n'));
  return parts.join('\n\n');
}

// ── Sessions (so --resume keeps the conversation) ───────────────────────────
function sessionDir(cwd) { const d = path.join(cwd, '.claude', 'agent-sessions'); fs.mkdirSync(d, { recursive: true }); return d; }
function loadSession(cwd, id) {
  if (!id || !/^[\w-]+$/.test(id)) return null;
  try { return JSON.parse(fs.readFileSync(path.join(sessionDir(cwd), id + '.json'), 'utf8')); } catch { return null; }
}
function saveSession(cwd, id, messages) {
  try {
    let m = messages;
    if (m.length > HISTORY_KEEP) { // cut on a plain user turn so tool calls stay paired
      let cut = m.length - HISTORY_KEEP;
      while (cut < m.length && !(m[cut].role === 'user' && typeof m[cut].content === 'string')) cut++;
      m = m.slice(cut);
    }
    // don't persist image payloads
    m = m.map(x => Array.isArray(x.content) ? { ...x, content: x.content.map(c => c.type === 'image_url' ? { type: 'text', text: '[image omitted]' } : c) } : x);
    fs.writeFileSync(path.join(sessionDir(cwd), id + '.json'), JSON.stringify(m));
    // housekeeping: keep the 30 newest sessions
    const dir = sessionDir(cwd);
    const files = fs.readdirSync(dir).map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const x of files.slice(30)) try { fs.unlinkSync(path.join(dir, x.f)); } catch {}
  } catch {}
}

// ── The agent loop ──────────────────────────────────────────────────────────
async function runAgent({ cfg, sandbox, system, messages, onText, depth = 0 }) {
  const all = google.isConnected(sandbox.cwd) ? SCHEMAS.concat(google.SCHEMAS) : SCHEMAS;
  const tools = depth > 0 ? all.filter(t => t.function.name !== 'delegate_task') : all;
  let finalText = '', spoke = false;
  const ctx = {
    delegate: async (task, agentName) => {
      let sys = system;
      if (agentName) {
        const f = path.join(sandbox.cwd, '.claude', 'agents', agentName.replace(/[^\w-]/g, '') + '.md');
        try { sys += '\n\n# Your role for this sub-task\n' + fs.readFileSync(f, 'utf8'); } catch {}
      }
      sys += '\n\nYou are a sub-agent. Complete the task, then reply with a concise, complete result for the main agent.';
      const sub = [{ role: 'user', content: task }];
      const r = await runAgent({ cfg, sandbox, system: sys, messages: sub, onText: null, depth: depth + 1 });
      return r.text || '(sub-agent returned nothing)';
    },
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    let turnText = '';
    const res = await chat(cfg, {
      messages: [{ role: 'system', content: system }, ...messages],
      tools,
      onText: t => {
        if (!turnText && spoke && onText) onText('\n'); // separate text blocks across tool steps
        turnText += t; if (onText) onText(t);
      },
    });
    if (turnText) spoke = true;
    const assistant = { role: 'assistant', content: res.content || null };
    if (res.tool_calls.length) assistant.tool_calls = res.tool_calls;
    messages.push(assistant);
    if (res.content) finalText = res.content;
    if (!res.tool_calls.length) break;

    const images = [];
    for (const tc of res.tool_calls) {
      let args = {};
      try { args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}; } catch { args = null; }
      let out;
      if (args === null) out = { text: 'Invalid JSON arguments — retry the call with valid JSON.' };
      else {
        try { out = google.names.includes(tc.function.name) ? { text: await google.execute(sandbox.cwd, tc.function.name, args) } : await execute(sandbox, tc.function.name, args, ctx); }
        catch (e) { out = { text: 'Error: ' + e.message }; }
      }
      if (process.env.JARVIS_DEBUG) process.stderr.write('[tool] ' + tc.function.name + ' ' + JSON.stringify(args).slice(0, 200) + '\n');
      messages.push({ role: 'tool', tool_call_id: tc.id, content: out.text });
      if (out.image) images.push(out.image);
    }
    if (images.length) {
      messages.push({ role: 'user', content: [{ type: 'text', text: 'Images returned by read_file:' },
        ...images.map(im => ({ type: 'image_url', image_url: { url: 'data:' + im.mime + ';base64,' + im.base64 } }))] });
    }
    if (step === MAX_STEPS - 1) {
      const note = '\n[Stopped after ' + MAX_STEPS + ' steps — ask me to continue.]';
      if (onText) onText(note); finalText += note;
    }
  }
  return { text: finalText };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const cwd = process.cwd();
  loadEnv([path.join(cwd, '.env'), path.join(__dirname, '..', '..', '.env')]);
  const opts = parseArgs(process.argv.slice(2));
  const cfg = resolveConfig(process.env, opts.model);
  const sandbox = new Sandbox(cwd, opts.addDirs, opts.full || !!process.env.JARVIS_FULL);
  const system = systemPrompt(cwd, sandbox);

  const streamJson = opts.outFmt === 'stream-json';
  const emit = obj => process.stdout.write(JSON.stringify(obj) + '\n');

  if (cfg.problems.length) {
    const msg = 'Jarvis is not configured yet: ' + cfg.problems.join(' ') + ' (see README → Setup).';
    if (streamJson) emit({ type: 'result', subtype: 'error', is_error: true, result: msg });
    else process.stdout.write(msg + '\n');
    process.exit(1);
  }

  const sid = (opts.resume && loadSession(cwd, opts.resume)) ? opts.resume : crypto.randomUUID();
  const messages = (opts.resume && loadSession(cwd, opts.resume)) || [];

  async function turn(userText, content) {
    messages.push({ role: 'user', content: content || userText });
    const onText = streamJson
      ? t => emit({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } } })
      : t => process.stdout.write(t);
    let result;
    try { result = await runAgent({ cfg, sandbox, system, messages, onText }); }
    catch (e) {
      const msg = 'Error: ' + e.message;
      if (streamJson) emit({ type: 'result', subtype: 'error', is_error: true, result: msg, session_id: sid });
      else process.stdout.write('\n' + msg + '\n');
      saveSession(cwd, sid, messages);
      return false;
    }
    saveSession(cwd, sid, messages);
    if (streamJson) emit({ type: 'result', subtype: 'success', is_error: false, result: result.text, session_id: sid });
    else process.stdout.write('\n');
    return true;
  }

  if (streamJson) emit({ type: 'system', subtype: 'init', session_id: sid, model: cfg.model, provider: cfg.provider, cwd });

  if (opts.inFmt === 'stream-json') {
    // Long-lived worker: one JSON user message per line on stdin.
    const rl = readline.createInterface({ input: process.stdin });
    let queue = Promise.resolve();
    rl.on('line', line => {
      line = line.trim(); if (!line) return;
      let j; try { j = JSON.parse(line); } catch { return; }
      if (j.type !== 'user' || !j.message) return;
      const c = j.message.content;
      const text = typeof c === 'string' ? c : (c || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
      queue = queue.then(() => turn(text));
    });
    rl.on('close', () => queue.then(() => process.exit(0)));
    return;
  }

  let prompt = opts.prompt;
  if (prompt == null) prompt = fs.readFileSync(0, 'utf8');
  const ok = await turn(prompt);
  process.exit(ok ? 0 : 1);
}

if (require.main === module) main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
module.exports = { runAgent, systemPrompt, parseArgs };
