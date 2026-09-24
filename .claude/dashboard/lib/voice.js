// Voice: text-to-speech (free Edge neural voices or ElevenLabs) and local Whisper speech-to-text.
'use strict';
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { DASH, readSettings } = require('./config');
const PY = process.env.JARVIS_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

let MsEdgeTTS = null, EDGE_FMT = null;
for (const mod of ['msedge-tts', './vendor/msedge-tts']) {   // installed package, else the bundled copy
  try { const m = require(mod); MsEdgeTTS = m.MsEdgeTTS; EDGE_FMT = m.OUTPUT_FORMAT; break; } catch {}
}
const EDGE_VOICE = process.env.EDGE_VOICE || 'en-GB-RyanNeural'; // free neural British male
// Two Mandarin options, and the choice genuinely matters:
//   zh-TW-YunJheNeural            — authentic Taiwanese Mandarin, but NOT multilingual, so an
//                                   English word inside a Chinese sentence comes out mangled.
//   zh-CN-YunyiMultilingualNeural — code-switches natively (Azure "multilingual" voices speak the
//                                   auto-detected language of the input), at the cost of a
//                                   Mainland accent. There is no zh-TW multilingual voice.
const EDGE_VOICE_ZH = process.env.EDGE_VOICE_ZH || 'zh-TW-YunJheNeural';
const EDGE_VOICE_ZH_MIX = process.env.EDGE_VOICE_ZH_MIX || 'zh-CN-YunyiMultilingualNeural';
const hasCJK = t => /[一-鿿]/.test(t);
// "Boss", "sir" and "Jarvis" appear in almost every Chinese line and both voices say them
// fine — if they counted as English, auto mode would never pick the Taiwanese voice.
const OWNER_RE = new RegExp('\\b(boss|sir|jarvis|ok|okay|' + readSettings().ownerName.replace(/[^\w ]/g, '').split(/\s+/).filter(Boolean).join('|') + ')\\b', 'gi');
const hasLatin = t => /[A-Za-z]{2,}/.test(String(t).replace(OWNER_RE, ''));
// Voice is chosen from the CONVERSATION language, never per fragment. Choosing per fragment made
// a single reply flip between a British and a Mandarin voice mid-thought.
function pickVoice(text, lang, mode) {
  const zh = lang === 'zh' || (lang !== 'en' && hasCJK(text));
  if (!zh) return EDGE_VOICE;
  if (mode === 'tw') return EDGE_VOICE_ZH;          // he chose accent over pronunciation
  if (mode === 'mix') return EDGE_VOICE_ZH_MIX;     // he chose pronunciation over accent
  return hasLatin(text) ? EDGE_VOICE_ZH_MIX : EDGE_VOICE_ZH;   // auto: switch only when needed
}
async function edgeTts(text, res, lang, mode) {
  const t = new MsEdgeTTS();
  await t.setMetadata(pickVoice(text, lang, mode), EDGE_FMT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const st = t.toStream(text.slice(0, 600));
  const stream = st.audioStream || st;
  res.writeHead(200, { 'content-type': 'audio/mpeg' });
  stream.on('data', d => res.write(d));
  stream.on('end', () => { try { res.end(); } catch {} try { t.close(); } catch {} });
  stream.on('error', () => { try { res.end(); } catch {} });
}

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVEN_VOICE = process.env.ELEVEN_VOICE_ID || 'onwK4e9ZLuTAKqWW03F9'; // "Daniel" — deep, refined British
async function tts(text, res, lang, mode) {
  if (!ELEVEN_KEY && MsEdgeTTS) { try { return await edgeTts(text, res, lang, mode); } catch (e) { try { res.writeHead(500); return res.end('tts-fail'); } catch {} return; } }
  if (!ELEVEN_KEY) { res.writeHead(404); return res.end('no-key'); }
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + ELEVEN_VOICE + '/stream?output_format=mp3_22050_32', {
      method: 'POST',
      headers: { 'xi-api-key': ELEVEN_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 600), model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25 } })
    });
    if (!r.ok) { res.writeHead(502); return res.end('tts-error ' + r.status); }
    res.writeHead(200, { 'content-type': 'audio/mpeg' });
    const reader = r.body.getReader();
    while (true) { const { done, value } = await reader.read(); if (done) break; res.write(Buffer.from(value)); }
    res.end();
  } catch (e) { try { res.writeHead(500); res.end('tts-fail'); } catch {} }
}


// ---------- Whisper ears (local STT sidecar) ----------
let whisperChild = null, whisperReady = false;
function startWhisper() {
  // Python is optional: a missing interpreter must never take the server down (spawn emits 'error', not an exception).
  let probe;
  try { probe = spawn(PY, ['-c', 'import faster_whisper'], { stdio: 'ignore' }); } catch { return; }
  let noPython = false;
  probe.on('error', () => { noPython = true; console.log('🎧 Whisper ears unavailable (no Python found) — browser speech recognition will be used.'); });
  probe.on('close', code => {
    if (noPython) return;
    if (code !== 0) { console.log('🎧 Whisper ears not installed — enable with: pip3 install faster-whisper'); return; }
    whisperChild = spawn(PY, [path.join(DASH, 'whisper_server.py')], { stdio: ['ignore', 'pipe', 'pipe'] });
    whisperChild.stdout.on('data', d => { if (String(d).includes('[whisper] ready')) { whisperReady = true; console.log('🎧 Whisper ears ready'); } });
    whisperChild.stderr.on('data', () => {});
    whisperChild.on('error', () => { whisperChild = null; whisperReady = false; });
    whisperChild.on('close', () => { whisperChild = null; whisperReady = false; });
  });
}
function sttProxy(body, res, lang) {
  if (!whisperReady) { res.writeHead(503, { 'content-type': 'application/json' }); return res.end('{"text":null,"error":"whisper-offline"}'); }
  const rq = http.request({ host: '127.0.0.1', port: 3334, method: 'POST', headers: { 'content-length': body.length, 'x-lang': lang || 'auto' } }, r2 => {
    res.writeHead(200, { 'content-type': 'application/json' }); r2.pipe(res); });
  rq.on('error', () => { try { res.writeHead(503); res.end('{"text":null}'); } catch {} });
  rq.end(body);
}


module.exports = { PY, tts, startWhisper, sttProxy, isWhisperReady: () => whisperReady, stopWhisper: () => { if (whisperChild) try { whisperChild.kill(); } catch {} } };
