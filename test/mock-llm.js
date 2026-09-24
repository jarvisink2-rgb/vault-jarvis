// A tiny OpenAI-compatible mock model used by the tests. Script its replies per request.
'use strict';
const http = require('http');

function start(script) {
  const log = [];
  const server = http.createServer((req, res) => {
    let b = ''; req.on('data', d => b += d);
    req.on('end', () => {
      const body = JSON.parse(b || '{}'); log.push({ headers: req.headers, body });
      const reply = script(body, log.length) || { content: 'ok' };
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const send = o => res.write('data: ' + JSON.stringify(o) + '\n\n');
      if (reply.content) for (const piece of String(reply.content).match(/.{1,12}/gs)) send({ choices: [{ delta: { content: piece } }] });
      (reply.tool_calls || []).forEach((tc, i) => send({ choices: [{ delta: { tool_calls: [{ index: i, id: tc.id || 'call_' + i, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) }, ...(tc.extra || {}) }] } }] }));
      send({ choices: [{ delta: {}, finish_reason: reply.tool_calls ? 'tool_calls' : 'stop' }] });
      res.end('data: [DONE]\n\n');
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ url: 'http://127.0.0.1:' + server.address().port + '/v1', log, close: () => server.close() })));
}
module.exports = { start };
