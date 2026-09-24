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
class Sandbox {
  constructor(cwd, addDirs, full) {
    this.cwd = path.resolve(cwd);
    this.full = !!full;
    this.roots = [this.cwd, ...addDirs.map(d => path.resolve(d.replace(/^~/, os.homedir())))];
    // Write access outside the vault only where the dashboard grant says so.
    this.writable = new Set([this.cwd]);
    try {
      const grants = JSON.parse(fs.readFileSync(path.join(this.cwd, '.claude', 'dashboard', 'folders.json'), 'utf8'));
      for (const g of grants) if (g && g.write) this.writable.add(path.resolve(String(g.path).replace(/^~/, os.homedir())));
    } catch {}
    if (this.full) for (const r of this.roots) this.writable.add(r);
  }
  resolve(p) {
    if (!p || typeof p !== 'string') throw new Error('path is required');
    const abs = path.resolve(this.cwd, p.replace(/^~(?=$|\/)/, os.homedir()));
    // Follow symlinks for the check so a link inside the vault can't point outside it.
    let real = abs;
    try { real = fs.realpathSync(abs); } catch { try { real = path.join(fs.realpathSync(path.dirname(abs)), path.basename(abs)); } catch {} }
    const realRoots = this.roots.map(r => { try { return fs.realpathSync(r); } catch { return r; } });
    if (!realRoots.some(r => real === r || real.startsWith(r + path.sep))) {
      throw new Error('Access denied: ' + p + ' is outside the vault and the granted folders.');
    }
    return abs;
  }
  resolveWritable(p) {
    const abs = this.resolve(p);
    // The vault is always writable, even if it sits inside a read-only grant.
    const inVault = abs === this.cwd || abs.startsWith(this.cwd + path.sep);
    const ok = inVault || [...this.writable].some(r => abs === r || abs.startsWith(r + path.sep));
    if (!ok) throw new Error('Read-only: ' + p + ' is in a folder granted READ ONLY. Write the result into the vault (output/) instead.');
    if (abs.split(path.sep).some(s => s === '.git' || s === '.obsidian')) throw new Error('Refusing to write inside .git/.obsidian.');
    return abs;
  }
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

async function webFetch(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Only http(s) URLs are allowed.');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (VAULT-Jarvis)' }, redirect: 'follow', signal: ctl.signal });
    const type = r.headers.get('content-type') || '';
    const body = await r.text();
    const text = /html/i.test(type) ? htmlToText(body) : body;
    return 'URL: ' + r.url + '\nStatus: ' + r.status + '\n\n' + text.slice(0, 40000) + (text.length > 40000 ? '\n…[truncated]' : '');
  } finally { clearTimeout(t); }
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
      const hits = files.filter(f => re.test(path.relative(base, f).split(path.sep).join('/')));
      hits.sort((a, b) => { try { return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs; } catch { return 0; } });
      if (!hits.length) return { text: 'No files match ' + pat + (args.path ? ' in ' + args.path : '') + '.' };
      const shown = hits.slice(0, 300).map(f => sb.rel(f));
      return { text: shown.join('\n') + (hits.length > 300 ? '\n…and ' + (hits.length - 300) + ' more' : '') };
    }
    case 'grep': {
      let re; try { re = new RegExp(args.pattern, 'i'); } catch (e) { return { text: 'Invalid regex: ' + e.message }; }
      const base = args.path ? sb.resolve(args.path) : sb.cwd;
      const max = Math.min(args.max_results || 60, 300);
      let files = [];
      if (fs.existsSync(base) && fs.statSync(base).isFile()) files = [base];
      else walk(base, false, files, 20000);
      const gre = args.glob ? globToRegex(args.glob.replace(/^\.\//, '')) : null;
      const out = [];
      for (const f of files) {
        if (gre && !gre.test(path.relative(base, f).split(path.sep).join('/'))) continue;
        if (!gre && !/\.(md|txt|json|csv|js|py|html|css|ya?ml|tex|canvas)$/i.test(f)) continue;
        let txt; try { const st = fs.statSync(f); if (st.size > 2e6) continue; txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
        const lines = txt.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i])) { out.push(sb.rel(f) + ':' + (i + 1) + ': ' + lines[i].slice(0, 300)); if (out.length >= max) break; }
        }
        if (out.length >= max) break;
      }
      return { text: out.length ? out.join('\n') : 'No matches for /' + args.pattern + '/.' };
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
