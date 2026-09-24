
var SKILLS = __SKILLS__, KEY = '__KEY__', OWNER = __OWNER__;
(function(){ var _f = window.fetch; window.fetch = function(u, o){ o = o || {}; var h = o.headers || {}; h['x-key'] = KEY; o.headers = h; return _f(u, o); }; })();
// The key arrived in the URL (phone link) — the server set a strict cookie, so take it out of the address bar/history.
if (/[?&]key=/.test(location.search)) { try { history.replaceState(null, '', location.pathname); } catch (e) {} }
// Built-in lines are written for "Boss"/"sir"; swap in the configured owner at runtime (data, not source rewriting).
function H(t){ if (typeof t !== 'string') return t;
  return t.replace(/\bBoss\b/g, function(){ return OWNER.name; }).replace(/\b(sir|Sir)\b/g, function(m){ var w = OWNER.sir; return m === 'Sir' ? w.charAt(0).toUpperCase() + w.slice(1) : w; }); }
function Hdeep(o){ for (var k in o){ if (typeof o[k] === 'string') o[k] = H(o[k]); else if (o[k] && typeof o[k] === 'object') Hdeep(o[k]); } return o; }
var THEMES = {
  dark: { light: false, p: '79,209,224', pB: '127,227,238', pBB: '184,244,251', a: '79,209,224', aB: '127,227,238', star: '150,215,225', nuc: '184,244,251',
    core: { b: '30,110,122', m: '79,209,224', h: '184,244,251' },
    vars: { '--bg-base': '#0B0D10', '--bg-deep': '#06070A',
            '--surface': 'rgba(255,255,255,0.05)', '--surface-hover': 'rgba(255,255,255,0.09)', '--border-soft': 'rgba(255,255,255,0.07)',
            '--text-primary': '#F2F4F7', '--text-secondary': '#A6ADBB', '--text-muted': '#7C8391',
            '--accent': '#4FD1E0', '--accent-strong': '#7FE3EE', '--accent-soft': 'rgba(79,209,224,0.15)', '--accent-glow': 'rgba(79,209,224,0.35)',
            '--success': '#4ADE80', '--warning': '#FBBF24', '--error': '#F87171', '--warm': '79,209,224', '--on-accent': '#06070A' },
    bodyBg: 'radial-gradient(1200px 700px at 50% 34%,#0B0D10 0%,#08090b 55%,#06070A 100%) #06070A' },
  light: { light: true, p: '14,143,163', pB: '10,113,133', pBB: '179,224,230', a: '14,143,163', aB: '10,113,133', star: '120,180,190', nuc: '179,224,230',
    core: { b: '10,70,80', m: '14,143,163', h: '179,224,230' },
    vars: { '--bg-base': '#F5F6F8', '--bg-deep': '#E9EBEF',
            '--surface': 'rgba(255,255,255,0.65)', '--surface-hover': 'rgba(0,0,0,0.05)', '--border-soft': 'rgba(0,0,0,0.07)',
            '--text-primary': '#14171C', '--text-secondary': '#4A5160', '--text-muted': '#69707C',
            '--accent': '#0E8FA3', '--accent-strong': '#0A7185', '--accent-soft': 'rgba(14,143,163,0.14)', '--accent-glow': 'rgba(14,143,163,0.25)',
            '--success': '#15803D', '--warning': '#B45309', '--error': '#B91C1C', '--warm': '14,143,163', '--on-accent': '#F5F6F8' },
    bodyBg: 'radial-gradient(1200px 700px at 50% 34%,#F5F6F8 0%,#EEF0F2 55%,#E9EBEF 100%) #E9EBEF' }
};
var T = THEMES.dark;
function applyTheme(name){ T = THEMES[name] || THEMES.dark;
  for (var k in T.vars) document.documentElement.style.setProperty(k, T.vars[k]);
  document.body.style.background = T.bodyBg;
  document.body.classList.toggle('light', !!T.light);
  localStorage.setItem('jarvis_theme', name); }

var feed = document.getElementById('feed'), txt = document.getElementById('txt'), mic = document.getElementById('mic');
var stCore = document.getElementById('stCore'), stAud = document.getElementById('stAud'), vsel = document.getElementById('vsel');
var state = 'idle', speakingText = '', controller = null, pendingCtx = [], lastActivity = Date.now(), lastNudge = 0, lastNudgeText = '', neural = true, ttsFails = 0, audioPlaying = false, ttsQ = [], curAudio = null;
/* ---------- language: auto | en | zh ---------- */
var lang = localStorage.getItem('jarvis_lang') || 'auto';
function hasCJK(t){ return /[一-鿿]/.test(t || ''); }
function syncLangUI(){ Array.prototype.forEach.call(document.querySelectorAll('.lrow'), function(r){
  var on = r.getAttribute('data-l') === lang;
  r.style.color = on ? 'var(--accent)' : ''; r.style.fontWeight = on ? '600' : ''; }); }
/* ---------- full-page i18n ---------- */
var UI = {
en:{ core:{idle:'IDLE',listening:'LISTENING',thinking:'PROCESSING',speaking:'SPEAKING'}, audio:'AUDIO', audOff:'OFF — CLICK', audOn:'ON',
  h3vitals:'SYSTEM VITALS', h3exams:'EXAM COUNTDOWN', h3dirs:'DIRECTIVES <span style="color:var(--text-muted);opacity:.7">/ TO DO</span>', h3ops:'OPS / SKILLS', h3docs:'DOCUMENTS <span style="color:var(--text-muted);opacity:.7">/ RECENT</span>',
  prime:'PRIMARY DIRECTIVE — KNOWLEDGE BASE', notes:'NOTES', words:'WORDS',
  vit:['NOTES IN VAULT','WIKILINKS','WIKI ARTICLES','OUTPUT SHIPPED','INBOX PENDING'],
  micOff:'◉ MIC OFF', micWake:'◉ WAKE “JARVIS”', micOn:'◉ CONVO ON', recOff:'OFF', recStandby:'STANDBY', recLive:'LIVE',
  ph:'Speak or type, Boss…', send:'EXECUTE', today:'TODAY', dsuf:'D', none:'— none —', noneSched:'— none scheduled —', copied:'Copied, Boss.', noTs:'install Tailscale — see README',
  labLang:'LANGUAGE', labTheme:'THEME', labZhVoice:'MANDARIN VOICE', labVoice:'FALLBACK VOICE', labPhone:'PHONE (SAME WI-FI)', labRemote:'PHONE (ANYWHERE)', skills:null,
  btnSearch:'⌕ SEARCH', btnGraph:'◈ GRAPH', ovclose:'✕ CLOSE', ovback:'‹ BACK',
  panHide:'Hide this panel', panShow:'Show this panel', feedClear:'Clear the conversation',
  h3folders:'GRANTED FOLDERS', btnGrant:'+ GRANT FOLDER', gRead:'READ', gRW:'R/W', gMissing:'MISSING', gNone:'— none granted —',
  gToggle:'Click to switch between read-only and read+write', gRevoke:'Revoke access', gRevokeAsk:'Revoke Jarvis’s access to this folder?',
  gAsk:'Folder to grant Jarvis (e.g. ~/Documents or ~/Desktop):', gBad:'That is not a folder, Boss:',
  loading:'OPENING…', notfound:'NOT IN THE VAULT, BOSS', vsearch:'VAULT SEARCH', searchPh:'Search every note, Boss… (⌘K)',
  nohits:'— nothing matches —', graph:'LINK GRAPH', ghint:'DRAG A NODE · CLICK TO OPEN · ESC TO CLOSE' },
zh:{ core:{idle:'待命',listening:'聆聽中',thinking:'處理中',speaking:'說話中'}, audio:'語音', audOff:'關 — 點擊', audOn:'開',
  h3vitals:'系統狀態', h3exams:'考試倒數', h3dirs:'今日指令 <span style="color:var(--text-muted);opacity:.7">/ TO DO</span>', h3ops:'技能 / 操作', h3docs:'文件 <span style="color:var(--text-muted);opacity:.7">/ 最近</span>',
  prime:'主要任務 — 知識庫', notes:'篇筆記', words:'字',
  vit:['筆記總數','雙向連結','維基文章','成品輸出','收件待處理'],
  micOff:'◉ 麥克風關', micWake:'◉ 喚醒「賈維斯」', micOn:'◉ 對話模式', recOff:'關', recStandby:'待喚醒', recLive:'聆聽',
  ph:'說話或輸入，Boss…', send:'執行', today:'今天', dsuf:'天', none:'— 無 —', noneSched:'— 尚無安排 —', copied:'已複製，Boss。', noTs:'請安裝 Tailscale — 見 README',
  labLang:'語言', labTheme:'主題', labZhVoice:'中文語音', labVoice:'備用語音', labPhone:'手機（同 Wi-Fi）', labRemote:'手機（任何地方）',
  btnSearch:'⌕ 搜尋', btnGraph:'◈ 關聯圖', ovclose:'✕ 關閉', ovback:'‹ 返回',
  panHide:'收起這個面板', panShow:'展開這個面板', feedClear:'清除對話',
  h3folders:'已授權資料夾', btnGrant:'+ 授權資料夾', gRead:'唯讀', gRW:'讀寫', gMissing:'找不到', gNone:'— 尚未授權 —',
  gToggle:'點擊切換唯讀／讀寫', gRevoke:'取消授權', gRevokeAsk:'要取消 Jarvis 對這個資料夾的存取權嗎？',
  gAsk:'要授權給 Jarvis 的資料夾（例如 ~/Documents 或 ~/Desktop）：', gBad:'那不是資料夾，Boss：',
  loading:'開啟中…', notfound:'筆記庫裡沒有這一篇，Boss', vsearch:'全庫搜尋', searchPh:'搜尋所有筆記，Boss…（⌘K）',
  nohits:'— 沒有符合的內容 —', graph:'筆記關聯圖', ghint:'拖曳節點 · 點擊開啟 · ESC 關閉',
  skills:{'quiz':'互動學習','past-paper':'模擬考卷','mark':'批改作業','night-review':'晚間回顧','morning-report':'晨間報告','inbox':'信箱簡報','draft-reply':'草擬回信','deep-research':'深度研究','process-inbox':'處理收件匣','link':'連結筆記','organize':'整理檔案','index':'重建索引','weekly-plan':'週計畫','gap-audit':'進度差距審查','calendar':'行事曆簡報','review':'複習卷'} }
};
Hdeep(UI);
/* Mandarin voice: auto = Taiwanese unless the line contains English, then a bilingual voice.
   tw = always Taiwanese (best accent, mangles English). mix = always bilingual (correct English,
   Mainland accent). There is no Taiwanese multilingual voice, so this trade-off is his to make. */
var zhVoiceMode = localStorage.getItem('jarvis_zhvoice') || 'auto';
function syncZhVoice(){ Array.prototype.forEach.call(document.querySelectorAll('.zrow'), function(r){
  var on = r.getAttribute('data-z') === zhVoiceMode;
  r.style.color = on ? 'var(--accent)' : ''; r.style.fontWeight = on ? '600' : ''; }); }
function UIt(){ return lang === 'zh' ? UI.zh : UI.en; }
function applyLang(){ var t = UIt();
  ['h3vitals','h3exams','h3dirs','h3ops','h3docs','h3folders'].forEach(function(id){ var el = document.getElementById(id); if (el && t[id]) el.innerHTML = t[id]; });
  if (typeof loadFolders === 'function') loadFolders();
  ['labLang','labTheme','labZhVoice','labVoice','labPhone','labRemote'].forEach(function(id){ var el = document.getElementById(id); if (el && t[id]) el.textContent = t[id]; });
  [['btnSearch','btnSearch'],['btnGraph','btnGraph'],['ovclose','ovclose'],['ovback','ovback']].forEach(function(p){
    var el = document.getElementById(p[0]); if (el && t[p[1]]) el.textContent = t[p[1]]; });
  var el;
  if ((el = document.getElementById('primeLab'))) el.textContent = t.prime;
  if ((el = document.getElementById('notesLab'))) el.textContent = t.notes;
  if ((el = document.getElementById('wordsLab'))) el.textContent = t.words;
  if ((el = document.getElementById('audLab'))) el.textContent = t.audio;
  if (!audioOn && stAud) stAud.textContent = t.audOff;
  txt.placeholder = t.ph;
  document.getElementById('send').textContent = t.send;
  if (feedX) feedX.title = t.feedClear;
  if (typeof syncPanels === 'function') syncPanels();
  setState(state); syncMicUI(); syncLangUI(); renderOps(); loadStats(); }

