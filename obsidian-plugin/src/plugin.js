/* V.A.U.L.T. Jarvis — Obsidian plugin.
 * Installs the Jarvis runtime into this vault's .claude/ folder, runs the local Jarvis server,
 * and shows the HUD in an Obsidian tab. No terminal, no Node.js install required.
 *
 * Build: node obsidian-plugin/build.js  →  dist/main.js (RUNTIME is injected by the build).
 */
'use strict';
const { Plugin, ItemView, PluginSettingTab, Setting, Notice, requestUrl, FileSystemAdapter, Platform } = require('obsidian');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

/* global RUNTIME, RUNTIME_VERSION */
const VIEW_TYPE = 'vault-jarvis-hud';

const DEFAULTS = {
  provider: 'gemini', apiKey: '', model: '', fastModel: '', baseUrl: '',
  ownerName: 'Boss', pronoun: 'they', curriculum: 'IB',
  port: 3333, autoStart: true, nodePath: '',
  googleClientId: '', googleClientSecret: '', tavilyKey: '',
  installed: {}, // relPath -> sha1 of the version the plugin last wrote (so user edits are never clobbered silently)
  runtimeVersion: '',
};

const PROVIDERS = {
  gemini: 'Google Gemini (free tier)', groq: 'Groq (free tier)', openrouter: 'OpenRouter',
  ollama: 'Ollama (local, offline)', openai: 'OpenAI', anthropic: 'Anthropic', custom: 'Custom OpenAI-compatible URL',
  claude: 'Claude Code CLI (adds nothing new; needs `claude` installed)',
};
const KEY_ENV = { gemini: 'GEMINI_API_KEY', groq: 'GROQ_API_KEY', openrouter: 'OPENROUTER_API_KEY', openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', custom: 'JARVIS_API_KEY' };

const sha1 = buf => crypto.createHash('sha1').update(buf).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Files the plugin keeps up to date (code) vs. files it only seeds once (the owner's to edit).
const isCode = rel => /^\.claude\/(agent\/|dashboard\/|start\.js$)/.test(rel);

class JarvisView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Jarvis'; }
  getIcon() { return 'bot'; }
  async onOpen() { await this.render(); }
  async render() {
    const el = this.contentEl; el.empty(); el.addClass('vault-jarvis-view');
    const bar = el.createDiv({ cls: 'vault-jarvis-bar' });
    const status = bar.createSpan({ text: 'Starting Jarvis…', cls: 'vault-jarvis-status' });
    const btns = bar.createDiv({ cls: 'vault-jarvis-btns' });
    const mk = (label, fn) => { const b = btns.createEl('button', { text: label }); b.onclick = fn; return b; };
    mk('Open in browser (voice)', () => window.open(this.plugin.url()));
    mk('Reload', () => this.render());
    mk('Restart server', async () => { await this.plugin.restartServer(); this.render(); });
    const ok = await this.plugin.ensureServer();
    if (!ok) {
      status.setText('Jarvis could not start.');
      const msg = el.createDiv({ cls: 'vault-jarvis-error' });
      msg.createEl('p', { text: this.plugin.lastError || 'Unknown error.' });
      msg.createEl('p', { text: 'Check Settings → V.A.U.L.T. Jarvis (API key, Node path).' });
      return;
    }
    status.setText('Online · ' + PROVIDERS[this.plugin.settings.provider]);
    const frame = el.createEl('iframe', { cls: 'vault-jarvis-frame' });
    frame.setAttr('allow', 'microphone; autoplay; clipboard-write');
    frame.src = this.plugin.url();
  }
}

module.exports = class VaultJarvisPlugin extends Plugin {
  async onload() {
    if (!Platform.isDesktopApp) return;
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    if (!this.settings.key) { this.settings.key = crypto.randomBytes(6).toString('hex'); await this.saveData(this.settings); }
    this.child = null; this.lastError = '';
    this.registerView(VIEW_TYPE, leaf => new JarvisView(leaf, this));
    this.addRibbonIcon('bot', 'Open Jarvis', () => this.openView());
    this.addCommand({ id: 'open-hud', name: 'Open HUD', callback: () => this.openView() });
    this.addCommand({ id: 'open-in-browser', name: 'Open HUD in browser (for voice)', callback: async () => { if (await this.ensureServer()) window.open(this.url()); } });
    this.addCommand({ id: 'restart-server', name: 'Restart server', callback: () => this.restartServer() });
    this.addCommand({ id: 'install-runtime', name: 'Install or update Jarvis files in this vault', callback: () => this.installRuntime(true) });
    this.addCommand({ id: 'connect-google', name: 'Connect Gmail and Google Calendar', callback: () => this.connectGoogle() });
    this.addSettingTab(new JarvisSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(async () => {
      if (this.settings.runtimeVersion !== RUNTIME_VERSION) await this.installRuntime(false);
      if (this.settings.autoStart) this.ensureServer();
    });
  }
  onunload() { this.stopServer(); }

  vaultPath() {
    const a = this.app.vault.adapter;
    if (!(a instanceof FileSystemAdapter)) throw new Error('Jarvis needs a local vault on desktop.');
    return a.getBasePath();
  }
  url() { return 'http://localhost:' + this.settings.port + '/?key=' + this.settings.key; }
  // Probes use 127.0.0.1: on Windows/Node 18+ "localhost" can resolve to IPv6 ::1, but the server listens on IPv4.
  api(p) { return 'http://127.0.0.1:' + this.settings.port + p; }

  async openView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf('tab'); await leaf.setViewState({ type: VIEW_TYPE, active: true }); }
    this.app.workspace.revealLeaf(leaf);
  }

  // ── Runtime install ───────────────────────────────────────────────────────
  async installRuntime(verbose) {
    const base = this.vaultPath();
    let wrote = 0, backedUp = 0, kept = 0;
    for (const [rel, b64] of Object.entries(RUNTIME)) {
      const dest = path.join(base, ...rel.split('/'));
      const buf = Buffer.from(b64, 'base64');
      const exists = fs.existsSync(dest);
      if (exists && !isCode(rel)) { kept++; continue; }           // owner's content: seed once, never overwrite
      if (exists) {
        const cur = fs.readFileSync(dest);
        if (sha1(cur) === sha1(buf)) { this.settings.installed[rel] = sha1(buf); continue; }
        if (this.settings.installed[rel] !== sha1(cur)) {            // changed by someone other than this plugin
          fs.copyFileSync(dest, dest + '.bak-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'));
          backedUp++;
        }
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      if (/\.(sh|command)$|jarvis-run$/.test(rel)) { try { fs.chmodSync(dest, 0o755); } catch {} }
      this.settings.installed[rel] = sha1(buf); wrote++;
    }
    // Seed memory files from their examples
    for (const f of ['memory', 'profile']) {
      const dst = path.join(base, '.claude', 'memory', f + '.md'), ex = path.join(base, '.claude', 'memory', f + '.example.md');
      if (!fs.existsSync(dst) && fs.existsSync(ex)) fs.copyFileSync(ex, dst);
    }
    this.settings.runtimeVersion = RUNTIME_VERSION;
    await this.saveData(this.settings);
    await this.pushSettingsFile();
    if (verbose || wrote) new Notice('Jarvis files ' + (wrote ? 'installed/updated (' + wrote + ')' : 'already up to date') + (backedUp ? ' · ' + backedUp + ' customised file(s) backed up as .bak-*' : '') + '.');
    if (wrote && this.child) await this.restartServer();
  }

  // Owner settings live in .claude/jarvis.json so the server, agent and automations all see them.
  async pushSettingsFile() {
    const p = path.join(this.vaultPath(), '.claude', 'jarvis.json');
    let cur = {}; try { cur = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
    const s = this.settings;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ ...cur, ownerName: s.ownerName, pronoun: s.pronoun, curriculum: s.curriculum }, null, 2));
  }

  // ── Server process ────────────────────────────────────────────────────────
  // Prefer a real Node.js if one is installed; otherwise run Obsidian's own Electron as Node.
  findNode() {
    if (this.settings.nodePath) return { cmd: this.settings.nodePath, electron: false };
    const home = os.homedir(), cands = [];
    const win = process.platform === 'win32';
    const dirs = win
      ? [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs'), path.join(process.env.APPDATA || '', 'nvm')]
      : ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', path.join(home, '.volta', 'bin')];
    try { const nvm = path.join(home, '.nvm', 'versions', 'node'); for (const v of fs.readdirSync(nvm).sort().reverse()) dirs.push(path.join(nvm, v, 'bin')); } catch {}
    for (const d of (process.env.PATH || '').split(path.delimiter).concat(dirs)) cands.push(path.join(d, win ? 'node.exe' : 'node'));
    for (const c of cands) { try { if (fs.statSync(c).isFile()) return { cmd: c, electron: false }; } catch {} }
    return { cmd: process.execPath, electron: true };
  }

  env(electron) {
    const s = this.settings, e = { ...process.env };
    // GUI apps on macOS don't get the shell PATH — add the usual places for python3 (Whisper) and friends.
    e.PATH = [e.PATH, '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean).join(path.delimiter);
    if (electron) e.ELECTRON_RUN_AS_NODE = '1';
    e.JARVIS_VAULT = this.vaultPath(); e.PORT = String(s.port); e.JARVIS_KEY = s.key;
    if (s.provider === 'claude') e.JARVIS_AGENT = 'claude';
    else {
      e.JARVIS_PROVIDER = s.provider;
      if (s.apiKey && KEY_ENV[s.provider]) e[KEY_ENV[s.provider]] = s.apiKey;
      if (s.model) e.JARVIS_MODEL = s.model;
      if (s.fastModel) e.JARVIS_FAST_MODEL = s.fastModel;
      if (s.provider === 'custom' && s.baseUrl) e.JARVIS_BASE_URL = s.baseUrl;
    }
    if (s.googleClientId) { e.GOOGLE_CLIENT_ID = s.googleClientId; e.GOOGLE_CLIENT_SECRET = s.googleClientSecret; }
    if (s.tavilyKey) e.TAVILY_API_KEY = s.tavilyKey;
    return e;
  }

  async alive() {
    try { const r = await requestUrl({ url: this.api('/stats?key=' + this.settings.key), throw: false }); return r.status === 200; }
    catch { return false; }
  }

  ensureServer() {
    if (this.starting) return this.starting;       // lock taken synchronously — no double starts
    this.starting = (async () => {
      try {
        if (await this.alive()) return true;
        const base = this.vaultPath();
        const server = path.join(base, '.claude', 'dashboard', 'server.js');
        if (!fs.existsSync(server)) await this.installRuntime(false);
        const node = this.findNode();
        let log = '';
        this.child = spawn(node.cmd, [server], { cwd: path.dirname(server), env: this.env(node.electron), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        this.child.stdout.on('data', d => { log = (log + d).slice(-4000); });
        this.child.stderr.on('data', d => { log = (log + d).slice(-4000); });
        this.child.on('error', e => { this.lastError = 'Could not launch ' + node.cmd + ': ' + e.message; });
        this.child.on('close', () => { this.child = null; });
        for (let i = 0; i < 40; i++) { await sleep(250); if (await this.alive()) { this.lastError = ''; return true; } if (!this.child) break; }
        this.lastError = (this.lastError || 'Server did not come up.') + (log ? '\n' + log.slice(-800) : '');
        return false;
      } catch (e) { this.lastError = e.message; return false; }
      finally { this.starting = null; }
    })();
    return this.starting;
  }
  stopServer() { if (this.child) { try { this.child.kill(); } catch {} this.child = null; } }
  async restartServer() {
    this.stopServer();
    try { await requestUrl({ url: this.api('/shutdown'), method: 'POST', throw: false }); } catch {}
    await sleep(500);
    const ok = await this.ensureServer();
    new Notice(ok ? 'Jarvis restarted.' : 'Jarvis failed to start: ' + this.lastError.split('\n')[0]);
    return ok;
  }

  connectGoogle() {
    const s = this.settings;
    if (!s.googleClientId || !s.googleClientSecret) { new Notice('Add your Google OAuth client ID and secret in Settings → V.A.U.L.T. Jarvis first.'); return; }
    const node = this.findNode();
    const script = path.join(this.vaultPath(), '.claude', 'agent', 'google.js');
    new Notice('Opening Google sign-in in your browser…');
    const c = spawn(node.cmd, [script, 'auth'], { env: this.env(node.electron), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d);
    c.on('error', e => new Notice('Could not start Google sign-in: ' + e.message, 8000));
    c.on('close', code => { new Notice(code === 0 ? 'Google connected — Jarvis can now read mail, draft replies and use your calendar.' : 'Google sign-in failed: ' + out.trim().split('\n').pop(), 8000); if (code === 0) this.restartServer(); });
  }
};

class JarvisSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl: el } = this; el.empty();
    const p = this.plugin, s = p.settings;
    const save = async (restart) => { await p.saveData(s); await p.pushSettingsFile(); if (restart && p.child) p.restartServer(); };

    el.createEl('h3', { text: 'Model' });
    new Setting(el).setName('Provider').setDesc('Gemini has a free tier (no card). Ollama runs fully offline.')
      .addDropdown(d => d.addOptions(PROVIDERS).setValue(s.provider).onChange(async v => { s.provider = v; await save(true); this.display(); }));
    if (s.provider === 'gemini') el.createEl('p', { cls: 'setting-item-description', text: 'Get a free key at aistudio.google.com/apikey. Default models: gemini-3.5-flash / gemini-3.5-flash-lite.' });
    if (KEY_ENV[s.provider]) new Setting(el).setName('API key').setDesc('Stored in this vault\'s plugin data (.obsidian/plugins/vault-jarvis/data.json). Don\'t sync or share that file.')
      .addText(t => { t.inputEl.type = 'password'; t.setValue(s.apiKey).onChange(async v => { s.apiKey = v.trim(); await save(false); }); });
    if (s.provider === 'custom') new Setting(el).setName('Base URL').setDesc('Any OpenAI-compatible endpoint, e.g. http://localhost:1234/v1')
      .addText(t => t.setValue(s.baseUrl).onChange(async v => { s.baseUrl = v.trim(); await save(false); }));
    if (s.provider !== 'claude') {
      new Setting(el).setName('Model').setDesc(s.provider === 'gemini' ? 'Optional override.' : 'Required — a model that supports tool calling.')
        .addText(t => t.setPlaceholder(s.provider === 'gemini' ? 'gemini-3.5-flash' : 'model id').setValue(s.model).onChange(async v => { s.model = v.trim(); await save(false); }));
      new Setting(el).setName('Fast model (optional)').setDesc('Used for quick background jobs.')
        .addText(t => t.setValue(s.fastModel).onChange(async v => { s.fastModel = v.trim(); await save(false); }));
    }
    new Setting(el).setName('Apply').setDesc('Restart the server so model changes take effect.').addButton(b => b.setButtonText('Restart Jarvis').onClick(() => p.restartServer()));

    el.createEl('h3', { text: 'You' });
    new Setting(el).setName('What Jarvis calls you').addText(t => t.setValue(s.ownerName).onChange(async v => { s.ownerName = v.trim() || 'Boss'; await save(false); }));
    new Setting(el).setName('Pronouns').addDropdown(d => d.addOptions({ he: 'he / him', she: 'she / her', they: 'they / them' }).setValue(s.pronoun).onChange(async v => { s.pronoun = v; await save(false); }));
    new Setting(el).setName('Curriculum').setDesc('Study protocols ship with IB rubrics; others (AP, A-Level, GCSE…) are adapted.')
      .addText(t => t.setValue(s.curriculum).onChange(async v => { s.curriculum = v.trim() || 'IB'; await save(false); }));
    el.createEl('p', { cls: 'setting-item-description', text: 'Tell Jarvis about yourself in .claude/memory/profile.md — it is loaded into every conversation.' });

    el.createEl('h3', { text: 'Gmail and Google Calendar (optional)' });
    el.createEl('p', { cls: 'setting-item-description', text: 'Create a free OAuth client (type: Desktop app) in Google Cloud Console, enable the Gmail and Google Calendar APIs, then paste the ID and secret here. Jarvis can read mail and write drafts — it can never send.' });
    new Setting(el).setName('OAuth client ID').addText(t => t.setValue(s.googleClientId).onChange(async v => { s.googleClientId = v.trim(); await save(false); }));
    new Setting(el).setName('OAuth client secret').addText(t => { t.inputEl.type = 'password'; t.setValue(s.googleClientSecret).onChange(async v => { s.googleClientSecret = v.trim(); await save(false); }); });
    new Setting(el).setName('Connect').addButton(b => b.setButtonText('Sign in with Google').onClick(() => p.connectGoogle()));

    el.createEl('h3', { text: 'Advanced' });
    new Setting(el).setName('Web search key (Tavily, optional)').setDesc('More reliable than the keyless default. Free tier at tavily.com.')
      .addText(t => { t.inputEl.type = 'password'; t.setValue(s.tavilyKey).onChange(async v => { s.tavilyKey = v.trim(); await save(false); }); });
    new Setting(el).setName('Port').addText(t => t.setValue(String(s.port)).onChange(async v => { const n = parseInt(v, 10); if (n > 1023 && n < 65536) { s.port = n; await save(false); } }));
    new Setting(el).setName('Start with Obsidian').addToggle(t => t.setValue(s.autoStart).onChange(async v => { s.autoStart = v; await save(false); }));
    new Setting(el).setName('Node.js path (optional)').setDesc('Leave empty to auto-detect; falls back to Obsidian\'s built-in runtime.')
      .addText(t => t.setPlaceholder('/usr/local/bin/node').setValue(s.nodePath).onChange(async v => { s.nodePath = v.trim(); await save(false); }));
    new Setting(el).setName('Reinstall Jarvis files').setDesc('Updates code in .claude/agent and .claude/dashboard. Your notes, skills and memory are never overwritten; customised code is backed up as .bak-*.')
      .addButton(b => b.setButtonText('Install / update').onClick(() => p.installRuntime(true)));
  }
}
