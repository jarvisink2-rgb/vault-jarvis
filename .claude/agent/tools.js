// The tools Jarvis can use, described in OpenAI function-calling format, plus
// their local implementations. Everything is sandboxed to the vault (cwd) and
// any --add-dir folders the owner granted in the dashboard.
// There is deliberately NO delete tool and NO shell tool.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SKIP_DIRS = new Set(['.git', 'node_modules', '.obsidian', '.trash', '.Trash', '__pycache__', '.DS_Store']);
const IMAGE_EXT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
const MAX_READ = 60000;

// ── Tool schemas ────────────────────────────────────────────────────────────
const fn = (name, description, properties, required) =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required: required || [] } } });

const SCHEMAS = [
  fn('read_file', 'Read a text file (or look at an image) in the vault or a granted folder. Paths are relative to the vault root unless absolute. Returns numbered lines.',
    { path: { type: 'string' }, offset: { type: 'integer', description: '1-based first line (optional)' }, limit: { type: 'integer', description: 'max lines (optional)' } }, ['path']),
  fn('write_file', 'Create or fully overwrite a file. Prefer edit_file for existing notes. Never overwrite the owner\'s content without being asked.',
    { path: { type: 'string' }, content: { type: 'string' } }, ['path', 'content']),
  fn('edit_file', 'Replace an exact string in a file. old_string must match exactly once unless replace_all is true. Use old_string="" with an existing file to append content at the end.',
    { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' } }, ['path', 'old_string', 'new_string']),
  fn('move_file', 'Move or rename a file or folder. Never overwrites: fails if the destination exists.',
    { from: { type: 'string' }, to: { type: 'string' } }, ['from', 'to']),
  fn('list_files', 'Find files by glob pattern, e.g. "**/*.md", "School/**/A1*", ".claude/skills/*/SKILL.md". Returns paths sorted by most recently modified.',
    { pattern: { type: 'string' }, path: { type: 'string', description: 'folder to search in (default: vault root)' } }, ['pattern']),
  fn('grep', 'Search file contents with a JavaScript regular expression (case-insensitive). Returns matching lines with file:line.',
    { pattern: { type: 'string' }, path: { type: 'string', description: 'folder or file (default: vault root)' }, glob: { type: 'string', description: 'only files matching this glob, e.g. "**/*.md"' }, max_results: { type: 'integer' } }, ['pattern']),
  fn('web_search', 'Search the web for current information. Returns titles, URLs and snippets.',
    { query: { type: 'string' }, max_results: { type: 'integer' } }, ['query']),
  fn('web_fetch', 'Fetch a web page and return its readable text.',
    { url: { type: 'string' } }, ['url']),
  fn('delegate_task', 'Hand a self-contained sub-task to a sub-agent with fresh context. Optionally name one of the agents in .claude/agents/ (e.g. "researcher", "note-linker", "vault-librarian"). Returns the sub-agent\'s final answer.',
    { task: { type: 'string' }, agent: { type: 'string' } }, ['task']),
];

// ── Sandbox ─────────────────────────────────────────────────────────────────
// The agent reads untrusted text (web pages, email), so a prompt injection must not be able to:
//  • change Jarvis itself (its code, launchers, cron scripts, config) — that would be code execution,
//  • read secrets (.env, OAuth token, access key) — they could be exfiltrated through web_fetch,
//  • write through a symlink into a folder granted READ ONLY.
// All checks use the real (symlink-resolved) path.
const posix = p => p.split(path.sep).join('/');
// Case-insensitive on purpose: macOS and Windows disks usually are, so ".CLAUDE/Agent" IS ".claude/agent" there.
const WRITE_PROTECTED = [
  /^\.env($|\.)/i,                                  // secrets
  /^\.claude\/agent(\/|$)/i, /^\.claude\/automations(\/|$)/i, /^\.claude\/start\.js$/i,
  /^\.claude\/dashboard\/(?!(persona-learned\.txt|nudges\.json)$)/i,   // code; the two tuning files stay writable
  /^\.claude\/(jarvis\.json|\.jarvis-key)$/i, /^\.claude\/agent-sessions(\/|$)/i,
  /^\.github(\/|$)/i, /^(package\.json|obsidian-plugin\/|test\/)/i,
];
// Jarvis's own instructions: a prompt injection that could edit these would persist across sessions.
// Read-only unless the owner opts in (jarvis.json "allowInstructionEdits": true or JARVIS_ALLOW_INSTRUCTION_EDITS=1).
const INSTRUCTIONS = [/^(CLAUDE|AGENTS|JARVIS)\.md$/i, /^\.claude\/(skills|agents|commands)(\/|$)/i];
const ANYWHERE_PROTECTED = [/(^|\/)\.git(\/|$)/i, /(^|\/)\.obsidian(\/|$)/i,
  /\.(command|sh|bash|zsh|bat|cmd|ps1|psm1|vbs|exe|app|scpt|applescript|plist|desktop|service)$/i];   // nothing runnable, anywhere
const READ_PROTECTED = [/^\.env($|\.)/i, /(^|\/)google-token\.json$/i, /(^|\/)\.jarvis-key$/i, /^\.claude\/agent-sessions(\/|$)/i];
function instructionEditsAllowed(cwd) {
  if (process.env.JARVIS_ALLOW_INSTRUCTION_EDITS === '1') return true;
  try { return JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'jarvis.json'), 'utf8')).allowInstructionEdits === true; } catch { return false; }
}