function setState(s){ state = s; stCore.textContent = UIt().core[s] || UIt().core.idle; }
/* ================= VOICE OUT ================= */
var audioOn = false, voice = null, zhVoice = null;
function fillVoices(){ var all = speechSynthesis.getVoices();
  zhVoice = all.find(function(v){ return /^zh[-_]?(TW|HK)/i.test(v.lang); }) || all.find(function(v){ return /^zh/i.test(v.lang); }) || null;
  var vs = all.filter(function(v){ return /^(en|zh)/i.test(v.lang); });
  vsel.innerHTML = vs.map(function(v,i){ return '<option value="' + v.name.replace(/"/g,'') + '">' + v.name + '</option>'; }).join('');
  var saved = localStorage.getItem('jarvis_voice');
  var pref = vs.find(function(v){ return v.name === saved; }) ||
             vs.find(function(v){ return /Google UK English Male/i.test(v.name); }) ||
             vs.find(function(v){ return /Daniel/i.test(v.name); }) ||
             vs.find(function(v){ return /en-GB/i.test(v.lang); }) || vs[0] || null;
  voice = pref; if (pref) vsel.value = pref.name; }
if ('speechSynthesis' in window){ speechSynthesis.onvoiceschanged = fillVoices; fillVoices(); }
vsel.onchange = function(){ var v = speechSynthesis.getVoices().find(function(x){ return x.name === vsel.value; });
  if (v){ voice = v; localStorage.setItem('jarvis_voice', v.name); speak('Voice calibrated, Boss.'); } };
function unlockAudio(){ if (audioOn || !('speechSynthesis' in window)) return;
  audioOn = true; stAud.textContent = UIt().audOn; var ah = document.getElementById('audhint'); if (ah) ah.style.opacity = '.35'; fillVoices();
  speak('Jarvis online.');
  fetch('/greet?lang=' + lang).then(function(r){ return r.json(); }).then(function(j){ if (j.text){ speak(j.text); pendingCtx.push(j.text); } }).catch(function(){}); }
document.addEventListener('click', function(){ unlockAudio(); if (micMode > 0 && !micStream) startMic(); });
function stopSpeaking(){ speechSynthesis.cancel(); ttsQ = []; if (curAudio){ try{ curAudio.pause(); }catch(e){} curAudio = null; } audioPlaying = false; speakingText = ''; if (state === 'speaking') setState('idle'); }
function cleanForSpeech(t){ return t.replace(/[*_#>\`~]|\[\[|\]\]/g, '').replace(/https?:\/\/\S+/g, 'link'); }
function playNext(){ if (audioPlaying || !ttsQ.length) return;
  var item = ttsQ.shift(); audioPlaying = true; if (state !== 'listening') setState('speaking');
  fetch('/tts', { method: 'POST', headers: {'content-type':'application/json'},
      body: JSON.stringify({ t: item, lang: zhMode(item) ? 'zh' : 'en', mode: zhVoiceMode }) })
    .then(function(r){ if (!r.ok){ neural = (r.status !== 404); throw new Error('tts'); } return r.blob(); })
    .then(function(b){ ttsFails = 0; curAudio = new Audio(URL.createObjectURL(b));
      curAudio.onended = function(){ audioPlaying = false; curAudio = null;
        if (!ttsQ.length){ speakingText = ''; if (state === 'speaking') setState('idle'); if (micMode === 1) activeUntil = Date.now() + 8000; } playNext(); };
      curAudio.play().catch(function(){ audioPlaying = false; playNext(); }); })
    .catch(function(){ audioPlaying = false; ttsFails++; if (ttsFails >= 2) neural = false; sysSpeak(item); playNext(); }); }
function sysSpeak(sent){ var u = new SpeechSynthesisUtterance(sent);
  // same rule as the neural path: decide from the conversation, not from this fragment
  if (zhMode(sent) && zhVoice) u.voice = zhVoice; else if (voice) u.voice = voice;
  u.lang = zhMode(sent) ? 'zh-TW' : 'en-GB';
  u.rate = 1.0; u.pitch = 0.93;
  u.onstart = function(){ if (state !== 'listening') setState('speaking'); };
  u.onend = function(){ setTimeout(function(){ if (!speechSynthesis.speaking && !speechSynthesis.pending && !audioPlaying && !ttsQ.length){ speakingText = ''; if (state === 'speaking') setState('idle'); if (micMode === 1) activeUntil = Date.now() + 8000; } }, 150); };
  speechSynthesis.speak(u); }
function speakSent(sent){ if (!audioOn) return; sent = cleanForSpeech(sent).trim(); if (!sent) return;
  speakingText = (speakingText + ' ' + sent.toLowerCase()).slice(-800);
  globeWave(0.55); // one ripple per sentence he speaks
  if (neural){ ttsQ.push(sent); playNext(); } else sysSpeak(sent); }
function speak(text){ text = H(text); if (!audioOn) return; speechSynthesis.cancel(); speakingText = '';
  var parts = cleanForSpeech(text).match(/[^.!?。！？\n]+[.!?。！？\n]*/g) || [text];
  parts.slice(0, 20).forEach(function(p){ speakSent(p); }); }
/* ================= FEED / ASK ================= */
function nearBottom(){ return feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80; }
function autoScroll(force){ if (force || nearBottom()) feed.scrollTop = feed.scrollHeight; }
function add(cls, t){ if (cls === 'j') t = H(t); if (typeof syncFeed === 'function') setTimeout(syncFeed, 0);
  var d = document.createElement('div'); d.className = cls; d.textContent = t;
  var f = nearBottom(); feed.appendChild(d); autoScroll(f || cls === 'u'); while (feed.children.length > 40) feed.removeChild(feed.firstChild); return d; }
async function stream(url, bodyObj, node, onDelta){ if (controller) controller.abort(); controller = new AbortController();
  var full = '';
  try { var r = await fetch(url, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(bodyObj), signal: controller.signal });
    var rd = r.body.getReader(), dec = new TextDecoder();
    while (true){ var c = await rd.read(); if (c.done) break; var nb = nearBottom(); full += dec.decode(c.value); node.textContent = full; autoScroll(nb); if (onDelta) onDelta(full); }
  } catch(e){ if (e.name === 'AbortError'){ node.textContent += ' — interrupted.'; return null; } node.textContent = 'Error: ' + e.message; }
  return full; }
var ACKS = ['Right away, Boss.', 'As you wish.', 'On it, sir.', 'One moment, Boss.', 'Working on it now.', 'Let me have a look, sir.', 'Ah. Let me pull that up.', 'Checking now, Boss.', 'Very good, sir — one moment.'];
var ACKS_ZH = ['馬上就來，Boss。', '遵命。', '我看看，Boss。', '稍等一下，Boss。', '這就去辦。'];
ACKS = ACKS.map(H); ACKS_ZH = ACKS_ZH.map(H);
function zhMode(q){ return lang === 'zh' || (lang === 'auto' && hasCJK(q)); }
async function ask(q){ q = (q || '').trim(); if (!q) return;
  lastActivity = Date.now();
  unlockAudio(); stopSpeaking(); add('u', q); txt.value = ''; txt.style.height = ''; setState('thinking');
  globePulse(1); // the core takes the command
  var zh = zhMode(q);
  if (audioOn && (q.split(/\s+/).length > 3 || (zh && q.length > 6))) speakSent(zh ? ACKS_ZH[(Math.random() * ACKS_ZH.length) | 0] : ACKS[(Math.random() * ACKS.length) | 0]);
  var node = add('j', '…'), spoken = 0;
  function onDelta(full){ // speak completed sentences immediately while the rest streams
    var m; var re = /[^.!?。！？\n]+[.!?。！？\n]+/g; re.lastIndex = 0; var text = full;
    var out = []; var idx = 0;
    while ((m = re.exec(text)) !== null){ if (m.index + m[0].length <= spoken) continue; if (m.index >= spoken){ out.push(m[0]); idx = m.index + m[0].length; } }
    if (out.length){ spoken = idx; out.forEach(speakSent); } }
  var ctx = pendingCtx.join(' '); pendingCtx = [];
  var full = await stream('/ask', { q: q, ctx: ctx, lang: lang }, node, onDelta);
  if (full === null) return;
  if (full && full.length > spoken) speakSent(full.slice(spoken)); // tail without punctuation
  if (state === 'thinking') setState('idle'); loadStats(); }
async function runSkill(s){ lastActivity = Date.now(); unlockAudio(); var input = '';
  if (s.input){ input = prompt(s.input) || ''; if (!input.trim()) return; }
  globePulse(1.6); // protocols hit harder than questions
  if (s.id === 'quiz'){ // interactive study runs through the live conversation, not a headless job
    ask('STUDY MODE: quiz me on ' + input + '. Follow .claude/skills/quiz-me/SKILL.md exactly — read my notes on the topic first, then ONE question at a time and wait for my answer.');
    return; }
  stopSpeaking(); add('u', 'EXECUTE ' + s.label + (input ? ' ▸ ' + input : '')); setState('thinking');
  opBusy(s.id, true); // the chip shimmers while its protocol runs
  var node = add('j', 'As you wish, Boss — running the ' + s.label.toLowerCase() + ' protocol…');
  var full = await stream('/run', { id: s.id, input: input }, node);
  opBusy(s.id, false);
  if (full === null) return; setState('idle'); var lbl = s.label.toLowerCase();
  var DONE = lang === 'zh'
    ? [lbl + ' 完成了，Boss。還需要什麼嗎？', '都辦妥了，Boss — ' + lbl + ' 已就緒。', lbl + ' 搞定，Boss。']
    : ['All wrapped up, Boss. Will there be anything else?', lbl + ' complete, sir.', 'That\u2019s ' + lbl + ' done, Boss. Anything else while I\u2019m warm?', 'As requested, Boss — ' + lbl + ' is in.', lbl + ' protocol complete, sir. Will there be anything else?'];
  speak(DONE[(Math.random() * DONE.length) | 0]); pendingCtx.push('I just ran ' + s.label + ' for you.'); loadStats(); }
document.getElementById('send').onclick = function(){ ask(txt.value); };
/* IME-safe Enter: while composing Chinese (choosing 是 vs 事), Enter confirms the characters — only a plain Enter sends */
var composing = false;
txt.addEventListener('compositionstart', function(){ composing = true; });
txt.addEventListener('compositionend', function(){ setTimeout(function(){ composing = false; }, 0); });
txt.addEventListener('keydown', function(e){
  if (e.key !== 'Enter') return;
  if (composing || e.isComposing || e.keyCode === 229) return; // IME is picking characters — don't send
  if (e.shiftKey) return; // Shift+Enter inserts a newline in the (now multi-line-capable) box
  e.preventDefault();
  ask(txt.value); });
/* auto-grow the input box (textarea now, was a single-line input) up to a CSS-capped height —
   capped small on desktop (no visible change there) and taller on mobile (~4 lines) */
function growTxt(){ txt.style.height = 'auto'; txt.style.height = Math.min(txt.scrollHeight, 96) + 'px'; }
txt.addEventListener('input', growTxt);
/* iOS Safari doesn't reliably reposition position:fixed elements when the on-screen keyboard
   opens — they can end up hidden behind it, showing as a black gap above the keyboard. Track
   how much of the screen the keyboard covers via VisualViewport and push the fixed bottom bar
   / chat box up by that amount. */
if (window.visualViewport){
  var syncKb = function(){
    var vv = window.visualViewport;
    var covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', covered + 'px');
  };
  window.visualViewport.addEventListener('resize', syncKb);
  window.visualViewport.addEventListener('scroll', syncKb);
  syncKb();
}
/* ================= VOICE IN: wake word + Whisper ears (SR fallback) ================= */
var micMode = 0; // 0 off · 1 standby (wake word) · 2 convo (always on)
var whisperOK = false, activeUntil = 0, lastSub = '', lastSubT = 0, hearNode = null;
var stRec = document.getElementById('stRec');
function showHeard(t){ if (!hearNode || !hearNode.parentNode){ hearNode = add('i', ''); } hearNode.textContent = t; }
function clearHeard(){ if (hearNode && hearNode.parentNode) hearNode.parentNode.removeChild(hearNode); hearNode = null; }
function similar(a, b){ a = a.toLowerCase().split(/\s+/); b = (b || '').toLowerCase();
  var hits = 0; a.forEach(function(w){ if (b.indexOf(w) !== -1) hits++; }); return a.length && hits / a.length > 0.7; }
function isEcho(t){ if (!speakingText) return false;
  var w = t.toLowerCase().split(/\s+/).filter(Boolean); if (!w.length) return false;
  var hits = 0; w.forEach(function(x){ if (speakingText.indexOf(x) !== -1) hits++; });
  return hits / w.length > 0.6; }
var WAKE = /^\s*(?:hey\s+|ok\s+|嘿[，,]?\s*|喂[，,]?\s*)?(?:(?:jarvis|jervis|jarvus|garvis|travis)\b|賈維斯|贾维斯|傑維斯|佳維斯|加維斯)[,.!?，。！？]*\s*(.*)$/i;
function handleUtterance(t){ t = (t || '').trim(); if (!t) return;
  clearHeard();
  if (isEcho(t)) return;
  if (Date.now() - lastSubT < 6000 && similar(t, lastSub)) return;
  var m = t.match(WAKE);
  if (m) globeWake(); // called by name — the core snaps awake
  if (micMode === 1){
    if (m){ activeUntil = Date.now() + 15000; var rest = m[1].trim();
      if (rest){ lastSub = t; lastSubT = Date.now(); ask(rest); } else speak(['Yes, Boss?', 'Sir?', 'At your service, Boss.', 'Listening, Boss.'][(Math.random() * 4) | 0]); }
    else if (Date.now() < activeUntil){ activeUntil = Date.now() + 15000; lastSub = t; lastSubT = Date.now(); ask(t); }
    return; }
  if (micMode === 2){ var q = m ? (m[1].trim() || t) : t; lastSub = t; lastSubT = Date.now(); ask(q); } }
function bargeIn(){ if (state === 'thinking'){ if (controller) controller.abort(); fetch('/stop', { method: 'POST' }); }
  stopSpeaking(); setState('listening'); }
/* ---------- mic + level meter + VAD ---------- */
var micStream = null, audioCtx = null, analyser = null, tdBuf = null;
var vRec = null, vChunks = [], speechOn = false, loudSince = 0, lastLoud = 0, rollStart = 0, speechStart = 0;
function startRolling(){ if (!whisperOK || !micStream) return;
  if (vRec && vRec.state !== 'inactive'){ try { vRec.stop(); } catch (e) {} }
  try { var mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
    (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
    vChunks = []; vRec = new MediaRecorder(micStream, mime ? { mimeType: mime } : undefined);
    vRec.ondataavailable = function(e){ if (e.data && e.data.size) vChunks.push(e.data); };
    rollStart = Date.now(); vRec.start(250); // always rolling → utterances captured from the very first syllable
  } catch (e) { vRec = null; } }
function utteranceEnd(){ if (!vRec) return;
  var dur = lastLoud - speechStart, myChunks = vChunks, myType = vRec.mimeType || 'audio/webm';
  try { vRec.requestData(); } catch (e) {}
  setTimeout(function(){ var blob = new Blob(myChunks, { type: myType });
    startRolling(); // fresh tape for the next utterance
    if (dur < 200 || blob.size < 1500) return;   // was 300/3000 — that discarded short commands like "停" or "yes"
    stRec.textContent = 'HEARING…'; showHeard('…');
    fetch('/stt', { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-lang': lang }, body: blob })
      .then(function(r){ if (!r.ok) throw 0; return r.json(); })
      .then(function(j){ stRec.textContent = micMode === 1 ? 'STANDBY' : 'LIVE';
        if (j.text){ showHeard(j.text); setTimeout(function(){ handleUtterance(j.text); }, 60); } else clearHeard(); })
      .catch(function(){ whisperOK = false; clearHeard(); srSync(); }); }, 160); }
function startMic(){ if (micStream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    if (!window.__micWarned){ window.__micWarned = 1; add('j', 'Voice on the phone needs the secure link, Boss — run "tailscale serve --bg 3333" on the Mac once and use the https address it prints.'); }
    return; }
  // Noise suppression and auto-gain are tuned for phone calls: they chew consonants and
  // pump quiet speech, which is exactly what wrecks Whisper's accuracy. Echo cancellation
  // stays on — he plays replies through speakers and we must not transcribe Jarvis.
  navigator.mediaDevices.getUserMedia({ audio: {
    echoCancellation: true, noiseSuppression: false, autoGainControl: false, channelCount: 1 } })
  .then(function(st){ micStream = st;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var src = audioCtx.createMediaStreamSource(st); analyser = audioCtx.createAnalyser(); analyser.fftSize = 512; src.connect(analyser);
    tdBuf = new Uint8Array(analyser.fftSize);
    if (whisperOK) startRolling();
    var lvl = document.getElementById('lvl');
    (function loop(){ if (!micStream){ if (lvl) lvl.style.width = '0%'; return; }
      analyser.getByteTimeDomainData(tdBuf);
      var sum = 0; for (var i = 0; i < tdBuf.length; i++){ var v = (tdBuf[i] - 128) / 128; sum += v * v; }
      var rms = Math.sqrt(sum / tdBuf.length);
      if (lvl) lvl.style.width = Math.min(100, Math.round(rms * 320)) + '%';
      var talkingBack = (audioPlaying || speechSynthesis.speaking);
      var TH = talkingBack ? 0.055 : 0.022;
      var now = Date.now();
      if (rms > TH){ lastLoud = now; if (!loudSince) loudSince = now;
        if (!speechOn && now - loudSince > 120){ speechOn = true; speechStart = now; if (!vRec) startRolling();
          if (micMode > 0 && (state === 'speaking' || state === 'thinking')) bargeIn();
          stRec.textContent = 'SPEECH'; } }
      else { loudSince = 0;
        // 750 ms cut him off mid-sentence: Mandarin clause pauses routinely exceed it.
        if (speechOn && now - lastLoud > 1100){ speechOn = false; utteranceEnd(); }
        else if (!speechOn && vRec && now - rollStart > 15000) startRolling(); }
      requestAnimationFrame(loop); })();
  }).catch(function(e){ if (!window.__micWarned){ window.__micWarned = 1; add('j', 'Tap anywhere once and allow the microphone, Boss.'); } }); }
function stopMic(){ if (vRec && vRec.state !== 'inactive'){ try { vRec.stop(); } catch (e) {} } vRec = null;
  if (micStream){ micStream.getTracks().forEach(function(t){ t.stop(); }); micStream = null; } speechOn = false; }
/* ---------- Chrome SR fallback (when Whisper offline) ---------- */
var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, srOn = false, silTimer = null, pending = '';
if (SR){ rec = new SR(); rec.lang = lang === 'zh' ? 'zh-TW' : 'en-US'; rec.continuous = true; rec.interimResults = true;
  rec.onresult = function(e){ var interim = '', finals = '';
    for (var i = e.resultIndex; i < e.results.length; i++){ var t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finals += t + ' '; else interim += t; }
    var probe = (finals || interim).trim();
    if ((state === 'speaking' || state === 'thinking') && probe.split(/\s+/).length >= 2 && !isEcho(probe)) bargeIn();
    if (finals.trim()){ pending = ''; clearTimeout(silTimer); handleUtterance(finals.trim()); return; }
    if (interim.trim()){ pending = interim.trim(); showHeard(pending + ' …'); clearTimeout(silTimer);
      silTimer = setTimeout(function(){ var p = pending; pending = ''; handleUtterance(p); }, 650); } };
  rec.onerror = function(e){ if (e.error === 'not-allowed'){ micMode = 0; syncMicUI(); add('j', 'Microphone blocked — allow it in Chrome, Boss.'); } };
  rec.onend = function(){ srOn = false; srSync(); }; }
function srSync(){ var want = micMode > 0 && !whisperOK && rec;
  if (want && !srOn){ try { rec.start(); srOn = true; } catch (e) {} }
  if (!want && srOn){ try { rec.stop(); } catch (e) {} srOn = false; } }
setInterval(srSync, 3000);
/* ---------- mode button ---------- */
function syncMicUI(){
  mic.classList.toggle('on', micMode === 2);
  mic.classList.toggle('standby', micMode === 1);
  mic.textContent = micMode === 0 ? UIt().micOff : micMode === 1 ? UIt().micWake : UIt().micOn;
  stRec.textContent = micMode === 0 ? UIt().recOff : micMode === 1 ? UIt().recStandby : UIt().recLive;
  try { localStorage.setItem('jarvis_mic', micMode); } catch(e){}
  if (micMode > 0){ startMic(); } else { stopMic(); stopSpeaking(); setState('idle'); }
  srSync(); }
mic.onclick = function(){
  if (window.innerWidth <= 768) return; // phone UI: typing-only, never request the mic
  unlockAudio(); globePulse(0.6); micMode = (micMode + 1) % 3;
  if (micMode === 1) speak('As you wish, Boss. On standby — just say Jarvis when you need me.');
  else if (micMode === 2) speak('Conversation mode engaged, Boss. I am all ears.');
  else stopSpeaking();
  syncMicUI(); };
// Phone UI: force mic off and ignore any previously-persisted mode — no mic permission prompt, typing-only.
micMode = (window.innerWidth <= 768) ? 0 : Math.min(2, parseInt(localStorage.getItem('jarvis_mic') || '0', 10) || 0);
syncMicUI();
/* ================= PANELS ================= */
var ops = document.getElementById('ops');
var GLYPH = { quiz:'◈', 'past-paper':'▤', mark:'✓', 'morning-report':'☀', 'night-review':'☾',
  'deep-research':'⌕', 'process-inbox':'⤓', link:'∞', index:'⌸', 'weekly-plan':'▦',
  'gap-audit':'△', calendar:'▣', review:'❖', inbox:'✉', 'draft-reply':'✎', organize:'⌗' };
var opEls = {};
function renderOps(){ var box = ops || document.getElementById('ops'); if (!box) return;
  box.innerHTML = ''; opEls = {};
  SKILLS.forEach(function(s){ var d = document.createElement('div');
    d.className = 'op' + (['quiz','past-paper','mark'].indexOf(s.id) >= 0 ? ' study' : '')
                       + (['inbox','draft-reply'].indexOf(s.id) >= 0 ? ' mail' : '');
    var g = document.createElement('span'); g.className = 'g'; g.textContent = GLYPH[s.id] || '▸';
    var t = document.createElement('span'); t.textContent = (UIt().skills && UIt().skills[s.id]) || s.label;
    d.appendChild(g); d.appendChild(t);
    d.onclick = function(){ runSkill(s); };
    opEls[s.id] = d; box.appendChild(d); }); }
function opBusy(id, on){ var d = opEls[id]; if (d) d.classList.toggle('run', !!on); }
renderOps();
applyLang(); // restore saved language across the whole page at boot
function mdLite(t){ return t.replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
  .replace(/==([^=]+)==/g,'<mark>$1</mark>')
  .replace(/\x60([^\x60]+)\x60/g,'<code>$1</code>')
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,'<span class="wl" data-w="$1">$2</span>')
  .replace(/\[\[([^\]]+)\]\]/g,'<span class="wl" data-w="$1">$1</span>'); }
function vital(lab, n, pct){ return '<div class="vital"><div class="n">' + n + '</div><div class="lab">' + lab + '</div><div class="bar"><i style="width:' + Math.min(100, pct) + '%"></i></div></div>'; }
async function loadStats(){ try{ var s = await (await fetch('/stats')).json();
  var hadW = whisperOK; whisperOK = !!s.whisper; if (whisperOK && !hadW && micStream) startRolling();
  var VL = UIt().vit;
  document.getElementById('vitals').innerHTML =
    vital(VL[0], s.notes, s.notes) + vital(VL[1], s.links, s.links / 3) +
    vital(VL[2], s.wiki, s.wiki * 10) + vital(VL[3], s.output, s.output * 10) +
    vital(VL[4], s.rawPending, s.rawPending * 20);
  function bindUrl(id, url, fallback){ var el = document.getElementById(id); if (!el) return;
    if (!url){ if (!el.dataset.c) el.textContent = fallback || '—'; el.onclick = null; return; }
    if (el.dataset.c) return;
    el.textContent = url;
    el.onclick = function(){ if (navigator.clipboard) navigator.clipboard.writeText(url);
      el.dataset.c = '1'; el.textContent = UIt().copied; setTimeout(function(){ delete el.dataset.c; el.textContent = url; }, 1400); }; }
  bindUrl('phoneurl', s.phone);
  bindUrl('remoteurl', s.remote, UIt().noTs);
  document.getElementById('bignum').textContent = s.notes.toLocaleString();
  document.getElementById('bigwords').textContent = s.words.toLocaleString();
  var ex = s.exams || [];
  document.getElementById('exams').innerHTML = ex.map(function(e){
    var cls = e.days <= 3 ? 'ex hot' : e.days <= 7 ? 'ex warm' : 'ex';
    var d = e.days === 0 ? UIt().today : e.days + UIt().dsuf;
    return '<div class="' + cls + '"><b>' + d + '</b>' + String(e.name).replace(/</g,'&lt;') + '</div>';
  }).join('') || '<div class="doc">' + UIt().noneSched + '</div>';
  document.getElementById('dirs').innerHTML = s.todos.map(function(t){ return '<div class="dir">' + mdLite(t) + '</div>'; }).join('') || '<div class="doc">' + UIt().none + '</div>';
  document.getElementById('docs').innerHTML = s.recent.map(function(x){ return '<div class="doc" data-f="' + esc(x.f) + '">▪ ' + esc(x.f) + '</div>'; }).join('');
  var upH = Math.floor((s.uptimeSec||0)/3600), upM = Math.floor(((s.uptimeSec||0)%3600)/60);
  var vc = document.getElementById('vaultCounters');
  if (vc) vc.innerHTML =
    '<div class="vital"><div class="n">' + (s.convoCount||0) + '</div><div class="lab">CONVERSATIONS LOGGED</div></div>' +
    '<div class="vital"><div class="n">' + (s.memoryEntries||0) + '</div><div class="lab">MEMORY ENTRIES</div></div>' +
    '<div class="vital"><div class="n">' + (s.invocations||0) + '</div><div class="lab">SKILLS RUN THIS SESSION</div></div>' +
    '<div class="vital"><div class="n">' + (s.calendarToday||0) + '</div><div class="lab">CALENDAR EVENTS TODAY</div></div>' +
    '<div class="vital"><div class="n">' + upH + 'h ' + upM + 'm</div><div class="lab">SERVER UPTIME</div></div>';
  var vr = document.getElementById('vdRecent');
  if (vr) vr.innerHTML = s.recent.map(function(x){ return vdRow(x.f); }).join('') || '<div class="doc">' + UIt().none + '</div>';
 }catch(e){} }
function vdRow(f){
  return '<div class="vd-item"><div class="doc" data-f="' + esc(f) + '">▪ ' + esc(f) + '</div><span class="vd-use" data-f="' + esc(f) + '" title="Use as context">+ CTX</span></div>';
}
var allNotesCache = null;
async function loadAllNotes(){
  var box = document.getElementById('vdAll'); if (!box) return;
  if (!allNotesCache){ try{ var j = await (await fetch('/notes')).json(); allNotesCache = j.notes || []; }catch(e){ allNotesCache = []; } }
  renderAllNotes(document.getElementById('vdSearch').value || '');
}
function renderAllNotes(filter){
  var box = document.getElementById('vdAll'); if (!box || !allNotesCache) return;
  var f = filter.trim().toLowerCase();
  var list = f ? allNotesCache.filter(function(n){ return n.f.toLowerCase().indexOf(f) !== -1; }) : allNotesCache;
  box.innerHTML = list.slice(0, 200).map(function(n){ return vdRow(n.f); }).join('') || '<div class="doc">' + UIt().nohits + '</div>';
}
(function(){
  var s = document.getElementById('vdSearch');
  if (s) s.addEventListener('input', function(){ renderAllNotes(s.value); });
  document.getElementById('vaultPanel').addEventListener('click', function(e){
    var useBtn = e.target.closest && e.target.closest('.vd-use');
    if (useBtn){ e.stopPropagation(); var f = useBtn.getAttribute('data-f');
      fetch('/note?f=' + encodeURIComponent(f)).then(function(r){ return r.json(); }).then(function(j){
        if (j && j.text){ pendingCtx.push('Context from note "' + f + '":\n' + j.text.slice(0, 1500));
          useBtn.textContent = '✓ ADDED'; setTimeout(function(){ useBtn.textContent = '+ CTX'; }, 1500); }
      }).catch(function(){});
      return; }
    var docEl = e.target.closest && e.target.closest('#vdRecent .doc, #vdAll .doc');
    if (docEl){ e.stopPropagation(); openNote(docEl.getAttribute('data-f'), false); }
  });
  Array.prototype.forEach.call(document.querySelectorAll('.vtab'), function(tab){
    tab.onclick = function(e){ e.stopPropagation();
      Array.prototype.forEach.call(document.querySelectorAll('.vtab'), function(t){ t.classList.toggle('on', t === tab); });
      Array.prototype.forEach.call(document.querySelectorAll('.vtabPane'), function(p){ p.classList.toggle('on', p.id === tab.getAttribute('data-tab')); });
      if (tab.getAttribute('data-tab') === 'vtDirs') loadAllNotes();
    };
  });
})();
/* ---------- collapsible panels: give the core the whole stage ---------- */
var tabL = document.getElementById('tabL'), tabR = document.getElementById('tabR'), feedX = document.getElementById('feedX');
function syncPanels(){
  if (!tabL || !tabR) return;          // applyLang() runs at boot before these are assigned
  var l = document.body.classList.contains('hideL'), r = document.body.classList.contains('hideR');
  tabL.textContent = l ? '›' : '‹';
  tabR.textContent = r ? '‹' : '›';
  tabL.title = (l ? UIt().panShow : UIt().panHide) + ' — [';
  tabR.title = (r ? UIt().panShow : UIt().panHide) + ' — ]';
  localStorage.setItem('jarvis_hideL', l ? '1' : '');
  localStorage.setItem('jarvis_hideR', r ? '1' : '');
}
function togglePanel(side){
  document.body.classList.toggle(side === 'L' ? 'hideL' : 'hideR');
  syncPanels();
  // the column animates for 300ms — re-measure the core's stage as it settles
  var n = 0, t = setInterval(function(){ if (typeof _layN !== 'undefined') _layN = 0; if (++n > 20) clearInterval(t); }, 25);
}
tabL.onclick = function(){ togglePanel('L'); };
tabR.onclick = function(){ togglePanel('R'); };
if (localStorage.getItem('jarvis_hideL')) document.body.classList.add('hideL');
if (localStorage.getItem('jarvis_hideR')) document.body.classList.add('hideR');
syncPanels();                          // now that the elements exist, label them properly
feedX.title = UIt().feedClear;
/* ---------- closing the chat hands its space back ---------- */
function syncFeed(){ feedX.classList.toggle('on', feed.children.length > 0); }
feedX.onclick = function(){
  feed.innerHTML = ''; hearNode = null; pendingCtx = []; syncFeed();
};
document.addEventListener('keydown', function(e){
  if (e.target === txt || (e.target && e.target.tagName === 'INPUT')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '[') { e.preventDefault(); togglePanel('L'); }
  else if (e.key === ']') { e.preventDefault(); togglePanel('R'); }
  else if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault();
    GB.oy = Math.max(0.30, Math.min(0.70, GB.oy + (e.key === 'ArrowUp' ? -0.01 : 0.01)));
    localStorage.setItem('jarvis_globe_oy', String(GB.oy)); }   // nudge the core up/down, remembered
  else if (e.key === '\\') { e.preventDefault();          // both at once — full-screen core
    var both = document.body.classList.contains('hideL') && document.body.classList.contains('hideR');
    document.body.classList.toggle('hideL', !both); document.body.classList.toggle('hideR', !both); syncPanels(); }
});
/* ---------- granted folders: what he can reach outside the vault ---------- */
async function loadFolders(){
  var box = document.getElementById('folds'); if (!box) return;
  try{
    var j = await (await fetch('/folders')).json();
    box.innerHTML = (j.grants || []).map(function(g){
      var badge = !g.ok ? UIt().gMissing : (g.write ? UIt().gRW : UIt().gRead);
      return '<div class="fold' + (g.write ? ' w' : '') + (g.ok ? '' : ' bad') + '" data-p="' + esc(g.path) + '">'
           + '<span class="nm" title="' + esc(g.path) + '">' + esc(g.label) + '</span>'
           + '<span class="rw" title="' + esc(UIt().gToggle) + '">' + badge + '</span>'
           + '<span class="x" title="' + esc(UIt().gRevoke) + '">✕</span></div>';
    }).join('') || '<div class="doc">' + UIt().gNone + '</div>';
    Array.prototype.forEach.call(box.querySelectorAll('.fold'), function(el){
      var p = el.getAttribute('data-p');
      el.querySelector('.rw').onclick = function(e){ e.stopPropagation(); post({ toggleWrite: p }); };
      el.querySelector('.x').onclick = function(e){ e.stopPropagation();
        if (confirm(UIt().gRevokeAsk + '\n\n' + p)) post({ remove: p }); };
    });
  }catch(e){}
  function post(body){
    fetch('/folders', { method: 'POST', body: JSON.stringify(body) })
      .then(function(r){ return r.json(); }).then(function(){ loadFolders(); }).catch(function(){});
  }
}
document.getElementById('btnGrant').onclick = function(){
  var p = prompt(UIt().gAsk, '~/');
  if (!p || !p.trim()) return;
  fetch('/folders', { method: 'POST', body: JSON.stringify({ add: p.trim() }) })
    .then(function(r){ return r.json(); })
    .then(function(j){ if (j.error) add('j', UIt().gBad + ' ' + (j.path || p)); loadFolders(); })
    .catch(function(){});
};
loadFolders();
loadStats(); setInterval(loadStats, 20000);
/* ================= NOTE VIEWER / VAULT SEARCH / LINK GRAPH ================= */
function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function inl(s){ return esc(s)
  .replace(/\x60([^\x60]+)\x60/g,'<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
  .replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<i>$2</i>')
  .replace(/==([^=]+)==/g,'<mark>$1</mark>')
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,'<span class="wl" data-w="$1">$2</span>')
  .replace(/\[\[([^\]]+)\]\]/g,'<span class="wl" data-w="$1">$1</span>')
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>'); }
/* full markdown → HTML, enough for Obsidian notes: headings, lists, tables, code, quotes, wikilinks */
function mdFull(src){
  var lines = String(src).split('\n'), out = [], inCode = false, listOpen = false, tbl = null, i, m;
  if (lines[0] && lines[0].trim() === '---'){ var fe = lines.indexOf('---', 1); if (fe > 0) lines = lines.slice(fe + 1); }
  function closeList(){ if (listOpen){ out.push('</ul>'); listOpen = false; } }
  function closeTbl(){ if (tbl){ out.push('<table>' + tbl.join('') + '</table>'); tbl = null; } }
  for (i = 0; i < lines.length; i++){
    var L = lines[i];
    if (/^\s*\x60\x60\x60/.test(L)){ closeList(); closeTbl();
      if (!inCode){ out.push('<pre>'); inCode = true; } else { out.push('</pre>'); inCode = false; } continue; }
    if (inCode){ out.push(esc(L) + '\n'); continue; }
    if (/^\s*\|/.test(L) && L.indexOf('|', 1) > 0){
      closeList();
      if (/^[\s|:\-]+$/.test(L)) continue;
      var cells = L.trim().replace(/^\|/,'').replace(/\|\s*$/,'').split('|');
      var tag = tbl ? 'td' : 'th'; if (!tbl) tbl = [];
      tbl.push('<tr>' + cells.map(function(c){ return '<' + tag + '>' + inl(c.trim()) + '</' + tag + '>'; }).join('') + '</tr>');
      continue; }
    closeTbl();
    if ((m = L.match(/^(#{1,6})\s+(.*)$/))){ closeList(); var hn = Math.min(3, m[1].length);
      out.push('<h' + hn + '>' + inl(m[2]) + '</h' + hn + '>'); continue; }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(L)){ closeList(); out.push('<hr>'); continue; }
    if ((m = L.match(/^\s*>\s?(.*)$/))){ closeList(); out.push('<blockquote>' + inl(m[1]) + '</blockquote>'); continue; }
    m = L.match(/^(\s*)[-*+]\s+(.*)$/) || L.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (m){ if (!listOpen){ out.push('<ul>'); listOpen = true; }
      var body = m[2].replace(/^\[([ xX])\]\s*/, function(_a, c){ return /[xX]/.test(c) ? '☑ ' : '☐ '; });
      out.push('<li style="margin-left:' + (14 + Math.floor(m[1].length / 2) * 14) + 'px">' + inl(body) + '</li>'); continue; }
    if (!L.trim()){ closeList(); continue; }
    closeList(); out.push('<p>' + inl(L) + '</p>');
  }
  closeList(); closeTbl(); if (inCode) out.push('</pre>');
  return out.join('');
}
var ovl = document.getElementById('ovl'), ovbody = document.getElementById('ovbody'),
    ovtitle = document.getElementById('ovtitle'), ovback = document.getElementById('ovback');
var ovStack = [], ovCur = null;
function ovOpen(){ ovl.classList.add('on'); }
function ovClose(){ stopGraph(); ovl.classList.remove('on'); ovStack = []; ovCur = null; ovback.style.display = 'none'; }
function ovNav(){ ovback.style.display = ovStack.length ? '' : 'none'; }
async function openNote(ref, isWiki, noPush){
  if (!ref) return;
  stopGraph(); ovOpen();
  ovbody.className = ''; ovtitle.textContent = UIt().loading; ovbody.innerHTML = '';
  try{
    var r = await fetch('/note?' + (isWiki ? 'wiki=' : 'f=') + encodeURIComponent(ref));
    if (!r.ok){ ovtitle.textContent = UIt().notfound; ovbody.innerHTML = '<div class="doc">' + esc(ref) + '</div>'; return; }
    var j = await r.json();
    if (ovCur && !noPush && ovCur !== j.file) ovStack.push(ovCur);
    ovCur = j.file; ovtitle.textContent = j.file;
    ovbody.className = 'md'; ovbody.innerHTML = mdFull(j.text); ovbody.scrollTop = 0; ovNav();
  }catch(e){ ovtitle.textContent = UIt().notfound; }
}
function openSearch(seed){
  stopGraph(); ovOpen(); ovCur = null; ovStack = []; ovNav();
  ovbody.className = ''; ovtitle.textContent = UIt().vsearch;
  ovbody.innerHTML = '<input id="ovsearch" placeholder="' + UIt().searchPh + '"><div id="ovhits"></div>';
  var inp = document.getElementById('ovsearch'), box = document.getElementById('ovhits'), tmr = null;
  function run(){
    var v = inp.value.trim();
    if (v.length < 2){ box.innerHTML = ''; return; }
    fetch('/search?k=12&q=' + encodeURIComponent(v)).then(function(r){ return r.json(); }).then(function(j){
      box.innerHTML = j.hits.map(function(h){
        return '<div class="hit" data-f="' + esc(h.file) + '"><div class="f"><span class="sc">' + h.score + '</span>' +
               esc(h.file) + (h.head ? ' › ' + esc(h.head) : '') + '</div><div class="s">' + esc(h.snippet) + '…</div></div>';
      }).join('') || '<div class="doc">' + UIt().nohits + '</div>';
      Array.prototype.forEach.call(box.querySelectorAll('.hit'), function(el){
        el.onclick = function(){ ovCur = null; openNote(el.dataset.f, false); }; });
    }).catch(function(){});
  }
  inp.oninput = function(){ clearTimeout(tmr); tmr = setTimeout(run, 170); };
  inp.onkeydown = function(e){ if (e.key === 'Escape'){ e.stopPropagation(); ovClose(); } };
  if (seed){ inp.value = seed; run(); }
  setTimeout(function(){ inp.focus(); }, 30);
}
/* ---------- force-directed wikilink graph ---------- */
var graphRaf = 0;
function stopGraph(){ if (graphRaf) cancelAnimationFrame(graphRaf); graphRaf = 0; }
async function openGraph(){
  stopGraph(); ovOpen(); ovCur = null; ovStack = []; ovNav();
  ovtitle.textContent = UIt().graph; ovbody.className = 'wide';
  ovbody.innerHTML = '<canvas id="gcv"></canvas><div id="ghint">' + UIt().ghint + '</div>';
  var g; try{ g = await (await fetch('/graph')).json(); }catch(e){ return; }
  var cv = document.getElementById('gcv'); if (!cv) return;
  var cx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  var N = g.nodes, E = g.links, W = 1, H = 1;
  var groups = []; N.forEach(function(n){ if (groups.indexOf(n.g) < 0) groups.push(n.g); });
  function hue(n){ return (groups.indexOf(n.g) * 47 + 190) % 360; }
  function fit(){ var r = ovbody.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  fit(); window.addEventListener('resize', fit);
  N.forEach(function(n, i){ var a = i / N.length * 6.283;
    n.x = W / 2 + Math.cos(a) * Math.min(W, H) * 0.3; n.y = H / 2 + Math.sin(a) * Math.min(W, H) * 0.3;
    n.vx = 0; n.vy = 0; n.r = 3.5 + Math.min(9, n.d * 0.75); });
  var hot = null, drag = null, down = null, moved = false, alpha = 1;
  function step(){
    var i, j, a, b, dx, dy, d2, d, f;
    var K = Math.sqrt(W * H / (N.length || 1)) * 0.72;
    for (i = 0; i < N.length; i++){ a = N[i];
      for (j = i + 1; j < N.length; j++){ b = N[j];
        dx = a.x - b.x; dy = a.y - b.y; d2 = dx * dx + dy * dy || 0.01;
        if (d2 > 360000) continue;
        d = Math.sqrt(d2); f = K * K / d2 * 0.9;
        a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f; } }
    for (i = 0; i < E.length; i++){ a = N[E[i].s]; b = N[E[i].t]; if (!a || !b) continue;
      dx = b.x - a.x; dy = b.y - a.y; d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      f = (d - K) * 0.012;
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f; }
    for (i = 0; i < N.length; i++){ a = N[i];
      a.vx += (W / 2 - a.x) * 0.0016; a.vy += (H / 2 - a.y) * 0.0016;
      if (a === drag) { a.vx = a.vy = 0; continue; }
      a.vx *= 0.86; a.vy *= 0.86;
      a.x += Math.max(-14, Math.min(14, a.vx)) * alpha; a.y += Math.max(-14, Math.min(14, a.vy)) * alpha;
      a.x = Math.max(a.r + 6, Math.min(W - a.r - 6, a.x)); a.y = Math.max(a.r + 6, Math.min(H - a.r - 6, a.y)); }
    if (alpha > 0.25) alpha *= 0.997;
  }
  function nb(n){ if (!n) return null; var s = {};
    E.forEach(function(e){ if (N[e.s] === n) s[e.t] = 1; if (N[e.t] === n) s[e.s] = 1; }); return s; }
  function draw(){
    var light = document.body.classList.contains('light');
    cx.clearRect(0, 0, W, H);
    var near = nb(hot);
    E.forEach(function(e){ var a = N[e.s], b = N[e.t]; if (!a || !b) return;
      var on = hot && (a === hot || b === hot);
      cx.strokeStyle = on ? 'hsla(' + hue(a) + ',90%,68%,.85)' : (light ? 'rgba(0,0,0,.13)' : 'rgba(127,231,255,.13)');
      cx.lineWidth = on ? 1.6 : 0.7;
      cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); });
    N.forEach(function(n, i){
      var on = n === hot, adj = near && near[i];
      var dim = hot && !on && !adj;
      cx.globalAlpha = dim ? 0.28 : 1;
      cx.fillStyle = 'hsl(' + hue(n) + ',' + (on ? '95%,72%' : '70%,58%') + ')';
      cx.beginPath(); cx.arc(n.x, n.y, n.r * (on ? 1.35 : 1), 0, 6.284); cx.fill();
      if (on || adj || n.d >= 6){
        cx.fillStyle = light ? '#111' : (on ? '#fff' : '#8fc7dd');
        cx.font = (on ? '600 ' : '') + (on ? 12 : 9.5) + 'px "SF Mono",Menlo,monospace';
        cx.textAlign = 'center';
        cx.fillText(n.n.length > 26 ? n.n.slice(0, 25) + '…' : n.n, n.x, n.y - n.r - 5); }
      cx.globalAlpha = 1; });
  }
  function loop(){ step(); draw(); graphRaf = requestAnimationFrame(loop); }
  function at(ev){ var r = cv.getBoundingClientRect();
    var t = ev.touches && ev.touches[0], px = (t ? t.clientX : ev.clientX) - r.left, py = (t ? t.clientY : ev.clientY) - r.top;
    var best = null, bd = 400;
    N.forEach(function(n){ var dx = n.x - px, dy = n.y - py, d2 = dx * dx + dy * dy;
      if (d2 < bd && d2 < Math.pow(n.r + 13, 2)){ bd = d2; best = n; } });
    return { n: best, x: px, y: py }; }
  cv.onmousemove = function(e){ var h = at(e);
    if (drag){ drag.x = h.x; drag.y = h.y; moved = true; alpha = Math.max(alpha, 0.6); return; }
    hot = h.n; cv.style.cursor = h.n ? 'pointer' : 'grab'; };
  cv.onmousedown = function(e){ var h = at(e); down = h.n; drag = h.n; moved = false; if (h.n) cv.classList.add('drag'); };
  cv.onmouseup = function(e){ var wasDrag = moved; drag = null; cv.classList.remove('drag');
    if (down && !wasDrag) openNote(down.id, false); down = null; };
  cv.onmouseleave = function(){ drag = null; down = null; hot = null; cv.classList.remove('drag'); };
  cv.ontouchstart = function(e){ var h = at(e); hot = h.n; down = h.n; drag = h.n; moved = false; };
  cv.ontouchmove = function(e){ if (!drag) return; var h = at(e); drag.x = h.x; drag.y = h.y; moved = true; e.preventDefault(); };
  cv.ontouchend = function(){ if (down && !moved) openNote(down.id, false); drag = null; down = null; };
  loop();
}
document.getElementById('ovclose').onclick = ovClose;
document.getElementById('ovsearchbtn').onclick = function(){ openSearch(''); };
document.getElementById('ovgraphbtn').onclick = openGraph;
document.getElementById('ovUseCtx').onclick = function(){
  if (!ovCur) return;
  pendingCtx.push('Context from note "' + ovCur + '":\n' + ovbody.textContent.slice(0, 1500));
  var b = document.getElementById('ovUseCtx'); b.textContent = '✓ ADDED';
  setTimeout(function(){ b.textContent = '+ CONTEXT'; }, 1500);
};
ovback.onclick = function(){ var p = ovStack.pop(); ovNav(); if (p){ ovCur = null; openNote(p, false, true); } };
document.getElementById('btnSearch').onclick = function(){ openSearch(''); };
document.getElementById('btnGraph').onclick = openGraph;
document.addEventListener('click', function(e){
  var t = e.target;
  var w = t.closest ? t.closest('.wl') : null;
  if (w && w.getAttribute('data-w')){ e.preventDefault(); openNote(w.getAttribute('data-w'), true); return; }
  var d = t.closest ? t.closest('.doc[data-f]') : null;
  if (d){ ovCur = null; openNote(d.getAttribute('data-f'), false); }
});
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape' && ovl.classList.contains('on')){ ovClose(); return; }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')){ e.preventDefault(); openSearch(''); }
});
/* ---------- PROACTIVE: contextual check-ins when idle ---------- */
setInterval(function(){
  if (!audioOn || state !== 'idle' || document.hidden) return;
  var now = Date.now();
  if (now - lastActivity < 6 * 60 * 1000 || now - lastNudge < 12 * 60 * 1000) return;
  fetch('/nudge?lang=' + lang).then(function(r){ return r.json(); }).then(function(j){
    if (j.text && j.text !== lastNudgeText){ lastNudge = Date.now(); lastNudgeText = j.text;
      add('j', j.text); speak(j.text); pendingCtx.push(j.text); } }).catch(function(){});
}, 60000);
/* ---------- VISION: drop or paste an image ---------- */
function sendFile(f){ if (!f) return;
  if (f.size > 90e6){ add('j', 'That file is a touch ambitious, Boss — might I suggest keeping it under 90 megabytes.'); return; }
  var isVid = /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(f.name || '') || (f.type || '').indexOf('video') === 0;
  if (isVid) add('j', 'Watching it now, Boss — give me a moment to take it in…');
  var r = new FileReader();
  r.onload = function(){ add('u', '📎 ' + (f.name || 'pasted image'));
    fetch('/upload', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ name: f.name || 'pasted.png', data: r.result }) })
      .then(function(x){ return x.json(); })
      .then(function(j){
        if (j.video){
          var p = 'I just uploaded a video to the vault at "' + j.file + '".';
          if (j.frames) p += ' Key frames are extracted in "' + j.frames + '/" — Read them in order to SEE the video.';
          if (j.transcript) p += ' The spoken audio transcript is at "' + (j.frames || '') + '/transcript.txt" — read it too.';
          if (!j.frames) p += ' Frame extraction was unavailable; work with what you can.';
          p += ' Then tell me what the video shows and help me with it.';
          ask(p);
        } else {
          ask('I just added a file to the vault at "' + j.file + '". Open it with the Read tool (it handles images, PDFs and text), describe what you see, and help me with it — if it is homework or notes, work through it.');
        } })
      .catch(function(){ add('j', 'Upload failed, Boss.'); }); };
  r.readAsDataURL(f); }
