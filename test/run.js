// Cross-platform test runner (Node 18+): runs every test/*.test.js with node:test.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).map(f => path.join(__dirname, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