function realish(p) {               // realpath of p, or of its deepest existing ancestor + the rest
  let cur = p; const rest = [];
  for (;;) {
    // .native returns the on-disk capitalisation, so case-insensitive disks can't dodge the checks
    try { return path.join(fs.realpathSync.native(cur), ...rest.reverse()); }
    catch { const parent = path.dirname(cur); if (parent === cur) return p; rest.push(path.basename(cur)); cur = parent; }
  }
}
const within = (p, root) => p === root || p.startsWith(root.endsWith(path.sep) ? root : root + path.sep);

class Sandbox {
  constructor(cwd, addDirs, full) {
    this.cwd = path.resolve(cwd);
    this.realCwd = realish(this.cwd);
    this.full = !!full;
    this.roots = [this.cwd, ...addDirs.map(d => path.resolve(d.replace(/^~/, os.homedir())))];
    this.realRoots = this.roots.map(realish);
    // Write access outside the vault only where the dashboard grant says so.
    const writable = [];
    try {
      const grants = JSON.parse(fs.readFileSync(path.join(this.cwd, '.claude', 'dashboard', 'folders.json'), 'utf8'));
      for (const g of grants) if (g && g.write) writable.push(path.resolve(String(g.path).replace(/^~/, os.homedir())));
    } catch {}
    if (this.full) writable.push(...this.roots);
    this.realWritable = [this.realCwd, ...writable.map(realish)];
  }
  // vault-relative posix path of a real path (null if outside the vault)
  vrel(real) { return within(real, this.realCwd) ? posix(path.relative(this.realCwd, real)) : null; }
  resolve(p) {
    if (!p || typeof p !== 'string') throw new Error('path is required');
    const abs = path.resolve(this.cwd, p.replace(/^~(?=$|[\\/])/, os.homedir()));
    const real = realish(abs);
    if (!this.realRoots.some(r => within(real, r))) throw new Error('Access denied: ' + p + ' is outside the vault and the granted folders.');
    const rel = this.vrel(real);
    if (rel !== null && READ_PROTECTED.some(re => re.test(rel))) throw new Error('Access denied: ' + p + ' holds secrets Jarvis must not read.');
    return abs;
  }
  resolveWritable(p) {
    const abs = this.resolve(p);
    const real = realish(abs);
    if (!this.realWritable.some(r => within(real, r)))
      throw new Error('Read-only: ' + p + ' is in a folder granted READ ONLY. Write the result into the vault (output/) instead.');
    const rel = this.vrel(real), lex = posix(path.relative(this.cwd, abs));
    for (const r of [rel, lex]) {
      if (r === null || r.startsWith('..')) continue;
      if (WRITE_PROTECTED.some(re => re.test(r))) throw new Error('Protected: Jarvis cannot modify its own code, launchers, schedules or secrets (' + r + '). Describe the change for the owner instead.');
      if (INSTRUCTIONS.some(re => re.test(r)) && !instructionEditsAllowed(this.cwd))
        throw new Error('Protected: CLAUDE.md, skills, agents and commands are read-only for Jarvis (' + r + '). Put the proposed change in a note for the owner (they can allow edits with "allowInstructionEdits" in .claude/jarvis.json).');
    }
    if (ANYWHERE_PROTECTED.some(re => re.test(posix(real)) || re.test(posix(abs)))) throw new Error('Protected: no writing inside .git/.obsidian or creating runnable files (' + p + ').');
    return abs;
  }
  readable(abs) { const rel = this.vrel(realish(abs)); return rel === null || !READ_PROTECTED.some(re => re.test(rel)); }
  rel(abs) { const r = path.relative(this.cwd, abs); return r.startsWith('..') ? abs : r; }
}