var themeBtn = document.getElementById('themeBtn'), themebox = document.getElementById('themebox');
themeBtn.onclick = function(e){ e.stopPropagation(); themebox.style.display = themebox.style.display === 'block' ? 'none' : 'block'; };
themebox.addEventListener('click', function(e){ e.stopPropagation(); }); // keep open while picking a voice
document.addEventListener('click', function(){ themebox.style.display = 'none'; });
Array.prototype.forEach.call(themebox.querySelectorAll('.swrow[data-t]'), function(r){
  r.onclick = function(e){ e.stopPropagation(); applyTheme(r.getAttribute('data-t')); themebox.style.display = 'none'; }; });
Array.prototype.forEach.call(themebox.querySelectorAll('.zrow'), function(r){
  r.onclick = function(e){ e.stopPropagation(); zhVoiceMode = r.getAttribute('data-z');
    localStorage.setItem('jarvis_zhvoice', zhVoiceMode); syncZhVoice(); stopSpeaking();
    speak('好的，Boss。這是我現在的中文聲音，裡面夾一個 English word 給你聽。'); }; });

/* ---------- sheet component (shared): wires a FAB + glass panel + scrim triple ---------- */
/* Used for both the Skills sheet and the mobile-only Status sheet — same open/close pattern,
   same a11y behavior (aria-expanded, outside-click/Escape/close-button dismissal). */
