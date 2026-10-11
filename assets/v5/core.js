(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WordbookCore = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const VERSION = 1;
  const DAY = 86400000;
  const BASE = ['door', 'light', 'pencil', 'book'];
  const TOOLS = [...BASE, 'open', 'clean'];
  const CARDS = {
    door: { cost: 1, label: '挡住 6', detail: '获得 6 护盾，每回合褪去 2。', effect: 'shield', value: 6 },
    light: { cost: 1, label: '减攻 2', detail: '目标本回合攻击 −2；照出弱点，下一次 pencil 额外 +2。', effect: 'light', value: 2 },
    pencil: { cost: 1, label: '清除 6', detail: '清除目标 6 点墨痕，也能补回黑板。', effect: 'damage', value: 6 },
    book: { cost: 1, label: '抽 2 张', detail: '抽 2 张牌，手牌最多 6 张。', effect: 'draw', value: 2 },
    open: { cost: 1, label: '打开防线', detail: '打开护盾或当前修复点的封页。', effect: 'open', value: 0 },
    clean: { cost: 1, label: '清除强化', detail: '清除敌人的攻击强化，或黑板上的残墨。', effect: 'clean', value: 0 }
  };
  const copy = x => JSON.parse(JSON.stringify(x));
  function defaults() {
    return { version: VERSION, settings: { voice: true, sound: true, reducedMotion: false }, words: {}, events: [], submitted: [], hints: {}, run: null, collection: [], totalCoins: 0 };
  }
  function validateSave(s) {
    const sceneOK = scene => scene && ['door','light','board','book','window','cat'].every(k => typeof scene[k] === 'boolean') && (!scene.catRoute || ['door','window'].includes(scene.catRoute));
    const hintsOK = hints => !hints || (typeof hints === 'object' && !Array.isArray(hints) && Object.values(hints).every(h => h && typeof h.id === 'string' && typeof h.variant === 'string' && Number.isFinite(h.mistakes) && Array.isArray(h.hints) && h.hints.every(x => typeof x === 'string')));
    const abilityOK = a => a && ['attempts','independent','assisted','mistakes','lastIndependent','due'].every(k => Number.isFinite(a[k]) && a[k] >= 0) && Array.isArray(a.variants) && a.variants.every(v => typeof v === 'string');
    const wordOK = r => r && Number.isFinite(r.exposures) && r.exposures >= 0 && r.abilities && typeof r.abilities === 'object' && Object.values(r.abilities).every(abilityOK);
    const battleOK = b => !b || (['active','repair','won','lost'].includes(b.status) && [1,3,4].includes(b.page) && Number.isInteger(b.phase) && b.phase >= 0 && b.phase <= 2 && Number.isFinite(b.hp) && Number.isFinite(b.energy) && Number.isInteger(b.turn) && Number.isFinite(b.bonusCoins)
      && ['hand','draw','discard'].every(k => Array.isArray(b[k]) && b[k].every(c => c && typeof c.id === 'string' && !!CARDS[c.word]))
      && Array.isArray(b.enemies) && b.enemies.length > 0 && b.enemies.every(e => e && ['小墨点','橡皮小兵','空白页'].includes(e.name) && ['hp','maxHp','attack','shield','boost','weak'].every(k => Number.isFinite(e[k])))
      && Array.isArray(b.guards) && b.guards.every(g => g && Number.isFinite(g.hp) && Number.isFinite(g.decay)) && sceneOK(b.scene) && b.upgrades && Array.isArray(b.reinforced));
    return !!(s && s.version === VERSION && s.words && typeof s.words === 'object' && !Array.isArray(s.words) && Object.values(s.words).every(wordOK)
      && Array.isArray(s.events) && Array.isArray(s.submitted) && s.submitted.every(x => typeof x === 'string') && Array.isArray(s.collection)
      && s.collection.every(c => c && sceneOK(c.scene) && ['door','window'].includes(c.route)) && s.settings && ['voice','sound','reducedMotion'].every(k => typeof s.settings[k] === 'boolean') && hintsOK(s.hints)
      && (!s.run || (Number.isInteger(s.run.page) && s.run.page >= 0 && s.run.page <= 5 && sceneOK(s.run.scene) && Number.isFinite(s.run.hp) && Number.isFinite(s.run.coins) && typeof s.run.id === 'string' && (!s.run.puzzle || ['door','window'].includes(s.run.puzzle))
        && Array.isArray(s.run.completed) && Array.isArray(s.run.introduced) && Array.isArray(s.run.prepared) && s.run.upgrades && battleOK(s.run.battle))));
  }
  function wordRecord(s, word) {
    return s.words[word] || (s.words[word] = { exposures: 0, abilities: {} });
  }
  function event(s, item) {
    s.events.push(item);
    if (s.events.length > 500) s.events.splice(0, s.events.length - 500);
  }
  function expose(s, word, id, now = Date.now()) {
    if (s.submitted.includes(id)) return false;
    s.submitted.push(id);
    wordRecord(s, word).exposures++;
    event(s, { id, word, kind: 'exposure', at: now });
    return true;
  }
  function record(s, result) {
    if (!result || !result.attemptId || result.cancelled || s.submitted.includes(result.attemptId)) return false;
    const allowed = ['recognition', 'listening', 'spelling', 'usage'];
    if (!allowed.includes(result.ability) || !result.word || !Number.isFinite(result.completedAt)) return false;
    const assisted = !!(result.answerRevealed || (result.hints || []).length || result.inputMode === 'trace' || result.inputMode === 'tray');
    const independent = !!result.correct && !assisted;
    const r = wordRecord(s, result.word);
    const a = r.abilities[result.ability] || (r.abilities[result.ability] = { attempts: 0, independent: 0, assisted: 0, mistakes: 0, variants: [], lastIndependent: 0, retained: false, due: 0 });
    a.attempts++;
    a.mistakes += result.mistakes || 0;
    if (independent) {
      if (a.lastIndependent && a.lastVariant && result.variant !== a.lastVariant && result.completedAt - a.lastIndependent >= DAY) a.retained = true;
      a.independent++;
      if (!a.variants.includes(result.variant)) a.variants.push(result.variant);
      a.lastIndependent = result.completedAt;
      a.lastVariant = result.variant;
      const intervals = [1, 3, 7, 14];
      a.due = result.completedAt + intervals[Math.min(a.independent - 1, 3)] * DAY;
    } else if (result.correct) {
      a.assisted++;
      a.due = result.completedAt + DAY;
    }
    const committed = { ...copy(result), independent };
    s.submitted.push(result.attemptId);
    event(s, committed);
    return committed;
  }
  function abilityStatus(a) {
    if (!a) return '未验证';
    if (a.retained) return '间隔后仍会';
    if (a.independent >= 2 && a.variants.length >= 2) return '可以独立完成';
    if (a.independent) return '独立完成过';
    return a.assisted ? '借助帮助完成' : '待再练';
  }
  function dueWords(s, words, now = Date.now()) {
    return words.map(word => ({ word, due: Math.min(...Object.values(s.words[word]?.abilities || {}).map(a => a.due || Infinity), Infinity) }))
      .filter(x => x.due <= now).sort((a, b) => a.due - b.due).slice(0, 2).map(x => x.word);
  }
  function shuffle(a, random = Math.random) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function newRun(now = Date.now()) {
    return { id: 'run-' + now, page: 0, hp: 60, coins: 0, upgrades: {}, completed: [], prepared: [], introduced: [], scene: { door: false, light: false, board: false, book: false, window: false, cat: false }, battle: null, puzzle: null };
  }
  function createBattle(page, run, random = Math.random) {
    const list = page === 1 ? BASE : TOOLS;
    const deck = list.flatMap(w => [0, 1].map(n => ({ id: w + '_' + n, word: w })));
    const first = page === 1 ? ['door', 'pencil', 'book', 'light', 'pencil'] : ['open', 'clean', 'pencil', 'door', 'book'];
    const hand = first.map(w => deck.splice(deck.findIndex(c => c.word === w), 1)[0]);
    const foes = page === 1 ? [{ name: '小墨点', hp: 9, maxHp: 9, attack: 3, shield: 0, boost: 0, weak: 0, exposed: false }, { name: '小墨点', hp: 9, maxHp: 9, attack: 3, shield: 0, boost: 0, weak: 0, exposed: false }]
      : [{ name: page === 3 ? '橡皮小兵' : '空白页', hp: page === 3 ? 24 : 18, maxHp: page === 3 ? 24 : 18, attack: 4, shield: page === 3 ? 6 : 0, boost: 0, weak: 0, exposed: false }];
    if (page === 1) Object.assign(run.scene, { door: false, light: false, board: false, book: false });
    if (page === 3) Object.assign(run.scene, { sealed: true, ink: true });
    if (page === 4) Object.assign(run.scene, { door: false, light: false, board: false, sealed: true, ink: true });
    return { page, status: 'active', turn: 1, energy: 3, hp: run.hp, guards: [], hand, draw: shuffle(deck, random), discard: [], enemies: foes, target: 0, phase: 0, goal: false, basicUsed: false, upgrades: copy(run.upgrades), reinforced: [], action: 0, bonusCoins: 0, scene: copy(run.scene) };
  }
  function config(b, word) {
    const c = CARDS[word];
    if (!c) return null;
    const plus = (b.upgrades[word] || 0) * 2;
    return { ...c, value: c.value + (['shield', 'damage'].includes(c.effect) ? plus : 0) };
  }
  function required(b) {
    if (b.page === 1) return BASE;
    if (b.page === 3) return ['open', 'clean'];
    return [['door', 'open'], ['light', 'open'], ['pencil', 'clean']][b.phase];
  }
  function target(b) { return b.enemies[b.target] || b.enemies.find(e => e.hp > 0); }
  function preview(b, word, extra = 0) {
    const c = config(b, word), e = target(b);
    if (!c) return { valid: false, reason: '这张工具还没有准备好。' };
    if (['won', 'lost'].includes(b.status)) return { valid: false, reason: '本页已经结束。' };
    const repair = b.status === 'repair';
    if (repair && !required(b).includes(word)) return { valid: false, reason: '请选择能完成剩余修复的工具。' };
    if (!repair && b.energy < c.cost) return { valid: false, reason: '墨力不够，结束回合后会回满。' };
    if (!repair && c.effect === 'open' && !(e?.shield > 0 || (b.page === 4 && b.phase < 2 && !b.goal))) return { valid: false, reason: '这里没有需要打开的护盾或封页。' };
    if (!repair && c.effect === 'clean' && !(e?.boost > 0 || (b.page === 4 && b.phase === 2 && !b.goal))) return { valid: false, reason: '现在没有攻击强化；下一回合小兵会强化。' };
    if (!repair && ['damage', 'light'].includes(c.effect) && !(e?.hp > 0)) return { valid: false, reason: '请选择一个还在场上的墨团。' };
    const value = c.value + (['damage', 'shield'].includes(c.effect) ? extra : 0);
    const damage = c.effect === 'damage' ? value + (e?.exposed ? 2 : 0) : 0;
    const descriptions = { shield: `获得 ${value} 护盾`, light: '本回合目标攻击 −2；标出弱点', damage: `清除 ${damage} 点墨痕${e?.exposed ? '（连携 +2）' : ''}`, draw: '抽 2 张，手牌最多 6 张', open: '打开防线／封页', clean: '清除攻击强化／残墨' };
    return { valid: true, cost: repair ? 0 : c.cost, text: repair ? '免费完成剩余修复' : descriptions[c.effect], damage, value };
  }
  function damageEnemy(e, amount) {
    const blocked = Math.min(e.shield, amount);
    e.shield -= blocked;
    e.hp = Math.max(0, e.hp - amount + blocked);
  }
  function draw(b, amount, random = Math.random) {
    while (amount-- > 0 && b.hand.length < 6) {
      if (!b.draw.length) { b.draw = shuffle(b.discard, random); b.discard = []; }
      if (!b.draw.length) break;
      b.hand.push(b.draw.pop());
    }
  }
  function refresh(b) {
    if (b.enemies.every(e => e.hp <= 0)) {
      if (!b.goal) { b.status = 'repair'; return '墨团退场了，完成最后的修复吧。'; }
      if (b.page === 4 && b.phase < 2) {
        b.phase++;
        b.goal = false;
        b.status = 'active';
        b.target = 0;
        b.enemies = [{ name: '空白页', hp: 18, maxHp: 18, attack: 4 + b.phase, shield: 0, boost: 0, weak: 0, exposed: false }];
        return ['入口修好了，接着恢复照明。', '照明恢复了，最后补回黑板。'][b.phase - 1];
      }
      b.status = 'won';
      return '这一页修好了！';
    }
    if (!b.enemies[b.target] || b.enemies[b.target].hp <= 0) b.target = b.enemies.findIndex(e => e.hp > 0);
    return null;
  }
  function repairScene(b, word) {
    const match = b.page !== 4 || required(b).includes(word);
    if (b.page === 1 || (b.page === 4 && match)) {
      if (word === 'door' || (word === 'open' && b.phase === 0)) b.scene.door = true;
      if (word === 'light' || (word === 'open' && b.phase === 1)) { b.scene.light = true; if (word === 'open') b.scene.window = true; }
      if (word === 'pencil' || word === 'clean') b.scene.board = true;
      if (word === 'book') b.scene.book = true;
      if (match) b.goal = true;
    }
    if (b.page === 3 && ['open', 'clean'].includes(word)) { b.goal = true; b.scene.sealed = false; b.scene.ink = false; }
    if (word === 'open') b.scene.sealed = false;
    if (word === 'clean') b.scene.ink = false;
  }
  function useCard(b, cardId, extra = 0, random = Math.random) {
    const repair = b.status === 'repair';
    const card = repair ? { id: cardId, word: cardId.replace('repair_', '') } : b.hand.find(c => c.id === cardId);
    if (!card) return { ok: false, reason: '这张卡已经使用过了。' };
    const p = preview(b, card.word, extra);
    if (!p.valid) return { ok: false, reason: p.reason };
    const c = config(b, card.word), e = target(b);
    b.energy -= p.cost;
    if (!repair) { b.hand = b.hand.filter(x => x.id !== card.id); b.discard.push(card); }
    if (!repair && c.effect === 'damage') { damageEnemy(e, p.damage); e.exposed = false; }
    if (!repair && c.effect === 'shield') b.guards.push({ hp: p.value, decay: 2 });
    if (!repair && c.effect === 'light') { e.weak += 2; e.exposed = true; }
    if (!repair && c.effect === 'open') e.shield = 0;
    if (!repair && c.effect === 'clean') e.boost = 0;
    if (!repair && c.effect === 'draw') draw(b, 2, random);
    repairScene(b, card.word);
    b.action++;
    const next = refresh(b);
    return { ok: true, word: card.word, text: next || p.text, next, damage: p.damage };
  }
  function basic(b) {
    if (b.status !== 'active' || b.basicUsed) return { ok: false, reason: '画笔每回合可用一次。' };
    const e = target(b);
    if (!e || e.hp <= 0) return { ok: false, reason: '没有可清除的墨团。' };
    b.basicUsed = true;
    damageEnemy(e, 3);
    b.action++;
    return { ok: true, text: refresh(b) || '画笔清除了 3 点墨痕。' };
  }
  function shield(b) { return b.guards.reduce((n, g) => n + g.hp, 0); }
  function endTurn(b, random = Math.random) {
    if (b.status !== 'active') return { ok: false };
    const attacks = b.enemies.filter(e => e.hp > 0).map(e => Math.max(0, e.attack + e.boost - e.weak));
    const attack = attacks.reduce((a, n) => a + n, 0);
    let left = attack;
    for (const g of b.guards) { const take = Math.min(g.hp, left); g.hp -= take; left -= take; }
    b.hp = Math.max(0, b.hp - left);
    if (b.hp === 0) { b.status = 'lost'; return { ok: true, attack, damage: left, text: '这一页暂时没守住。学过的词还在，可以重新来。' }; }
    b.guards.forEach(g => g.hp = Math.max(0, g.hp - g.decay));
    b.guards = b.guards.filter(g => g.hp > 0);
    b.turn++;
    b.energy = 3;
    b.basicUsed = false;
    b.enemies.forEach(e => { e.weak = 0; if (b.page === 3 && b.turn === 2 && e.hp > 0) e.boost += 2; });
    b.discard.push(...b.hand);
    b.hand = [];
    draw(b, 5, random);
    b.action++;
    return { ok: true, attack, damage: left, text: `挡住 ${attack - left}，生命 −${left}。墨力回满。${b.page === 3 && b.turn === 2 ? '小兵强化了，现在试试 clean。' : ''}` };
  }
  function normalize(s) { return String(s || '').trim().toLowerCase(); }
  function puzzleAnswer(text, knownWords) {
    const answer = normalize(text);
    if (['door', 'window'].includes(answer)) return { ok: true, answer };
    if (knownWords.includes(answer)) return { ok: false, kind: 'semantic', text: '这个词拼对了，但小猫需要一个入口。试试门或低窗。' };
    return { ok: false, kind: 'spelling', text: '再检查一下字母，或者用提示看看入口的英语。' };
  }
  return { VERSION, DAY, BASE, TOOLS, CARDS, defaults, validateSave, copy, expose, record, abilityStatus, dueWords, newRun, createBattle, config, required, preview, useCard, basic, endTurn, shield, shuffle, normalize, puzzleAnswer };
});