// ── Glob ────────────────────────────────────────────────────────────────────
function globToRegex(g) {
  let re = '', i = 0;
  while (i < g.length) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') { i += 2; if (g[i] === '/') { i++; re += '(?:.*/)?'; } else re += '.*'; continue; }
      re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') { const j = g.indexOf('}', i); if (j > i) { re += '(?:' + g.slice(i + 1, j).split(',').map(s => s.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')).join('|') + ')'; i = j + 1; continue; } re += '\\{'; }
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
    i++;
  }
  return new RegExp('^' + re + '$', 'i');
}

function walk(dir, includeDot, out, limit) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (out.length >= limit) return;
    if (SKIP_DIRS.has(e.name)) continue;
    if (e.name.startsWith('.') && !includeDot) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, includeDot, out, limit);
    else if (e.isFile()) out.push(p);
  }
}

// ── Web ─────────────────────────────────────────────────────────────────────
function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
}

async function webSearch(query, n) {
  n = Math.min(Math.max(n || 6, 1), 10);
  const env = process.env;
  if (env.TAVILY_API_KEY) {
    const r = await fetch('https://api.tavily.com/search', { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.TAVILY_API_KEY },
      body: JSON.stringify({ query, max_results: n }) });
    const j = await r.json();
    return (j.results || []).map((x, i) => (i + 1) + '. ' + x.title + '\n   ' + x.url + '\n   ' + (x.content || '').slice(0, 300)).join('\n') || 'No results.';
  }
  if (env.BRAVE_API_KEY) {
    const r = await fetch('https://api.search.brave.com/res/v1/web/search?count=' + n + '&q=' + encodeURIComponent(query),
      { headers: { accept: 'application/json', 'X-Subscription-Token': env.BRAVE_API_KEY } });
    const j = await r.json();
    return ((j.web && j.web.results) || []).map((x, i) => (i + 1) + '. ' + x.title + '\n   ' + x.url + '\n   ' + htmlToText(x.description || '')).join('\n') || 'No results.';
  }
  // Keyless fallback: DuckDuckGo's HTML endpoint. Best-effort; add TAVILY_API_KEY or BRAVE_API_KEY for reliability.
  const r = await fetch('https://html.duckduckgo.com/html/', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Mozilla/5.0 (VAULT-Jarvis)' },
    body: 'q=' + encodeURIComponent(query) });
  const html = await r.text();
  const out = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g;
  let m;
  while ((m = re.exec(html)) && out.length < n) {
    let url = m[1];
    const u = url.match(/[?&]uddg=([^&]+)/); if (u) url = decodeURIComponent(u[1]);
    if (url.startsWith('//')) url = 'https:' + url;
    out.push((out.length + 1) + '. ' + htmlToText(m[2]) + '\n   ' + url + '\n   ' + htmlToText(m[3] || ''));
  }
  return out.length ? out.join('\n') : 'No results (the keyless search fallback may be rate-limited — set TAVILY_API_KEY or BRAVE_API_KEY).';
}