var sheetInstances = [];
function wireSheet(fabId, panelId, scrimId, closeId){
  var fab = document.getElementById(fabId), panel = document.getElementById(panelId),
      scrim = document.getElementById(scrimId), closeBtn = document.getElementById(closeId);
  function setOpen(open){
    panel.classList.toggle('on', open);
    scrim.classList.toggle('on', open);
    fab.classList.toggle('on', open);
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  fab.onclick = function(e){ e.stopPropagation(); setOpen(!panel.classList.contains('on')); sheetInstances.forEach(function(s){ if (s.setOpen !== setOpen) s.setOpen(false); }); };
  closeBtn.onclick = function(e){ e.stopPropagation(); setOpen(false); };
  // Deliberately NOT wiring tap-outside/scrim-tap-to-close. On some phones taps meant for
  // content inside the sheet were being caught by the scrim behind it and closing the sheet
  // instead of reaching the button underneath. The only ways to close a sheet now are the
  // explicit close button, re-tapping the sheet's own FAB, or Escape — all solid, unambiguous
  // targets, not an invisible full-screen layer that can steal a tap.
  var instance = { setOpen: setOpen };
  sheetInstances.push(instance);
  return instance;
}
wireSheet('opsFab', 'opsDrawer', 'opsScrim', 'opsClose');
wireSheet('vaultFab', 'vaultPanel', 'vaultScrim', 'vaultClose');
document.addEventListener('keydown', function(e){ if (e.key === 'Escape') sheetInstances.forEach(function(s){ s.setOpen(false); }); });
syncZhVoice();
Array.prototype.forEach.call(themebox.querySelectorAll('.lrow'), function(r){
  r.onclick = function(e){ e.stopPropagation(); lang = r.getAttribute('data-l'); localStorage.setItem('jarvis_lang', lang); applyLang();
    if (rec) rec.lang = lang === 'zh' ? 'zh-TW' : 'en-US';
    if (srOn){ try { rec.stop(); } catch(err){} } // srSync restarts with new lang
    speak(lang === 'zh' ? '中文模式，Boss。' : lang === 'en' ? 'English it is, Boss.' : 'Automatic, Boss — I will follow your lead.'); }; });
syncLangUI();
applyTheme(localStorage.getItem('jarvis_theme') || 'dark');
var att = document.getElementById('att'), fpick = document.getElementById('fpick');
att.onclick = function(){ unlockAudio(); fpick.click(); };
fpick.onchange = function(){ if (fpick.files.length) sendFile(fpick.files[0]); fpick.value = ''; };
document.addEventListener('dragover', function(e){ e.preventDefault(); });
document.addEventListener('drop', function(e){ e.preventDefault(); if (e.dataTransfer.files.length) sendFile(e.dataTransfer.files[0]); });
document.addEventListener('paste', function(e){ var it = e.clipboardData && e.clipboardData.items; if (!it) return;
  for (var i = 0; i < it.length; i++) if (it[i].type.indexOf('image') === 0) { sendFile(it[i].getAsFile()); break; } });
/* ================= AURUM CORE — the neural globe =================
   A filigree hologram sphere: a geodesic street-grid skin, radial bristles,
   holo plates and a white-hot nucleus. It breathes when idle, streaks when he
   thinks, throws shockwaves when he speaks — and you can grab it and spin it. */
var cv = document.getElementById('cv'), cx = cv.getContext('2d');
var _mobileZoom = window.innerWidth <= 768 ? 2 : 1; // phone UI: render the core ~2x larger
var GB = { yaw: 0.6, pitch: -0.28, spin: 0.0024, vyaw: 0, vpitch: 0,
  zoom: _mobileZoom, zoomT: _mobileZoom, px: 0, py: 0, tpx: 0, tpy: 0,
  drag: null, moved: false, over: false, surge: 0, boot: 1, hot: 1,
  oy: parseFloat(localStorage.getItem('jarvis_globe_oy') || '') || 0.50,  // 0.5 = dead centre of the visible gap
  waves: [], motes: [], shards: [] };
var TRACE = [], SPIRE = [], PANEL = [], DUST = [], RING = [], PULSE = [], stars = [];
(function build(){
  function nz(v){ var m = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]) || 1; return [v[0]/m, v[1]/m, v[2]/m]; }
  function cr(a, b){ return [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]]; }
  function fib(i, n){ var y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(Math.max(0, 1 - y * y)), th = i * 2.399963;
    return [r * Math.cos(th), y, r * Math.sin(th)]; }
  function basis(p){ var up = Math.abs(p[1]) > 0.94 ? [1, 0, 0] : [0, 1, 0];
    var t1 = nz(cr(p, up)); return [t1, nz(cr(p, t1))]; }
  /* A geodesic walker with 90-degree turns — this is what gives the shell its
     circuit-board / city-street texture rather than a plain wireframe. */
  function walk(p0, d0, steps, step, turnP){
    var pts = [p0], cur = p0, dir = d0, s, u, cu, su, t, nx, nd;
    for (s = 0; s < steps; s++){
      if (Math.random() < turnP){ t = nz(cr(cur, dir)); dir = Math.random() < 0.5 ? t : [-t[0], -t[1], -t[2]]; }
      u = step * (0.55 + Math.random() * 0.9); cu = Math.cos(u); su = Math.sin(u);
      nx = nz([cur[0]*cu + dir[0]*su, cur[1]*cu + dir[1]*su, cur[2]*cu + dir[2]*su]);
      nd = nz([dir[0]*cu - cur[0]*su, dir[1]*cu - cur[1]*su, dir[2]*cu - cur[2]*su]);
      cur = nx; dir = nd; pts.push(cur); }
    return pts; }
  function skin(count, rlo, rhi, steps, step, turnP, hotP, seedN){
    for (var i = 0; i < count; i++){
      var p = fib(i, count), B = basis(p), a = Math.random() * 6.2832, ca = Math.cos(a), sa = Math.sin(a);
      var d = nz([B[0][0]*ca + B[1][0]*sa, B[0][1]*ca + B[1][1]*sa, B[0][2]*ca + B[1][2]*sa]);
      TRACE.push({ p: walk(p, d, 1 + (Math.random() * steps | 0), step, turnP),
        r: rlo + Math.random() * (rhi - rlo), hot: Math.random() < hotP,
        w: Math.random() < 0.18 ? 1.1 : 0.5, ph: Math.random() * 6.2832 }); }
  }
  skin(620, 0.955, 1.045, 5, 0.052, 0.34, 0.10);   /* outer shell — dense, thin, tight band */
  skin(210, 0.60,  0.76,  4, 0.075, 0.40, 0.14);   /* inner shell — the machinery inside */
  skin(90,  0.30,  0.44,  3, 0.095, 0.45, 0.20);   /* core cage */
  /* radial bristles — short, not spikes */
  for (var j = 0; j < 200; j++){
    var q = fib(j, 200), r0 = 0.86 + Math.random() * 0.10;
    SPIRE.push({ p: q, r0: r0, r1: r0 + 0.035 + Math.random() * Math.random() * 0.20,
      hot: Math.random() < 0.20, ph: Math.random() * 6.2832 }); }
  for (var j2 = 0; j2 < 90; j2++){
    var q2 = fib(j2 * 3 % 90, 90), rr0 = 0.44 + Math.random() * 0.16;
    SPIRE.push({ p: q2, r0: rr0, r1: rr0 + 0.05 + Math.random() * 0.22,
      hot: Math.random() < 0.30, ph: Math.random() * 6.2832 }); }
  /* holo plates hanging off the shell */
  for (var k = 0; k < 26; k++){
    var c = fib(k, 26), Bb = basis(c);
    var sx = 0.05 + Math.random() * 0.10, sy = 0.035 + Math.random() * 0.075, cor = [];
    for (var m2 = 0; m2 < 4; m2++){
      var ux = (m2 === 0 || m2 === 3) ? -sx : sx, uy = m2 < 2 ? -sy : sy;
      cor.push(nz([c[0] + Bb[0][0]*ux + Bb[1][0]*uy, c[1] + Bb[0][1]*ux + Bb[1][1]*uy, c[2] + Bb[0][2]*ux + Bb[1][2]*uy])); }
    PANEL.push({ c: cor, r: 1.0 + Math.random() * 0.11, ph: Math.random() * 6.2832 }); }
  /* dust suspended through the volume */
  for (var d2 = 0; d2 < 420; d2++){
    DUST.push({ p: fib(d2, 420), r: 0.25 + Math.random() * 0.82, ph: Math.random() * 6.2832,
      hot: Math.random() < 0.16, sz: 0.5 + Math.random() * 0.8 }); }
  /* structural lattice — latitude circles and meridians. Continuous curves are what
     let the eye read a sphere; the walkers alone look like confetti. */
  var la, lo, t2, pts2;
  for (la = -64; la <= 64; la += 16){
    var yy = Math.sin(la * Math.PI / 180), rr2 = Math.cos(la * Math.PI / 180); pts2 = [];
    for (t2 = 0; t2 <= 72; t2++){ var a2 = t2 / 72 * 6.2832; pts2.push([rr2 * Math.cos(a2), yy, rr2 * Math.sin(a2)]); }
    RING.push({ p: pts2, r: 1.0, w: 0.5, a: Math.abs(la) === 0 ? 0.55 : 0.34, ph: Math.random() * 6.2832 });
  }
  for (lo = 0; lo < 180; lo += 30){
    var ca2 = Math.cos(lo * Math.PI / 180), sa2 = Math.sin(lo * Math.PI / 180); pts2 = [];
    for (t2 = 0; t2 <= 72; t2++){ var a3 = t2 / 72 * 6.2832; pts2.push([Math.cos(a3) * ca2, Math.sin(a3), Math.cos(a3) * sa2]); }
    RING.push({ p: pts2, r: 1.0, w: 0.45, a: 0.26, ph: Math.random() * 6.2832 });
  }
  RING.push({ p: RING[4].p, r: 0.62, w: 0.6, a: 0.30, ph: 1.1 });   // an inner equator, for depth
  /* data pulses that run along the shell traces */
  for (var pz = 0; pz < 46; pz++)
    PULSE.push({ i: (Math.random() * 520) | 0, t: Math.random(), v: 0.004 + Math.random() * 0.010 });
  for (var s2 = 0; s2 < 90; s2++) stars.push({ x: Math.random(), y: Math.random(), tw: Math.random() * 6.2832 });
})();
/* ---------- animation triggers, called from the rest of the HUD ---------- */
function globeWave(power){ power = power || 1;
  if (GB.waves.length < 14) GB.waves.push({ r: 0.16, v: 0.011 + 0.005 * power, a: 1, w: power }); }
