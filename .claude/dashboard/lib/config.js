// Paths, environment and owner settings shared by every dashboard module.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const DASH = path.resolve(__dirname, '..');                 // .claude/dashboard
const VAULT = process.env.JARVIS_VAULT
  ? path.resolve(process.env.JARVIS_VAULT.replace(/^~/, os.homedir()))
  : path.resolve(DASH, '..', '..');
require(path.join(DASH, '..', 'agent', 'env.js')).loadEnv([path.join(VAULT, '.env'), path.join(DASH, '..', '..', '.env')]);

// ---------- Owner settings (.claude/jarvis.json, then env) ----------
// Jarvis's personality was written for one person. These settings make it anyone's:
//   ownerName   what he calls you            (default "Boss")
//   pronoun     he | she | they              (default "they")
//   curriculum  IB | AP | A-Level | GCSE | … (default "IB"; skills adapt their rubrics)
const SETTINGS_PATH = path.join(VAULT, '.claude', 'jarvis.json');
function readSettings() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch {}
  const env = process.env;
  const pronoun = String(env.JARVIS_OWNER_PRONOUN || s.pronoun || 'they').toLowerCase();
  return {
    ownerName: String(env.JARVIS_OWNER_NAME || s.ownerName || 'Boss').trim().slice(0, 40) || 'Boss',
    pronoun: ['he', 'she', 'they'].includes(pronoun) ? pronoun : 'they',
    curriculum: String(env.JARVIS_CURRICULUM || s.curriculum || 'IB').trim().slice(0, 40) || 'IB',
  };
}
function writeSettings(patch) {
  const cur = (() => { try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch { return {}; } })();
  const next = { ...cur, ...patch };
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  return readSettings();
}

// Text in this codebase was written as: the owner is "Boss", addressed as "sir", referred to as he/him/his.
// honor() rewrites that for the configured owner. Apply it to project-authored text only
// (prompts, UI strings, greetings) — never to the owner's notes or memory.
const PRONOUNS = {
  he: null,
  she: { he: 'she', him: 'her', his: 'her', himself: 'herself', sir: "ma'am" },
  they: { he: 'they', him: 'them', his: 'their', himself: 'themselves', sir: null },
};
function caseLike(src, word) { return src[0] === src[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word; }
function honor(text, settings) {
  const s = settings || readSettings();
  let t = String(text);
  if (s.ownerName !== 'Boss') t = t.replace(/\bBoss\b/g, s.ownerName);
  const map = PRONOUNS[s.pronoun];
  if (map) {
    t = t.replace(/\b(sir|Sir)\b/g, m => map.sir ? caseLike(m, map.sir) : s.ownerName);
    t = t.replace(/\b(he|He|him|Him|his|His|himself|Himself)\b/g, m => caseLike(m, map[m.toLowerCase()]));
    if (s.pronoun === 'they') {
      t = t.replace(/\b(they|They) (is|was|has|does|says|wants|asks|needs|knows|writes|speaks|sounds|insists|uses|mentions|references|gives|chose|clicks|goes|reads|sees|likes|looks|thinks)\b/g,
        (m, p, v) => p + ' ' + ({ is: 'are', was: 'were', has: 'have', does: 'do', goes: 'go', chose: 'chose' }[v] || v.replace(/s$/, '')));
    }
  }
  return t;
}

const PORT = process.env.PORT || 3333;
const KEY = process.env.JARVIS_KEY || crypto.randomBytes(4).toString('hex');
const SERVER_START = Date.now();

module.exports = { DASH, VAULT, PORT, KEY, SERVER_START, SETTINGS_PATH, readSettings, writeSettings, honor };
