// Dashboard numbers: note/word/link counts, today's directives, exams, phone links, uptime.
'use strict';
const fs = require('fs');
const path = require('path');
const { VAULT, PORT, KEY, SERVER_START } = require('./config');
const { mdFiles, exams } = require('./vault');
const { lanIP, getTsUrl } = require('./net');
const { isWhisperReady } = require('./voice');
const { MEM_PATH, convoCount } = require('./memory');
const counters = { skillInvocations: 0 };

function stats() {
  const files = mdFiles();
  const rel = f => path.relative(VAULT, f);
  const recent = files.map(f => ({ f: rel(f), t: fs.statSync(f).mtimeMs })).sort((a, b) => b.t - a.t).slice(0, 8);
  const raw = files.filter(f => rel(f).startsWith('raw' + path.sep));
  const rawPending = raw.filter(f => { try { return !/status:\s*processed/.test(fs.readFileSync(f, 'utf8').slice(0, 400)); } catch { return false; } });
  let words = 0, links = 0;
  for (const f of files) { try { const s = fs.readFileSync(f, 'utf8'); words += (s.match(/\S+/g) || []).length; links += (s.match(/\[\[/g) || []).length; } catch {} }
  let todos = [], calendarToday = 0;
  try {
    const lines = fs.readFileSync(path.join(VAULT, 'TO DO.md'), 'utf8').split('\n');
    let scope = lines, ti = lines.findIndex(l => /^##\s*Today/i.test(l));
    if (ti >= 0) {
      scope = [];
      for (let li = ti + 1; li < lines.length; li++) {
        if (/^##\s/.test(lines[li]) || /^---/.test(lines[li])) break;
        scope.push(lines[li]);
      }
    }
    todos = scope
      .filter(l => /^\s*- /.test(l) && !/^\s*- \[[xX]\]/.test(l))
      .map(l => l.replace(/^\s*- (\[.\]\s*)?/, ''))
      .slice(0, 8);
    // self-improve step 1a prefixes calendar-synced bullets with a time, e.g. "3:00pm Orthodontist"
    calendarToday = todos.filter(t => /^\d{1,2}:\d{2}\s*(am|pm)\b/i.test(t)).length;
  } catch {}
  return {
    notes: files.length, words, links,
    wiki: files.filter(f => rel(f).startsWith('wiki' + path.sep)).length,
    output: files.filter(f => rel(f).startsWith('output' + path.sep)).length,
    rawPending: rawPending.length, todos, recent, whisper: isWhisperReady(), exams: exams(),
    phone: (() => { const ip = lanIP(); return ip ? 'http://' + ip + ':' + PORT + '/?key=' + KEY : null; })(),
    remote: getTsUrl(),
    convoCount: convoCount(),
    memoryEntries: (() => { try { return (fs.readFileSync(MEM_PATH, 'utf8').match(/^-\s/gm) || []).length; } catch { return 0; } })(),
    invocations: counters.skillInvocations,
    uptimeSec: Math.floor((Date.now() - SERVER_START) / 1000),
    calendarToday
  };
}


module.exports = { stats, counters };