function globePulse(power){ power = power || 1;
  GB.surge = Math.min(1.8, GB.surge + 0.8 * power);
  GB.hot = Math.min(1.5, GB.hot + 0.9 * power);
  GB.vyaw += 0.030 * power; globeWave(power);
  for (var i = 0; i < 12 * power && GB.motes.length < 130; i++)
    GB.motes.push({ a: Math.random() * 6.2832, e: Math.acos(2 * Math.random() - 1),
      r: 0.2 + Math.random() * 0.3, v: 0.020 + Math.random() * 0.022, out: true }); }
function globeWake(){ GB.boot = 1; GB.surge = 1.3; GB.hot = 1.5; GB.vyaw += 0.05; globeWave(1.8);
  for (var i = 0; i < 26; i++) GB.shards.push({ a: Math.random() * 6.2832, r: 1.9 + Math.random() * 0.9, v: 0.03 + Math.random() * 0.02 }); }
/* ---------- projection ---------- */
var pX = 0, pY = 0, pZ = 0, pS = 0, _cy = 1, _sy = 0, _cp = 1, _sp = 0, _R = 100, _CX = 0, _CY = 0;
/* Where the core should actually sit: the gap between the top bar and the input bar,
   in viewport coordinates, plus the canvas's own offset so we can convert to canvas-local.
   Re-measured on resize, on panel toggles, and every 15 frames — cheap, and it means the
   core stays optically centred no matter what else changes height. */
