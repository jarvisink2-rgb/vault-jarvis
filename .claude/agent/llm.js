// Minimal streaming client for any OpenAI-compatible /chat/completions endpoint.
// Zero dependencies — uses Node 18+ global fetch.
'use strict';

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Merge a streamed tool_call delta into the accumulated call. Unknown fields
// (e.g. Gemini's extra_content.google.thought_signature) are kept verbatim,
// because some providers require them to be sent back on the next turn.
function mergeToolCall(acc, d) {
  for (const [k, v] of Object.entries(d)) {
    if (k === 'index' || v == null) continue;
    if (k === 'function') {
      acc.function = acc.function || { name: '', arguments: '' };
      if (v.name) acc.function.name += v.name;
      if (v.arguments) acc.function.arguments += v.arguments;
    } else if (k === 'id' || k === 'type') {
      acc[k] = v;
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      acc[k] = Object.assign(acc[k] || {}, v);
    } else {
      acc[k] = v;
    }
  }
}

/**
 * Stream one completion.
 * @returns {Promise<{content: string, tool_calls: object[], finish_reason: string, usage: object|null}>}
 */
async function chat(cfg, { messages, tools, onText, signal, maxTokens }) {
  const body = {
    model: cfg.model,
    messages,
    stream: true,
  };
  if (tools && tools.length) body.tools = tools;
  if (maxTokens) body.max_tokens = maxTokens;

  const headers = { 'content-type': 'application/json' };
  if (cfg.apiKey) headers.authorization = 'Bearer ' + cfg.apiKey;
  if (cfg.provider === 'openrouter') { headers['HTTP-Referer'] = 'https://github.com/'; headers['X-Title'] = 'V.A.U.L.T. Jarvis'; }

  let res, lastErr = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      res = await fetch(cfg.baseUrl + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(body), signal });
    } catch (e) {
      if (signal && signal.aborted) throw e;
      lastErr = e.message; await sleep(1000 * 2 ** attempt); continue;
    }
    if (res.ok) break;
    lastErr = res.status + ' ' + (await res.text().catch(() => '')).slice(0, 600);
    if (!RETRY_STATUS.has(res.status)) break;
    const ra = Number(res.headers.get('retry-after'));
    await sleep(ra > 0 ? Math.min(ra, 30) * 1000 : 1500 * 2 ** attempt);
    res = null;
  }
  if (!res || !res.ok) throw new Error('LLM request failed (' + cfg.provider + ' / ' + cfg.model + '): ' + lastErr);

  let content = '', finish = '', usage = null, buf = '';
  const calls = [];
  const decoder = new TextDecoder();
  const handle = line => {
    line = line.trim();
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    let j; try { j = JSON.parse(data); } catch { return; }
    if (j.usage) usage = j.usage;
    const ch = j.choices && j.choices[0];
    if (!ch) return;
    const d = ch.delta || ch.message || {};
    if (typeof d.content === 'string' && d.content) { content += d.content; if (onText) onText(d.content); }
    if (Array.isArray(d.tool_calls)) {
      d.tool_calls.forEach((tc, n) => {
        const i = typeof tc.index === 'number' ? tc.index : n;
        calls[i] = calls[i] || { id: '', type: 'function', function: { name: '', arguments: '' } };
        mergeToolCall(calls[i], tc);
      });
    }
    if (ch.finish_reason) finish = ch.finish_reason;
  };
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 1); }
  }
  if (buf) handle(buf);

  const tool_calls = calls.filter(Boolean).map((c, i) => {
    if (!c.id) c.id = 'call_' + Date.now().toString(36) + '_' + i;
    return c;
  });
  return { content, tool_calls, finish_reason: finish, usage };
}

module.exports = { chat };