// web_fetch must not become a way into the owner's own machine or network (SSRF):
// every hop's DNS answer is checked inside the socket's own lookup, so it can't be swapped afterwards.
const net = require('net');
const dns = require('dns');
function privateIP(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return privateIP(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}
function guardedLookup(host, opts, cb) {
  dns.lookup(host, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    const bad = addrs.find(a => privateIP(a.address));
    if (bad && !process.env.JARVIS_ALLOW_PRIVATE_FETCH) return cb(new Error('Blocked: ' + host + ' resolves to a private/local address (' + bad.address + ').'));
    if (opts && opts.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}
function getOnce(u) {
  const mod = u.protocol === 'https:' ? require('https') : require('http');
  return new Promise((resolve, reject) => {
    if (net.isIP(u.hostname.replace(/^\[|\]$/g, '')) && privateIP(u.hostname.replace(/^\[|\]$/g, '')) && !process.env.JARVIS_ALLOW_PRIVATE_FETCH)
      return reject(new Error('Blocked: ' + u.hostname + ' is a private/local address.'));
    const req = mod.get(u, { lookup: guardedLookup, headers: { 'user-agent': 'Mozilla/5.0 (VAULT-Jarvis)', 'accept-encoding': 'identity' }, timeout: 20000 }, res => {
      const chunks = []; let len = 0;
      res.on('data', d => { len += d.length; if (len <= 3e6) chunks.push(d); else res.destroy(); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('close', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', reject);
  });
}
async function webFetch(url) {
  let u; try { u = new URL(url); } catch { throw new Error('Invalid URL.'); }
  for (let hop = 0; hop < 6; hop++) {
    if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs are allowed.');
    const r = await getOnce(u);
    if (r.status >= 300 && r.status < 400 && r.headers.location) { u = new URL(r.headers.location, u); continue; }
    const type = r.headers['content-type'] || '';
    const text = /html/i.test(type) ? htmlToText(r.body) : r.body;
    return 'URL: ' + u.href + '\nStatus: ' + r.status + '\n\n' + text.slice(0, 40000) + (text.length > 40000 ? '\n…[truncated]' : '');
  }
  throw new Error('Too many redirects.');
}

// ── grep worker ─────────────────────────────────────────────────────────────
const GREP_TIMEOUT_MS = 5000;
const GREP_WORKER = `
const { parentPort, workerData: w } = require('worker_threads');
const fs = require('fs');
const re = new RegExp(w.pattern, 'i'); const out = [];
for (const f of w.files) {
  let txt; try { if (fs.statSync(f).size > 2e6) continue; txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const lines = txt.split('\\n');
  for (let i = 0; i < lines.length && out.length < w.max; i++) {
    const l = lines[i].length > 5000 ? lines[i].slice(0, 5000) : lines[i];
    if (re.test(l)) out.push({ f, n: i + 1, line: l.slice(0, 300) });
  }
  if (out.length >= w.max) break;
}
parentPort.postMessage(out);`;
function grepInWorker(pattern, files, max, timeoutMs) {
  const { Worker } = require('worker_threads');
  return new Promise(resolve => {
    const wk = new Worker(GREP_WORKER, { eval: true, workerData: { pattern, files, max } });
    const t = setTimeout(() => { wk.terminate(); resolve(null); }, timeoutMs);
    wk.once('message', m => { clearTimeout(t); wk.terminate(); resolve(m); });
    wk.once('error', () => { clearTimeout(t); resolve([]); });
  });
}

// ── Executor ────────────────────────────────────────────────────────────────
// Returns { text, image? } — image = { mime, base64 } when the model looked at a picture.
async function execute(sb, name, args, ctx) {
  switch (name) {
    case 'read_file': {
      const abs = sb.resolve(args.path);
      if (!fs.existsSync(abs)) return { text: 'File not found: ' + args.path + ' — use list_files or grep to locate it.' };
      if (fs.statSync(abs).isDirectory()) return { text: args.path + ' is a folder. Use list_files.' };
      const mime = IMAGE_EXT[path.extname(abs).toLowerCase()];
      if (mime) {
        const buf = fs.readFileSync(abs);
        if (buf.length > 15e6) return { text: 'Image too large to view (>15 MB).' };
        return { text: 'Image ' + sb.rel(abs) + ' attached below.', image: { mime, base64: buf.toString('base64') } };
      }
      const raw = fs.readFileSync(abs);
      if (raw.includes(0)) return { text: 'Binary file — cannot read as text.' };
      const lines = raw.toString('utf8').split('\n');
      const start = Math.max(1, args.offset || 1);
      const end = Math.min(lines.length, start - 1 + (args.limit || 2000));
      let out = '';
      for (let i = start; i <= end; i++) { out += i + '\t' + lines[i - 1] + '\n'; if (out.length > MAX_READ) { out += '…[truncated — use offset/limit]\n'; break; } }
      return { text: out || '(empty file)' };
    }
    case 'write_file': {
      const abs = sb.resolveWritable(args.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, String(args.content ?? ''), 'utf8');
      return { text: 'Wrote ' + sb.rel(abs) + ' (' + String(args.content ?? '').length + ' chars).' };
    }
    case 'edit_file': {
      const abs = sb.resolveWritable(args.path);
      if (!fs.existsSync(abs)) return { text: 'File not found: ' + args.path + '. Use write_file to create it.' };
      const src = fs.readFileSync(abs, 'utf8');
      const oldS = String(args.old_string ?? ''), newS = String(args.new_string ?? '');
      if (oldS === '') { fs.writeFileSync(abs, src + (src.endsWith('\n') || !src ? '' : '\n') + newS + (newS.endsWith('\n') ? '' : '\n'), 'utf8'); return { text: 'Appended to ' + sb.rel(abs) + '.' }; }
      const count = src.split(oldS).length - 1;
      if (count === 0) return { text: 'old_string not found in ' + args.path + '. Read the file and copy the exact text (whitespace matters).' };
      if (count > 1 && !args.replace_all) return { text: 'old_string matches ' + count + ' times — add surrounding text to make it unique, or set replace_all.' };
      fs.writeFileSync(abs, args.replace_all ? src.split(oldS).join(newS) : src.replace(oldS, () => newS), 'utf8');
      return { text: 'Edited ' + sb.rel(abs) + ' (' + (args.replace_all ? count : 1) + ' replacement' + (count > 1 && args.replace_all ? 's' : '') + ').' };
    }
    case 'move_file': {
      const from = sb.resolveWritable(args.from), to = sb.resolveWritable(args.to);
      if (!fs.existsSync(from)) return { text: 'Source not found: ' + args.from };
      if (fs.existsSync(to)) return { text: 'Destination already exists: ' + args.to + ' — pick another name (e.g. append " (2)").' };
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
      return { text: 'Moved ' + sb.rel(from) + ' → ' + sb.rel(to) };
    }
    case 'list_files': {
      const base = args.path ? sb.resolve(args.path) : sb.cwd;
      const pat = String(args.pattern || '**/*').replace(/^\.\//, '');
      const re = globToRegex(pat);
      const files = []; walk(base, /(^|\/)\./.test(pat), files, 20000);
      const hits = files.filter(f => re.test(path.relative(base, f).split(path.sep).join('/')) && sb.readable(f));
      hits.sort((a, b) => { try { return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs; } catch { return 0; } });
      if (!hits.length) return { text: 'No files match ' + pat + (args.path ? ' in ' + args.path : '') + '.' };
      const shown = hits.slice(0, 300).map(f => sb.rel(f));
      return { text: shown.join('\n') + (hits.length > 300 ? '\n…and ' + (hits.length - 300) + ' more' : '') };
    }
    case 'grep': {
      try { new RegExp(args.pattern, 'i'); } catch (e) { return { text: 'Invalid regex: ' + e.message }; }
      const base = args.path ? sb.resolve(args.path) : sb.cwd;
      const max = Math.min(args.max_results || 60, 300);
      let files = [];
      if (fs.existsSync(base) && fs.statSync(base).isFile()) files = [base];
      else walk(base, false, files, 20000);
      const gre = args.glob ? globToRegex(args.glob.replace(/^\.\//, '')) : null;
      files = files.filter(f => sb.readable(f) && (gre ? gre.test(path.relative(base, f).split(path.sep).join('/')) : /\.(md|txt|json|csv|js|py|html|css|ya?ml|tex|canvas)$/i.test(f)));
      // The model writes the regex, so it can be catastrophic (ReDoS). Run it in a worker we can kill.
      const out = await grepInWorker(String(args.pattern), files, max, GREP_TIMEOUT_MS);
      if (out === null) return { text: 'That regex took too long (over ' + GREP_TIMEOUT_MS / 1000 + ' s) — use a simpler pattern.' };
      return { text: out.length ? out.map(o => sb.rel(o.f) + ':' + o.n + ': ' + o.line).join('\n') : 'No matches for /' + args.pattern + '/.' };
    }
    case 'web_search': return { text: await webSearch(String(args.query || ''), args.max_results) };
    case 'web_fetch': return { text: await webFetch(String(args.url || '')) };
    case 'delegate_task': {
      if (!ctx || !ctx.delegate) return { text: 'Delegation is not available here — do the task yourself.' };
      return { text: await ctx.delegate(String(args.task || ''), args.agent ? String(args.agent) : '') };
    }
    default: return { text: 'Unknown tool: ' + name };
  }
}

module.exports = { SCHEMAS, Sandbox, execute, globToRegex };