var _stage = { top: 0, bot: 0, cvTop: 0 }, _layN = 0;
function measureStage(){
  var t = document.getElementById('top'), b = document.getElementById('bottom');
  var cr = cv.getBoundingClientRect();
  var top = t ? t.getBoundingClientRect().bottom : 0;
  var bot = b ? b.getBoundingClientRect().top : (window.innerHeight || cr.bottom);
  // Never centre in more gap than the canvas itself actually occupies. On desktop the
  // canvas fills ~the whole top-to-bottom gap so this is a no-op; on mobile the canvas
  // is a small fixed-height box above other stacked content, and without this clamp the
  // core gets centred far below the canvas's own visible bounds (invisible, clipped).
  _stage.top = Math.max(top, cr.top);
  _stage.bot = Math.min(bot, cr.bottom);
  _stage.cvTop = cr.top;
  if (_stage.bot <= _stage.top) { _stage.top = cr.top; _stage.bot = cr.bottom; }  // fallback
}
window.addEventListener('resize', function(){ _layN = 0; });
var _lastT = 0, _slow = 0, LOD = 1; // adaptive detail: thins the shell if the machine struggles
function setYaw(y){ _cy = Math.cos(y); _sy = Math.sin(y); }
function pr(v, rad){
  var x = v[0] * rad, y = v[1] * rad, z = v[2] * rad;
  var x1 = x * _cy - z * _sy, z1 = x * _sy + z * _cy;
  var y1 = y * _cp - z1 * _sp, z2 = y * _sp + z1 * _cp;
  var s = 1 / (1.9 - z2 * 0.55);
  pX = _CX + x1 * _R * s; pY = _CY + y1 * _R * s; pZ = z2; pS = s; }
