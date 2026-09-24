'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { honor } = require('../.claude/dashboard/lib/config.js');

test('honor() rewrites owner name, honorific and pronouns', () => {
  const t = 'Right away, Boss. Very good, sir. Ask him about his notes; he says he is ready.';
  assert.strictEqual(honor(t, { ownerName: 'Boss', pronoun: 'he' }), t);
  assert.strictEqual(honor(t, { ownerName: 'Maya', pronoun: 'she' }), "Right away, Maya. Very good, ma'am. Ask her about her notes; she says she is ready.");
  assert.strictEqual(honor(t, { ownerName: 'Sam', pronoun: 'they' }), 'Right away, Sam. Very good, Sam. Ask them about their notes; they say they are ready.');
});
