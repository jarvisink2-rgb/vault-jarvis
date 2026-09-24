// Tiny .env loader (no dependency). Existing environment variables always win.
'use strict';
const fs = require('fs');

function loadEnv(files) {
  for (const f of files) {
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      else v = v.replace(/\s+#.*$/, '');
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
}

module.exports = { loadEnv };