function draw(){
  var w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== (w * dpr | 0) || cv.height !== (h * dpr | 0)){ cv.width = w * dpr; cv.height = h * dpr; }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.clearRect(0, 0, w, h);
  var now = Date.now(), light = !!T.light;
  var _dt = now - (_lastT || now); _lastT = now;
  if (_dt > 26) _slow = Math.min(50, _slow + 1); else if (_dt < 19) _slow = Math.max(0, _slow - 1);
  LOD = _slow > 34 ? 2 : 1;
  var C = T.core || { b: '224,148,38', m: '255,196,92', h: '255,242,206' };
  /* ---- dynamics ---- */
  var tgt = state === 'thinking' ? 0.0300 : state === 'speaking' ? 0.0105 : state === 'listening' ? 0.0058 : 0.0024;
  GB.spin += (tgt - GB.spin) * 0.05;
  GB.yaw += GB.spin + GB.vyaw; GB.vyaw *= 0.93;
  GB.pitch += GB.vpitch; GB.vpitch *= 0.90;
  GB.pitch = Math.max(-1.2, Math.min(1.2, GB.pitch));
  GB.zoom += (GB.zoomT - GB.zoom) * 0.10;
  GB.px += (GB.tpx - GB.px) * 0.055; GB.py += (GB.tpy - GB.py) * 0.055;
  GB.surge *= 0.955; GB.hot *= 0.92; GB.boot *= 0.945; if (GB.boot < 0.005) GB.boot = 0;
  var beatPeriod = state === 'thinking' ? 210 : state === 'listening' ? 191 : state === 'speaking' ? 140 : 637;
  var beat = 0.5 + 0.5 * Math.sin(now / beatPeriod);
  var breath = 1 + 0.02 * Math.sin(now / 2600) + 0.03 * GB.surge;
  var glowTgt = (light ? 1 : (state === 'idle' ? 0.55 : 1)) * (1 + GB.surge * 0.4) * (1 - GB.boot * 0.25) * (GB.over ? 1.08 : 1);
  GB.glowS = (GB.glowS === undefined) ? glowTgt : GB.glowS + (glowTgt - GB.glowS) * 0.045; // ~400ms cross-fade between states
  var glow = GB.glowS;
  var bx = 1 + GB.boot * GB.boot * 1.7;                 /* assembly: the shell flies in */
  var streak = Math.min(1, Math.max(0, (GB.spin - 0.008) / 0.022));
  // Centre on what the EYE sees, not on the canvas box. The canvas can be taller than
  // the visible gap (PRIMARY DIRECTIVE sits below it, and the column can overflow), so
  // centring on h/2 pushes the core down into the input bar. Measure the real gap
  // between the top bar and the input bar and centre in that instead.
  if (--_layN < 0) { _layN = 15; measureStage(); }
  var gap = _stage.bot - _stage.top;                       // visible height, viewport coords
  _R = Math.min(w * 0.30, gap * 0.40, h * 0.46) * GB.zoom * breath;
  _CX = w / 2;
  _CY = (_stage.top + _stage.bot) / 2 - _stage.cvTop + (GB.oy - 0.5) * gap;
  var yaw = GB.yaw + GB.px * 0.26, pit = GB.pitch + GB.py * 0.18;
  _cp = Math.cos(pit); _sp = Math.sin(pit); setYaw(yaw);
  /* ---- background dust field ---- */
  if (!light) for (var si = 0; si < stars.length; si++){ var sp2 = stars[si];
    var sa2 = (0.035 + 0.085 * ((Math.sin(now / 700 + sp2.tw) + 1) / 2)) * glow;
    cx.fillStyle = 'rgba(' + T.star + ',' + sa2.toFixed(3) + ')';
    cx.fillRect(sp2.x * w, sp2.y * h, 1, 1); }
  cx.globalCompositeOperation = light ? 'source-over' : 'lighter';
  cx.lineCap = 'round';
  /* ---- nucleus bloom ---- */
  var nr = _R * (0.155 + 0.03 * beat + 0.05 * GB.surge);
  if (!light){
    var g0 = cx.createRadialGradient(_CX, _CY, 0, _CX, _CY, _R * 1.15);
    g0.addColorStop(0, 'rgba(' + C.b + ',' + (0.12 * glow).toFixed(3) + ')');
    g0.addColorStop(0.55, 'rgba(' + C.b + ',' + (0.05 * glow).toFixed(3) + ')');
    g0.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g0; cx.beginPath(); cx.arc(_CX, _CY, _R * 1.15, 0, 6.2832); cx.fill();
    var g1 = cx.createRadialGradient(_CX, _CY, 0, _CX, _CY, nr * 4.2);
    g1.addColorStop(0, 'rgba(' + C.h + ',' + Math.min(0.95, (0.42 + 0.20 * beat + 0.30 * GB.hot) * glow).toFixed(3) + ')');
    g1.addColorStop(0.16, 'rgba(' + C.m + ',' + ((0.26 + 0.12 * beat) * glow).toFixed(3) + ')');
    g1.addColorStop(0.5, 'rgba(' + C.b + ',' + (0.10 * glow).toFixed(3) + ')');
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g1; cx.beginPath(); cx.arc(_CX, _CY, nr * 4.2, 0, 6.2832); cx.fill();
  }
  /* ---- the shell. limb brightening (density piles up where the surface turns
         away from you) is what makes a wireframe read as a solid sphere ---- */
  function shell(mul, yawOff, hotOnly){
    if (yawOff) setYaw(yaw + yawOff);
    var i, k, tr, pts, al, limb;
    for (i = 0; i < TRACE.length; i += LOD){
      tr = TRACE[i];
      if (hotOnly && !tr.hot) continue;
      pts = tr.p;
      pr(pts[0], tr.r * bx);
      var depth = (pZ + 1) / 2, x0 = pX, y0 = pY, s0 = pS;
      limb = 1 + 1.5 * (1 - Math.abs(pZ));
      var tw = 0.76 + 0.24 * Math.sin(now / 620 + tr.ph);
      al = (light ? 0.10 + 0.26 * depth : 0.055 + 0.30 * depth * depth) * tw * limb * glow * mul;
      if (tr.hot) al *= 2.2;
      if (al < 0.014) continue;
      cx.strokeStyle = 'rgba(' + (tr.hot ? C.m : C.b) + ',' + Math.min(1, al).toFixed(3) + ')';
      cx.lineWidth = tr.w * (0.5 + 0.7 * s0);
      cx.beginPath(); cx.moveTo(x0, y0);
      for (k = 1; k < pts.length; k++){ pr(pts[k], tr.r * bx); cx.lineTo(pX, pY); }
      cx.stroke();
    }
    if (yawOff) setYaw(yaw);
  }
  /* ---- structural lattice. Each ring is stroked in runs of constant depth sign, so the
         half facing away is dim and the half facing you is bright — one stroke per run,
         not one per segment, which keeps this nearly free. ---- */
  function lattice(){
    for (var ri = 0; ri < RING.length; ri++){
      var RG = RING[ri], rp = RG.p, rad = RG.r * bx, k2, run = 0, front = 0, started = false;
      var brea = 0.75 + 0.25 * Math.sin(now / 1500 + RG.ph);
      for (k2 = 0; k2 < rp.length; k2++){
        pr(rp[k2], rad);
        var f = pZ >= 0 ? 1 : 0;
        if (!started || f !== front){
          if (started){ cx.stroke(); }
          front = f; started = true;
          var al2 = RG.a * (front ? 1 : 0.30) * brea * glow * (light ? 1.4 : 1);
          cx.strokeStyle = 'rgba(' + (front ? C.m : C.b) + ',' + Math.min(1, al2).toFixed(3) + ')';
          cx.lineWidth = RG.w * (front ? 1 : 0.75);
          cx.beginPath(); cx.moveTo(pX, pY);
        } else cx.lineTo(pX, pY);
        run++;
      }
      if (started) cx.stroke();
    }
  }
  lattice();
  if (streak > 0.02){ shell(0.5 * streak, -GB.spin * 5.5, true); shell(0.28 * streak, -GB.spin * 11, true); }
  shell(1, 0, false);
  /* ---- scan sweep: a plane of light crossing the sphere, lighting the shell as it goes ---- */
  var swY = Math.sin(now / 3400) * 1.05, swW = 0.16 + 0.05 * Math.sin(now / 900);
  for (var sw = 0; sw < TRACE.length; sw += 3){
    var st = TRACE[sw], sp0 = st.p[0];
    var dy = (sp0[1] - swY) / swW;
    if (dy > 2.2 || dy < -2.2) continue;
    var lit = Math.exp(-dy * dy) * (0.55 + 0.45 * GB.surge);
    if (lit < 0.05) continue;
    pr(sp0, st.r * bx); var sx0 = pX, sy0 = pY;
    if (pZ < -0.25) continue;
    pr(st.p[st.p.length - 1], st.r * bx);
    cx.strokeStyle = 'rgba(' + C.h + ',' + Math.min(0.85, lit * 0.8 * glow).toFixed(3) + ')';
    cx.lineWidth = 1.1;
    cx.beginPath(); cx.moveTo(sx0, sy0); cx.lineTo(pX, pY); cx.stroke();
  }
  /* ---- data pulses running along the traces ---- */
  var prate = state === 'thinking' ? 2.4 : state === 'speaking' ? 1.5 : 1;
  for (var pu = 0; pu < PULSE.length; pu++){
    var P = PULSE[pu];
    P.t += P.v * prate * (1 + GB.surge);
    if (P.t >= 1){ P.t = 0; P.i = (Math.random() * TRACE.length) | 0; P.v = 0.004 + Math.random() * 0.010; }
    var TR = TRACE[P.i] || TRACE[0], tp = TR.p, seg = (tp.length - 1) * P.t, si = seg | 0, ft = seg - si;
    var A = tp[si], B2 = tp[Math.min(tp.length - 1, si + 1)];
    var mv = [A[0] + (B2[0] - A[0]) * ft, A[1] + (B2[1] - A[1]) * ft, A[2] + (B2[2] - A[2]) * ft];
    pr(mv, TR.r * bx);
    if (pZ < -0.15) continue;
    var pal = (0.35 + 0.65 * ((pZ + 1) / 2)) * glow;
    cx.fillStyle = 'rgba(' + C.h + ',' + Math.min(1, pal).toFixed(3) + ')';
    cx.beginPath(); cx.arc(pX, pY, 1.1 * pS + 0.5, 0, 6.2832); cx.fill();
    cx.fillStyle = 'rgba(' + C.m + ',' + (pal * 0.20).toFixed(3) + ')';
    cx.beginPath(); cx.arc(pX, pY, 3.4 * pS + 1, 0, 6.2832); cx.fill();
  }
  /* ---- rim light: the silhouette edge, where the shell turns away from you ---- */
  if (!light){
    var rimR = _R * (1 / (1.9 - 0)) * 1.0;                     // radius at z = 0, the true limb
    var rg = cx.createRadialGradient(_CX, _CY, rimR * 0.86, _CX, _CY, rimR * 1.14);
    rg.addColorStop(0, 'rgba(' + C.b + ',0)');
    rg.addColorStop(0.5, 'rgba(' + C.m + ',' + (0.16 * glow * (0.85 + 0.15 * Math.sin(now / 1800))).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(' + C.b + ',0)');
    cx.fillStyle = rg; cx.beginPath(); cx.arc(_CX, _CY, rimR * 1.14, 0, 6.2832); cx.fill();
  }
  /* ---- radial bristles ---- */
  for (var q3 = 0; q3 < SPIRE.length; q3++){
    var S = SPIRE[q3];
    var puls = 0.62 + 0.38 * Math.sin(now / 520 + S.ph);
    pr(S.p, S.r0 * bx); var ax = pX, ay = pY, adep = (pZ + 1) / 2, asc = pS, alimb = 1 + 1.2 * (1 - Math.abs(pZ));
    pr(S.p, (S.r1 + 0.06 * GB.surge) * bx);
    var sal = (light ? 0.12 + 0.26 * adep : 0.05 + 0.30 * adep * adep) * puls * alimb * glow * (S.hot ? 2.4 : 1);
    if (sal < 0.014) continue;
    cx.strokeStyle = 'rgba(' + (S.hot ? C.m : C.b) + ',' + Math.min(1, sal).toFixed(3) + ')';
    cx.lineWidth = (S.hot ? 0.95 : 0.55) * (0.5 + 0.7 * asc);
    cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(pX, pY); cx.stroke();
    if (S.hot && adep > 0.66 && !light){
      cx.fillStyle = 'rgba(' + C.h + ',' + (0.55 * puls * glow).toFixed(3) + ')';
      cx.beginPath(); cx.arc(pX, pY, 1.0 * pS + 0.3, 0, 6.2832); cx.fill(); }
  }
  /* ---- holo plates ---- */
  for (var pi = 0; pi < PANEL.length; pi++){
    var PA = PANEL[pi], co = PA.c;
    pr(co[0], PA.r * bx);
    if (pZ < -0.05) continue;
    var pdep = (pZ + 1) / 2, pal = (light ? 0.22 : 0.11 + 0.26 * pdep * pdep) * (0.62 + 0.38 * Math.sin(now / 900 + PA.ph)) * glow;
    if (pal < 0.016) continue;
    cx.strokeStyle = 'rgba(' + C.m + ',' + pal.toFixed(3) + ')'; cx.lineWidth = 0.5;
    cx.beginPath(); cx.moveTo(pX, pY);
    for (var ci = 1; ci < 4; ci++){ pr(co[ci], PA.r * bx); cx.lineTo(pX, pY); }
    cx.closePath(); cx.stroke();
    cx.fillStyle = 'rgba(' + C.b + ',' + (pal * 0.18).toFixed(3) + ')'; cx.fill();
  }
  /* ---- suspended dust ---- */
  for (var di = 0; di < DUST.length; di++){
    var D = DUST[di];
    pr(D.p, D.r * bx);
    var ddep = (pZ + 1) / 2, dtw = 0.5 + 0.5 * Math.sin(now / 380 + D.ph);
    var dal = (light ? 0.30 + 0.4 * ddep : 0.12 + 0.62 * ddep * ddep) * dtw * glow * (D.hot ? 1.9 : 1);
    if (dal < 0.02) continue;
    cx.fillStyle = 'rgba(' + (D.hot ? C.h : C.m) + ',' + Math.min(1, dal).toFixed(3) + ')';
    cx.beginPath(); cx.arc(pX, pY, D.sz * (0.3 + 0.7 * pS), 0, 6.2832); cx.fill();
  }
  /* ---- core: swirl, ring, white-hot centre ---- */
  var swirl = now / 900 + GB.surge * 2, flat = 0.30 + 0.55 * Math.abs(Math.cos(pit));
  cx.strokeStyle = 'rgba(' + C.m + ',' + (0.5 * glow).toFixed(3) + ')'; cx.lineWidth = 0.85;
  cx.beginPath();
  for (var sa3 = 0; sa3 <= 56; sa3++){ var u3 = sa3 / 56, an3 = u3 * 12.5 + swirl, rr4 = nr * (0.18 + u3 * 1.15);
    var XX = _CX + Math.cos(an3) * rr4, YY = _CY + Math.sin(an3) * rr4 * flat;
    if (sa3 === 0) cx.moveTo(XX, YY); else cx.lineTo(XX, YY); }
  cx.stroke();
  /* iris — three counter-rotating broken rings; the gaps are what make it feel mechanical */
  var iris = [[0.72, 5200, 1, 0.60], [0.98, -7600, -1, 0.34], [1.28, 11000, 1, 0.22]];
  for (var ir = 0; ir < iris.length; ir++){
    var IR = iris[ir], irr = nr * IR[0] * (1 + 0.05 * beat), spin2 = now / IR[1] * IR[2];
    cx.strokeStyle = 'rgba(' + C.h + ',' + (IR[3] * glow).toFixed(3) + ')';
    cx.lineWidth = ir === 0 ? 1 : 0.7;
    for (var seg2 = 0; seg2 < 3; seg2++){
      var a0 = spin2 + seg2 * 2.094, a1 = a0 + 1.50;
      cx.beginPath(); cx.ellipse(_CX, _CY, irr, irr * flat, 0, a0, a1); cx.stroke();
    }
  }
  if (!light){
    cx.fillStyle = 'rgba(255,252,238,' + Math.min(0.98, (0.6 + 0.35 * GB.hot) * glow).toFixed(3) + ')';
    cx.beginPath(); cx.arc(_CX, _CY, nr * (0.16 + 0.05 * beat + 0.06 * GB.hot), 0, 6.2832); cx.fill(); }
  /* ---- interior sweep arcs (kept inside the shell — they are seasoning) ---- */
  function sweep(rad, per, off, fl, wid, al){
    cx.save(); cx.translate(_CX, _CY); cx.rotate(now / per + off + GB.py * 0.15);
    cx.strokeStyle = 'rgba(' + C.b + ',' + (al * 0.35 * glow).toFixed(3) + ')'; cx.lineWidth = wid * 4;
    cx.beginPath(); cx.ellipse(0, 0, rad, rad * fl, 0, 0.35, 3.2); cx.stroke();
    cx.strokeStyle = 'rgba(' + C.h + ',' + (al * glow).toFixed(3) + ')'; cx.lineWidth = wid;
    cx.beginPath(); cx.ellipse(0, 0, rad, rad * fl, 0, 0.35, 3.2); cx.stroke();
    cx.restore(); }
  sweep(_R * 0.56, 7000, 0, 0.34, 0.85, 0.26);
  sweep(_R * 0.38, -11000, 2.1, 0.62, 0.65, 0.20);
  /* ---- shockwaves ---- */
  for (var wv = GB.waves.length - 1; wv >= 0; wv--){ var W = GB.waves[wv];
    W.r += W.v * (1 + GB.surge * 0.6); W.a *= 0.962;
    if (W.r > 2.3 || W.a < 0.02){ GB.waves.splice(wv, 1); continue; }
    var wr = W.r * _R;
    cx.strokeStyle = 'rgba(' + C.h + ',' + (W.a * 0.40 * glow).toFixed(3) + ')'; cx.lineWidth = 1.2 * W.w;
    cx.beginPath(); cx.arc(_CX, _CY, wr, 0, 6.2832); cx.stroke();
    cx.strokeStyle = 'rgba(' + C.b + ',' + (W.a * 0.10 * glow).toFixed(3) + ')'; cx.lineWidth = 7 * W.w;
    cx.beginPath(); cx.arc(_CX, _CY, wr, 0, 6.2832); cx.stroke(); }
  /* ---- energy motes: inbound while he listens, outbound when he fires ---- */
  var spawn = state === 'listening' ? 0.55 : state === 'thinking' ? 0.30 : state === 'speaking' ? 0.16 : 0.05;
  if (Math.random() < spawn && GB.motes.length < 110)
    GB.motes.push({ a: Math.random() * 6.2832, e: Math.acos(2 * Math.random() - 1),
      r: 1.75 + Math.random() * 0.5, v: 0.012 + Math.random() * 0.016, out: false });
  for (var mi = GB.motes.length - 1; mi >= 0; mi--){ var M = GB.motes[mi];
    M.r += M.out ? M.v : -M.v;
    if (M.r < 0.10 || M.r > 2.5){ if (!M.out) GB.hot = Math.min(1.5, GB.hot + 0.05); GB.motes.splice(mi, 1); continue; }
    var se = Math.sin(M.e), v3 = [se * Math.cos(M.a), Math.cos(M.e), se * Math.sin(M.a)];
    pr(v3, M.r); var mx = pX, my = pY, ms = pS;
    var mal = Math.min(1, (M.out ? 0.85 : 0.7) * glow * Math.min(1, 2.5 - M.r));
    pr(v3, M.r + (M.out ? -0.16 : 0.16));
    cx.strokeStyle = 'rgba(' + C.m + ',' + (mal * 0.35).toFixed(3) + ')'; cx.lineWidth = 0.9;
    cx.beginPath(); cx.moveTo(pX, pY); cx.lineTo(mx, my); cx.stroke();
    cx.fillStyle = 'rgba(' + C.h + ',' + mal.toFixed(3) + ')';
    cx.beginPath(); cx.arc(mx, my, 1.1 * ms + 0.4, 0, 6.2832); cx.fill(); }
  /* ---- wake shards snapping into the shell ---- */
  for (var sh = GB.shards.length - 1; sh >= 0; sh--){ var SH = GB.shards[sh];
    SH.r -= SH.v; if (SH.r <= 1.0){ GB.shards.splice(sh, 1); continue; }
    var sr = SH.r * _R, sal2 = Math.min(1, (SH.r - 1) * 1.6) * glow;
    cx.strokeStyle = 'rgba(' + C.h + ',' + (sal2 * 0.7).toFixed(3) + ')'; cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(_CX + Math.cos(SH.a) * sr, _CY + Math.sin(SH.a) * sr * 0.75);
    cx.lineTo(_CX + Math.cos(SH.a) * (sr - _R * 0.12), _CY + Math.sin(SH.a) * (sr - _R * 0.12) * 0.75);
    cx.stroke(); }
  cx.globalCompositeOperation = 'source-over';
  requestAnimationFrame(draw); }
