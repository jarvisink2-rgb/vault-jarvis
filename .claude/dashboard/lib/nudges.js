// Proactive lines: the idle nudge and the greeting when the HUD opens.
'use strict';
const fs = require('fs');
const path = require('path');
const { DASH, VAULT, honor } = require('./config');
const { examLine, changesSince } = require('./vault');
const { stats } = require('./stats');

function nudge(zh) {
    const st = stats(); const h = new Date().getHours(); const arr = [];
    if (st.rawPending) arr.push(zh ? '收件匣還有 ' + st.rawPending + ' 項待處理，Boss。要我處理嗎？' : st.rawPending + (st.rawPending > 1 ? ' items are' : ' item is') + ' sitting in the inbox, Boss. Shall I process ' + (st.rawPending > 1 ? 'them' : 'it') + '?');
    const today = new Date().toISOString().slice(0, 10);
    if (h >= 6 && h < 12 && !fs.existsSync(path.join(VAULT, 'raw', today + ' Morning Report.md')))
      arr.push(zh ? '今天還沒有晨間報告，Boss。要我跑一份嗎？' : 'No morning report yet today, Boss. Shall I run it?');
    try { const mem = fs.readFileSync(path.join(VAULT, '.claude', 'memory', 'memory.md'), 'utf8');
      const study = mem.split('## Study')[1];
      if (study && (study.split('##')[0].match(/^- /gm) || []).length > 0)
        arr.push(zh ? '你的弱點清單有記錄，Boss。來個五分鐘小測驗如何？' : 'Might I suggest a five-minute drill, Boss? There are weak spots logged in your study list.');
    } catch {}
    if (st.exams && st.exams.length && st.exams[0].days <= 7)
      arr.push(zh ? st.exams[0].name + (st.exams[0].days === 0 ? '就是今天' : '還有 ' + st.exams[0].days + ' 天') + '，Boss。要我準備一份複習卷嗎？' : examLine(st.exams[0]) + ', Boss. Might I suggest a revision sheet?');
    const fresh = changesSince(Date.now() - 3600e3).filter(c => !c.gone);
    if (fresh.length >= 2)
      arr.push(zh ? '你剛在編輯「' + path.basename(fresh[fresh.length - 1].f, '.md') + '」，Boss。要我把新內容連結、加標籤、整理進索引嗎？' : 'You’ve been working on ' + path.basename(fresh[fresh.length - 1].f, '.md') + ', Boss. Shall I weave the new material in — links, tags, index?');
    try { const extra = JSON.parse(fs.readFileSync(path.join(DASH, 'nudges.json'), 'utf8'));
      if (Array.isArray(extra)) for (const x of extra) if (typeof x === 'string' && x.trim()) arr.push(x.trim().slice(0, 220)); } catch {}
    if (h >= 21 && !fs.existsSync(path.join(VAULT, 'raw', today + ' Night Review.md')))
      arr.push(zh ? '今天還沒收尾，Boss。要我跑晚間回顧嗎？三題複習，然後定好明天第一件事。' : 'The day is not closed out yet, Boss. Shall I run the night-review protocol — three recall questions, then tomorrow\u2019s first move?');
    if (h >= 22) arr.push(zh ? '不早了，Boss。睡前要我先排好明天的計畫嗎？' : 'Getting late, Boss. Shall I sketch tomorrow\u2019s plan before you turn in?');
    if (st.todos.length) arr.push(zh ? '清單上還有 ' + st.todos.length + ' 項指令，Boss。要不要先解決一項？' : 'Still ' + st.todos.length + (st.todos.length > 1 ? ' directives' : ' directive') + ' on the list, Boss. Might I suggest we knock ' + (st.todos.length > 1 ? 'one' : 'it') + ' down?');
    const t = arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    return t && honor(t);
}

function greet(zh) {
    const st = stats(); const h = new Date().getHours();
    const pick = a => a[Math.floor(Math.random() * a.length)];
    let t = pick(zh ? (
      (h >= 23 || h < 5) ? ['這麼晚還在燒腦嗎，Boss？', '深夜班是吧，我陪你，Boss。'] :
      h < 12 ? ['早安，Boss — 系統一切正常。', '早安，Boss。筆記庫昨晚安好。'] :
      h < 18 ? ['午安，Boss。', '歡迎回來，Boss。'] :
               ['晚上好，Boss。隨時候命。', '歡迎回家，Boss。']
    ) : (
      (h >= 23 || h < 5) ? ['Burning the midnight oil, Boss? ', 'Late shift then. At your service, as ever. ', 'The reasonable world is asleep, Boss. We are not. '] :
      h < 12 ? ['Good morning, Boss — all systems online. ', 'Good morning, Boss — systems green. ', 'Morning, sir. The vault kept well overnight. '] :
      h < 18 ? ['Welcome back, Boss. ', 'Good afternoon, sir — all quiet on the vault front. ', 'Afternoon, Boss. Picking up where we left off? '] :
               ['Good evening, Boss. At your service. ', 'Welcome home, Boss. ', 'Evening, Boss — the night is young and the list is not. ']));
    if (st.todos.length) t += zh ? '清單上有 ' + st.todos.length + ' 項指令。' : st.todos.length + (st.todos.length > 1 ? ' directives' : ' directive') + ' on the list. ';
    if (st.exams && st.exams.length && st.exams[0].days <= 21) t += zh ? st.exams[0].name + (st.exams[0].days === 0 ? '就是今天。' : '還有 ' + st.exams[0].days + ' 天。') : examLine(st.exams[0]) + '. ';
    if (st.rawPending) t += zh ? '收件匣有 ' + st.rawPending + ' 項待處理。' : st.rawPending + (st.rawPending > 1 ? ' items' : ' item') + ' waiting in the inbox. ';
    const today = new Date().toISOString().slice(0, 10);
    t += fs.existsSync(path.join(VAULT, 'raw', today + ' Morning Report.md'))
      ? (zh ? '晨間報告已就緒。' : 'Your morning report is ready.') : (zh ? '要我跑晨間報告嗎？' : 'Shall I run your morning report?');
    return honor(t);
}

module.exports = { nudge, greet };
