(function () {
  'use strict';
  const C = window.WordbookCore, Art = window.V5Art;
  const WORDS = window.WORDS_V5, byWord = Object.assign(Object.create(null), Object.fromEntries(WORDS.map(w => [w.word, w])));
  const KEY = 'wbo_v5_demo_v1';
  const app = document.querySelector('#app'), modal = document.querySelector('#modal');
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const word = name => byWord[name] || { word: name, cn: name, art: name, present: 'thing' };
  const taskArt = w => Art.word(w).replace(/aria-label="[^"]*"/, `aria-label="${esc(w.cn)}"`);
  let serial = 0, save = C.defaults(), storageMessage = '', toastTimer, speechTimer, priorFocus, bootRaw = null, storageWritable = true;
  const uid = () => Date.now() + '-' + (++serial);
  try {
    const old = localStorage.getItem('wbo_save_v3') || localStorage.getItem('wbo_save_v2');
    if (old && !localStorage.getItem('wbo_v5_legacy_backup')) localStorage.setItem('wbo_v5_legacy_backup', old);
    const raw = localStorage.getItem(KEY); bootRaw = raw;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!C.validateSave(parsed)) throw new Error('invalid save');
      save = { ...C.defaults(), ...parsed, hints: parsed.hints || {} };
    }
  } catch (_) {
    try { if (bootRaw && !localStorage.getItem(KEY + '_unreadable_backup')) localStorage.setItem(KEY + '_unreadable_backup', bootRaw); }
    catch (_) { storageWritable = false; }
    storageMessage = '保存的进度暂时无法读取，原始记录已保留。你可以先体验，或打开原版游戏。';
  }
  const S = { view: 'home', selected: null, busy: false, task: null, lesson: null, unit: 1, practiceWords: ['door', 'pencil'], ability: 'recognition', practiceBatch: null, practiceSummary: null, message: '', animateCat: false };
  const pages = [
    ['让四个词成真', '教室的一角被擦掉了。点一个词，让它对应的东西重新出现。'],
    ['守住教室的一角', '墨点来了。选工具、看收益，再决定怎么修复这页。'],
    ['给小猫一个入口', '入口消失了，小猫还在外面。画一扇门，或一扇能跳过的低窗。'],
    ['打开防线，清理强化', '新工具 open 和 clean，能解决两种不同的障碍。'],
    ['把完整教室修回来', '入口、照明、黑板。每修好一处，空白页就退去一层。']
  ];
  const btn = (text, action, cls = '', extra = '') => `<button class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`;
  const objective = (text, done) => `<div class="objective ${done ? 'done' : ''}"><i>${done ? '✓' : ''}</i><span>${text}</span></div>`;
  function persist() {
    if (!storageWritable) { storageMessage = '本次以临时进度游玩。原始记录未覆盖，可以从学习手册导出新记录。'; return; }
    try { localStorage.setItem(KEY, JSON.stringify(save)); }
    catch (_) { storageMessage = '浏览器未能保存这次进度。当前仍能游玩，建议从学习手册导出记录。'; }
  }
  function toast(text) {
    const el = $('#toast'); el.textContent = text; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3100);
  }
  function audio(text, done) {
    clearTimeout(speechTimer);
    if (!save.settings.voice || !window.speechSynthesis || !window.SpeechSynthesisUtterance) { done?.(false); return false; }
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => /^en[-_]/i.test(v.lang));
    if (!voice) { done?.(false); return false; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = .8; u.voice = voice;
    let settled = false;
    const finish = ok => { if (!settled) { settled = true; clearTimeout(speechTimer); done?.(ok); } };
    u.onend = () => finish(true); u.onerror = () => finish(false);
    speechTimer = setTimeout(() => { finish(false); speechSynthesis.cancel(); }, 6000);
    speechSynthesis.speak(u); return true;
  }
  function sound() {
    if (!save.settings.sound) return;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      sound.ctx ||= new A(); const ctx = sound.ctx; ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.setValueAtTime(600, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + .12);
      g.gain.setValueAtTime(.045, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .18); o.start(); o.stop(ctx.currentTime + .19);
    } catch (_) {}
  }
  function nav() {
    document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === (S.view === 'adventure' ? 'home' : S.view)));
    $('.sound-switch span').textContent = save.settings.voice ? '朗读开启' : '朗读关闭';
    $('.sound-switch').setAttribute('aria-label', save.settings.voice ? '关闭英语朗读' : '开启英语朗读');
    document.body.classList.toggle('reduce-motion', save.settings.reducedMotion);
  }
  function render() {
    nav();
    if (S.view === 'home') renderHome();
    else if (S.view === 'adventure') renderAdventure();
    else if (S.view === 'practice') renderPractice();
    else renderReport();
    if (storageMessage) app.insertAdjacentHTML('afterbegin', `<div class="storage-note">${esc(storageMessage)}</div>`);
  }
  function changeView(view) {
    if (S.busy) return;
    closeModal(true); S.view = view; S.selected = null; S.message = ''; render(); window.scrollTo({ top: 0 });
  }
  function renderHome() {
    const resume = save.run && save.run.page < 5;
    const showcase = save.collection.at(-1)?.scene || { door: true, window: true, light: true, board: true, book: true, cat: true };
    app.innerHTML = `<div class="home-grid"><section class="home-copy"><div class="eyebrow">A LITTLE WORD. A LITTLE MAGIC.</div><h1>写一个词。<br>让世界多一点<em>色彩。</em></h1><p>书页里的教室被擦坏了。<br>用英语召唤工具，守住书页，<br>也给等在门外的小猫一个入口。</p><div class="button-row">${btn(resume ? `继续第 ${save.run.page + 1} 页 →` : '开始修复教室 →', resume ? 'resume' : 'start', 'primary')}${btn('先练几个词', 'practice', 'ghost')}</div><div class="small muted">第一章 · 5 页冒险 · 可以随时停下</div>${resume ? btn('重新开始这一章', 'restart-confirm', 'ghost compact') : ''}</section><section class="home-book" aria-label="教室书页"><div class="book-cover">${Art.room(showcase)}<div class="book-page-label"><span>CHAPTER 01 · THE CLASSROOM</span><span>一笔一词，一页一世界</span></div></div><div class="floating-word one">${Art.word('light')}<span>light <small class="muted">· 光</small></span></div><div class="floating-word two">${Art.word('door')}<span>door <small class="muted">· 门</small></span></div></section></div><div class="home-notes"><div class="home-note"><span class="note-number">01</span><div><b>词会变成真的工具</b><p>先认识它，再看到它怎样改变场景。</p></div></div><div class="home-note"><span class="note-number">02</span><div><b>你的选择有不同结果</b><p>挡住墨点，照出弱点，或给小猫画一扇窗。</p></div></div><div class="home-note"><span class="note-number">03</span><div><b>需要帮助也能继续</b><p>认词、拼写与理解分别记录，随时回来练。</p></div></div></div>`;
  }
  function start() { save.run = C.newRun(uid()); S.view = 'adventure'; S.selected = null; S.message = ''; persist(); render(); window.scrollTo({ top: 0 }); }
  function heading(run) {
    return `<div class="page-heading"><div><div class="eyebrow">第一章 / THE CLASSROOM</div><h1>${pages[run.page][0]}</h1><p>${pages[run.page][1]}</p></div><div class="page-steps" aria-label="第 ${run.page + 1} 页，共 5 页">${pages.map((_, i) => `${i ? '<span class="step-line"></span>' : ''}<span class="page-step ${i === run.page ? 'current' : i < run.page ? 'done' : ''}">${i < run.page ? '✓' : i + 1}</span>`).join('')}</div></div>`;
  }
  function sceneHTML(scene, opt = {}) { return `<div class="scene-panel"><div class="scene-caption"><strong>${opt.title || '教室 · 正在修复的书页'}</strong><span>${opt.caption || '点选词卡，让物件成真'}</span></div>${Art.room(scene, opt)}</div>`; }
  function renderAdventure() {
    const r = save.run;
    if (!r) { S.view = 'home'; renderHome(); return; }
    if (r.page === 5) { renderCompletion(); return; }
    if (r.page === 0) {
      const done = C.BASE.every(w => r.introduced.includes(w));
      app.innerHTML = heading(r) + `<div class="adventure-layout"><div class="adventure-main">${sceneHTML(r.scene, { title: '四个工具，还差一点颜色', caption: `${r.introduced.filter(w => C.BASE.includes(w)).length} / 4 已出现` })}<div class="intro-grid">${C.BASE.map(w => `<button class="intro-word ${r.introduced.includes(w) ? 'introduced' : ''}" data-action="introduce" data-word="${w}">${Art.word(w)}<strong>${w}</strong><small>${esc(word(w).cn)} · 点一下成真</small></button>`).join('')}</div></div><aside class="sidebar"><section class="guide-panel green"><div class="hint-title">神笔的小秘密</div><h3>先认识，再使用。</h3><p>点下方词卡，听听英语，再看物件出现。你只是认识它，不需要马上拼写。</p>${objective('让四个工具都出现', done)}${btn('试试自己认词 →', 'intro-check', 'primary', done ? '' : 'disabled')}</section><section class="guide-panel"><h3>如果没听见声音</h3><p>可以看图和词形继续。声音不决定你能不能冒险。</p>${btn('回到书桌', 'home', 'ghost')}</section></aside></div>`;
      return;
    }
    if (r.page === 2) { renderPuzzle(r); return; }
    if (!r.battle) { renderPreparation(r); return; }
    renderBattle(r);
  }
  function introduce(w) {
    const r = save.run; if (!r || S.busy) return;
    if (!r.introduced.includes(w)) r.introduced.push(w);
    C.expose(save, w, `${r.id}:intro:${w}`);
    if (w === 'pencil') r.scene.board = true;
    else if (C.BASE.includes(w)) r.scene[w] = true;
    persist(); sound(); audio(w); render(); flash(w);
  }
  function renderPreparation(r) {
    const elite = r.page === 3;
    const learned = ['open', 'clean'].every(w => r.introduced.includes(w));
    const text = r.page === 1 ? '先认出 door 和 light，再带着四个工具出发。本场用牌不重复答题。' : r.page === 3 ? 'open 打开护盾；clean 清掉攻击强化。先看它们怎么用，再做两个小任务。' : '最后一页，听懂一个简单指令就出发。可以看文字完成。';
    app.innerHTML = heading(r) + `<div class="adventure-layout"><div class="adventure-main">${sceneHTML(r.scene, { title: '出发前 · 准备工具', caption: '只做少量准备，不逐牌考试' })}${elite ? `<div class="intro-grid two">${['open','clean'].map(w => `<button class="intro-word ${r.introduced.includes(w) ? 'introduced' : ''}" data-action="tool-lesson" data-word="${w}">${Art.word(w)}<strong>${w}</strong><small>${w === 'open' ? '打开 · 移走防线' : '清理 · 去掉强化'}</small></button>`).join('')}</div>` : ''}</div><aside class="sidebar"><section class="guide-panel green"><div class="hint-title">战斗准备</div><h3>${elite ? '两种问题，两种工具' : r.page === 4 ? '让英语连成一句话' : '先认两个词就好'}</h3><p>${text}</p>${btn(r.page === 4 ? '试试这句指令 →' : '开始准备 →', 'prepare', 'primary', elite && !learned ? 'disabled' : '')}<p class="small">答错会给帮助，工具不会消失。</p></section><section class="guide-panel"><h3>这一页要做什么？</h3><p>${r.page === 1 ? '击退墨点，并用至少一张词卡修复物件。' : r.page === 3 ? '打开护盾或清除强化，再击退小兵。' : '每段清除 18 点墨痕，并修好一个位置。'}</p>${btn('回到书桌', 'home', 'ghost')}</section></aside></div>`;
  }
  function lesson(w, onDone) {
    priorFocus = document.activeElement; S.lesson = { word: w, onDone };
    C.expose(save, w, `lesson:${save.run?.id || 'practice'}:${w}`); persist();
    showDialog(`<div class="dialog-head"><span>先认识一个工具</span>${closeButton()}</div><div class="lesson-card">${Art.word(word(w))}<strong>${esc(w)}</strong><span class="muted">${esc(word(w).cn)}</span><p>${w === 'window' ? '画一扇低窗，小猫可以跳进来。' : C.CARDS[w]?.detail || esc(word(w).sentence)}<br>${esc(word(w).sentence || '')}</p>${btn('♫ 听示范', 'lesson-audio')}${btn('记住它的样子，继续 →', 'lesson-done', 'primary')}</div>`);
    audio(w);
  }
  function beginPreparedBattle() {
    const r = save.run; if (!r) return;
    if (!r.battle) { r.battleStartScene = C.copy(r.scene); r.battleStartHp = r.hp; r.battle = C.createBattle(r.page, r); }
    persist(); S.message = r.page === 1 ? '它们准备攻击。试试用 door 保护自己，或 light → pencil 连携。' : r.page === 3 ? 'open 打开护盾；下一回合小兵强化后，clean 就能派上用场。' : '先修入口：door 或 open 都可以。'; render();
  }
  function prepare() {
    const r = save.run, runId = r.id, page = r.page;
    const list = page === 1 ? ['door','light'] : page === 3 ? ['open','clean'] : ['open'];
    let index = 0;
    const next = () => {
      if (!save.run || save.run.id !== runId || save.run.page !== page) return;
      while (index < list.length && r.prepared.includes(`${page}:${list[index]}`)) index++;
      if (index === list.length) { beginPreparedBattle(); return; }
      const w = list[index];
      openTask({ word: w, ability: page === 4 ? 'usage' : 'recognition', variant: page === 4 ? 'instruction-door' : 'picture', scope: `${runId}:prepare:${page}:${w}`, context: 'adventure', onDone: () => { r.prepared.push(`${page}:${w}`); persist(); index++; next(); } });
    }; next();
  }
  function introCheck() {
    const r = save.run, runId = r.id; let index = 0;
    const next = () => {
      if (save.run?.id !== runId || save.run.page !== 0) return;
      while (index < 2 && r.prepared.includes('intro:' + ['book','pencil'][index])) index++;
      if (index === 2) { advance(); return; }
      const w = ['book','pencil'][index];
      openTask({ word: w, ability: 'recognition', variant: 'picture', scope: `${runId}:intro-check:${w}`, context: 'adventure', onDone: () => { r.prepared.push('intro:' + w); index++; persist(); next(); } });
    }; next();
  }
  function battleGoal(b) {
    if (b.page === 1) return '用任意词卡修复一处物件';
    if (b.page === 3) return '打开护盾或清除攻击强化';
    return ['修复入口 · door / open', '恢复照明 · light / open', '补回黑板 · pencil / clean'][b.phase];
  }
  function renderBattle(r) {
    const b = r.battle, repair = b.status === 'repair', won = b.status === 'won', lost = b.status === 'lost';
    const selected = repair ? (S.selected ? { id: S.selected, word: S.selected.replace('repair_', '') } : null) : b.hand.find(c => c.id === S.selected);
    const preview = selected ? C.preview(b, selected.word, S.boost?.word === selected.word ? 2 : 0) : null;
    const hand = repair ? C.required(b).map(w => ({ id: 'repair_' + w, word: w })) : b.hand;
    const highlight = selected ? ({ door:['door'], light:['light'], pencil:['board'], book:['book'], open:[b.phase === 1 ? 'window' : 'door'], clean:['board'] }[selected.word] || []) : [];
    const sidebar = won ? `<section class="guide-panel green"><div class="hint-title">PAGE RESTORED</div><h3>这一页，修好了。</h3><p>工具和你的选择，让场景发生了变化。+${{1:12,3:18,4:30}[b.page]} 星币。</p>${btn(b.page === 4 ? '看看完整教室 →' : '翻到下一页 →', 'battle-next', 'primary')}${btn('回到书桌', 'home', 'ghost')}</section>` : lost ? `<section class="guide-panel green"><h3>再试一次就好。</h3><p>词卡没有消失，学习记录也还在。重新开始这一场，换个出牌顺序吧。</p>${btn('重新守住这一页 →', 'retry', 'primary')}${btn('回到书桌', 'home', 'ghost')}</section>` : `<section class="guide-panel"><div class="hint-title">本页目标${b.page === 4 ? ` · ${b.phase + 1} / 3` : ''}</div>${objective(battleGoal(b), b.goal)}${objective('清除当前墨团', b.enemies.every(e => e.hp <= 0))}<p>${repair ? '没有敌方压力。下面的工具免费使用，完成修复就能继续。' : '清除墨团与场景修复，都完成才翻页。'}</p></section><section class="guide-panel"><div class="hint-title">下一次敌方行动</div>${b.enemies.filter(e => e.hp > 0).map(e => `<div class="enemy-intent"><span>${e.name}<small>${e.boost ? `强化 +${e.boost} · clean 可清除` : b.page === 3 && b.turn === 1 ? '下一回合强化 +2' : e.weak ? 'light 已减攻' : '准备擦除书页'}</small></span><strong>${Math.max(0,e.attack + e.boost - e.weak)} 攻击</strong></div>`).join('') || '<p>墨团已退场。</p>'}</section>`;
    app.innerHTML = heading(r) + `<div class="adventure-layout battle-layout ${won || lost ? "finished" : ""}"><div class="adventure-main"><div class="goal-strip">${b.goal ? "✓" : "○"} ${battleGoal(b)}　·　${b.enemies.every(e=>e.hp<=0) ? "✓" : "○"} 清除墨团</div>${sceneHTML(b.scene, { title: b.page === 4 ? ['入口 · 第一层','照明 · 第二层','黑板 · 最后一层'][b.phase] : '教室 · 用词卡守住书页', caption: won ? '修复完成' : `回合 ${b.turn} · 准备 ${b.enemies.filter(e=>e.hp>0).reduce((n,e)=>n+Math.max(0,e.attack+e.boost-e.weak),0)} 攻击`, enemies: b.enemies, target: b.target, highlight })}<div class="stats-bar"><span class="stat"><span class="heart">♥</span>生命 <strong>${b.hp}/60</strong></span><span class="stat"><span class="shield-icon">◇</span>护盾 <strong>${C.shield(b)}</strong></span><span class="stat"><span class="energy-icon">✦</span>墨力 <strong>${b.energy}/3</strong></span><span class="stat">星币 <strong>${r.coins}</strong></span></div>${won ? (b.page !== 4 ? `<div class="repair-banner">选一个小奖励，再翻页。<div class="reward-row">${btn('pencil 清除 +2', 'reward', '', 'data-reward="pencil"')}${btn('door 护盾 +2', 'reward', '', 'data-reward="door"')}${btn('恢复 10 生命', 'reward', '', 'data-reward="heal"')}</div><span class="small">${r.rewardPage === r.page ? '奖励已领取。' : '也可以直接继续。'}</span></div>` : '') : lost ? '' : `<div class="hand-area"><div class="hand-heading"><span>${repair ? '免费收尾工具' : '手中的工具 · 先选中，再确认'}</span><span>${repair ? '不需要再答题' : `${b.draw.length} 待抽 / ${b.discard.length} 已用`}</span></div><div class="hand">${hand.map(card => { const cfg = C.config(b, card.word); return `<button class="word-card ${card.id === S.selected ? 'selected' : ''} ${!C.preview(b,card.word).valid ? 'dis' : ''}" data-action="select-card" data-card="${card.id}" data-word="${card.word}" ${S.busy ? 'disabled' : ''}><span class="cost">${repair ? '0' : cfg.cost}</span>${Art.word(card.word)}<b>${card.word}</b><div class="cn">${esc(word(card.word).cn)}</div><div class="card-effect">${cfg.effect === 'damage' ? '清除 ' + cfg.value : cfg.effect === 'shield' ? '挡住 ' + cfg.value : cfg.label}</div></button>`; }).join('')}</div></div>${repair ? '<div class="repair-banner">墨团退场了。使用一个适用词，把剩下的地方修好。</div>' : ''}<div class="action-panel"><div><b>${selected ? selected.word + ' · ' + (preview.valid ? preview.text : preview.reason) : '选一张词卡，看看它能做什么。'}</b><p>${esc(S.message || (selected ? C.CARDS[selected.word].detail : '先看敌人的攻击意图，再考虑挡住、减攻或清除。'))}</p></div><div class="action-tools">${selected ? `${btn('取消', 'cancel-card', 'ghost')}${btn('♫', 'card-audio', '', 'aria-label="听这个词"')}${!repair ? btn(b.reinforced.includes(selected.word) ? '已强化' : '拼写强化', 'reinforce', '', b.reinforced.includes(selected.word) ? 'disabled' : '') : ''}${btn(repair ? '完成修复 →' : '使用 ' + selected.word, 'use-card', 'primary', !preview.valid || S.busy ? 'disabled' : '')}` : ''}</div></div><div class="turn-actions">${btn('画笔普攻 · 3', 'basic', '', b.basicUsed || repair || S.busy ? 'disabled' : '')}${btn('帮助', 'help', 'ghost')}${btn('结束回合 →', 'end-turn', 'primary', repair || S.busy ? 'disabled' : '')}</div>`}</div><aside class="sidebar">${sidebar}</aside></div>`;
  }
  function commitBattle(result) {
    const r = save.run, b = r.battle; r.hp = b.hp; r.scene = C.copy(b.scene); S.message = result.text || ''; S.selected = null;
    if (b.status === 'won' && !r.completed.includes(r.page)) {
      r.completed.push(r.page); const coins = ({1:12,3:18,4:30}[r.page] || 0) + b.bonusCoins; r.coins += coins; save.totalCoins += coins;
    }
    persist(); render(); sound();
  }
  function animateAction(result) {
    if (!result.ok) { toast(result.reason || '现在不能使用。'); return; }
    S.busy = true; commitBattle(result); flash(result.word || '✦');
    const runId = save.run.id, page = save.run.page;
    setTimeout(() => { S.busy = false; if (save.run?.id === runId && save.run.page === page && S.view === 'adventure') render(); }, save.settings.reducedMotion ? 20 : 430);
  }
  function flash(text) {
    const panel = $('.scene-panel'); if (!panel || save.settings.reducedMotion) return;
    panel.insertAdjacentHTML('beforeend', `<div class="scene-flash">${esc(text)}</div>`);
    setTimeout(() => panel.querySelector('.scene-flash')?.remove(), 600);
  }
  function useSelected() {
    if (S.busy || !S.selected || !save.run?.battle) return;
    const b = save.run.battle;
    const selected = b.status === 'repair' ? S.selected.replace('repair_', '') : b.hand.find(c => c.id === S.selected)?.word;
    const extra = S.boost?.word === selected ? 2 : 0;
    const result = C.useCard(b, S.selected, extra); S.boost = null;
    if (result.ok) C.expose(save, result.word, `${save.run.id}:use:${b.page}:${b.action}`);
    animateAction(result);
  }
  function reward(kind) {
    const r = save.run; if (!r || r.battle?.status !== 'won' || r.rewardPage === r.page) return;
    r.rewardPage = r.page;
    if (kind === 'heal') { r.hp = Math.min(60, r.hp + 10); r.battle.hp = r.hp; }
    else r.upgrades[kind] = (r.upgrades[kind] || 0) + 1;
    persist(); render(); toast(kind === 'heal' ? '生命已恢复。' : `${kind} 强化了，下页收益 +2。`);
  }
  function advance() {
    const r = save.run; if (!r) return;
    r.page++; r.battle = null; S.selected = null; S.boost = null; S.message = '';
    if (r.page === 2) { r.scene.door = false; r.scene.window = false; r.scene.cat = false; }
    if (r.page === 5) {
      r.scene.door = true; r.scene.light = true; r.scene.board = true; r.scene.book = true; r.scene.sealed = false; r.scene.ink = false;
      if (!save.collection.some(c => c.runId === r.id)) save.collection.push({ runId: r.id, scene: C.copy(r.scene), route: r.puzzle, at: Date.now() });
    }
    persist(); render(); window.scrollTo({ top: 0 });
  }
  function renderPuzzle(r) {
    const solved = !!r.puzzle;
    app.innerHTML = heading(r) + `<div class="adventure-layout"><div class="adventure-main">${sceneHTML(r.scene, { title: solved ? '小猫到教室里了' : '门和窗都不见了', caption: solved ? `你的解法：${r.puzzle}` : '两种入口，两种结果', catWaiting: !solved, animateCat: S.animateCat })}${solved ? `<div class="repair-banner">${r.puzzle === 'door' ? 'door 成真了。门打开，小猫从地面走进教室。' : 'window 成真了。低窗打开，小猫跳过窗台进入教室。'}<br><span class="small">这次选择会留在你的书页收藏里。</span></div>` : `<div class="puzzle-choices"><button class="puzzle-choice" data-action="solve-puzzle" data-word="door">${Art.word('door')}<span><b>door</b><small>画一扇门 · 从地面走进来</small></span></button><button class="puzzle-choice" data-action="solve-puzzle" data-word="window">${Art.word('window')}<span><b>window</b><small>画一扇低窗 · 跳过窗台</small></span></button></div><div class="puzzle-toolbar">${btn('我想自己拼出来', 'puzzle-spell', 'compact')}${btn('先认识 window', 'window-lesson', 'ghost compact')}<span>选词也可以完成，拼写是自选挑战。</span></div>`}</div><aside class="sidebar"><section class="guide-panel green"><div class="hint-title">你的词，你的解法</div><h3>${solved ? '不是只有一种正确答案。' : '你会给小猫画什么？'}</h3><p>${solved ? '门和低窗都解决了入口问题，但小猫的动作和书页结果不同。' : '选一个合适的英语词，物件就会出现。没学过 window？先看看它的样子。'}</p>${solved ? btn('翻到下一页 →', 'puzzle-next', 'primary') : ''}</section><section class="guide-panel"><h3>英语怎样解决问题？</h3><p>door 是门，window 是窗。两种物件都能成为小猫的入口。</p>${btn('回到书桌', 'home', 'ghost')}</section></aside></div>`;
    S.animateCat = false;
  }
  function solvePuzzle(answer, assisted = false, alreadyRecorded = false) {
    const r = save.run; if (!r || r.page !== 2 || r.puzzle) return;
    if (!alreadyRecorded) C.record(save, { attemptId: `${r.id}:puzzle:choice`, word: answer, ability: 'usage', taskType: 'scene-choice', variant: 'cat-entrance', correct: true, response: answer, inputMode: 'select', hints: assisted ? ['word-demo'] : [], answerRevealed: false, mistakes: 0, context: 'adventure', completedAt: Date.now(), cancelled: false });
    r.puzzle = answer; r.scene[answer] = true; r.scene.cat = true; r.scene.catRoute = answer; r.coins += 12; save.totalCoins += 12;
    C.expose(save, answer, `${r.id}:puzzle:${answer}`); if (!r.introduced.includes(answer)) r.introduced.push(answer);
    persist(); S.animateCat = true; render(); sound(); audio(answer); flash(answer);
  }
  function renderCompletion() {
    const r = save.run, metrics = summary();
    app.innerHTML = `<section class="completion"><div class="eyebrow" style="justify-content:center">CHAPTER RESTORED</div><h1>教室回来了。小猫也回来了。</h1><p class="muted small">你用英语让工具成真，也决定了小猫怎样走进教室。</p>${sceneHTML(r.scene, { title: '你的第一张修复书页', caption: `${r.puzzle === 'window' ? '低窗路线' : '门路线'} · 已收入收藏` })}<div class="complete-summary"><span>独立认读过 ${metrics.recognition} 个词</span><span>独立拼写过 ${metrics.spelling} 个词</span><span>本章获得 ${r.coins} 星币</span></div><div class="button-row">${btn('练练今天的词 →', 'chapter-practice', 'primary')}${btn('看看学习记录', 'report')}${btn('再试另一种入口', 'start', 'ghost')}</div><p class="report-note" style="margin:22px auto">这些是本次实际完成的任务记录。继续游戏与独立掌握分开记录，需要帮助的词可以回来练。</p></section>`;
  }
  function summary() {
    const records = Object.values(save.words), independent = ability => records.filter(r => r.abilities[ability]?.independent > 0).length;
    return { exposures: records.filter(r => r.exposures > 0).length, recognition: independent('recognition'), spelling: independent('spelling'), usage: independent('usage'), assisted: records.filter(r => Object.values(r.abilities).some(a => a.assisted > 0)).length };
  }
  function renderPractice() {
    const pool = WORDS.filter(w => S.unit === 0 || w.unit === S.unit);
    const selected = S.practiceWords.map(word);
    const due = C.dueWords(save, WORDS.map(w => w.word));
    app.innerHTML = `<div class="page-heading"><div><div class="eyebrow">A LITTLE PRACTICE</div><h1>今天先练两个词。</h1><p>从冒险里带回来的词，可以换一种方式再遇见。</p></div><span class="pill">${WORDS.length} 个词 · 6 个单元</span></div><div class="practice-layout"><section class="practice-panel"><h2>选你想练的词</h2><select id="unit-select" aria-label="选择教材单元">${['全部单元','Unit 1 · 教室','Unit 2 · 书包','Unit 3 · 朋友','Unit 4 · 家','Unit 5 · 晚餐','Unit 6 · 家人'].map((v,i) => `<option value="${i}" ${i === S.unit ? 'selected' : ''}>${v}</option>`).join('')}</select><div class="word-picker">${pool.map(w => `<button class="pick-word ${S.practiceWords.includes(w.word) ? 'active' : ''}" data-action="pick-word" data-word="${esc(w.word)}">${esc(w.word)}<small class="muted">${esc(w.cn)}</small></button>`).join('')}</div><p class="small muted">选择 1—2 个词，不用一次练完。</p>${due.length ? btn('练到期的两个词', 'practice-due', 'compact') : ''}</section><section class="practice-panel"><div class="hint-title">选一种练法</div><div class="mode-row">${[['recognition','看图认词'],['listening','听音选词'],['spelling','自己拼写']].map(([a,t]) => `<button class="mode-chip ${S.ability === a ? 'active' : ''}" data-action="practice-mode" data-ability="${a}">${t}</button>`).join('')}</div>${selected.map(w => `<div class="practice-preview">${Art.word(w)}<div><h3>${esc(w.word)}</h3><span class="muted small">${esc(w.cn)}</span><p>${esc(w.sentence)}</p>${btn('♫ 听示范', 'preview-audio', 'ghost compact', `data-word="${esc(w.word)}"`)}</div></div>`).join('') || '<p class="muted">从左边选一个词开始。</p>'}${S.practiceSummary ? `<div class="repair-banner">本次 ${S.practiceSummary.total} 个任务完成：${S.practiceSummary.independent} 次独立完成，${S.practiceSummary.assisted} 次借助帮助。<br>下次会换一种提示再遇见。</div>` : ''}<div class="button-row">${btn(`开始 ${selected.length} 个小任务 →`, 'practice-start', 'primary', selected.length ? '' : 'disabled')}${btn('学习手册', 'report', 'ghost')}</div><p class="report-note">认读、听辨与拼写分开记录。朗读不可用时会切到认读；提示后的成功记为辅助。复习到期也不扣分。</p></section></div>`;
  }
  function practiceStart() {
    if (!S.practiceWords.length) return;
    const batch = { id: uid(), words: S.practiceWords.slice(0,2), index: 0, results: [] }; S.practiceBatch = batch;
    const next = () => {
      if (S.view !== 'practice' || S.practiceBatch !== batch) return;
      if (batch.index === batch.words.length) {
        S.practiceSummary = { total: batch.results.length, independent: batch.results.filter(x => x.independent).length, assisted: batch.results.filter(x => !x.independent).length }; S.practiceBatch = null; render(); return;
      }
      const w = batch.words[batch.index], a = save.words[w]?.abilities[S.ability];
      const variant = S.ability === 'recognition' ? ((a?.attempts || 0) % 2 ? 'meaning' : 'picture') : S.ability === 'spelling' ? ((a?.attempts || 0) % 2 ? 'picture' : 'meaning') : 'audio';
      openTask({ word: w, ability: S.ability, variant, scope: `practice:${w}:${S.ability}:${variant}`, context: 'practice', onDone: result => { batch.results.push(result); batch.index++; next(); } });
    }; next();
  }
  function renderReport() {
    const m = summary(), names = Object.keys(save.words).filter(w => byWord[w]);
    const badge = a => { const text = C.abilityStatus(a); return `<span class="badge ${a?.independent ? 'verified' : a?.assisted ? 'assist' : ''}">${text}</span>`; };
    app.innerHTML = `<div class="page-heading"><div><div class="eyebrow">YOUR WORD NOTEBOOK</div><h1>每一步，都如实留下。</h1><p>看看哪些词独立完成过，哪些词需要再遇见一次。</p></div>${btn('导出记录 ↓', 'export', 'compact')}</div><div class="report-metrics">${[[m.exposures,'接触过的词'],[m.recognition,'独立认读过'],[m.spelling,'独立拼写过'],[m.usage,'独立应用过']].map(([n,t]) => `<div class="metric"><strong>${n}</strong><span>${t}</span></div>`).join('')}</div><div class="learning-table">${names.length ? `<table><thead><tr><th>英语词</th><th>认读</th><th>听辨</th><th>拼写</th><th>应用</th></tr></thead><tbody>${names.map(w => { const r = save.words[w]; return `<tr><td><strong>${esc(w)}</strong><small>${esc(word(w).cn)} · 接触 ${r.exposures} 次</small></td>${['recognition','listening','spelling','usage'].map(a => `<td>${badge(r.abilities[a])}</td>`).join('')}</tr>`; }).join('')}</tbody></table>` : `<div class="report-empty"><h2>你的第一笔还没落下。</h2><p class="muted small">从教室冒险或两个词的练习开始。</p>${btn('开始修复教室 →', 'start', 'primary')}</div>`}</div><p class="report-note">“独立完成过”表示至少一次无提示完成；两种变化题干都独立成功后，显示“可以独立完成”。至少隔 24 小时再次独立完成后，才显示“间隔后仍会”。这些是练习证据，不是发音准确率或学习效果保证。旧版记录保留在原版，不混进新能力。</p><div class="button-row">${btn('再练两个词 →', 'practice', 'primary')}${btn('导入记录', 'import', 'ghost')}${btn(save.settings.reducedMotion ? '恢复动画' : '减少动画', 'motion', 'ghost')}<input id="import-file" type="file" accept="application/json,.json" hidden></div>${save.collection.length ? `<p class="report-note">已收藏 ${save.collection.length} 张教室书页，尝试过：${[...new Set(save.collection.map(c => c.route))].map(x => x === 'window' ? '低窗路线' : '门路线').join('、')}。</p>` : ''}`;
  }
  function closeButton() { return '<button class="icon-btn" data-action="modal-close" aria-label="返回，不扣资源">×</button>'; }
  function showDialog(body, cls = '') {
    if (modal.hidden) priorFocus = document.activeElement;
    modal.hidden = false; modal.innerHTML = `<section class="dialog ${cls}" role="dialog" aria-modal="true" aria-label="英语学习任务" tabindex="-1">${body}</section>`;
    app.inert = true; $('.site-header').inert = true; $('.site-footer').inert = true;
    document.body.classList.toggle('learning-question', !!S.task && !S.task.completed);
    $('.dialog').focus({ preventScroll: true });
  }
  function closeModal(cancel = false) {
    if (modal.hidden) return;
    const task = S.task; S.task = null; S.lesson = null; modal.hidden = true; modal.innerHTML = '';
    app.inert = false; $('.site-header').inert = false; $('.site-footer').inert = false;
    document.body.classList.remove('learning-question');
    if (window.speechSynthesis) speechSynthesis.cancel(); clearTimeout(speechTimer);
    priorFocus?.isConnected && priorFocus.focus({ preventScroll: true });
    if (task?.completed && !task.delivered && !cancel) { task.delivered = true; task.opt.onDone?.(task.result); }
  }
  function openTask(opt) {
    const cache = save.hints[opt.scope] || (save.hints[opt.scope] = { id: 'task-' + uid(), hints: [], mistakes: 0, answerRevealed: false, variant: opt.variant });
    const ability = opt.ability === 'listening' && (!save.settings.voice || !window.speechSynthesis || !speechSynthesis.getVoices().some(v => /^en[-_]/i.test(v.lang))) ? 'recognition' : opt.ability;
    const w = word(opt.word);
    const pool = WORDS.filter(x => x.word !== w.word && x.cn !== w.cn && x.art !== w.art && x.unit === w.unit);
    const distractors = C.shuffle(pool).slice(0,2).map(x => x.word);
    S.task = { opt, id: cache.id, word: w, ability, variant: cache.variant, cache, input: '', choices: opt.ability === 'usage' ? ['door','window','book'] : C.shuffle([w.word,...distractors]), failed: [], completed: false, heard: false, start: performance.now(), downgradedFrom: ability !== opt.ability ? opt.ability : null };
    if (w.present === 'action' && !['open','clean'].includes(w.word) && S.task.variant === 'picture') S.task.variant = 'meaning';
    if (ability === 'recognition' && opt.ability === 'listening') S.task.variant = 'picture';
    if (!opt.puzzle) C.expose(save, w.word, `${cache.id}:shown`);
    persist(); renderTask();
  }
  function renderTask() {
    const t = S.task; if (!t) return;
    if (t.completed) {
      showDialog(`<div class="dialog-head"><span>${t.result.independent ? '独立完成了一次' : '借助帮助，也向前了一步'}</span>${closeButton()}</div><div class="lesson-card">${Art.word(word(t.result.word))}<strong>${esc(t.result.word)}</strong><span class="muted">${esc(word(t.result.word).cn)}</span><p>${t.result.independent ? '这次没有使用提示，记录到对应能力。' : '工具仍然可以使用，下次再试着自己完成。'}</p>${btn('继续 →', 'task-next', 'primary')}</div>`); return;
    }
    const spell = t.ability === 'spelling' || t.opt.puzzle;
    let prompt = '';
    if (t.opt.puzzle) prompt = '<div class="meaning">给小猫一个入口</div><p class="small muted">自己输入一个英语词。门或低窗都可以。</p>';
    else if (t.ability === 'usage') prompt = '<div class="meaning instruction">Open the door.</div><p class="small muted">这句话让你打开哪个物件？</p>';
    else if (t.ability === 'listening') prompt = `${btn('♫ 听一遍', 'task-audio', 'gold')}<p class="small muted">先听声音，再选择对应的英语词。</p>`;
    else prompt = t.variant === 'meaning' ? `<div class="meaning">${esc(t.word.cn)}</div>` : taskArt(t.word);
    const answered = t.cache.answerRevealed;
    const title = t.opt.puzzle ? '把你的解法拼出来' : t.ability === 'usage' ? '根据指令，选择物件' : spell ? '这个词，怎么拼？' : t.ability === 'listening' ? '你听到了哪个词？' : '选出对应的英语词';
    const input = spell ? `<div class="spell-layout"><div><input class="task-input" id="task-input" aria-label="输入英语单词" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text" maxlength="35" value="${esc(t.input)}">${answered ? `<div class="answer-word">${esc(t.opt.puzzle ? 'door / window' : t.word.word)}</div>` : ''}<p class="small muted">点字母或直接输入；可以撤回，不限次数。</p></div><div class="keyboard">${'abcdefghijklmnopqrstuvwxyz'.split('').map(ch => `<button class="key" data-action="task-key" data-key="${ch}">${ch}</button>`).join('')}</div></div>` : `<div class="task-options">${t.choices.map(w => `<button class="task-option ${t.failed.includes(w) ? 'wrong' : ''} ${t.cache.hints.includes('reduce-options') && w !== t.word.word && t.failed.includes(w) ? 'removed' : ''}" data-action="task-option" data-answer="${esc(w)}" ${t.ability === 'listening' && !t.heard ? 'disabled' : ''}>${t.ability === 'usage' ? `${taskArt(word(w))}<span class="small">${esc(word(w).cn)}</span>` : esc(w)}</button>`).join('')}</div>${answered ? `<div class="answer-word">${esc(t.word.word)}</div>` : ''}`;
    const feedback = t.feedback || (t.downgradedFrom ? '朗读不可用，已切换为看图认词，只记录认读。' : '慢慢来。答错不会让工具消失。');
    showDialog(`<div class="dialog-head"><span>${t.opt.context === 'practice' ? '两个词的小练习' : '冒险中的英语准备'}</span>${closeButton()}</div><div class="task-content"><h2>${title}</h2><div class="task-prompt">${prompt}</div>${input}<div class="task-feedback" role="status">${esc(feedback)}</div></div><div class="task-bottom">${spell ? btn('⌫ 撤回', 'task-backspace', 'compact') : btn('返回', 'modal-close', 'ghost compact')}${btn('给我一点帮助', 'task-hint', 'compact')}${spell ? btn('提交 →', 'task-submit', 'primary compact') : answered ? btn('跟着完成 →', 'task-assisted', 'primary compact') : ''}</div>`, spell ? 'task-spelling' : '');
  }
  function taskAudio() {
    const t = S.task; if (!t || t.completed) return;
    const id = t.id;
    audio(t.word.word, ok => {
      if (S.task?.id !== id || S.task.completed) return;
      if (ok) { t.heard = true; t.feedback = '听到了，再选出对应的词。'; }
      else { t.downgradedFrom = 'listening'; t.ability = 'recognition'; t.variant = 'picture'; t.feedback = '朗读不可用，已切到看图认词。'; }
      renderTask();
    });
  }
  function taskHint() {
    const t = S.task; if (!t || t.completed) return;
    if (!t.cache.hints.includes('help')) {
      t.cache.hints.push('help');
      t.feedback = t.opt.puzzle ? '门是 door，低窗是 window。选一个你想画的。' : t.ability === 'usage' ? 'door 是门；指令中的 open 表示打开。' : t.ability === 'spelling' ? `开头是 ${t.word.word[0]}，一共 ${t.word.word.length} 个字母。` : `${t.word.cn} 对应 ${t.word.word}。再看一下。`;
      if (!['spelling','usage'].includes(t.ability) || t.opt.puzzle) t.cache.answerRevealed = true;
    } else {
      t.cache.answerRevealed = true; t.cache.hints.push('answer');
      t.feedback = t.opt.puzzle ? '跟着拼 door 或 window 就可以继续。' : `看看 ${t.word.word}，跟着完成一次。`;
    }
    persist(); renderTask();
  }
  function wrongTask(message, answer) {
    const t = S.task; t.cache.mistakes++; if (answer && !t.failed.includes(answer)) t.failed.push(answer);
    if (t.cache.mistakes === 2) t.cache.hints.push('reduce-options');
    t.feedback = message;
    if (t.cache.mistakes >= 3) { t.cache.answerRevealed = true; if (!t.cache.hints.includes('answer')) t.cache.hints.push('answer'); t.feedback = '看看示范，跟着完成一次就能继续。'; }
    persist(); renderTask();
  }
  function finishTask(response, chosenWord) {
    const t = S.task; if (!t || t.completed) return;
    const result = { attemptId: t.id, word: chosenWord || t.word.word, wordId: word(chosenWord || t.word.word).id, taskType: t.opt.puzzle ? 'puzzle-spelling' : t.ability, ability: t.opt.puzzle ? 'spelling' : t.ability, correct: true, response, inputMode: t.opt.puzzle || t.ability === 'spelling' ? 'free' : 'select', variant: t.variant, mistakes: t.cache.mistakes, hints: t.cache.hints.slice(), answerRevealed: t.cache.answerRevealed, context: t.opt.context, elapsedMs: Math.round(performance.now() - t.start), completedAt: Date.now(), cancelled: false, speech: { attempted: false, method: null }, trace: { attempted: false }, downgradedFrom: t.downgradedFrom };
    const committed = C.record(save, result);
    if (!committed) return;
    t.completed = true; t.result = committed; delete save.hints[t.opt.scope]; persist(); sound(); renderTask();
  }
  function submitTask() {
    const t = S.task; if (!t || t.completed) return;
    const value = C.normalize(t.input);
    if (!value) { t.feedback = '先放上几个字母。'; renderTask(); return; }
    if (t.opt.puzzle) {
      const match = C.puzzleAnswer(value, WORDS.map(w => w.word));
      if (match.ok) finishTask(value, match.answer);
      else if (match.kind === 'semantic') { t.feedback = match.text; renderTask(); }
      else wrongTask(match.text);
    } else if (value === C.normalize(t.word.word)) finishTask(value);
    else wrongTask('字母还差一点。可以撤回，也可以用提示。');
  }
  function reinforce() {
    const r = save.run, b = r?.battle, card = b?.hand.find(c => c.id === S.selected);
    if (!card || S.busy || b.reinforced.includes(card.word)) return;
    const runId = r.id, page = r.page;
    openTask({ word: card.word, ability: 'spelling', variant: 'meaning', scope: `${runId}:reinforce:${page}:${card.word}`, context: 'adventure', onDone: result => {
      if (save.run?.id !== runId || save.run.page !== page || save.run.battle !== b) return;
      if (!b.reinforced.includes(card.word)) {
        b.reinforced.push(card.word);
        if (['damage','shield'].includes(C.CARDS[card.word].effect)) S.boost = { word: card.word };
        if (b.bonusCoins < 4) b.bonusCoins += 2;
      }
      persist(); S.message = ['damage','shield'].includes(C.CARDS[card.word].effect) ? '本次使用收益 +2，已包含在预览里。' : '练习已记录。本场额外星币 +2；抽牌和状态效果不翻倍。'; render();
    } });
  }
  function help() {
    showDialog(`<div class="dialog-head"><span>工具怎么用</span>${closeButton()}</div><h2>看意图，选工具，再确认。</h2><p class="report-note">每回合 3 墨力，出牌后从墨力中扣除费用。先点卡，再点墨团换目标，最后确认使用。画笔普攻每回合一次，清除 3 点墨痕。</p><p class="report-note">door 的每件护盾在敌方行动后、下一回合开始时褪去 2。light 只减少本回合攻击，照出的弱点可让下一次 pencil +2。book 抽 2 张，手牌最多 6 张。</p><p class="report-note">熟词直接使用；拼写强化是可选的，每词每场一次。答错会给帮助，不删卡。清除敌人后若还有修复目标，会提供免费收尾工具。</p>${btn('知道了，继续', 'modal-close', 'primary')}`);
  }
  function exportSave() {
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '单词画笔-v5-学习记录.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 500);
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]'); if (!el || el.disabled || el.closest('[inert]')) return;
    const action = el.dataset.action;
    if (S.busy && !['modal-close','voice'].includes(action)) return;
    switch (action) {
      case 'home': case 'practice': case 'report': changeView(action); break;
      case 'start': closeModal(true); start(); break;
      case 'resume': S.view = 'adventure'; render(); window.scrollTo({top:0}); break;
      case 'restart-confirm': showDialog(`<div class="dialog-head"><span>重新开始这一章</span>${closeButton()}</div><h2>换一种修复方法？</h2><p class="report-note">重新开始教室冒险，已提交的学习记录和收藏保留。</p>${btn('重新开始 →','start','primary')}`); break;
      case 'voice': save.settings.voice = !save.settings.voice; persist(); nav(); toast(save.settings.voice ? '朗读已开启。' : '朗读已关闭，可以看图继续。'); break;
      case 'motion': save.settings.reducedMotion = !save.settings.reducedMotion; persist(); render(); break;
      case 'introduce': introduce(el.dataset.word); break;
      case 'intro-check': introCheck(); break;
      case 'tool-lesson': { const w = el.dataset.word; lesson(w, () => { if (!save.run.introduced.includes(w)) save.run.introduced.push(w); persist(); render(); }); break; }
      case 'window-lesson': lesson('window', () => { if (!save.run.introduced.includes('window')) save.run.introduced.push('window'); persist(); render(); }); break;
      case 'prepare': prepare(); break;
      case 'select-card': S.selected = S.selected === el.dataset.card ? null : el.dataset.card; S.message = ''; render(); break;
      case 'card-audio': { const b = save.run.battle, name = b.status === 'repair' ? S.selected.replace('repair_','') : b.hand.find(c => c.id === S.selected)?.word; if (name && !audio(name)) toast('当前没有可用的英语朗读，仍可看图继续。'); break; }
      case 'cancel-card': S.selected = null; S.message = ''; render(); break;
      case 'use-card': useSelected(); break;
      case 'basic': animateAction(C.basic(save.run.battle)); break;
      case 'end-turn': animateAction(C.endTurn(save.run.battle)); break;
      case 'reinforce': reinforce(); break;
      case 'reward': reward(el.dataset.reward); break;
      case 'battle-next': if (save.run.battle?.status === 'won') advance(); break;
      case 'retry': { const r = save.run; r.scene = C.copy(r.battleStartScene); r.hp = r.battleStartHp; r.battle = C.createBattle(r.page,r); S.selected = null; S.boost = null; persist(); render(); break; }
      case 'help': help(); break;
      case 'solve-puzzle': { const w = el.dataset.word; if (w === 'window' && !save.run.introduced.includes(w)) lesson(w, () => solvePuzzle(w,true)); else solvePuzzle(w); break; }
      case 'puzzle-spell': { const r = save.run, runId = r.id; openTask({ word:'door', ability:'spelling', variant:'cat-entrance', scope:`${runId}:puzzle:spell`, context:'adventure', puzzle:true, onDone: result => { if (save.run?.id === runId && save.run.page === 2) solvePuzzle(result.word,!result.independent,true); } }); break; }
      case 'puzzle-next': if (save.run.puzzle) advance(); break;
      case 'chapter-practice': S.practiceWords = ['door','pencil']; S.unit = 1; changeView('practice'); break;
      case 'pick-word': if (S.practiceWords.includes(el.dataset.word)) S.practiceWords = S.practiceWords.filter(w => w !== el.dataset.word); else if (S.practiceWords.length < 2) S.practiceWords.push(el.dataset.word); else { S.practiceWords.shift(); S.practiceWords.push(el.dataset.word); } S.practiceSummary=null; render(); break;
      case 'practice-mode': S.ability = el.dataset.ability; S.practiceSummary=null; render(); break;
      case 'practice-due': S.practiceWords = C.dueWords(save, WORDS.map(w=>w.word)); S.unit=0; render(); break;
      case 'practice-start': practiceStart(); break;
      case 'preview-audio': if (!audio(el.dataset.word)) toast('当前没有可用的英语朗读。'); break;
      case 'export': exportSave(); break;
      case 'import': $('#import-file').click(); break;
      case 'modal-close': closeModal(); break;
      case 'lesson-audio': if (!audio(S.lesson.word)) toast('当前没有可用的英语朗读。'); break;
      case 'lesson-done': { const done = S.lesson?.onDone; closeModal(true); done?.(); break; }
      case 'task-next': closeModal(); break;
      case 'task-audio': taskAudio(); break;
      case 'task-hint': taskHint(); break;
      case 'task-assisted': finishTask(S.task.word.word); break;
      case 'task-option': { const t = S.task, answer = el.dataset.answer; if (!t || t.completed || (t.ability === 'listening' && !t.heard)) return; if (answer === (t.ability === 'usage' ? 'door' : t.word.word)) finishTask(answer); else wrongTask(t.ability === 'usage' ? '这句话说的是门，再找一找。' : '再看看图或意思，需要帮助也可以。', answer); break; }
      case 'task-key': if (S.task && !S.task.completed) { S.task.input = (S.task.input + el.dataset.key).slice(0,35); $('#task-input').value = S.task.input; } break;
      case 'task-backspace': if (S.task && !S.task.completed) { S.task.input = S.task.input.slice(0,-1); $('#task-input').value = S.task.input; } break;
      case 'task-submit': submitTask(); break;
    }
  });
  document.addEventListener('click', e => {
    if (S.view !== 'adventure' || !modal.hidden || S.busy) return;
    const enemy = e.target.closest('[data-enemy]');
    if (enemy && save.run?.battle && save.run.battle.enemies[+enemy.dataset.enemy]?.hp > 0) { save.run.battle.target = +enemy.dataset.enemy; persist(); S.message = '目标已切换。预览会跟着更新。'; render(); return; }
    const zone = e.target.closest('[data-zone]'); if (!zone || !save.run) return;
    if (save.run.page === 0) { const w = {board:'pencil',book:'book',door:'door',light:'light'}[zone.dataset.zone]; if (w) introduce(w); }
    else if (save.run.page === 2 && !save.run.puzzle && ['door','window'].includes(zone.dataset.zone)) { $(`[data-action="solve-puzzle"][data-word="${zone.dataset.zone}"]`)?.click(); }
    else toast('选一张词卡，场景会高亮它能改变的位置。');
  });
  document.addEventListener('input', e => { if (e.target.id === 'task-input' && S.task) S.task.input = e.target.value; });
  document.addEventListener('change', async e => {
    if (e.target.id === 'unit-select') { S.unit = +e.target.value; render(); }
    if (e.target.id === 'import-file' && e.target.files[0]) {
      try { const data = JSON.parse(await e.target.files[0].text()); if (!C.validateSave(data)) throw new Error(); localStorage.setItem(KEY + '_before_import', JSON.stringify(save)); save = { ...C.defaults(),...data,hints:data.hints || {} }; persist(); render(); toast('学习记录已恢复，导入前的记录已备份。'); }
      catch (_) { toast('文件格式不正确，当前记录没有被修改。'); }
    }
  });
  document.addEventListener('keydown', e => {
    if (!modal.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key === 'Tab') {
        const items = [...modal.querySelectorAll('button:not(:disabled),input,[tabindex="0"]')].filter(x => !x.hidden && x.offsetParent !== null);
        if (items.length && (e.shiftKey && document.activeElement === items[0] || !e.shiftKey && document.activeElement === items.at(-1))) { e.preventDefault(); (e.shiftKey ? items.at(-1) : items[0]).focus(); }
      }
      if (S.task && !S.task.completed && (S.task.ability === 'spelling' || S.task.opt.puzzle)) {
        if (e.key === 'Enter') { e.preventDefault(); submitTask(); }
        else if (e.target.id !== 'task-input' && /^[a-z]$/i.test(e.key)) { e.preventDefault(); S.task.input += e.key.toLowerCase(); $('#task-input').value = S.task.input; }
        else if (e.target.id !== 'task-input' && e.key === 'Backspace') { e.preventDefault(); S.task.input = S.task.input.slice(0,-1); $('#task-input').value = S.task.input; }
      }
    } else if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-enemy],[data-zone]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click',{bubbles:true})); }
  });
  // Read-only observability for browser QA; game actions still go through visible controls.
  window.V5Game = { get save() { return save; }, get state() { return S; }, key: KEY, words: WORDS };
  render();
})();