requestAnimationFrame(draw);
/* ---------- you can grab it: drag to spin, wheel to zoom, tap to talk ---------- */
cv.style.touchAction = 'none'; cv.style.cursor = 'grab';
function coreHit(e){ var r = cv.getBoundingClientRect();
  var dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
  return Math.sqrt(dx * dx + dy * dy) < Math.min(r.width, r.height) * 0.365 * GB.zoom * 1.15; }
cv.addEventListener('pointerdown', function(e){
  GB.drag = { x: e.clientX, y: e.clientY }; GB.moved = false;
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  cv.style.cursor = 'grabbing'; });
cv.addEventListener('pointermove', function(e){
  var r = cv.getBoundingClientRect();
  GB.tpx = ((e.clientX - r.left) / r.width - 0.5) * 2;
  GB.tpy = ((e.clientY - r.top) / r.height - 0.5) * 2;
  GB.over = true;
  if (!GB.drag) return;
  var dx = e.clientX - GB.drag.x, dy = e.clientY - GB.drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) GB.moved = true;
  GB.vyaw += dx * 0.00045; GB.vpitch += dy * 0.00032;
  GB.drag.x = e.clientX; GB.drag.y = e.clientY; });
cv.addEventListener('pointerup', function(e){
  var wasDrag = GB.moved; GB.drag = null; cv.style.cursor = 'grab';
  if (wasDrag || !coreHit(e)) return;
  if (mic && mic.onclick) mic.onclick.call(mic); });   /* tap the core = the mic button */
cv.addEventListener('pointerleave', function(){ GB.drag = null; GB.over = false; GB.tpx = 0; GB.tpy = 0; cv.style.cursor = 'grab'; });
cv.addEventListener('pointercancel', function(){ GB.drag = null; cv.style.cursor = 'grab'; });
cv.addEventListener('wheel', function(e){ e.preventDefault();
  GB.zoomT = Math.max(0.6, Math.min(1.95, GB.zoomT - e.deltaY * 0.0012)); }, { passive: false });
cv.addEventListener('dblclick', function(){ GB.zoomT = 1; GB.pitch = -0.28; globePulse(1.6); });
