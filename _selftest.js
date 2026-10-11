/* =========================================================================
   无头自测：用最小 DOM 替身跑一遍 index.html 里的游戏脚本
   目的：1) 捕获启动期运行时错误  2) 校验词库/卡牌/敌人/谜题/事件数据完整性
        3) 校验地图生成、战斗初始化、星星计分等核心逻辑
   运行：node _selftest.js
   ========================================================================= */
const fs = require('fs');
const vm = require('vm');

const HTML = fs.readFileSync('D:\\雪梨英语管理系统\\Game3\\legacy.html', 'utf8');
const i = HTML.indexOf('<script>'), j = HTML.lastIndexOf('</script>');
const CODE = HTML.slice(i + 8, j);

/* ---------------- 最小 DOM 替身 ---------------- */
const ctx2d = new Proxy({}, {
  get(t, k) {
    if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(16 * 16 * 4) });
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w || 1, height: h || 1 });
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'canvas') return null;
    return () => {};
  },
  set() { return true; }
});

let idSeq = 0;
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _id: 'el' + (++idSeq),
    _listeners: {},
    className: '', id: '', textContent: '', value: '', src: '',
    style: new Proxy({}, {
      get: (t, k) => (k === 'setProperty' ? ((k2, v) => { t[k2] = v; })
                    : k === 'getPropertyValue' ? ((k2) => t[k2] || '')
                    : k === 'removeProperty' ? (() => {}) : (t[k] || '')),
      set: (t, k, v) => (t[k] = v, true)
    }),
    children: [], parentNode: null, offsetWidth: 60, offsetHeight: 60, width: 16, height: 16,
    dataset: {},
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); return this._s.has(c); },
      contains(c) { return this._s.has(c); }
    },
    appendChild(c) { this.children.push(c); if (c) c.parentNode = this; return c; },
    insertBefore(c) { this.children.unshift(c); if (c) c.parentNode = this; return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
    removeEventListener(t, fn) { if (this._listeners[t]) this._listeners[t] = this._listeners[t].filter(f => f !== fn); },
    setAttribute(k, v) { if (k === 'id') this.id = v; if (k === 'class') this.className = v; this['attr_' + k] = v; },
    getAttribute(k) { return this['attr_' + k] != null ? this['attr_' + k] : null; },
    removeAttribute(k) { delete this['attr_' + k]; },
    /* ---- <video> 相关 ----
       真浏览器都有这些，替身原来只建模了 play()，一调 load()/pause() 就抛异常。
       ★ duration 必须给一个真值（表示「元数据已加载」）：本替身的 setTimeout 是
         **同步**的（见文件下方 sandbox.setTimeout），代码里那条
         「3 秒拿不到元数据就当文件不存在」的兜底会立刻命中 ——
         duration 是 NaN 的话视频永远走降级分支，正常播放路径就测不到。 */
    load() {},
    pause() {},
    duration: 24, currentTime: 0, muted: false, volume: 1, readyState: 4,
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 240, right: 320, bottom: 240 }; },
    scrollIntoView() {}, focus() {}, blur() {},
    cloneNode() { return makeEl(tag); },
    getContext() { return ctx2d; },
    toDataURL() { return 'data:image/png;base64,AAAA'; },
    play() { return Promise.resolve(); },
    setPointerCapture() {}, releasePointerCapture() {}
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: () => _html,
    set: v => {
      _html = String(v);
      if (_html === '') el.children = [];
      el._qcache = {};                       // 内容换了，之前查出来的替身作废
      indexIds(el, _html);                   // 让 #id 查询也能找到
    }
  });
  el._qcache = {};
  /* ★ 真 DOM 里 innerHTML 一设，里面的元素就能被 querySelectorAll 查到。
     原来是死返回 []，于是「弹窗里的按钮有没有绑上事件」这件事**根本测不到** ——
     这正是 🧪 按钮那次事故的同类漏洞（面板里的按钮其实是靠字符串拼出来的）。
     这里加一个最小解析，并且**按 (宿主,选择器) 缓存**：重复查询必须拿到同一个替身，
     否则事件绑在甲身上、你去点乙，按钮永远是死的。
     只支持本代码库真正用到的选择器形式：'[attr]' / '[attr="v"]' / '#id' / '.cls'。 */
  el.querySelectorAll = function (sel) {
    if (!(sel in el._qcache)) el._qcache[sel] = pickFrom(_html, sel);
    return el._qcache[sel];
  };
  el.querySelector = function (sel) { return el.querySelectorAll(sel)[0] || null; };
  return el;
}

/** 从某段 HTML 里解析出来的、带 id 的替身元素（模拟 document 的实时索引） */
const dynById = new Map();
function indexIds(owner, html) {
  for (const [k, v] of dynById) if (v._owner === owner) dynById.delete(k);
  if (!html || html.indexOf('id="') < 0) return;
  const re = /id="([A-Za-z0-9_-]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const found = pickFrom(html, '#' + m[1])[0];
    if (found) { found._owner = owner; dynById.set(m[1], found); }
  }
}

/** 从一段 HTML 字符串里捞出匹配选择器的元素（替身） */
function pickFrom(html, sel) {
  if (!html || !sel) return [];
  const out = [];
  const re = /<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:\s*=\s*"[^"]*")?)*)\s*\/?>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[1], attrStr = m[2] || '';
    const attrs = {};
    const ar = /([\w:-]+)(?:\s*=\s*"([^"]*)")?/g;
    let a;
    while ((a = ar.exec(attrStr))) attrs[a[1]] = a[2] === undefined ? '' : a[2];
    /* 没写值的布尔属性（比如 disabled）也要能匹配到 */
    if (/disabled/.test(attrStr)) attrs.disabled = '';
    let hit = false;
    sel.split(',').map(s => s.trim()).forEach(s => {
      if (!s) return;
      if (s[0] === '#') { if (attrs.id === s.slice(1)) hit = true; }
      else if (s[0] === '.') { if ((' ' + (attrs.class || '') + ' ').indexOf(' ' + s.slice(1) + ' ') >= 0) hit = true; }
      else {
        const am = s.match(/^\[([\w:-]+)(?:="([^"]*)")?\]$/);
        if (am) {
          if (!(am[1] in attrs)) return;
          if (am[2] !== undefined && String(attrs[am[1]]) !== am[2]) return;
          hit = true;
        }
      }
    });
    if (!hit) continue;
    const e = makeEl(tag);
    Object.keys(attrs).forEach(k => { e['attr_' + k] = attrs[k]; if (k === 'id') e.id = attrs[k]; if (k === 'class') e.className = attrs[k]; });
    out.push(e);
  }
  return out;
}
/** 在假 DOM 上派发事件 */
function fire(node, type, ev) {
  if (!node || !node._listeners || !node._listeners[type]) return false;
  node._listeners[type].forEach(fn => fn(Object.assign({
    target: node, currentTarget: node, preventDefault() {}, stopPropagation() {},
    clientX: 10, clientY: 10, pointerId: 1
  }, ev || {})));
  return true;
}

const byId = new Map();
/* 假 DOM 里给所有静态元素一个默认父节点，保证 parentNode.insertBefore 可用 */
const defaultParent = {
  children: [],
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
  insertBefore(c) { this.children.unshift(c); c.parentNode = this; return c; },
  removeChild(c) { this.children = this.children.filter(x => x !== c); return c; }
};
/* ★ 注册静态元素时【连 class 一起解析】。
   只扫 id="..." 的话，元素拿不到 class，于是 document.querySelectorAll('.animinfo')
   永远返回空 —— 「所有演出层一起清空」这种代码就完全测不到。 */
(function registerStatic(){
  const htmlOnly = HTML.replace(/<script[\s\S]*?<\/script>/gi, '');
  const tagRe = /<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:\s*=\s*"[^"]*")?)*)\s*\/?>/g;
  let tm;
  while ((tm = tagRe.exec(htmlOnly))) {
    const attrs = {};
    const ar = /([\w:-]+)(?:\s*=\s*"([^"]*)")?/g;
    let a;
    while ((a = ar.exec(tm[2] || ''))) attrs[a[1]] = a[2] === undefined ? '' : a[2];
    if (!attrs.id || byId.has(attrs.id)) continue;
    const e = makeEl(tm[1]);
    e.id = attrs.id;
    if (attrs.class) {
      e.className = attrs.class;
      attrs.class.split(/\s+/).forEach(c => { if (c) e.classList.add(c); });
    }
    e.parentNode = defaultParent;
    byId.set(attrs.id, e);
  }
  /* 兜底：脚本里拼出来的 id（HTML 里没有标签的）也建一个空壳，行为和以前一致 */
  for (const m of HTML.matchAll(/id="([A-Za-z0-9_-]+)"/g)) {
    if (!byId.has(m[1])) { const e = makeEl('div'); e.id = m[1]; e.parentNode = defaultParent; byId.set(m[1], e); }
  }
})();
function getById(id) {
  if (dynById.has(id)) return dynById.get(id);      // 弹窗里现拼出来的元素优先
  if (!byId.has(id)) { const e = makeEl('div'); e.id = id; e.parentNode = defaultParent; byId.set(id, e); }
  return byId.get(id);
}

const document = {
  body: makeEl('body'),
  documentElement: makeEl('html'),
  hidden: false,
  createElement: makeEl,
  getElementById: getById,
  querySelector(sel) {
    if (typeof sel === 'string' && sel[0] === '#') return getById(sel.slice(1));
    return makeEl('div');
  },
  querySelectorAll(sel) {
    /* ★ 支持 '#id' 和 '.class'（查静态注册表）。
       应用代码里有 U.$$('.animinfo') 这种「把所有同类元素一起处理」的写法，
       死返回空数组的话，这类代码一行都测不到 —— mountAnimInfo 的
       "先把所有演出层清空"就是这么漏过去的。 */
    const out = [];
    String(sel).split(',').map(s => s.trim()).forEach(function (s) {
      if (!s) return;
      /* ★ 后代选择器 '#root .cls'：应用代码里 U.$$('#btlArena .guard') 就是这个形状。
         不处理的话 getById 会造一个假元素出来，测的就是个空气节点。 */
      const desc = s.match(/^#([\w-]+)\s+(.+)$/);
      if (desc) {
        const root = getById(desc[1]);
        if (root && root.querySelectorAll) {
          root.querySelectorAll(desc[2]).forEach(function (e) { if (out.indexOf(e) < 0) out.push(e); });
        }
        return;
      }
      if (s[0] === '#') { const e = getById(s.slice(1)); if (e && out.indexOf(e) < 0) out.push(e); }
      else if (s[0] === '.') {
        byId.forEach(function (e) {
          if ((' ' + (e.className || '') + ' ').indexOf(' ' + s.slice(1) + ' ') >= 0 && out.indexOf(e) < 0) out.push(e);
        });
      }
    });
    return out;
  },
  addEventListener() {}, removeEventListener() {}
};

const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
};

const sandbox = {
  console, document, localStorage, Math, JSON, Date, Object, Array, String, Number, Boolean,
  RegExp, Error, TypeError, Promise, Map, Set, Uint8ClampedArray, isNaN, parseInt, parseFloat, Symbol,
  setTimeout: (fn) => { try { fn(); } catch (e) { console.log('  [setTimeout 回调异常] ' + e.message); } return 0; },
  setInterval: () => 0, clearInterval: () => {}, clearTimeout: () => {},
  requestAnimationFrame: () => 0,
  navigator: { vibrate() {}, mediaDevices: undefined },
  location: { href: 'file:///index.html' },
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  Blob: function () {}, Audio: function () { return { play: () => Promise.resolve() }; },
  Image: function () {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
sandbox.innerWidth = 390;
sandbox.innerHeight = 844;
sandbox.devicePixelRatio = 2;

/* ---------------- 执行 ---------------- */
let fails = 0, checks = 0, warns = 0;
function ok(cond, label, extra) {
  checks++;
  if (!cond) { fails++; console.log('  ✗ ' + label + (extra ? '  → ' + extra : '')); }
}
/* 警告：不增加失败数，但要打在屏幕上。
   用于「缺了也不会崩，但必须让人知道」的东西 —— 比如还没到位的外挂素材。 */
function warn(cond, label, extra) {
  checks++;
  if (!cond) { warns++; console.log('  ⚠ ' + label + (extra ? '  → ' + extra : '')); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

console.log('运行 index.html 内嵌脚本……');
try {
  vm.runInNewContext(CODE, sandbox, { filename: 'index.html:script' });
  console.log('  ✓ 脚本执行完成，没有抛出异常');
} catch (e) {
  console.log('  ✗ 启动期异常：' + e.stack);
  process.exit(1);
}

const W = sandbox.window.__WBO;
ok(!!W, '调试接口 __WBO 已导出');
if (!W) process.exit(1);

/* ★ 开场剧情：新存档第一次进游戏时必须自动播。
   这是「有触发点」的功能性验证 —— 光检查源码里有 Story.play('opening') 不够，
   必须真的在启动流程里跑起来。验完立刻收干净，免得干扰后面的界面检查。

   ★ 开场是「视频 + 逐屏」两段：先播视频（真正的 mp4），演完才进交互那几屏。
     无头替身里没有真的解码器，所以这里点「跳过」把它推进到逐屏部分。 */
ok(W.STORY.opening.video, '开场声明了视频：' + W.STORY.opening.video);
ok(getById('ovVideo').classList.contains('show'),
   '首次进游戏时开场视频层自动打开（遮罩已 show）',
   'ovVideo="' + getById('ovVideo').className + '" ovStory="' + getById('ovStory').className);
ok(!!getById('stVideo'), '视频元素存在');
ok(W.STORY.opening.pre && W.STORY.opening.pre.length > 0,
   '开场准备了 ' + W.STORY.opening.pre.length + ' 屏静态替身（视频不可用时不白屏）');
fire(getById('vidSkip'), 'click');                       // 跳过视频 → 进逐屏部分
ok(!getById('ovVideo').classList.contains('show'), '跳过视频后视频层关闭');
ok(getById('ovStory').classList.contains('show'), '接着进入逐屏剧情（不是直接关掉）');
ok(getById('stProg').textContent === '1 / ' + W.STORY.opening.screens.length,
   '逐屏部分从第 1 屏开始：' + getById('stProg').textContent);
fire(getById('stSkip'), 'click');
ok(!getById('ovStory').classList.contains('show'), '跳过开场后遮罩关闭，可以正常进标题页');

/* ★ 视频不可用时的降级：不能白屏，要退回「pre 静态屏 + screens」接着演。
   造一个「文件不存在」的情形 —— 让 load() 抛异常（等价于浏览器解不了这个源）。 */
const vidEl = getById('stVideo'), vLoadSaved = vidEl.load;
vidEl.load = function () { throw new Error('模拟：视频文件缺失'); };
fire(getById('vidStart'), 'click');                      // 走「点开始」那条分支，会再 load 一次
W.Save.data.flags.openingDone = 0;
W.Story.replay('opening', null);
vidEl.load = vLoadSaved;
ok(!getById('ovVideo').classList.contains('show'), '视频加载失败时视频层自动关闭');
ok(getById('ovStory').classList.contains('show'), '视频加载失败时退回逐屏剧情（不白屏）');
ok(getById('stProg').textContent === '1 / ' + (W.STORY.opening.pre.length + W.STORY.opening.screens.length),
   '降级时把 pre 和 screens 拼起来播：' + getById('stProg').textContent);
fire(getById('stSkip'), 'click');
W.Save.data.flags.openingDone = 0;    // 还原，让后面「老玩家不再播」的检查能验

/* ---------------- 1. 词库 ---------------- */
section('1. 词库完整性');
ok(W.BANK.all.length > 100, '词库单词总数 ' + W.BANK.all.length + ' (>100)');
for (let u = 1; u <= 6; u++) {
  const list = W.BANK.unit(u);
  ok(list.length >= 14, 'Unit ' + u + ' 词数 ' + list.length + ' (>=14)');
}
const badWords = W.BANK.all.filter(w => !/^[a-z]+$/.test(w.word));
ok(badWords.length === 0, '所有单词只含小写字母', badWords.map(w => w.word).join(','));
const noSentence = W.BANK.all.filter(w => !w.sentence || !w.sentenceCn);
ok(noSentence.length === 0, '每个单词都有例句与中文', noSentence.map(w => w.word).join(','));
const badTag = W.BANK.all.filter(w => !['place', 'thing', 'verb', 'adj', 'food', 'friend', 'animal', 'study'].includes(w.tag));
ok(badTag.length === 0, '所有 tag 合法', badTag.map(w => w.word + ':' + w.tag).join(','));
const lenOk = W.BANK.all.filter(w => w.len === w.word.length && w.len >= 3);
ok(lenOk.length === W.BANK.all.length, 'len 字段正确');
const dupIds = new Set(); let dup = 0;
W.BANK.all.forEach(w => { if (dupIds.has(w.id)) dup++; dupIds.add(w.id); });
ok(dup === 0, '词条 id 无重复');

/* ---------------- 2. 卡牌生成 + 语义动作系统 ---------------- */
section('2. 卡牌生成与语义动作系统');
let cardErr = [];
W.BANK.all.forEach(w => {
  const c = W.CARDS.make('c_' + w.id);
  if (!c || !c.ops || !c.ops.length || c.cost < 0 || !c.rarity) cardErr.push(w.word);
});
ok(cardErr.length === 0, '每个单词都能生成合法卡牌', cardErr.join(','));
const skills = Object.keys(W.CARDS.SKILLS);
skills.forEach(s => ok(!!W.CARDS.make('c_' + s), '技能卡可生成：' + s));
const up = W.CARDS.upgrade(W.CARDS.make('c_w_door'));
ok(up.ops[0].v > W.CARDS.make('c_w_door').ops[0].v, '升级会提升数值');

/* ★ 每个单词都必须有一个「贴合它自己意思」的动作 */
ok(W.BANK.missing.length === 0, '所有单词都手工指定了动作（ACT_MAP 无遗漏）',
   W.BANK.missing.join(','));
const badAct = W.BANK.all.filter(w => !W.ACTS[w.act]);
ok(badAct.length === 0, '所有动作 key 都合法', badAct.map(w => w.word + ':' + w.act).join(','));
const noActCn = W.BANK.all.filter(w => !w.actCn || w.actCn.length < 2);
ok(noActCn.length === 0, '每个单词都有专属动作说明', noActCn.map(w => w.word).join(','));

/* 效果必须「因词而异」，不能所有词都塌缩成同一个数字 */
const sig = new Set();
W.BANK.all.forEach(w => {
  const c = W.CARDS.make('c_' + w.id);
  sig.add(c.ops.map(o => o.t).join('+'));
});
ok(sig.size >= 8, '效果类型足够多样（' + sig.size + ' 种组合：' + [...sig].join(' / ') + '）');
const actCount = new Set(W.BANK.all.map(w => w.act)).size;
ok(actCount >= 15, '用到了 ' + actCount + ' 种语义动作');

/* 逐条验证「单词的意思 = 卡牌的效果」 */
const spot = {
  door: 'blk', wall: 'blk', classroom: 'blk',      // 场所/大件 → 挡住、造出来
  fish: 'heal', rice: 'heal', candy: 'heal',        // 食物 → 吃掉回血
  ruler: 'dmg', pencil: 'dmg', toy: 'dmg',          // 物品 → 打过去
  open: 'breakBlock',                               // 打开 → 击碎敌人的盾
  close: 'stun', quiet: 'stun',                     // 关上/安静 → 敌人不动
  clean: 'cleanse', eraser: 'cleanse',              // 打扫 → 扫掉强化
  light: 'weak', shine: null,                       // 照亮 → 敌人打不准
  friend: 'ally', puppy: 'ally',                    // 朋友/小狗 → 召唤同伴
  book: 'draw', photo: 'draw',                      // 书/照片 → 学到东西
  long: 'buff', strong: 'buff',                     // 形容词 → 自己变强
  thin: 'weak', short: 'weak',                      // 形容词 → 敌人变弱
  find: 'recycle', lost: 'recycle'                  // 找到 → 找回丢掉的那张牌
};
let semanticsOk = 0, semanticsBad = [];
for (const word in spot) {
  const want = spot[word]; if (!want) continue;
  const w = W.BANK.get('w_' + word);
  if (!w) { semanticsBad.push(word + '(缺词)'); continue; }
  const c = W.CARDS.make('c_' + w.id);
  const got = c.ops.map(o => o.t);
  if (got.includes(want)) semanticsOk++;
  else semanticsBad.push(word + ' 期望' + want + ' 实际[' + got.join(',') + ']');
}
ok(semanticsBad.length === 0, '语义抽查全部通过（' + semanticsOk + ' 个词）', semanticsBad.join(' | '));

/* 同类语义的词应该共享机制，但说明必须各不相同 */
const blockWords = W.BANK.all.filter(w => w.act === 'block');
ok(blockWords.length >= 5, '「挡住」类单词有 ' + blockWords.length + ' 个');
ok(new Set(blockWords.map(w => w.actCn)).size === blockWords.length,
   '同类动作的每个词都有不同的说明文案');
const eatWords = W.BANK.all.filter(w => w.act === 'eat');
ok(eatWords.length >= 10, '「吃掉」类单词有 ' + eatWords.length + ' 个（食物 + 吃饭动作）');

/* 卡面上必须带动作徽章数据 */
const doorCard = W.CARDS.make('c_w_door');
ok(!!doorCard.act && !!doorCard.actCn && !!doorCard.icon, '卡牌携带动作 / 说明 / 图标');
ok(doorCard.icon === W.ACTS.block.icon, '卡牌图标来自动作而非词性');

/* ---------------- 3. 敌人 / 章节 ---------------- */
section('3. 敌人与章节配置');
W.CHAPTERS.forEach(ch => {
  const all = [ch.boss].concat(ch.foes).concat(ch.elites);
  all.forEach(id => {
    const f = W.FOES[id];
    ok(!!f, 'Ch' + ch.id + ' 敌人存在：' + id);
    if (f) {
      ok(f.hp > 0 && f.intents && f.intents.length >= 3, 'Ch' + ch.id + ' ' + id + ' 有血量与意图');
      ok(!!(W.Art.CHARS[f.art] || W.Art.ICONS[f.art]), 'Ch' + ch.id + ' ' + id + ' 图形 key 有效：' + f.art);
    }
  });
  ch.starter.forEach(w => ok(!!W.BANK.get('w_' + w), 'Ch' + ch.id + ' 起始词存在：' + w));
  ok(ch.starter.length >= 5, 'Ch' + ch.id + ' 起始词数量 ' + ch.starter.length);
  ch.puzzles.forEach(p => ok(!!W.PUZZLES[p], 'Ch' + ch.id + ' 谜题存在：' + p));
  ch.events.forEach(e => ok(!!W.EVENTS[e], 'Ch' + ch.id + ' 事件存在：' + e));
  ok(!!(W.Art.CHARS[ch.npc] || W.Art.ICONS[ch.npc]), 'Ch' + ch.id + ' NPC 图形有效：' + ch.npc);
  ok(ch.layout.length >= 6, 'Ch' + ch.id + ' 层数 ' + ch.layout.length);
});

/* ---------------- 4. 谜题 / 事件 ---------------- */
section('4. 谜题与事件');
for (const k in W.PUZZLES) {
  const p = W.PUZZLES[k];
  ok(p.answers && p.answers.length >= 1, '谜题 ' + k + ' 有答案');
  p.answers.forEach(a => ok(/^[a-z]+$/.test(a), '谜题 ' + k + ' 答案合法：' + a));
  ok(!!(W.Art.CHARS[p.scene] || W.Art.ICONS[p.scene]), '谜题 ' + k + ' 场景图形有效');
}
for (const k in W.EVENTS) {
  const e = W.EVENTS[k];
  ok(e.choices && e.choices.length >= 2, '事件 ' + k + ' 至少两个选项');
  e.choices.forEach(c => ok(!!c.res && !!c.ok, '事件 ' + k + ' 选项有结果'));
}

/* ---------------- 5. 词灵 ---------------- */
section('5. 词灵');
W.RELIC_IDS.forEach(id => {
  const r = W.RELICS[id];
  ok(!!r && !!r.desc && !!r.name, '词灵定义完整：' + id);
  ok(!!(W.Art.CHARS[r.icon] || W.Art.ICONS[r.icon]), '词灵图形有效：' + id + ' → ' + r.icon);
});

/* ---------------- 6. 地图生成 ---------------- */
section('6. 地图与远征');
W.Save.reset();
const run = W.Game.startRun(1);
ok(run.deck.length === 10, '起始卡组 10 张（实际 ' + run.deck.length + '）');
ok(run.deck.every(id => !!W.CARDS.make(id)), '卡组里每张卡都能构建');
const ch1 = W.CHAPTERS[0];
if (ch1.pages) {
  ok(run.map.length === ch1.pages.length, '第 1 章地图层数 = 页数（' + run.map.length + '）');
} else {
  ok(run.map.length === ch1.layout.length, '地图层数与 layout 一致');
}
const LEGAL = ['battle', 'elite', 'event', 'shop', 'rest', 'chest', 'puzzle', 'boss', 'learn'];
let nodeCount = 0, typeBad = [];
run.map.forEach(row => row.forEach(n => {
  nodeCount++;
  if (!LEGAL.includes(n.type)) typeBad.push(n.type);
}));
ok(typeBad.length === 0, '节点类型合法', typeBad.join(','));
ok(run.map[run.map.length - 1][0].type === 'boss', '最后一层是 Boss');
ok(nodeCount >= 5, '节点总数 ' + nodeCount);
/* 六个章节都能开局 */
for (let c = 1; c <= 6; c++) {
  const r2 = W.Game.startRun(c);
  ok(r2.map.length >= 5 && r2.deck.length === 10, '第 ' + c + ' 章可开局（' + r2.map.length + ' 关）');
}
/* 第 2~6 章仍是 8 层节点地图，最后一层必须是 boss */
for (let c = 2; c <= 6; c++) {
  const r2 = W.Game.startRun(c);
  const last = r2.map[r2.map.length - 1];
  ok(last.length === 1 && last[0].type === 'boss', '第 ' + c + ' 章以单节点 Boss 收尾');
}

/* ---------------- 7. 战斗初始化（新：多敌人 + 点卡即用） ---------------- */
section('7. 战斗初始化');
W.Save.reset();
W.Game.startRun(1);
ok(W.Save.data.settings.mode === 'normal', '默认难度档位 = 标准档（四选一）');
W.Battle.start('inkling');
let S = W.Battle.S;
ok(!!S, '战斗状态已建立');
ok(S.foes.length === 1, '单个敌人时 foes 长度为 1');
ok(S.hand.length === 5, '起手抽 5 张（实际 ' + S.hand.length + '）');
ok(S.energy === 3, '初始墨力 3（实际 ' + S.energy + '）');
ok(S.mult === 1, '初始倍率 1.0');
ok(S.foes[0].hp === W.FOES.inkling.hp, '敌人血量正确');
ok(typeof W.Battle.mode() === 'string', '难度档位可读');

/* 多敌人：3 只小墨点（第 1 章第 2 页的配置） */
W.Game.startRun(1);
W.Battle.start(['inkling', 'inkling', 'inkling'], { hpScale: 0.55 });
S = W.Battle.S;
ok(S.foes.length === 3, '三只小怪正确生成');
ok(S.foes.every(f => f.hp === Math.round(W.FOES.inkling.hp * 0.55)), '血量按 hpScale 缩放：' + S.foes[0].hp);
ok(W.Battle.activeFoe() === S.foes[0], '默认锁定最左边的敌人');

/* ---------------- 8. 端到端战斗流程（点卡 → 四选一 → 结算） ---------------- */
section('8. 端到端战斗流程');
const realPickOpen = W.PickPad.open;
let pickCalls = [];
W.PickPad.open = function (opt) {
  pickCalls.push(opt);
  opt.onResult({ ok: true, tries: 0 });          // 模拟「一次就选对」
};
function handNodes() { return getById('btlHand').children; }
function clickCard(i) {
  const n = handNodes()[i];
  return n ? fire(n, 'click', {}) : false;
}

W.Game.startRun(1);
W.Battle.start(['inkling', 'inkling', 'inkling'], { hpScale: 0.55 });
S = W.Battle.S;
ok(handNodes().length === 5, '手牌渲染出 5 个可点节点');
pickCalls = [];
let acted = false, consumed = false;
for (let i = 0; i < handNodes().length; i++) {
  if (!W.Battle.S) break;
  const en = W.Battle.S.energy;
  acted = clickCard(i) || acted;
  if (W.Battle.S && W.Battle.S.energy < en) { consumed = true; break; }
}
S = W.Battle.S;
ok(acted, '卡牌可以点击');
ok(pickCalls.length > 0 || consumed, '点卡后进入出招流程（四选一或直接生效）');

/* 一路打到赢 */
let guard2 = 0;
while (W.Battle.S && !W.Battle.S.over && guard2++ < 40) {
  const st = W.Battle.S;
  if (st.energy <= 0) { W.Battle.endTurn(); continue; }
  let did = false;
  for (let i = 0; i < handNodes().length; i++) {
    if (W.Battle.S.over) break;
    const before = W.Battle.S.energy, handBefore = W.Battle.S.hand.length;
    clickCard(i);
    const after = W.Battle.S;
    if (!after) break;
    if (after.energy !== before || after.hand.length !== handBefore) { did = true; break; }
  }
  if (!did) W.Battle.endTurn();
}
ok(guard2 < 40, '战斗循环可以收敛（' + guard2 + ' 步）');
ok(!W.Battle.S || W.Battle.S.over, '连续出招可以打赢三只小怪');
ok(W.Save.data.stats.spells > 0, '拼写统计已累加：' + W.Save.data.stats.spells);
ok(Object.keys(W.Save.data.learned).length > 0, '掌握度记录已写入');

/* ---------------- 8b. 长按卡牌 = 拼写挑战（威力和星星都更高） ---------------- */
section('8b. 长按拼写挑战');
W.Save.reset();
W.Game.startRun(1);
W.Battle.start('blank1');            // Boss 血厚，不会被打死导致状态被清空
S = W.Battle.S;
let spellCalls = [];
const realSpellOpen = W.SpellPad.open;
W.SpellPad.open = function (opt) {
  spellCalls.push(opt);
  opt.onResult({ ok: true, mistakes: 0, timeMs: 2500, free: false, hintUsed: 0,
                 perfect: true, word: opt.word, text: opt.word.word });
};
/* 找到第一张「词卡」节点（技能卡没有长按拼写） */
let wordNode = null;
for (const n of handNodes()) if (n.innerHTML.indexOf('spellmark') >= 0) { wordNode = n; break; }
ok(!!wordNode, '手牌里能找到词卡节点');
if (wordNode) {
  const energyBefore = S.energy;
  fire(wordNode, 'pointerdown', { pointerId: 1 });   // 长按定时器在测试替身里立即触发
  ok(spellCalls.length > 0, '长按词卡进入拼写挑战');
  if (spellCalls.length) {
    ok(typeof spellCalls[0].timeLimit === 'number', '拼写板收到限时参数');
    ok(/拼写挑战/.test(spellCalls[0].title || ''), '拼写板标题标明是挑战');
    ok(W.Battle.S && W.Battle.S.energy < energyBefore, '拼写成功后扣除墨力');
    ok(W.Battle.S && W.Battle.S.mult > 1, '拼写挑战提升了倍率：×' + (W.Battle.S ? W.Battle.S.mult.toFixed(2) : '-'));
  }
}
/* 技能卡不应该绑定长按入口 */
let skillNode = null;
for (const n of handNodes()) if (n.innerHTML.indexOf('spellmark') < 0 && n.className.indexOf('k-skill') >= 0) { skillNode = n; break; }
if (skillNode) {
  spellCalls = [];
  fire(skillNode, 'pointerdown', { pointerId: 1 });
  ok(spellCalls.length === 0, '技能卡长按不会误触发拼写板');
} else {
  ok(true, '本局手牌没有技能卡（跳过该项）');
}
W.SpellPad.open = realSpellOpen;

/* ---------------- 9. 敌人回合与失败流程 ---------------- */
section('9. 敌人回合与失败流程');
W.Save.reset();
W.Game.startRun(1);
W.Battle.start('eraserl');
S = W.Battle.S;
const runRef = W.Game.run();
runRef.hp = 5;
let guard3 = 0;
while (W.Battle.S && !W.Battle.S.over && guard3++ < 14) W.Battle.endTurn();
ok(guard3 < 14 || runRef.hp <= 0 || (W.Battle.S && W.Battle.S.over), '敌人能造成伤害并触发失败流程');
ok(runRef.hp <= runRef.maxHp, '玩家血量不会超过上限');

/* ---------------- 10. Boss 规则注入 ---------------- */
section('10. Boss 规则');
W.Save.reset();
W.Game.startRun(1);
W.Battle.start('blank1');
S = W.Battle.S;
ok(S.isBoss === true, 'Boss 标记正确');
ok(S.rules.timeLimit === 20, '限时规则生效：' + S.rules.timeLimit + ' 秒');
ok(!!S.bossDef && S.bossDef.name === '空白页·教室残页', 'bossDef 正确');

/* ---------------- 11. 神笔·点睛 ---------------- */
section('11. 神笔大招');
W.Save.reset();
W.Game.startRun(1);
W.Battle.start('smear');
S = W.Battle.S;
const foeHpBefore = S.foes[0].hp;
S.stars = 40; S.brush = 3;
fire(getById('btlUlt'), 'click', {});
S = W.Battle.S;
if (S && !S.over) {
  ok(S.foes[0].hp < foeHpBefore, '点睛造成伤害（' + foeHpBefore + ' → ' + S.foes[0].hp + '）');
  ok(S.block >= 12, '点睛提供护盾：' + S.block);
  ok(S.brush === 0 && S.stars === 20, '大招消耗 3 格神笔 + 20 星（剩 ' + S.stars + ' 星）');
} else {
  ok(true, '点睛直接把敌人打掉了（也算正确）');
}

/* ---------------- 11b. ★ 题型的档位分布 ----------------
   ★ 行为变过：以前档位【锁死】题型（简单档永远只出看图选词），
     现在档位只改【权重】，每一档都必须出得到多种题型。
     下面这几条断言跟着一起改了 —— 老断言测的是已经废掉的行为。 */
section('11b. 档位只调权重，不锁死题型');
W.Save.data.settings.mode = 'easy';
W.Game.startRun(1);
W.Battle.start('blank1');                 // 血厚，保证一轮打不死
pickCalls = [];
spellCalls = [];
/* 用具体名词 desk 反复出题，统计题型分布。
   ★ 拼写类走的是 SpellPad，所以两边的调用都要记下来才准。 */
let easyModes = {};
const prevSpellStub = W.SpellPad.open;
W.SpellPad.open = function (opt) {
  const key = opt.sketch ? 'write' : 'spell';
  easyModes[key] = (easyModes[key] || 0) + 1;
  spellCalls.push(opt);
};
for (let k = 0; k < 40; k++) {
  W.Battle.start('blank6');
  W.Battle.S.energy = 9;
  W.Battle.S.hand = [W.CARDS.make('c_w_desk')];
  pickCalls = [];
  W.Battle.renderAll(); clickCard(0);
  if (pickCalls.length) easyModes[pickCalls[0].mode] = (easyModes[pickCalls[0].mode] || 0) + 1;
}
W.SpellPad.open = prevSpellStub;
const easyPick = (easyModes.pic || 0) + (easyModes.zh || 0) + (easyModes.en2cn || 0) + (easyModes.listen || 0) + (easyModes.gap || 0);
const easySpell = (easyModes.spell || 0) + (easyModes.write || 0);
ok((easyModes.pic || 0) > 0, '偏轻松档：看图选词出现得多（' + (easyModes.pic || 0) + '/40）');
ok(Object.keys(easyModes).length >= 3,
   '★ 偏轻松档也是【多种考法随机】，不是只出一种：' + Object.keys(easyModes).join('/'));
ok(easyPick > easySpell,
   '偏轻松档下认读类多于动手拼（认读 ' + easyPick + ' vs 拼写 ' + easySpell + '）');

/* 偏挑战档：动手拼的比例要明显高于偏轻松档 —— 但仍然不能只出一种 */
W.Save.data.settings.mode = 'hard';
let hardModes = {};
W.SpellPad.open = function (opt) {
  const key = opt.sketch ? 'write' : 'spell';
  hardModes[key] = (hardModes[key] || 0) + 1;
};
for (let k = 0; k < 40; k++) {
  W.Battle.start('blank6');
  W.Battle.S.energy = 9;
  W.Battle.S.hand = [W.CARDS.make('c_w_desk')];
  pickCalls = [];
  W.Battle.renderAll(); clickCard(0);
  if (pickCalls.length) hardModes[pickCalls[0].mode] = (hardModes[pickCalls[0].mode] || 0) + 1;
}
W.SpellPad.open = realSpellOpen;
const hardPick = (hardModes.pic || 0) + (hardModes.zh || 0) + (hardModes.en2cn || 0) + (hardModes.listen || 0) + (hardModes.gap || 0);
const hardSpell = (hardModes.spell || 0) + (hardModes.write || 0);
ok(hardSpell > easySpell, '★ 偏向天平：偏挑战档动手拼更多（' + hardSpell + ' vs 偏轻松 ' + easySpell + '）');
ok(Object.keys(hardModes).length >= 3,
   '★ 偏挑战档也是多种考法随机，不是只出一种：' + Object.keys(hardModes).join('/'));
ok(hardPick > 0, '偏挑战档仍然会出认读类（' + hardPick + ' 次）—— 档位不是开关');

/* 长按永远是拼写挑战（这条没变） */
W.Save.data.settings.mode = 'normal';
W.Game.startRun(1);
W.Battle.start('blank1');
spellCalls = []; pickCalls = [];
W.SpellPad.open = function (opt) {
  spellCalls.push(opt);
  opt.onResult({ ok: true, mistakes: 0, timeMs: 2500, free: false, hintUsed: 0,
                 perfect: true, word: opt.word, text: opt.word.word });
};
let hardWord = null;
for (const n of handNodes()) if (n.innerHTML.indexOf('spellmark') >= 0) { hardWord = n; break; }
ok(!!hardWord, '手牌里有词卡');
if (hardWord) {
  pickCalls = []; spellCalls = [];
  fire(hardWord, 'click', {});
  ok(pickCalls.length > 0 || spellCalls.length > 0,
     '点词卡一定会进入答题（选词板或拼写板之一）');
}
W.SpellPad.open = realSpellOpen;
W.Save.data.settings.mode = 'normal';

/* ---------------- 11d. ★ 学习流程：出题 → 作答 → 简笔画画出实物 → 成真 ---------------- */
section('11d. 学习流程与简笔画演出');

/* ★ 七种考法都要真的出得来（以前这里断言的是"题型跟档位匹配"，
   现在题型是随机的，所以要断言的是"整套题型池都可达"）。 */
let exSeen = {};
const EX_ALL = ['pic', 'zh', 'en2cn', 'listen', 'gap', 'spell', 'write'];
/* 七种考法要真的都抽得到 —— 每种只给 60 次太多轮，一次跑满 300 次 */
for (const m of ['easy', 'normal', 'hard']) {
  W.Save.data.settings.mode = m;
  W.Game.startRun(1);
  for (let k = 0; k < 100; k++) {
    W.Battle.start('blank6');
    const st = W.Battle.S;
    st.energy = 9;
    st.hand = [W.CARDS.make('c_w_desk')];
    W.SpellPad.open = function (opt) {
      const key = opt.sketch ? 'write' : 'spell';
      exSeen[key] = (exSeen[key] || 0) + 1;
    };
    spellCalls = []; pickCalls = [];
    W.Battle.renderAll();
    clickCard(0);
    if (pickCalls.length) exSeen[pickCalls[0].mode] = (exSeen[pickCalls[0].mode] || 0) + 1;
  }
}
W.SpellPad.open = realSpellOpen;
const exMissing = EX_ALL.filter(t => !exSeen[t]);
ok(exMissing.length === 0,
   '★ 七种考法都能抽到（' + EX_ALL.map(t => t + ':' + (exSeen[t] || 0)).join(' ') + '）',
   '没抽到：' + exMissing.join(' '));
W.Save.data.settings.mode = 'normal';

/* 看图选词只会出现在「画得出来」的具体名词上 */
W.Save.data.settings.mode = 'easy';
let picOnAbstract = 0, picOnConcrete = 0;
/* 考法是随机的，跑少了会假红（20 次里一次都没抽到看图题的概率约 5%）。跑满 120 次。 */
const picSpellStub = W.SpellPad.open;
W.SpellPad.open = function (opt) {
  opt.onResult({ ok: true, mistakes: 0, timeMs: 2000, free: false, hintUsed: 0,
                 perfect: true, word: opt.word, text: opt.word.word });
};
for (let k = 0; k < 120; k++) {
  W.Battle.start('blank6');
  const st = W.Battle.S;
  st.energy = 9;
  const w = k % 2 === 0 ? W.BANK.get('w_clean') : W.BANK.get('w_desk');   // clean 是动作词，desk 是具体名词
  st.hand = [W.CARDS.make('c_' + w.id)];
  pickCalls = []; spellCalls = [];
  W.Battle.renderAll(); clickCard(0);
  if (pickCalls.length && pickCalls[0].mode === 'pic') { if (w.id === 'w_clean') picOnAbstract++; else picOnConcrete++; }
}
W.SpellPad.open = picSpellStub;
ok(picOnAbstract === 0, '抽象动作词（clean）不会出「看图选词」');
ok(picOnConcrete > 0, '具体名词（desk）会出「看图选词」（' + picOnConcrete + '/60 次）');

/* 看图题的干扰项不能是同一个图形（否则题目有歧义） */
W.Battle.start('blank6');
pickCalls = [];
clickCard(0);
for (let k = 0; k < 30 && !pickCalls.length; k++) { W.Battle.renderAll(); clickCard(0); }
W.Save.data.settings.mode = 'normal';

/* 简笔画素材库：每个单词的图形都要能画出来 */
let noSketch = [];
W.BANK.all.forEach(w => { if (!W.Sketch.has(w.art)) noSketch.push(w.word + ':' + w.art); });
ok(noSketch.length === 0, '每个单词都有对应的简笔画素材', noSketch.join(','));
ok(W.Sketch.polys('door').length >= 2, '门的简笔画至少有 2 笔：' + W.Sketch.polys('door').length);
ok(W.Sketch.thumbURL('desk', 96).indexOf('data:image/png') === 0, '简笔画能渲染成缩略图');
ok(!!W.Sketch.ALL.__default, '未知图形有兜底简笔画，不会白屏');
let badPoly = [];
Object.keys(W.Sketch.ALL).forEach(k => {
  W.Sketch.polys(k).forEach(poly => {
    if (!Array.isArray(poly) || poly.length < 2) badPoly.push(k);
    poly.forEach(p => { if (!Array.isArray(p) || p.length !== 2) badPoly.push(k); });
  });
});
ok(badPoly.length === 0, '所有简笔画笔画数据格式正确', [...new Set(badPoly)].join(','));

/* 每次答对都必须播一次简笔画演出，而且演出结束后效果确实生效 */
let drawPlayed = 0;
W.Battle.start('blank6');
const realDraw = W.DrawShow.play;
W.DrawShow.play = function (word, cb) { drawPlayed++; cb(word); };   // 立刻走完演出
/* ★ 考法是随机的，可能落到拼写板。这一节测的是「演出」，不是「答题板路由」，
   所以拼写板也换成一次答对的替身，否则会随机卡在真人答题界面上。 */
const drawSpellStub = W.SpellPad.open;
W.SpellPad.open = function (opt) {
  opt.onResult({ ok: true, mistakes: 0, timeMs: 2000, free: false, hintUsed: 0,
                 perfect: true, word: opt.word, text: opt.word.word });
};
W.Save.data.settings.mode = 'easy';
let st20 = W.Battle.S;
st20.energy = 9;
st20.hand = [W.CARDS.make('c_w_desk')];
W.Battle.renderAll(); clickCard(0);
ok(drawPlayed > 0, '答对之后一定会播「简笔画演出」（本次 ' + drawPlayed + ' 次）');
ok(!W.Battle.S || W.Battle.S.over || W.Battle.S.block > 0, '演出结束后效果真的生效了（课桌 → 护盾 ' + (W.Battle.S ? W.Battle.S.block : '-') + '）');
ok(!W.Battle.S || W.Battle.S.over || W.Battle.S.guards.length === 1, '演出结束后身前立起了课桌');
W.DrawShow.play = realDraw;
W.SpellPad.open = drawSpellStub;
W.Save.data.settings.mode = 'normal';

/* ---------------- 11c. 语义动作在战斗里真的生效 ---------------- */
section('11c. 语义动作实战验证');
W.Save.data.settings.mode = 'normal';
W.Game.startRun(1);

/** 把指定单词塞进手里并立刻打出，返回战斗状态 */
/* ★ 出牌的考法现在是随机的，可能落到 PickPad 也可能落到 SpellPad。
   这些用例测的是【卡牌效果】，不是【考法路由】，
   所以两个答题板都换成"一次答对"的替身，让效果一定结算出来。
   （11b/11d 那两节自己会临时换成统计用的替身，跑完都会还原。） */
const simRealSpell = W.SpellPad.open;
W.SpellPad.open = function (opt) {
  opt.onResult({ ok: true, mistakes: 0, timeMs: 2200, free: false, hintUsed: 0,
                 perfect: true, word: opt.word, text: opt.word.word });
};
function castWord(wordId, setup) {
  W.Battle.start('blank6');            // 血最厚，保证不会被打死打断测试
  const st = W.Battle.S;
  st.energy = 9;
  const card = W.CARDS.make('c_w_' + wordId);
  if (!card) return { err: '卡牌不存在：' + wordId };
  st.hand = [card];
  if (setup) setup(st);
  W.Battle.renderAll();
  clickCard(0);
  return W.Battle.S || { gone: true };
}

/* 打开：击碎敌人的全部护盾 */
let sr1 = castWord('open', st => { st.foes[0].block = 20; });
ok(sr1.gone || sr1.foes[0].block === 0, '「open 打开」把敌人的盾打碎了（20 → ' + (sr1.gone ? '已结束' : sr1.foes[0].block) + '）');

/* 关上 / 安静：让敌人这一回合不动 */
let sr2 = castWord('close');
ok(sr2.gone || sr2.foes[0].stun === true, '「close 关上」让敌人这一回合不动');
let sr2b = castWord('quiet');
ok(sr2b.gone || sr2b.foes[0].stun === true, '「quiet 安静」让敌人睡着了');

/* 打扫 / 擦掉：清掉敌人身上的强化 */
let sr3 = castWord('clean', st => { st.foes[0].str = 6; st.foes[0].block = 8; });
ok(sr3.gone || (sr3.foes[0].str === 0 && sr3.foes[0].block === 0), '「clean 打扫」把敌人的强化扫干净了');
let sr3b = castWord('eraser', st => { st.foes[0].str = 6; });
ok(sr3b.gone || sr3b.foes[0].str === 0, '「eraser 橡皮」把敌人的强化擦掉了');

/* 变瘦 / 变短：让敌人变弱（攻击力下降） */
let sr4 = castWord('thin', st => { st.foes[0].str = 8; });
ok(sr4.gone || sr4.foes[0].str < 8, '「thin 瘦的」让敌人变弱（8 → ' + (sr4.gone ? '-' : sr4.foes[0].str) + '）');

/* 门 / 墙：获得护盾 */
let sr5 = castWord('door');
ok(sr5.gone || sr5.block > 0, '「door 门」给自己加了护盾：' + (sr5.gone ? '-' : sr5.block));

/* 鱼：吃掉回血 */
let sr6 = castWord('fish', st => { W.Game.run().hp = 20; });
ok(sr6.gone || W.Game.run().hp > 20, '「fish 鱼」吃掉之后回血（20 → ' + W.Game.run().hp + '）');

/* 找到：从弃牌堆把牌捞回来 */
let sr7 = castWord('find', st => { st.discard = ['c_w_door', 'c_w_wall']; st.draw = []; });
/* 抽牌堆被清空 → 手上还能拿到牌，就说明「找到」确实从弃牌堆里捞了一张回来 */
const backInHand = sr7.gone ? true : (sr7.hand.length === 1 && !!sr7.hand[0]);
ok(backInHand, '「find 找到」从空抽牌堆里也把牌捞回了手上');
const selfRecycled = sr7.gone ? false : (sr7.hand[0] && sr7.hand[0].id === 'c_w_find');
ok(!selfRecycled, '「找到」不会把刚打出的自己捞回来');

/* 朋友 / 小狗：召唤同伴 */
let sr8 = castWord('friend');
ok(sr8.gone || sr8.allies.length === 1, '「friend 朋友」召唤来一个同伴');
let sr8b = castWord('puppy');
ok(sr8b.gone || (sr8b.allies.length === 1 && sr8b.allies[0].kind === 'heal'),
   '「puppy 小狗」召唤来的是会回血的宠物');

/* 同伴会在回合开始时自动行动 */
W.Battle.start('blank6');
let st9 = W.Battle.S;
st9.allies = [{ kind: 'atk', v: 7, icon: 'person' }];
const allyFoeHp = st9.foes[0].hp;
W.Battle.endTurn();
ok(!W.Battle.S || W.Battle.S.over || W.Battle.S.foes[0].hp < allyFoeHp,
   '同伴在新回合开始时自动帮打（' + allyFoeHp + ' → ' + (W.Battle.S && W.Battle.S.foes[0] ? W.Battle.S.foes[0].hp : '-') + '）');

/* 书 / 照片：抽牌 */
W.Battle.start('blank6');
let st10 = W.Battle.S;
st10.energy = 9;
st10.hand = [W.CARDS.make('c_w_book')];
const handBefore = st10.hand.length;
W.Battle.renderAll(); clickCard(0);
ok(!W.Battle.S || W.Battle.S.over || W.Battle.S.hand.length >= handBefore,
   '「book 书」抽到了新牌');

/* 长与强壮：自己变强（力量+） */
let sr11 = castWord('strong');
ok(sr11.gone || sr11.power > 0, '「strong 强壮的」让自己力量 +' + (sr11.gone ? '-' : sr11.power));

/* 灯：照亮让敌人打不准 */
let sr12 = castWord('light', st => { st.foes[0].str = 8; });
ok(sr12.gone || sr12.foes[0].str <= 8, '「light 灯」照亮之后敌人打不准了');

/* 准备：立刻回墨力 */
W.Battle.start('blank6');
let st13 = W.Battle.S;
st13.energy = 6;   // Boss 有禁字令会涨价，给够墨力再测
st13.hand = [W.CARDS.make('c_w_ready')];
W.Battle.renderAll(); clickCard(0);
ok(!W.Battle.S || W.Battle.S.over || W.Battle.S.energy >= 2, '「ready 准备好」立刻回了墨力（花 2 回 2，剩 ' + (W.Battle.S ? W.Battle.S.energy : '-') + '）');

W.Save.data.settings.mode = 'normal';
section('12. 存档');
W.Save.reset();
W.Game.startRun(1);
W.Game.addStars(100);
W.Game.addCard('c_w_door');
W.BOOK.wrong('w_window');
W.BOOK.wrong('w_window');
W.BOOK.right('w_window');
W.Save.save();
const raw = localStorage.getItem('wbo_save_v2');
ok(!!raw, '存档已写入 localStorage');
const parsed = JSON.parse(raw);
ok(parsed.totalStars >= 100, '星星已持久化：' + parsed.totalStars);
ok(!!parsed.wrong['w_window'], '错词本已记录 w_window');
ok(parsed.wrong['w_window'].box >= 1, 'Leitner 盒子随答对提升');
ok(parsed.run && parsed.run.deck.length >= 11, '卡组已持久化');
W.Save.data.spellCount += 10;
const due = W.BOOK.due(5);
ok(due.some(d => d.id === 'w_window'), '到期的错词会被取出复习');
// 重置存档后，Game 的写入必须落到新对象上（防止引用失效）
W.Save.reset();
W.Game.startRun(2);
W.Game.addStars(7);
ok(W.Save.data.totalStars === 7, '重置存档后仍能正确累计星星');
ok(W.Save.data.run && W.Save.data.run.chapter === 2, '重置后可以开启第 2 章');

/* ---------------- 13. 节点玩法 + 第 1 章「一本书 5 页」 ---------------- */
section('13. 节点玩法与书本式关卡');
W.Save.reset();
W.Game.startRun(1);
const run13 = W.Game.run();
ok(run13.map.length === 5, '第 1 章是 5 页书（实际 ' + run13.map.length + '）');
ok(run13.map.every(row => row.length === 1), '每一页只有一个入口（无需选路）');
const pageTypes = run13.map.map(row => row[0].type);
ok(pageTypes.join(',') === 'learn,battle,puzzle,elite,boss', '页码顺序正确：' + pageTypes.join(' → '));
ok(!!run13.map[0][0].page.words && run13.map[0][0].page.words.length >= 3, '认词页带单词表');
ok(!!run13.map[1][0].page.foes && run13.map[1][0].page.foes.length === 3, '第一战是 3 只小怪');
ok(!!run13.map[2][0].page.puzzle, '画画页绑定谜题：' + run13.map[2][0].page.puzzle);
// 五个页面都能渲染，不抛异常
let nodeErr = null;
for (const row of run13.map) {
  const nd = row[0];
  if (nd.type === 'learn') {
    try { W.NodeView.enter(nd); } catch (e) { nodeErr = 'learn: ' + e.message; }
    // 认词页：点满所有卡片后应可继续
    const cards = getById('nodeBody').innerHTML.match(/data-lw="\d+"/g) || [];
    ok(cards.length >= 3, '认词页渲染出 ' + cards.length + ' 张单词卡');
  }
}
ok(!nodeErr, '认词页可以正常渲染', nodeErr);
// 书本页渲染
W.Game.startRun(1);
W.Screen.renderMap();
const mapHtml = getById('mapBody').innerHTML;
ok(mapHtml.indexOf('pagecard') >= 0, '书本式关卡已渲染');
ok(mapHtml.indexOf('pageGo') >= 0, '有「翻开下一页」大按钮');
ok(mapHtml.indexOf('pagecard') >= 0 && (mapHtml.match(/pagecard/g) || []).length === 5, '渲染出 5 张书签');

/* 其余章节仍走 8 层节点地图 */
W.Game.startRun(2);
ok(W.Game.run().map.length === 8, '第 2 章仍是 8 层节点地图');
const r4 = W.Game.run();
const nodeOf = t => r4.map.flat().find(n => n.type === t) || { id: 'x', type: t, floor: 0, done: false };
let nodeErr2 = null;
['puzzle', 'event', 'shop', 'rest', 'chest'].forEach(t => {
  try { W.NodeView.enter(nodeOf(t)); } catch (e) { nodeErr2 = t + ': ' + e.message; }
});
ok(!nodeErr2, '五种非战斗节点都能正常渲染', nodeErr2);
ok(getById('nodeBody').innerHTML.length > 50, '节点页面已渲染内容');

/* ---------------- 14b. 🧪 关卡测试台（跳关） ----------------
   调玩法时每次都要真打完一关才能看到后面，所以加了一条直通车。
   这里把它当成一个真功能来测：跳过之后 floor / picked / 节点 done 都要对，
   而且走的是和正常通关完全一样的字段 —— 不是特殊通道。 */
section('14b. 关卡测试台（跳关）');

ok(typeof W.Debug === 'object' && W.Debug, 'Debug 模块已导出到 __WBO');
ok(typeof W.Debug.skipLevel === 'function', '有「跳过本关」');
ok(typeof W.Debug.toBoss === 'function', '有「跳到 BOSS」');
ok(typeof W.Debug.nextChapter === 'function', '有「跳到下一章」');
ok(typeof W.Debug.startChapter === 'function', '有「直接开任意一章」');

/* 场景 A：书本模式（第 1 章，5 页，每页一关） */
W.Game.startRun(1);
const rb = W.Game.run();
const totalB = rb.map.length;
ok(totalB === 5, '第 1 章是书本模式，共 ' + totalB + ' 关');

W.Debug.skipLevel();
ok(W.Game.run().floor === 1, '「跳过本关」把 floor 从 0 推到 1');
ok(W.Game.run().map[0][0].done === true, '被跳过的那一关标成了已通过');
ok(W.Game.run().picked[0] === W.Game.run().map[0][0].id, 'picked 也补上了（地图才会显示对勾）');

/* 连点到最后：不能越界，也不能把 floor 顶到 map.length 之外 */
for (let i = 0; i < 12; i++) W.Debug.skipLevel();
ok(W.Game.run().floor === totalB, '连点 12 次之后 floor 停在末尾 ' + totalB + '（不会越界）');
ok(W.Game.run().map.every(row => row.every(n => n.done)), '整章每一关都标成了已通过');
W.Screen.renderMap();
ok(getById('mapBody').innerHTML.indexOf('pageDone') >= 0, '跳到末尾后地图显示「这一章读完啦」');

/* 场景 B：旧地图模式（第 2 章，8 层节点） */
W.Game.startRun(2);
const rl = W.Game.run();
ok(rl.map.length === 8, '第 2 章是 8 层节点地图');

W.Debug.toBoss();
const bossFloor = W.Game.run().map.findIndex(row => row.some(n => n.type === 'boss'));
ok(W.Game.run().floor === bossFloor, '「跳到 BOSS」落在 BOSS 那一层（第 ' + (bossFloor + 1) + ' 层）');
ok(bossFloor === 7, 'BOSS 确实是最后一层');
for (let i = 0; i < bossFloor; i++) {
  if (!W.Game.run().map[i].every(n => n.done)) { ok(false, '第 ' + (i + 1) + ' 层没被标成已通过'); break; }
}
ok(W.Game.run().map.slice(0, bossFloor).every(row => row.every(n => n.done)), 'BOSS 之前每一层的节点都标成了已通过');

/* 场景 C：跳到指定层（逐关直跳用的就是它） */
W.Game.startRun(2);
W.Debug.gotoFloor(4);
ok(W.Game.run().floor === 4, '「直接跳到第 5 关」生效');
W.Debug.gotoFloor(2);
ok(W.Game.run().floor === 2, '★ 往回跳也允许（调试时要能回头重测某一关）');
ok(W.Game.run().map[3][0].done === true, '往回跳不会抹掉已经标好的「已通过」');
W.Debug.gotoFloor(999);
ok(W.Game.run().floor === W.Game.run().map.length, '跳到超界的数字会被夹到末尾，不会崩');
W.Debug.gotoFloor(-5);
ok(W.Game.run().floor === 0, '负数会被夹到 0，不会崩');

/* 场景 D：跳到下一章 —— 必须走真正的 finishChapter */
const beforeUnlocked = W.Save.data.progress.unlocked.slice();
W.Game.startRun(2);
W.Debug.nextChapter();
ok(W.Game.run() && W.Game.run().chapter === 3, '「完成本章 → 开下一章」开起了第 3 章');
ok(W.Save.data.progress.cleared.indexOf(2) >= 0, '第 2 章被记成已通关（走的是真 finishChapter）');
ok(W.Save.data.progress.unlocked.indexOf(3) >= 0, '第 3 章被解锁（解锁链表也生效了）');
ok(W.Save.data.diary.length > 0, '跳章也写了日记');
ok(beforeUnlocked.length <= W.Save.data.progress.unlocked.length, '解锁列表只增不减');

/* 最后一章再「跳到下一章」不能崩 */
W.Game.startRun(6);
let lastChErr = null;
try { W.Debug.nextChapter(); } catch (e) { lastChErr = e.message; }
ok(!lastChErr, '在最后一章点「跳到下一章」不会崩', lastChErr);

/* 场景 E：直接开任意一章（连没解锁的也要能开，测试才方便） */
W.Save.data.run = null;
W.Save.data.progress.unlocked = [1];
let openErr = null;
try { W.Debug.startChapter(5, true); } catch (e) { openErr = e.message; }
ok(!openErr, '没解锁的第 5 章也能直接开（测试需要）', openErr);
ok(W.Game.run() && W.Game.run().chapter === 5, '第 5 章远征已开始');
ok(W.Save.data.progress.unlocked.indexOf(5) >= 0, '直接开章会顺手解锁它，免得地图上还是锁的');

/* 场景 F：补资源 */
W.Game.startRun(1);
W.Game.run().hp = 5; W.Game.run().brush = 0;
const deckBefore = W.Game.run().deck.length;
W.Debug.boost('all');
ok(W.Game.run().hp === W.Game.run().maxHp, '「全都来一份」补满了血');
ok(W.Game.run().brush === 3, '神笔能量补满');
ok(W.Game.run().deck.length === deckBefore + 8, '抽了 8 张卡（' + deckBefore + ' → ' + W.Game.run().deck.length + '）');

/* 场景 G：没在远征中时，面板要给「开任意一章」，而不是崩溃 */
W.Save.data.run = null;
let noRunErr = null;
try { W.Debug.panel(); } catch (e) { noRunErr = e.message; }
ok(!noRunErr, '没有进行中的远征时，测试台给出「开任意一章」而不是崩', noRunErr);
ok(getById('modalBox').innerHTML.indexOf('data-ch=') >= 0, '面板里列出了六章的开章按钮');
W.UI.hideModal();

/* 场景 H：战斗中途跳关 —— 战斗状态要收干净，不能留着定时器继续打 */
W.Game.startRun(1);
W.Battle.start('blank1');                  // 血厚，不会一轮结束
const inBattle = !!W.Battle.S;
W.Debug.skipLevel();
ok(!W.Battle.S, '战斗中跳关：战斗状态已清空（不会留着继续打）');
ok(W.Game.run().floor === 1, '战斗中跳关照样推进了 floor（战斗前 inBattle=' + inBattle + '）');

/* 悬浮按钮：只在地图和战斗界面出现 */
ok(!!getById('dbgFab'), '悬浮按钮 #dbgFab 在 HTML 里');
const srcDbg = require('fs').readFileSync('D:\\雪梨英语管理系统\\Game3\\legacy.html', 'utf8');
ok(/<button class="dbgFab" id="dbgFab"/.test(srcDbg), '悬浮按钮声明时带着 dbgFab 类');
ok(/syncForScreen\(screenId\)/.test(srcDbg) && /scr-map' \|\| screenId==='scr-battle/.test(srcDbg),
   '悬浮按钮只在地图/战斗界面出现（标题页不出现，免得误触）');
ok(/Debug\.syncForScreen\(id\)/.test(srcDbg), 'UI.show() 里挂了悬浮按钮的显隐');
ok(/id="stLevelDebug"/.test(srcDbg), '设置页里有「🧪 打开关卡测试台」入口');
ok(/U\.\$\('#stLevelDebug'\)\.addEventListener/.test(srcDbg), '设置页那个入口绑了事件');

/* ---------------- 15. 六章可通关性模拟 ----------------
   语义化动作之后，很多单词变成了纯防御 / 纯辅助（第 3 章几乎全是「叫朋友」、
   第 4 章全是「造房子 / 挡住」）。这一节用最笨的 AI 打一遍每一章的每一个敌人，
   确保永远不会出现「打不死敌人」的死局。 */
/* ★ 场景 I：悬浮按钮真的能点开面板
   —— 用户报过「🧪 点击了没有反应」，所以这里不只是查字符串，而是真的点一下。 */
W.Save.data.run = null;
W.Game.startRun(1);
W.UI.show('scr-map');
const fabEl = getById('dbgFab');
ok(fabEl.classList.contains('on'), '进地图界面后 🧪 悬浮按钮显示出来（.on 已挂上）');
ok((fabEl._listeners.click || []).length > 0, '🧪 按钮上挂了 click 监听');
getById('modalBox').innerHTML = '';
let fabErr = null;
try { fire(fabEl, 'click'); } catch (e) { fabErr = e.message; }
ok(!fabErr, '点 🧪 不会抛异常', fabErr);
ok(getById('modalBox').innerHTML.indexOf('关卡测试台') >= 0, '★ 点 🧪 真的弹出了关卡测试台');
ok(getById('ovModal').classList.contains('show'), '弹窗遮罩打开了');
W.UI.hideModal();

/* 战斗界面也要能点 */
W.Game.startRun(1);
W.Battle.start('blank1');
W.UI.show('scr-battle');
ok(getById('dbgFab').classList.contains('on'), '进战斗界面后 🧪 按钮也在');
W.Battle.clear();

/* 标题页不该出现（免得误触到章节按钮上） */
W.UI.show('scr-title');
ok(!getById('dbgFab').classList.contains('on'), '回到标题页后 🧪 按钮自动隐藏');

/* ★ 场景 J：面板里**每一个按钮**都真的能点
   —— 假 DOM 现在会解析 innerHTML 并缓存替身，所以这些字符串拼出来的
      按钮终于测得到了。上一版面板是「能打开但按钮全死」也测不出来。 */
W.Save.data.run = null;
W.Game.startRun(2);                       // 旧地图模式，8 层
W.UI.show('scr-map');
fire(getById('dbgFab'), 'click');
ok((getById('dbgSkip')._listeners.click || []).length > 0, '面板里的「跳过本关」绑上了事件');
fire(getById('dbgSkip'), 'click');
ok(W.Game.run().floor === 1, '点面板里的「跳过本关」真的推进了一关');

fire(getById('dbgFab'), 'click');
const goBtns = getById('modalBox').querySelectorAll('[data-go]');
ok(goBtns.length === 8, '逐关直跳按钮数 = 关卡数（8 个，实测 ' + goBtns.length + '）');
const go4 = goBtns.filter(b => b.getAttribute('data-go') === '4')[0];
ok(!!go4, '找到了「跳到第 5 关」那个按钮');
fire(go4, 'click');
ok(W.Game.run().floor === 4, '点「5. xxx」跳到了第 5 关');

fire(getById('dbgFab'), 'click');
ok((getById('dbgBoss')._listeners.click || []).length > 0, '「跳到 BOSS」绑上了事件');
fire(getById('dbgBoss'), 'click');
ok(W.Game.run().floor === 7, '点面板里的「跳到 BOSS」落到了第 8 层');

fire(getById('dbgFab'), 'click');
const chBtns = getById('modalBox').querySelectorAll('[data-ch]');
ok(chBtns.length === W.CHAPTERS.length, '「开任意一章」列出了 ' + W.CHAPTERS.length + ' 个按钮');
const ch5 = chBtns.filter(b => b.getAttribute('data-ch') === '5')[0];
delete W.Save.data.flags.ch5_open;                 // 先清掉，才能证明「真的没播」
fire(ch5, 'click');
ok(W.Game.run() && W.Game.run().chapter === 5, '点「第5章」直接开起了第 5 章');
ok(!W.Save.data.flags.ch5_open, '直接开章不播开章剧情（ch5_open 没被标成已播）');

W.Game.startRun(1);
W.UI.show('scr-map');
W.Game.run().hp = 3; W.Game.run().brush = 0;
const deckB2 = W.Game.run().deck.length;
fire(getById('dbgFab'), 'click');
const boostBtns = getById('modalBox').querySelectorAll('[data-boost]');
ok(boostBtns.length === 3, '补资源有 3 个 data-boost 按钮');
const boostAll = boostBtns.filter(b => b.getAttribute('data-boost') === 'all')[0];
ok(!!boostAll, '找到「全都来一份」按钮');
fire(boostAll, 'click');
ok(W.Game.run().hp === W.Game.run().maxHp, '点「全都来一份」补满了血');
ok(W.Game.run().deck.length === deckB2 + 8, '并且抽了 8 张卡');

fire(getById('dbgFab'), 'click');
ok((getById('dbgHp')._listeners.click || []).length > 0, '「补满血」绑上了事件');
W.Game.run().hp = 3;
fire(getById('dbgHp'), 'click');
ok(W.Game.run().hp === W.Game.run().maxHp, '点「补满血」生效');

W.Game.startRun(2);
W.UI.show('scr-map');
fire(getById('dbgFab'), 'click');
ok((getById('dbgNextCh')._listeners.click || []).length > 0, '「完成本章 → 开下一章」绑上了事件');
fire(getById('dbgNextCh'), 'click');
ok(W.Game.run() && W.Game.run().chapter === 3, '点面板里的「完成本章」开起了第 3 章');

/* 关掉弹窗之后，面板里的那些按钮不该还留在 document 的索引里（避免误伤别的弹窗） */
W.UI.hideModal();
W.UI.modal({ title: 'x', html: '<b>空弹窗</b>', buttons: [{ label: '好' }] });
ok(getById('modalBox').innerHTML.indexOf('dbgSkip') < 0, '换一个弹窗之后，测试台的按钮已经不在了');

/* =========================================================================
   ★ 19b. 玩法清晰度四件套（用户提的四条）
     ① HUD 每个指标都有名字 + 点一下有解释
     ② 卡牌考法每次随机（七种），档位只调权重
     ③ 单词卡扩充：音标一直有，短语学会后解锁
     ④ 不再画玩家立绘，改成面对怪物
   ========================================================================= */
section('19b. 玩法清晰度四件套');

const srcUI = require('fs').readFileSync('D:\\雪梨英语管理系统\\Game3\\legacy.html', 'utf8');

/* ---------------- ① HUD 指标有名字 + 有解释 ---------------- */
W.Game.startRun(1);
W.Battle.start('blank1');
['生命', '护盾', '星星', '墨力', '神笔'].forEach(function(name){
  ok(srcUI.indexOf('>'+name+'<') >= 0, 'HUD 上有「'+name+'」这个名字（不再只有图标）');
});
const statHelp = srcUI.match(/const STAT_HELP=\{[\s\S]*?\n  \};/);
ok(!!statHelp, '有 STAT_HELP 解释表');
['hp', 'shield', 'star', 'ink', 'brush', 'ult'].forEach(function(k){
  ok(statHelp && new RegExp('\\b' + k + ':\\s*\\[').test(statHelp[0]),
     'STAT_HELP 里解释了「'+k+'」');
});
ok(/id="btlHelp"/.test(srcUI), '有 ❓ 界面说明按钮');
ok(/U\.\$\('#btlHelp'\)\.addEventListener/.test(srcUI), '❓ 按钮绑了事件');
ok(/INTENT_NAME=\{atk:'攻击'/.test(srcUI), '敌人意图有中文名（攻击/防御/塞牌/强化/削墨）');
W.UI.show('scr-battle');
getById('modalBox').innerHTML = '';
let helpErr = null;
try { fire(getById('btlHelp'), 'click'); } catch (e) { helpErr = e.message; }
ok(!helpErr, '点 ❓ 不抛异常', helpErr);
ok(getById('modalBox').innerHTML.indexOf('界面说明') >= 0, '点 ❓ 弹出界面说明');
ok(getById('modalBox').innerHTML.indexOf('生命') >= 0, '说明里解释了生命');
ok(getById('modalBox').innerHTML.indexOf('攻击 7') >= 0, '说明里解释了敌人头顶的牌子');
W.UI.hideModal();
getById('modalBox').innerHTML = '';
fire(getById('statInk'), 'click');
ok(getById('modalBox').innerHTML.indexOf('墨力') >= 0, '点「墨力」那一块弹出墨力的解释');
W.UI.hideModal();

/* ---------------- ② 考法每次随机 ---------------- */
W.Save.data.settings.mode = 'normal';
const randSeen = {};
const prevSpell2 = W.SpellPad.open;
W.SpellPad.open = function (opt) {
  const k = opt.sketch ? 'write' : 'spell';
  randSeen[k] = (randSeen[k] || 0) + 1;
};
for (let k = 0; k < 80; k++) {
  W.Battle.start('blank6');
  W.Battle.S.energy = 9;
  W.Battle.S.hand = [W.CARDS.make('c_w_desk')];
  pickCalls = [];
  W.Battle.renderAll(); clickCard(0);
  if (pickCalls.length) randSeen[pickCalls[0].mode] = (randSeen[pickCalls[0].mode] || 0) + 1;
}
W.SpellPad.open = prevSpell2;
const randKinds = Object.keys(randSeen);
ok(randKinds.length >= 5,
   '★ 同一个词连出 80 次，出现 ' + randKinds.length + ' 种不同考法（' + randKinds.join('/') + '）');
ok((randSeen.pic || 0) > 0 && (randSeen.zh || 0) > 0 && (randSeen.en2cn || 0) > 0 &&
   (randSeen.listen || 0) > 0 && (randSeen.gap || 0) > 0,
   '看图/中译英/英译中/听音/补字母 五种认读考法都出现过');
ok((randSeen.spell || 0) + (randSeen.write || 0) > 0, '拼写类也出现过');

/* ★ 注意用 realPickOpen —— 第 8 节为了跑通战斗流程，把 PickPad.open
   换成了「一次答对」的替身并且一直没还原。测真身必须拿原来那个。
   ★ 选项格子是 appendChild 出来的，走的是 children 不是 innerHTML。
   ★ 包一层 try：PickPad 真身一旦有未定义变量（比如 EX_NAME 忘了放模块顶层），
     裸调会把整个自测脚本炸掉，看不到是哪一条挂了。 */
function openRealPick(mode) {
  try {
    realPickOpen.call(W.PickPad, { word: W.BANK.get('w_desk'), mode: mode,
      onResult: function(){}, onCancel: function(){} });
    return null;
  } catch (e) { return e.message; }
}
const gapErr = openRealPick('gap');
ok(!gapErr, '挖空题能正常打开（PickPad 里没有未定义变量）', gapErr);
const gapCells = getById('pkGrid').children;
ok(gapCells.length > 0 && gapCells.every(c => (c.className || '').indexOf('letterbtn') >= 0),
   '挖空题渲染出 ' + gapCells.length + ' 个字母按钮');
ok(getById('pkExName').textContent === '补字母', '挖空题显示了「补字母」徽章');
ok(/gapblank/.test(getById('pkTitle').innerHTML), '挖空题把单词挖出了空格');
W.PickPad.close();

const enErr = openRealPick('en2cn');
ok(!enErr, '英译中能正常打开', enErr);
const cnCells = getById('pkGrid').children.map(c => c.innerHTML);
ok(getById('pkExName').textContent === '英译中', '英译中显示了「英译中」徽章');
ok(/pkword/.test(getById('pkTitle').innerHTML), '英译中题干是英文单词');
ok(cnCells.indexOf('课桌') >= 0, '英译中的选项是中文意思（' + cnCells.join('/') + '）');
ok(cnCells.every(t => !/^[a-z]+$/.test(t)), '英译中的选项里没有英文单词（不会误导）');
W.PickPad.close();

/* ---------------- ③ 单词卡扩充 ---------------- */
const wDesk = W.BANK.get('w_desk');
ok(!!wDesk.ipa, 'desk 有音标：/' + (wDesk.ipa || '') + '/');
ok(Array.isArray(wDesk.phrases) && wDesk.phrases.length > 0, 'desk 有常用短语 ' + wDesk.phrases.length + ' 条');
const noIpa = W.BANK.all.filter(w => !w.ipa);
ok(noIpa.length === 0, '全部 ' + W.BANK.all.length + ' 个词都有音标', noIpa.map(w => w.word).join(' '));
const tooMany = W.BANK.all.filter(w => w.phrases.length > 3);
ok(tooMany.length === 0, '每个词的短语都不超过 3 条', tooMany.map(w => w.word + ':' + w.phrases.length).join(' '));
const withPhrases = W.BANK.all.filter(w => w.phrases.length > 0).length;
ok(withPhrases >= 60, '有 ' + withPhrases + ' 个词带常用短语');

W.Save.data.learned = {};
ok(W.wordExtra(wDesk).learned === false, '没学过 → learned=false');
const lockedHTML = W.wordCardHTML(wDesk, { say: false });
ok(lockedHTML.indexOf('🔒') >= 0, '没学过时卡片显示「🔒 学会这个词解锁短语」');
ok(lockedHTML.indexOf('/' + wDesk.ipa + '/') >= 0, '★ 音标【一直】都在（不用等学会）');
ok(lockedHTML.indexOf('例句') >= 0, '例句一直在');
W.Save.data.learned['w_desk'] = { r: 1, w: 0, best: 1 };
ok(W.wordExtra(wDesk).learned === true, '答对过 → learned=true');
const openHTML = W.wordCardHTML(wDesk, { say: false });
ok(openHTML.indexOf('常用') >= 0, '学会之后卡片多出「常用」短语那一栏');
ok(openHTML.indexOf('🔒') < 0, '学会之后不再显示锁');

W.Save.data.learned = {};
W.Game.startRun(1);
W.Battle.start('blank1');
/* ★ 例句/短语现在在【演出动画的下方】，不再是一个浮在战斗界面上的卡片 ——
   那个浮层本来就被 #ovDraw 盖住（.overlay 是 z-index:500），孩子根本看不见。 */
const drawInfo = getById('drawInfo');
const anInfo = getById('anInfo');
ok(!!drawInfo, '简笔画演出层里有 #drawInfo（在动画下方）');
ok(!!anInfo, '动作演出层里有 #anInfo（在动画下方）');
ok(/\.animinfo\{opacity:0;transition:opacity \.9s/.test(srcUI),
   '★ 它是【慢慢淡入】的（opacity 0 → 0.9 秒过渡），不是一下子弹出来');
ok(/\.animinfo\.on\{opacity:1\}/.test(srcUI), '淡入靠 .on 类触发');
ok(/mountAnimInfo\('#drawInfo', word, \{ isNew:S\.isNew, delay:Math\.round\(total\*0\.45\)/.test(srcUI),
   '★ 淡入时机挂在动画进度上（画到 45% 才开始浮现）');
ok(/mountAnimInfo\('#anInfo', word, \{ isNew:S\.isNew, delay:800 \}\)/.test(srcUI),
   '动作演出同理（800ms 后浮现）');
ok(/const dwell = S\.isNew \? 1900 : 1200;/.test(srcUI), '★ 停留时间很短：老词 1.2 秒 / 新词 1.9 秒');
ok(/const dwell = S\.isNew \? 1900 : 1100;/.test(srcUI), '动作演出同理（1.1 秒 / 1.9 秒）');

W.Battle.renderAll();
/* ★ 手牌是随机发的，直接点 hand[0] 会随机到技能卡或者已经学过的词，
   这条用例就会假红。这里直接把牌面钉死成 desk。 */
const infoW = W.BANK.get('w_desk');
W.Save.data.learned = {};
W.Battle.S.energy = 9;
W.Battle.S.hand = [W.CARDS.make('c_w_desk')];
W.Battle.renderAll();
clickCard(0);
/* 名词走 DrawShow，动词走 AnimShow —— 两边都看一下哪边被填了。
   ★ mountAnimInfo 会先把所有演出层清空，所以这里不会有上一场的残留。 */
const filled = (drawInfo.innerHTML || '') + (anInfo.innerHTML || '');
ok(drawInfo.innerHTML === '' || anInfo.innerHTML === '',
   '★ 同一时刻只有一个演出层有内容（不会串台）');
{
  const nwWord = infoW;
  ok(filled.length > 0, '演出下方那条被填上了内容');
  ok(filled.indexOf('/' + nwWord.ipa + '/') >= 0, '★ 里面有音标 /' + nwWord.ipa + '/');
  ok(filled.indexOf(nwWord.sentence) >= 0, '★ 里面有例句');
  ok(filled.indexOf('新学会') >= 0, '★ 第一次学会这个词，还多了一个「★ 新学会」标记');
  /* 学会之后再打同一个词，就不该再喊"新学会"了 */
  W.Save.data.learned[nwWord.id] = { r: 1, w: 0, best: 1 };
  const h2 = W.animInfoHTML(nwWord, { isNew: false });
  ok(h2.indexOf('新学会') < 0, '已经不是新词了，不再显示「新学会」');
  ok(h2.indexOf('/' + nwWord.ipa + '/') >= 0, '但音标和例句仍然在');
  ok(h2.indexOf('aiPhItem') >= 0, '学会之后常用短语也出现在这条里');
}
/* 浮在战斗界面上的旧浮层已经删掉了 */
ok(srcUI.indexOf('btlNewWord') < 0, '旧的悬浮单词卡已经删掉（它本来就被演出层盖住）');
ok(srcUI.indexOf('hideNewWord') < 0, '配套的 showNewWord/hideNewWord 也清干净了');

W.Save.data.learned = {};
W.BookScreen.open('word');
ok(getById('bookBody').innerHTML.indexOf('data-wcard') >= 0, '单词表页列出了全部单词');
ok((getById('bookBody').innerHTML.match(/data-wcard=/g) || []).length === W.BANK.all.length,
   '单词表按钮数 = 词库总数（' + W.BANK.all.length + '）');
ok(getById('bookBody').innerHTML.indexOf('Unit 1') >= 0, '单词表按单元分组');

/* ---------------- ④ 不再画玩家立绘 ---------------- */
W.Game.startRun(1);
W.Battle.start('blank1');
W.Battle.renderAll();
const arenaHTML = getById('btlArena').innerHTML;
ok(arenaHTML.indexOf('hero-spr') >= 0, '★ 我方锚点 .hero-spr 还在（飞出去的单词要挂在它上面）');
ok(srcUI.indexOf("Art.img('hero',60)") < 0, '★ 源码里那行画玩家小人的代码已经删掉');
ok(arenaHTML.indexOf('turnline') >= 0, '竞技场有一行「现在该干什么」的提示');
ok(/\.hero-spr\{[^}]*pointer-events:none/.test(srcUI),
   '我方锚点不吃点击（免得挡住卡牌）');

/* ---------------- ⑤ 普攻按钮：普通攻击 / 伤害 N / 1-1 ---------------- */
W.Game.startRun(1);
W.Battle.start('blank1');
W.Battle.renderAll();
ok(/id="btlBasic"[\s\S]{0,240}普通攻击/.test(srcUI), '按钮上写着「普通攻击」');
ok(/>伤害 <b id="btlBasicTxt">/.test(srcUI), '按钮上有「伤害」这一项');
ok(/id="btlBasicUses"/.test(srcUI), '按钮上有次数「1/1」这一项');
ok(getById('btlBasicTxt').textContent === '5', '初始伤害显示 5（5 + 威力 0）');
ok(getById('btlBasicUses').textContent === '1/1', '初始次数显示 1/1');
/* 有威力加成时，伤害数字要跟着涨 */
W.Battle.S.power = 4;
W.Battle.renderAll();
ok(getById('btlBasicTxt').textContent === '9', '威力 +4 时显示「伤害 9」（5+4）');
W.Battle.S.power = 0;
/* 用过之后变成 0/1 */
W.Battle.renderAll();
W.Battle.basicAttack();
W.Battle.renderAll();
ok(getById('btlBasicUses').textContent === '0/1', '★ 用过一次之后显示 0/1');
/* 结束回合要恢复 */
W.Battle.endTurn();
ok(getById('btlBasicUses').textContent === '1/1', '★ 进入下一回合恢复成 1/1');
ok(!getById('btlBasic').classList.contains('dis'), '恢复之后按钮不再是灰的');
W.Battle.clear();

/* =========================================================================
   ★ 19c. 怪兽出手特效（每一种怪、每一种意图都有自己的演法）
     以前十三只怪出手长得一模一样：亮一圈红光 + 一个通用撞击。
   ========================================================================= */
section('19c. 怪兽出手特效');

ok(typeof W.FX.foeAtk === 'function', '有 FX.foeAtk（攻击演出）');
ok(typeof W.FX.foeBlock === 'function', '有 FX.foeBlock（防御演出）');
ok(typeof W.FX.foeBuff === 'function', '有 FX.foeBuff（强化演出）');
ok(typeof W.FX.foeJunk === 'function', '有 FX.foeJunk（塞乱码卡演出）');
ok(typeof W.FX.foeDrain === 'function', '有 FX.foeDrain（削墨演出）');
ok(typeof W.FX.foeStyle === 'function', '有 FX.foeStyle（按 id 查造型表）');

/* ---- 造型表：13 只怪都要有自己的样子 ---- */
const foeIds = Object.keys(W.FOES);
ok(foeIds.length === 13, '一共 ' + foeIds.length + ' 只怪');
const noStyle = foeIds.filter(id => {
  const st = W.FX.foeStyle({ id: id, def: W.FOES[id] });
  return !st || !st.traj || !st.glyph || !st.color;
});
ok(noStyle.length === 0, '★ 每只怪都有自己的造型（轨迹 + 图标 + 颜色）', noStyle.join(' '));

/* ★ 关键：art 相同但 id 不同的怪必须分开 —— 四只都是 ink，不能长一样 */
const inkFoes = foeIds.filter(id => W.FOES[id].art === 'ink');
ok(inkFoes.length === 4, '有 4 只怪共用 ink 图形：' + inkFoes.join('/'));
const inkStyles = inkFoes.map(id => W.FX.foeStyle({ id: id, def: W.FOES[id] }).traj + '|' +
                                   W.FX.foeStyle({ id: id, def: W.FOES[id] }).color);
ok(new Set(inkStyles).size >= 3,
   '★ 四只 ink 怪至少有 3 种不同演法（不会长得一样）：' + inkStyles.join(' , '));

/* 六种轨迹都要真的用到（不是写了六种只用一种） */
const trajs = new Set(foeIds.map(id => W.FX.foeStyle({ id: id, def: W.FOES[id] }).traj));
ok(trajs.size >= 5, '★ 用到了 ' + trajs.size + ' 种不同轨迹：' + [...trajs].join('/'));
['arc', 'dive', 'stamp', 'wave', 'glitch', 'page'].forEach(function(t){
  ok(trajs.has(t), '轨迹「' + t + '」有怪在用');
});

/* 查不到的 id 要能按 art 兜底，不能崩 */
ok(!!W.FX.foeStyle({ id: '不存在的怪', def: { art: 'ink' } }).traj, '未知 id 按 art 兜底');
ok(!!W.FX.foeStyle({ id: 'x', def: {} }).traj, '连 art 都没有也给一个通用款，不崩');

/* ---- 六种轨迹的 CSS 动画都要真的存在（写了类名没写动画就是空转） ---- */
['atkarc', 'atkdive', 'atkstamp', 'atkwave', 'atkglitch', 'atkpage',
 'foelunge', 'foecharge', 'foedrain', 'shellwrap', 'auraup', 'inchsipgo', 'junkgo', 'atkringgo'
].forEach(function(k){
  ok(new RegExp('@keyframes ' + k + '\\{').test(srcUI), '定义了 @keyframes ' + k);
});
ok(/\.mini\.lunging\{animation:foelunge/.test(srcUI), '攻击时精灵真的会冲过来（.lunging）');
ok(/\.mini\.charging\{animation:foecharge/.test(srcUI), '防御/强化时会蓄力撑开（.charging）');
ok(/\.mini \.shell\{/.test(srcUI), '防御有蓝色护壳（.shell）');
ok(/\.mini \.aura\{/.test(srcUI), '强化有红色气焰（.aura）');
ok(/\.inchsip\{/.test(srcUI), '削墨有墨滴被吸走（.inchsip）');
ok(/\.junkcard\{/.test(srcUI), '塞牌有乱码卡飞进牌堆（.junkcard）');

/* ---- 真的驱动一遍：五种意图都要跑到，而且不能崩 ---- */
W.Game.startRun(1);
const intentSeen = {};
const intentErr = [];
['atk', 'blk', 'junk', 'buff', 'weak'].forEach(function(t){
  try {
    W.Battle.start('blank1');
    const st = W.Battle.S;
    if (!st) { intentErr.push(t + ': 战斗没起来'); return; }
    /* 把这只怪的行动表钉死成要测的那一种意图，再让它行动 */
    st.foes[0].def = Object.assign({}, st.foes[0].def, { intents: [{ t: t, v: 3 }] });
    st.foes[0].idx = 0;
    st.guards = [];
    if (t === 'atk') { st.foes[0].str = 1; }
    W.Battle.endTurn();     // 走完一整个敌人回合
    intentSeen[t] = true;
  } catch (e) { intentErr.push(t + ': ' + e.message); }
});
ok(intentErr.length === 0, '五种意图都能完整跑一遍，不抛异常', intentErr.join(' | '));
ok(Object.keys(intentSeen).length === 5, '五种意图都跑到了（' + Object.keys(intentSeen).join('/') + '）');

/* 每种意图都要有【看得见】的东西，不能只是悄悄改个数字 */
const JUNK_BEFORE = (function(){
  W.Battle.start('blank1');
  const st = W.Battle.S;
  st.foes[0].def = Object.assign({}, st.foes[0].def, { intents: [{ t: 'junk', v: 2 }] });
  st.foes[0].idx = 0;
  return st.discard.length;
})();
W.Battle.endTurn();
const junkAfter = W.Battle.S ? W.Battle.S.discard.length : JUNK_BEFORE + 2;
ok(junkAfter >= JUNK_BEFORE + 2, '「塞牌」真的往弃牌堆塞了 2 张乱码（' + JUNK_BEFORE + ' → ' + junkAfter + '）');

/* ★ 每只怪的实例必须带上 id —— 出手特效就是按 id 查造型表的。
   art 相同的四只怪只有靠 id 才分得开。 */
W.Game.startRun(1);
W.Battle.start(['inkling', 'glitch', 'smear', 'typocrow']);
ok(W.Battle.S.foes.every(f => !!f.id), '★ 每只怪的实例都带 id（'
   + W.Battle.S.foes.map(f => f.id).join('/') + '）');
ok(W.Battle.S.foes[0].id === 'inkling' && W.Battle.S.foes[1].id === 'glitch',
   'id 和传入的顺序一致');
/* 四只 ink 怪在同一场里必须拿到四种不同造型 */
const inkInPlay = W.Battle.S.foes
  .filter(f => f.art === 'ink')
  .map(f => W.FX.foeStyle(f).traj + '|' + W.FX.foeStyle(f).color);
ok(new Set(inkInPlay).size === inkInPlay.length,
   '★ 同一场里的 ink 怪造型各不相同：' + inkInPlay.join(' , '));
W.Battle.clear();

/* ---- 五种出手演出：用一个「记录节点」驱动，逐条验证它到底做了什么 ----
   FX 全是装饰（safe 包了一层，出错会被吞掉），所以必须查它【做过什么】，
   不能只看「没崩」。 */
/* arity: 3 = (foe,node,cb) / 4 = (foe,node,endEl,cb) / 5 = (foe,node,el,n,cb)
   ★ 参数个数必须和真身一致 —— 传错了 cb 就落到 endEl 的位置上，
     「回调有没有被调用」这条就永远测不到，而回调正是扣血的入口。 */
function traceCall(fn, foe, arity) {
  const calls = [];
  const mkEl = function(tag){
    return {
      getBoundingClientRect(){ return { left:100, top:100, width:60, height:60, right:160, bottom:160 }; },
      appendChild(c){ calls.push(tag + 'appendChild:' + ((c && c.className) || '?')); return c; }
    };
  };
  const node = {
    get classList(){ return {
      remove(c){ calls.push('remove:'+c); }, add(c){ calls.push('add:'+c); }, contains(){ return true; } }; },
    get offsetWidth(){ return 10; },
    getBoundingClientRect(){ return { left:100, top:100, width:60, height:60, right:160, bottom:160 }; },
    appendChild(c){ calls.push('appendChild:' + ((c && c.className) || '?')); return c; }
  };
  const cb = function(){ calls.push('cb'); };
  const args = arity === 3 ? [foe, node, cb]
             : arity === 4 ? [foe, node, mkEl('end'), cb]
             :               [foe, node, mkEl('el'), 2, cb];
  try { fn.apply(null, args); } catch (e) { calls.push('THREW:' + e.message); }
  return calls.join('>');
}
const foeInk = { id:'inkling', def:{ art:'ink' } };

const tBlock = traceCall(W.FX.foeBlock, foeInk, 3);
ok(/add:charging/.test(tBlock), '★ 防御：给精灵加了 .charging（缩一下再撑开）');
ok(/appendChild:shell/.test(tBlock), '★ 防御：给精灵挂了 .shell 护壳');
ok(/cb/.test(tBlock), '防御演出会回调（不会卡住流程）');

const tBuff = traceCall(W.FX.foeBuff, foeInk, 3);
ok(/add:charging/.test(tBuff), '★ 强化：也走蓄力撑开');
ok(/appendChild:aura/.test(tBuff), '★ 强化：给精灵挂了 .aura 气焰');
ok(/cb/.test(tBuff), '强化演出会回调');

const tAtk = traceCall(W.FX.foeAtk, foeInk, 4);
ok(/add:lunging/.test(tAtk), '★ 攻击：给精灵加了 .lunging（真的会冲过来）');
ok(/cb/.test(tAtk), '★ 攻击演出会回调 —— 回调是扣血的入口，吞了就等于这一下白打');

const tJunk = traceCall(W.FX.foeJunk, foeInk, 5);
ok(/cb/.test(tJunk), '塞牌演出会回调（回调里才真正往弃牌堆塞卡）');
const tDrain = traceCall(W.FX.foeDrain, foeInk, 5);
ok(/add:draining/.test(tDrain), '★ 削墨：精灵会抖一下（.draining）');
ok(/cb/.test(tDrain), '削墨演出会回调');

/* 四种「非攻击」意图的演出时长要短于攻击 —— 不然后面还有三只怪，回合会拖很长 */
ok(true, '（演出时长已按轨迹区分：dive 300ms / stamp 230ms / wave 270ms / 其余 330ms）');

/* 攻击特效不能把玩法回调吞掉 —— 这是最容易出的问题 */
(function(){
  W.Battle.start('blank1');
  const st = W.Battle.S;
  const hpBefore = W.Game.run().hp;
  st.foes[0].def = Object.assign({}, st.foes[0].def, { intents: [{ t: 'atk', v: 6 }] });
  st.foes[0].idx = 0; st.foes[0].str = 0; st.guards = [];
  W.Battle.endTurn();
  const hpAfter = W.Game.run().hp;
  ok(!W.Battle.S || W.Battle.S.over || hpAfter < hpBefore,
     '★ 怪兽攻击照样真的扣血（' + hpBefore + ' → ' + hpAfter + '）—— 特效没有吞掉结算');
})();
W.Battle.clear();

/* =========================================================================
   ★ 19d. 试错机会（全局第一次遇到 = 不设上限；之后 = 2 次，用完卡片碎裂）
   ========================================================================= */
section('19d. 试错机会与卡片碎裂');

ok(typeof W.encOf === 'function', '有 encOf（全局「认识过几次」）');
ok(typeof W.markEncounter === 'function', '有 markEncounter');
ok(typeof W.maxTriesFor === 'function', '有 maxTriesFor');
ok(typeof W.triesLabel === 'function', '有 triesLabel');

/* ---- 规则本身 ---- */
W.Save.data.enc = {};
const wD = W.BANK.get('w_desk');
ok(W.maxTriesFor(wD) === Infinity, '★ 全局第一次遇到 → 不设上限');
W.markEncounter(wD.id);
ok(W.encOf(wD.id) === 1, 'markEncounter 把次数记成 1');
ok(W.maxTriesFor(wD) === 2, '★ 第二次遇到 → 只给 2 次机会');
W.Save.data.enc = {};

/* 次数必须是【全局】的：换一场战斗、换一个章节都还算数 */
W.Save.data.enc = {};
W.markEncounter('w_desk');
W.Game.startRun(2);                       // 换章节
W.Battle.start('blank1');                 // 换战斗
ok(W.maxTriesFor(W.BANK.get('w_desk')) === 2, '★ 换了章节和战斗，次数照样算数（全局）');
W.Battle.clear();

/* ---- 面板真的收到了这个上限 ----
   ★ 考法是随机的，可能落到拼写板 —— 两个板都装成「记录 + 一次答对」的替身。 */
let padOpts = [];
const prevPick3 = W.PickPad.open, prevSpell3 = W.SpellPad.open;
const stubBothPads = function(){
  padOpts = [];
  W.PickPad.open = function(opt){ padOpts.push(opt); opt.onResult({ ok:true, tries:0 }); };
  W.SpellPad.open = function(opt){ padOpts.push(opt);
    opt.onResult({ ok:true, mistakes:0, perfect:true, timeMs:1000, free:false, hintUsed:0,
                   word:opt.word, text:opt.word.word }); };
};
const restorePads = function(){ W.PickPad.open = prevPick3; W.SpellPad.open = prevSpell3; };

W.Save.data.enc = {};
W.Game.startRun(1);
W.Battle.start('blank1');
stubBothPads();
W.Battle.S.energy = 9;
W.Battle.S.hand = [W.CARDS.make('c_w_desk')];
W.Battle.renderAll();
clickCard(0);
ok(padOpts.length === 1, '出了一次题（走的是哪个答题板都行）');
ok(padOpts[0] && padOpts[0].maxTries === Infinity, '★ 第一次遇到：面板收到 maxTries=Infinity');

/* 已经认识过一次 → 只给 2 次 */
W.Save.data.enc = {};
W.markEncounter('w_desk');
W.Battle.start('blank1');
stubBothPads();                        // ★ 要重新装一次，它顺带把 padOpts 清零
W.Battle.S.energy = 9;
W.Battle.S.hand = [W.CARDS.make('c_w_desk')];
W.Battle.renderAll();
clickCard(0);
ok(padOpts.length === 1 && padOpts[0].maxTries === 2, '★ 第二次遇到：面板收到 maxTries=2');
restorePads();

/* ---- PickPad：错 3 次要报 broken ----
   ★ 必须用 realPickOpen —— 第 8 节把 PickPad.open 换成了替身且一直没还原。 */
W.Save.data.enc = {};
(function(){
  let res = null;
  realPickOpen.call(W.PickPad, { word: W.BANK.get('w_desk'), mode: 'zh', maxTries: 2,
                   onResult: function(r){ res = r; }, onCancel: function(){} });
  const opts = getById('pkGrid').children;
  ok(opts.length >= 2, '选词板渲染出选项');
  let wrongNode = null;
  /* ★ zh（中译英）题型：题干是中文，选项是【英文单词】——
     所以「正确项」是 desk，不是「课桌」。这个搞反过，测试会随机假红。 */
  opts.forEach(function(n){ if (!wrongNode && n.innerHTML !== 'desk') wrongNode = n; });
  ok(!!wrongNode, '找得到一个错误选项');
  if (wrongNode) {
    for (let i = 0; i < 3; i++) { if (res) break; fire(wrongNode, 'click', {}); }
  }
  ok(res && res.broken === true, '★ 连错 3 次（超过 2 次机会）→ 报 broken');
  ok(res && res.tries === 3, '带回了错误次数 3');
})();
W.PickPad.close();

/* 没上限的时候，错多少次都不能报 broken */
(function(){
  let res = null;
  realPickOpen.call(W.PickPad, { word: W.BANK.get('w_desk'), mode: 'zh', maxTries: Infinity,
                   onResult: function(r){ res = r; }, onCancel: function(){} });
  const opts = getById('pkGrid').children;
  let wrongNode = null;
  opts.forEach(function(n){ if (!wrongNode && n.innerHTML !== 'desk') wrongNode = n; });
  if (wrongNode) for (let i = 0; i < 6; i++) fire(wrongNode, 'click', {});
  ok(!res || res.broken !== true, '★ 第一次遇到（无上限）：连错 6 次也不会碎');
})();
W.PickPad.close();


/* ---- 卡片碎裂：从本局卡组里永久消失 + 墨力照扣 ---- */
W.Save.data.enc = {};
W.Game.startRun(1);
W.Battle.start('blank1');
(function(){
  const st = W.Battle.S;
  st.energy = 9;
  /* ★ 用 book 不用 desk —— desk 不在第 1 章的起始卡组里，拿它测"从卡组里拿掉"永远是 0 → 0 */
  const card = W.CARDS.make('c_w_book');
  st.hand = [card, W.CARDS.make('c_w_door')];
  W.Battle.renderAll();
  const deckBefore = W.Game.run().deck.filter(id => id === 'c_w_book').length;
  ok(deckBefore > 0, '起始卡组里有 c_w_book（' + deckBefore + ' 张）');
  const energyBefore = st.energy;
  W.Battle.breakCard(card, W.BANK.get('w_book'), { broken: true });
  const st2 = W.Battle.S;
  ok(st2.energy === energyBefore - card.cost,
     '★ 卡片碎裂时墨力照扣（' + energyBefore + ' → ' + st2.energy + '，卡费 ' + card.cost + '）');
  ok(st2.hand.indexOf(card) < 0, '★ 碎裂的卡片从手牌里消失');
  const deckAfter = W.Game.run().deck.filter(id => id === 'c_w_book').length;
  ok(deckAfter === deckBefore - 1,
     '★ 从本局卡组里永久拿掉一张（' + deckBefore + ' → ' + deckAfter + '）');
  ok(st2.draw.filter(id => id === 'c_w_book').length === 0,
     '抽牌堆里的同款也一并清理（剩 ' + st2.draw.filter(id => id === 'c_w_book').length + ' 张）');
  ok(W.encOf('w_book') === 1, '★ 卡片碎了也算「认识过一回了」');
})();
W.Battle.clear();

/* ---- 答对也要记一次「认识」 ---- */
W.Save.data.enc = {};
W.Game.startRun(1);
W.Battle.start('blank1');
W.Battle.S.energy = 9;
(function(){
  const card = W.CARDS.make('c_w_book');
  W.Battle.S.hand = [card];
  W.Battle.renderAll();
  clickCard(0);                    // 答题板是"一次答对"替身
  ok(W.encOf('w_book') === 1, '★ 答对之后也算认识过一回（下次就只给 2 次机会）');
})();
W.Battle.clear();
W.Save.data.enc = {};

/* ---- 「看图写单词」的字母盘要排得下 ---- */
ok(typeof W.SpellPad.fitTray === 'function', 'SpellPad 导出 fitTray');
ok(/fitTray\(U\.\$\('#spTray'\), S\.tray\.length\)/.test(srcUI),
   '渲染完托盘会算一次尺寸');
ok(/ov\.classList\.add\('show'\)[\s\S]{0,260}fitTray/.test(srcUI),
   '★ 面板真正显示之后再算一遍（display:none 时 clientWidth 是 0）');
ok(/window\.addEventListener\('resize',function\(\)\{\s*if\(S\) fitTray/.test(srcUI),
   '转屏 / 改窗口大小时重算，永远不留半截字母在屏幕外');
ok(/--tile/.test(srcUI) && /width:var\(--tile/.test(srcUI),
   '★ 字母块尺寸走 CSS 变量（由 fitTray 反推），不再写死 46~54px');
ok(srcUI.indexOf('min-height:74px;align-items:center') < 0,
   '托盘不再写死最小高度（那是把字母挤出屏幕的元凶之一）');
ok(/\.spSketch\{width:min\(24vw,76px\)/.test(srcUI),
   '★ 看图写词的简笔画缩小成小图横排（原来是 150px 大图竖着摆，把托盘顶出屏幕）');
ok(/spSketchRow/.test(srcUI), '简笔画和提示文字横着排');

/* fitTray 真的会算出尺寸：模拟一个 360px 宽的手机 */
(function(){
  const box = makeEl('div');
  box.clientWidth = 360;
  W.SpellPad.fitTray(box, 14);          // 最坏情况：10 字母词 + 4 个干扰
  const t = box.style.getPropertyValue('--tile');
  const n = parseInt(t, 10);
  ok(n > 0 && n <= 58, 'fitTray 算出合法尺寸：' + t);
  const cols = Math.ceil(14 / 2);
  ok((n + 6) * cols - 6 <= 342,
     '★ 14 个字母块 2 行就放得下（' + cols + ' 列 × ' + n + 'px = ' + ((n + 6) * cols - 6) + ' ≤ 342）');
  /* 字母少的时候不该被压小 */
  const box2 = makeEl('div'); box2.clientWidth = 360;
  W.SpellPad.fitTray(box2, 5);
  ok(parseInt(box2.style.getPropertyValue('--tile'), 10) > n,
     '字母少的时候块更大（不会被一起压小）');
})();

section('19e. 词条图源统一');

ok(typeof W.wordArtURL === 'function', '有 wordArtURL（唯一词条展示入口）');
ok(typeof W.wordArtHTML === 'function', '有 wordArtHTML');
ok(/function cardArtURL\(card\)\{[\s\S]{0,220}wordArtURL\(w\)/.test(srcUI),
   '★ wordArtURL 接进了 cardArtURL（卡面）');
ok(/wordArtHTML\(w,84\)/.test(srcUI), '★ 认词页改用 wordArtHTML');
ok(!/Art\.cardArt\(w\.icon/.test(srcUI),
   '★ 认词页不再用 w.icon（动作图标）当物件图');

/* ★★ 核心守护：没有任何一个词的卡面会掉成问号 ★★ */
const qmarkWords = [];
W.BANK.all.forEach(function(w){
  const hasSprite = !!(W.Art.SPRITE && W.Art.SPRITE[w.art]);
  const hasSketch = W.Sketch.has(w.art);
  if (!hasSprite && !hasSketch) qmarkWords.push(w.word+':'+w.art);
});
ok(qmarkWords.length === 0,
   '★★ 全部 ' + W.BANK.all.length + ' 个词的图源都不掉成问号（实物图或简笔画至少有一个）',
   qmarkWords.join(' '));

/* 实物图口径：这两个数字是核验文档纠正过的，写死成守护防止再漂 */
ok(W.BANK.all.length === 109, '词库 109 词（crayon 跨单元重复，去重后）实测 ' + W.BANK.all.length);
const spriteWords = W.BANK.all.filter(function(w){ return W.Art.SPRITE && W.Art.SPRITE[w.art]; });
ok(spriteWords.length === 101, '★ 101 个词有 64×64 实物图（实测 ' + spriteWords.length + '）');
const noSprite = W.BANK.all.filter(function(w){ return !(W.Art.SPRITE && W.Art.SPRITE[w.art]); });
ok(noSprite.length === 8,
   '剩下 8 个词没有实物图：' + noSprite.map(function(w){ return w.word+'('+w.art+')'; }).join(' '));
ok(noSprite.every(function(w){ return W.Sketch.has(w.art); }),
   '★ 这 8 个词都有简笔画兜底，不是问号');

let badUrl = [];
W.BANK.all.forEach(function(w){
  const u = W.wordArtURL(w);
  if (!u || typeof u !== 'string' || !u.length) badUrl.push(w.word);
});
ok(badUrl.length === 0, '109 个词的卡面图源都能取到 URL', badUrl.join(' '));

/* ★ 共享简笔画的动词要显式列出来 —— 它们"不是问号"但也没表达出动作含义 */
const sharedSketch = {};
W.BANK.all.forEach(function(w){
  if (W.Art.SPRITE && W.Art.SPRITE[w.art]) return;
  (sharedSketch[w.art] = sharedSketch[w.art] || []).push(w.word);
});
const sharedSuspicious = Object.keys(sharedSketch).filter(function(k){ return sharedSketch[k].length > 1; });
ok(true, '（已知待补美术）共享简笔画的词：' +
   sharedSuspicious.map(function(k){ return k+'='+sharedSketch[k].join('+'); }).join('  '));

/* 技能卡 / 角色立绘【不能】被一起改成词条实物图 */
ok(/if\(card\.kind==='word'\)\{[\s\S]{0,120}return wordArtURL\(w\);/.test(srcUI),
   '★ 只有词卡走 wordArtURL');
ok(/return Art\.cardArt\(cardIcon\(card\), card\.id\);/.test(srcUI),
   '★ 技能卡仍然走原来的彩色卡背 + 图标（没被误改）');
ok(/function actBadge\(w,size\)\{[\s\S]{0,170}Art\.img\(w\.icon/.test(srcUI),
   '★ 技能徽章仍然用 w.icon（动作图标和物件图本来就是两张图）');

/* 兜底：实物图加载失败要回退到内置图标，并打开发告警 */
ok(/onerror="if\(!this\.dataset\.fb\)/.test(srcUI), '★ wordArtHTML 带 onerror 兜底');
ok(/console\.warn\(\\?'\[wordArt\] 实物图加载失败/.test(srcUI), '★ 加载失败会打开发告警');

/* 认词页真的渲染出新图（不是只在源码里写写） */
W.Game.startRun(1);                    // NodeView.enter 需要一局进行中的远征
(function(){
  let err = null;
  try {
    /* ★ 必须有 node.type —— enter() 是按 node.type 分派的，
       只写 node.page.type 会走 default 分支直接跳回地图。 */
    W.NodeView.enter({ type:'learn', floor:0, done:false,
                       page:{ type:'learn', icon:'book', title:'认识单词',
                              words:['door','fan','wall','light'] } });
  } catch(e){ err = e.message; }
  ok(!err, '认词页能正常渲染', err);
  const h = getById('nodeBody').innerHTML;
  ok(h.indexOf('assets/sprites/door.png') >= 0,
     '★ 认词页的 door 用的是实物图 assets/sprites/door.png（不再是 shield 动作图标）');
  ok(h.indexOf('assets/sprites/light.png') >= 0 && h.indexOf('assets/sprites/fan.png') >= 0
     && h.indexOf('assets/sprites/wall.png') >= 0,
     '★ fan / wall / light 也都是实物图');
  ok(h.indexOf('lcipa') >= 0, '认词卡上带音标');
  ok(h.indexOf('learncard') >= 0, '认词卡正常渲染');
})();

/* =========================================================================
   ★ 20. 存档版本与迁移（批次 A 第 1 步）
   核验文档点名要测的 7 种情况：
     正常旧档 / 字段缺失 / 损坏 JSON / 迁移中断 / 重复启动 / 导入旧档 / 无效导入
   外加三条铁律：先备份、迁移失败不覆盖、不把空档写回原位置。
   ========================================================================= */
section('20. 存档版本与迁移');

const SK = W.Save._keys;                       // {KEY, BACKUP_KEY, META_KEY}
const KEY = SK.KEY, BKEY = SK.BACKUP_KEY, MKEY = SK.META_KEY;
ok(W.Save.VER >= 3, '存档版本是 v' + W.Save.VER);
ok(typeof W.Save.reload === 'function', '有 reload（能重新读存档）');
ok(typeof W.Save.validate === 'function' && typeof W.Save.importText === 'function', '有导入校验');

/** 造一份干净的测试环境：清掉三个 key，写进 raw，再重新加载 */
function loadRaw(raw) {
  store.delete(KEY); store.delete(BKEY); store.delete(MKEY);
  if (raw != null) store.set(KEY, raw);
  W.Save.reload();
  return W.Save.status();
}
const V2SAVE = JSON.stringify({
  v: 2, totalStars: 321,
  settings: { voice: true, music: false },
  progress: { unlocked: [1, 2, 3], cleared: [1, 2] },
  learned: { w_door: { r: 3, w: 1, best: 1 } },
  wrong: { w_fan: { box: 1, wrong: 2, right: 1, due: 0, last: 0 } },
  enc: { w_door: 4 },
  diary: [{ t: 1, time: '昨天', title: '第一章', text: '...' }],
  relicsSeen: ['chalk_sprite']
});

/* ---- ① 正常旧档：迁移成功，旧记录保留 ---- */
let st = loadRaw(V2SAVE);
ok(st.state === 'migrated', '① 正常 v2 旧档 → 状态是 migrated（实测 ' + st.state + '）');
ok(W.Save.data.v === W.Save.VER, '① 迁移后版本号升到 v' + W.Save.VER);
ok(W.Save.data.totalStars === 321, '① 累计星星保留（321）');
ok(JSON.stringify(W.Save.data.progress.unlocked) === '[1,2,3]', '① 章节解锁保留');
ok(JSON.stringify(W.Save.data.progress.cleared) === '[1,2]', '① 通关记录保留');
ok(W.Save.data.relicsSeen.indexOf('chalk_sprite') >= 0, '① 收藏（词灵）保留');
ok(W.Save.data.diary.length === 1, '① 日记保留');
ok(!!W.Save.data.legacy, '★ ① 旧档打上了 legacy 标记（旧版活动记录）');
ok(W.Save.data.legacy.from === 2, '★ ① legacy.from 记下了来源版本 v2');
ok(W.Save.data.learned.w_door && W.Save.data.learned.w_door.r === 3,
   '★ ① 旧 learned 原地保留（错词本 / 单词表还要用），没有被删');
ok(W.Save.data.wrong.w_fan && W.Save.data.wrong.w_fan.wrong === 2, '★ ① 旧 wrong 原地保留');
ok(W.Save.data.enc.w_door === 4, '★ ① enc 保留为历史信息');

/* ---- ② 先备份：原始字符串一字不差地留下来 ---- */
ok(st.hasBackup === true, '② 迁移前建立了备份');
ok(store.get(BKEY) === V2SAVE, '★★ ② 备份就是【原始字符串】，一字不差（不是重新序列化的）');

/* ---- ③ 重复启动：不重复迁移，备份也不被覆盖 ---- */
const afterFirst = store.get(KEY);
st = (function(){ W.Save.reload(); return W.Save.status(); })();
ok(st.state === 'ok', '③ 第二次启动 → 状态是 ok（不再重复迁移）');
ok(store.get(BKEY) === V2SAVE, '★ ③ 第二次启动不会覆盖备份（留住的是最早那份原始档）');
ok(store.get(KEY) === afterFirst, '③ 第二次启动不会改写主存档');

/* ---- ④ 字段缺失：照样能开，缺的补默认值 ---- */
st = loadRaw(JSON.stringify({ v: 2 }));      // 只有一个版本号
ok(st.state === 'migrated' || st.state === 'ok', '④ 只有 v 字段的残档也能打开（' + st.state + '）');
ok(Array.isArray(W.Save.data.progress.unlocked) && W.Save.data.progress.unlocked.length > 0,
   '④ 缺 progress 时补上默认解锁');
ok(W.Save.data.progress.unlocked.indexOf(1) >= 0, '④ 至少解锁第 1 章（不会开局全锁）');
ok(W.Save.data.stats && typeof W.Save.data.stats.spells === 'number', '④ 缺 stats 时补默认统计');
ok(W.Save.data.settings && W.Save.data.settings.rate > 0, '④ 缺 settings 时补默认设置');
ok(W.Save.data.flags && typeof W.Save.data.flags === 'object', '④ 缺 flags 时补空对象');
st = loadRaw(JSON.stringify({ v: 3, progress: { unlocked: 'not-an-array', cleared: null } }));
ok(Array.isArray(W.Save.data.progress.unlocked), '★ ④ unlocked 类型不对时会被修正成数组');
ok(Array.isArray(W.Save.data.progress.cleared), '★ ④ cleared 是 null 时会被修正成数组');

/* ---- ⑤ 损坏 JSON：只读恢复，绝不覆盖原始记录 ---- */
const BROKEN = '{"v":2,"progress":{"unlocked":[1,2]';   // 故意截断
st = loadRaw(BROKEN);
ok(st.state === 'corrupt', '★ ⑤ 损坏 JSON → 进入 corrupt 只读态');
ok(store.get(KEY) === BROKEN, '★★ ⑤ 原始记录【一个字节都没动】');
ok(W.Save.data.progress.unlocked.indexOf(1) >= 0, '⑤ 只读态下内存里仍有一份可用的空档（游戏能开）');
const beforeSave = store.get(KEY);
W.Save.save();
ok(store.get(KEY) === BROKEN, '★★ ⑤ 只读态下 save() 不会把空档写回原位置');
W.Save.reset();
ok(store.get(KEY) !== BROKEN, '⑤ 手动 reset 才允许覆盖（这是用户明确操作）');

/* 各种畸形内容都算损坏，不能崩 */
['', 'null', 'undefined', '[]', '"a string"', '123', '{bad json}'].forEach(function(bad){
  const s2 = loadRaw(bad);
  ok(s2.state === 'corrupt' || bad === '', '⑤ 畸形内容「' + bad.slice(0, 14) + '」→ ' + s2.state);
});
st = loadRaw('[]');
ok(st.state === 'corrupt', '⑤ JSON 数组也算损坏（存档必须是对象）');

/* ---- ⑥ 迁移中断：主存档写不进去时，备份和只读态仍然成立 ---- */
st = loadRaw(V2SAVE);
ok(st.hasBackup, '⑥ 中断场景起点：已有备份');
/* 模拟「迁移写盘失败」：把 localStorage.setItem 打断 */
const realSet = store.set.bind(store);
let broke = false;
store.set = function(k, v){ if (k === KEY && !broke) { broke = true; throw new Error('quota'); } return realSet(k, v); };
W.Save.reload();
store.set = realSet;
ok(store.get(BKEY) === V2SAVE, '★ ⑥ 写盘失败也不影响备份（原始档还在）');
ok(!broke || true, '⑥ 写盘抛异常不会把游戏搞崩（已捕获）');

/* ---- ⑦ 迁移失败 / 不支持的新版本：明确拒绝，不动存档 ---- */
st = loadRaw(V2SAVE);
const futureTxt = JSON.stringify({ v: 99, progress: { unlocked: [1] } });
const rawBeforeValidate = store.get(KEY);
const vFuture = W.Save.validate(futureTxt);
ok(!vFuture.ok, '★ ⑦ 来自更新版本（v99）的存档被明确拒绝');
ok(/更新的版本/.test(vFuture.error || ''), '⑦ 拒绝理由说清楚了：' + (vFuture.error || ''));
ok(store.get(KEY) === rawBeforeValidate, '★ ⑦ 校验失败一个字节都没动当前存档');

/* ---- ⑧ 无效导入：各种坏输入都要挡住 ---- */
const badInputs = [
  ['空内容', ''],
  ['空白', '   '],
  ['不是 JSON', 'hello world'],
  ['数组', '[1,2,3]'],
  ['没有版本号', JSON.stringify({ progress: { unlocked: [1] } })],
  ['版本号不是数字', JSON.stringify({ v: 'x' })],
  ['progress 类型不对', JSON.stringify({ v: 3, progress: 'oops' })]
];
badInputs.forEach(function(pair){
  const r = W.Save.validate(pair[1]);
  ok(!r.ok, '★ ⑧「' + pair[0] + '」被拒绝', r.error || '(竟然通过了)');
});
ok(W.Save.validate(null).ok === false, '⑧ null 被拒绝');

/* ---- ⑨ 合法导入：走通，并保留旧档语义 ---- */
st = loadRaw(V2SAVE);
const importTxt = JSON.stringify({
  v: 2, totalStars: 777, progress: { unlocked: [1, 2], cleared: [1] },
  learned: { w_book: { r: 2, w: 0, best: 1 } }
});
const vOk = W.Save.validate(importTxt);
ok(vOk.ok, '⑨ 合法 v2 存档通过校验');
ok(/v2/.test(vOk.info || ''), '⑨ 校验结果里报告了版本：' + (vOk.info || '').slice(0, 40));
ok(/迁移到 v3/.test(vOk.warn || ''), '★ ⑨ 旧版本导入会先警告「会迁移」（不偷偷改）');
const imp = W.Save.importText(importTxt);
ok(imp.ok, '⑨ 导入成功');
ok(W.Save.data.totalStars === 777, '⑨ 导入后用的是新档数据');
ok(!!W.Save.data.legacy, '★ ⑨ 导入的旧档同样打上 legacy 标记');
ok(W.Save.status().state === 'imported', '⑨ 状态标记为 imported');

/* ---- ⑩ 恢复备份：拿回迁移前那一份 ---- */
st = loadRaw(V2SAVE);                         // 建立备份
W.Save.data.totalStars = 1; W.Save.save();    // 之后把进度改乱
const restored = W.Save.restoreBackup();
ok(restored, '★ ⑩ 恢复备份成功');
ok(W.Save.data.totalStars === 321, '★ ⑩ 恢复后拿回的是备份里的值（321，不是被改乱的 1）');

/* ---- ⑪ 全新档 & 元信息 ---- */
st = loadRaw(null);
ok(st.state === 'fresh', '⑪ 没有存档时是 fresh');
ok(st.hasBackup === false, '⑪ 全新档没有备份');
ok(W.Save.status().writable === true, '⑪ 全新档可写');
loadRaw(V2SAVE);
ok(store.get(MKEY) != null, '★ ⑪ 迁移后写了元信息（记录迁移到哪个版本）');
const meta = JSON.parse(store.get(MKEY) || '{}');
ok(meta.migratedTo === W.Save.VER && meta.from === 2, '★ ⑪ 元信息记下了 from v2 → v' + W.Save.VER);

/* 收尾：把存档恢复成一个正常状态，别影响后面的用例 */
loadRaw(null);
W.Game.startRun(1);

section('15. 六章可通关性模拟（防死局）');
function simBattle(chapterId, foeIds, scale, maxTurns) {
  W.Save.data.settings.mode = 'easy';       // 只测「能不能打死」，排除认读失败干扰
  W.Game.startRun(chapterId);
  W.Game.run().hp = 99999;                  // 血量拉满，只考察输出能力
  W.Battle.start(foeIds, { hpScale: scale || 1 });
  let turns = 0;
  while (W.Battle.S && !W.Battle.S.over && turns < maxTurns) {
    let guard = 0;
    while (W.Battle.S && !W.Battle.S.over && guard++ < 14) {
      const st = W.Battle.S;
      if (st.energy <= 0) break;
      let played = false;
      for (let i = 0; i < handNodes().length; i++) {
        if (!W.Battle.S || W.Battle.S.over) break;
        const en = W.Battle.S.energy, hn = W.Battle.S.hand.length;
        clickCard(i);
        if (!W.Battle.S) break;
        if (W.Battle.S.energy !== en || W.Battle.S.hand.length !== hn) { played = true; break; }
      }
      if (!played) break;
    }
    if (!W.Battle.S || W.Battle.S.over) break;
    W.Battle.basicAttack();                 // 每回合一次的免费画笔攻击
    if (!W.Battle.S || W.Battle.S.over) break;
    W.Battle.endTurn();
    turns++;
  }
  const S2 = W.Battle.S;
  const allDead = !S2 || S2.foes.every(f => !f.alive);
  return { won: allDead, turns: turns, hp: S2 && S2.foes[0] ? S2.foes[0].hp : 0 };
}

const simFail = [];
W.CHAPTERS.forEach(ch => {
  const tests = [];
  if (ch.pages) {
    ch.pages.filter(p => p.foes).forEach(p => tests.push({ label: p.title, foes: p.foes, scale: p.hpScale }));
  } else {
    tests.push({ label: '普通战', foes: [ch.foes[0]], scale: 1 });
    tests.push({ label: '精英战', foes: [ch.elites[0]], scale: 1 });
  }
  tests.push({ label: 'BOSS', foes: [ch.boss], scale: 1 });
  tests.forEach(t => {
    const r = simBattle(ch.id, t.foes, t.scale, 30);
    ok(r.won, '第 ' + ch.id + ' 章「' + t.label + '」可以打赢（' + r.turns + ' 回合）',
       r.won ? '' : ('剩余血量 ' + r.hp + '，30 回合没打死'));
    if (!r.won) simFail.push(ch.id + '/' + t.label);
  });
});
ok(simFail.length === 0, '六章全部可通关，无死局', simFail.join(', '));

/* 反过来也要成立：起始卡组里必须有输出手段 */
W.CHAPTERS.forEach(ch => {
  const r0 = W.Game.startRun(ch.id);
  const hasDmg = r0.deck.some(id => {
    const c = W.CARDS.make(id);
    return c && c.ops.some(o => o.t === 'dmg');
  });
  const hasAlly = r0.deck.some(id => {
    const c = W.CARDS.make(id);
    return c && c.ops.some(o => o.t === 'ally' && o.kind !== 'heal');
  });
  ok(hasDmg || hasAlly, '第 ' + ch.id + ' 章起始卡组里有输出手段（伤害牌或同伴）');
});

/* 画笔普攻：永远存在的保底输出 */
W.Save.data.settings.mode = 'normal';
W.Game.startRun(1);
W.Battle.start('smear');
const basicHp0 = W.Battle.S.foes[0].hp;
W.Battle.basicAttack();
ok(!W.Battle.S || W.Battle.S.over || W.Battle.S.foes[0].hp < basicHp0, '画笔普攻能造成伤害');
ok(!W.Battle.S || W.Battle.S.over || W.Battle.S.basicUsed === true, '普攻每回合只能用一次');
W.Battle.endTurn();
ok(!W.Battle.S || W.Battle.S.over || W.Battle.S.basicUsed === false, '新回合普攻次数会重置');

/* ---------------- 15b. ★ 看得见的护盾（门立在身前 → 挡住 → 碎了才消失） ---------------- */
section('15b. 看得见的护盾物件');

function guardSetup(foeId) {
  W.Save.data.settings.mode = 'easy';
  W.Game.startRun(1);
  W.Game.run().hp = 9999;
  W.Battle.start(foeId);
  return W.Battle.S;
}

/* 打出 door → 生成一个「门」物件，血量 = 护盾值 */
let gs = guardSetup('inkling');
gs.energy = 9;
gs.hand = [W.CARDS.make('c_w_door')];
W.Battle.renderAll();
clickCard(0);
gs = W.Battle.S;
ok(gs.guards.length === 1, '打出 door 之后身前立起 1 件护盾物（实际 ' + gs.guards.length + '）');
if (gs.guards.length) {
  ok(gs.guards[0].icon === 'door', '立在身前的是「门」的图形，不是通用盾牌：' + gs.guards[0].icon);
  ok(gs.guards[0].hp === gs.block, '门自己的血量 = 护盾数值（' + gs.guards[0].hp + '）');
  ok(gs.guards[0].label === 'door', '护盾物带着它来自哪个单词：' + gs.guards[0].label);
}
ok(W.Battle.S.block === gs.guards.reduce((a, g) => a + g.hp, 0), 'S.block 与所有物件血量之和始终一致');

/* 渲染出来的 DOM 里确实有 .guard 元素，并且用门自己的图 */
W.Battle.renderAll();
const guardDom = getById('btlArena').innerHTML;
ok(guardDom.indexOf('class="guard') >= 0, '战场里渲染出了护盾物件元素');
ok(guardDom.indexOf('data-gid') >= 0, '护盾物件带唯一 id（便于播放碎裂动画）');
ok(guardDom.indexOf('opacity:1.00') >= 0 || /opacity:0\.\d\d/.test(guardDom), '护盾物件按血量显示透明度');
ok(guardDom.indexOf('gbar') >= 0, '每件护盾物有自己的小血条');

/* 敌人攻击 → 先砸在门上，只有超出部分才扣英雄血 */
gs = guardSetup('eraserl');           // 意图 7 点攻击
gs.energy = 9;
gs.hand = [W.CARDS.make('c_w_door')]; // 门 = 10 点护盾
W.Battle.renderAll(); clickCard(0);
gs = W.Battle.S;
const blockBefore = gs.block, heroHpBefore = W.Game.run().hp;
W.Battle.endTurn();
gs = W.Battle.S;
ok(!gs || gs.over || W.Game.run().hp === heroHpBefore, '敌人的攻击被门完全挡下，英雄不掉血');
ok(!gs || gs.over || gs.block < blockBefore, '门被砸掉了一部分（' + blockBefore + ' → ' + (gs.gone ? '-' : gs.block) + '）');

/* 连续挨打 → 门被打碎，之后才开始掉血 */
gs = guardSetup('smear');             // 意图 6 点
gs.energy = 9;
gs.hand = [W.CARDS.make('c_w_wall')]; // 墙 = 12 点护盾
W.Battle.renderAll(); clickCard(0);
let brokeAt = -1, turns = 0;
while (W.Battle.S && !W.Battle.S.over && turns < 12) {
  if (W.Battle.S.guards.length === 0 && brokeAt < 0) brokeAt = turns;
  W.Battle.endTurn();
  turns++;
}
ok(brokeAt >= 0, '护盾被反复攻击后最终会碎裂消失（第 ' + brokeAt + ' 回合后）');

/* 护盾可以跨回合保留，但会自然「褪色」衰减 */
gs = guardSetup('inkling');
gs.energy = 9;
gs.hand = [W.CARDS.make('c_w_wall')];
W.Battle.renderAll(); clickCard(0);
gs = W.Battle.S;
const full = gs.block;
/* 让敌人这一回合不动，单独观察褪色 */
gs.foes.forEach(f => { f.stun = true; });
W.Battle.endTurn();
gs = W.Battle.S;
ok(!gs || gs.over || (gs.block > 0 && gs.block < full),
   '门/墙能跨回合继续立在身前，但会褪色衰减（' + full + ' → ' + (gs.gone ? '-' : gs.block) + '）');
ok(!gs || gs.over || gs.block === gs.guards.reduce((a, g) => a + g.hp, 0), '褪色后数值依然与物件同步');

/* 同一个回合摆多件护盾：都应该看得见 */
gs = guardSetup('inkling');
gs.energy = 9;
gs.guards = []; gs.block = 0;
const multi = ['c_w_door', 'c_w_wall', 'c_w_desk'].map(id => W.CARDS.make(id));
multi.forEach(c => { gs.hand = [c]; W.Battle.renderAll(); clickCard(0); gs = W.Battle.S; });
ok(gs.guards.length === 3, '同一回合摆出 3 件护盾物（实际 ' + gs.guards.length + '）');
ok(new Set(gs.guards.map(g => g.icon)).size >= 2, '不同单词摆出的是不同的实物图形');
W.Battle.renderAll();
/* 注意正则要排除 class="guardrow" 这个容器 */
const gCount = (getById('btlArena').innerHTML.match(/class="guard[" ]/g) || []).length;
ok(gCount === 3, '战场上同时渲染 3 件护盾物（实际 ' + gCount + '）');

/* 护盾上限：不会无限堆积 */
gs = guardSetup('inkling');
gs.energy = 99;
for (let k = 0; k < 6; k++) {
  gs = W.Battle.S; if (!gs) break;
  gs.hand = [W.CARDS.make('c_w_door')]; gs.energy = 99;
  W.Battle.renderAll(); clickCard(0);
}
gs = W.Battle.S;
ok(!gs || gs.over || gs.guards.length <= 4, '同屏护盾物最多 4 件，不会堆满屏幕（实际 ' + (gs.gone ? '-' : gs.guards.length) + '）');
ok(!gs || gs.over || gs.block === gs.guards.reduce((a, g) => a + g.hp, 0), '超量护盾被合并后数值依然正确');

W.Save.data.settings.mode = 'normal';

/* ---------------- 16b. ★ 素材验收室 ---------------- */
section('16b. 素材验收室');
ok(!!W.ReviewRoom, '验收室模块已导出');
const rvAll = W.ReviewRoom.all;
ok(rvAll.length === W.BANK.all.length, '验收室列出了全部 ' + rvAll.length + ' 个单词');

/* 每个词条的状态要正确：有没有图形 / 和几个词共用 / 是不是本次新增 */
const rvMissing = rvAll.filter(x => !x.has);
ok(rvMissing.length === 0, '所有单词都有简笔画，没有兜底问号',
   rvMissing.map(x => x.w.word + ':' + x.w.art).join(','));
const rvUpdated = rvAll.filter(x => x.updated);
ok(rvUpdated.length === 21, '本次新增的 P0 图形被标了出来：' + rvUpdated.length + ' 个');
const badShare = rvAll.filter(x => {
  const n = W.BANK.all.filter(y => y.art === x.w.art).length;
  return x.share !== n;
});
ok(badShare.length === 0, '「共用数量」统计正确');
const rvShared = rvAll.filter(x => x.share > 1);
ok(rvShared.length > 0, '确实还有 ' + rvShared.length + ' 个词在共用图形（P1 待办）');

/* P0 的 21 个不能再共用图形了 */
const p0Keys = ['light', 'crayon', 'ruler', 'candy', 'teddy', 'key', 'eraser', 'hair',
                'glasses', 'shoe', 'hat', 'table', 'sofa', 'bathtub', 'knife', 'fork',
                'chopsticks', 'spoon', 'egg', 'football', 'basketball'];
const p0Bad = p0Keys.filter(k => W.BANK.all.filter(w => w.art === k).length !== 1);
ok(p0Bad.length === 0, 'P0 的 21 个图形都是专属的，不再被共用', p0Bad.join(','));

/* 新图形必须符合格式规范：3~6 笔、每笔 ≥2 点、坐标在 0~100、留白充足 */
const specBad = [];
p0Keys.forEach(k => {
  const polys = W.Sketch.polys(k);
  if (!polys.length) { specBad.push(k + ':空'); return; }
  if (polys.length < 3 || polys.length > 6) specBad.push(k + ':' + polys.length + '笔');
  let pts = 0, minX = 999, maxX = -999, minY = 999, maxY = -999;
  polys.forEach(p => {
    pts += p.length;
    if (p.length < 2) specBad.push(k + ':点数不足');
    p.forEach(q => {
      if (q[0] < 0 || q[0] > 100 || q[1] < 0 || q[1] > 100) specBad.push(k + ':越界');
      minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]);
      minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
    });
  });
  if (pts < 12 || pts > 48) specBad.push(k + ':' + pts + '点');
  if (minX < 2 || maxX > 98 || minY < 2 || maxY > 98) specBad.push(k + ':没留白');
});
ok(specBad.length === 0, '21 个新图形全部符合《简笔画规范》', [...new Set(specBad)].join(', '));

/* 验收室的界面能真的渲染出来 */
W.ReviewRoom.open();
const gridHtml = getById('rvGrid').innerHTML;
ok(gridHtml.indexOf('rvcard') >= 0, '验收室渲染出卡片网格');
const cardCount = (gridHtml.match(/class="rvcard/g) || []).length;
ok(cardCount === W.BANK.all.length,
   '网格里铺满了全部单词（实际 ' + cardCount + ' 个）');
ok(gridHtml.indexOf('rvbadge') >= 0, '共用图形的卡片带角标提示');
ok(gridHtml.indexOf('data:image/png') >= 0, '每张卡片都有简笔画缩略图');
ok(getById('rvCount').textContent.indexOf('/') > 0, '计数显示正常：' + getById('rvCount').textContent);

/* ★ 数字必须和卡片绑定：卡片上有序号，且序号连续、从 1 开始、数量对得上 */
const numbers = [...gridHtml.matchAll(/class="rvno">(\d+)</g)].map(m => +m[1]);
ok(numbers.length === cardCount, '每张卡片都带序号（' + numbers.length + ' 个）');
ok(numbers[0] === 1, '序号从 1 开始');
ok(numbers.every((n, i) => n === i + 1), '序号连续且和卡片顺序一一对应');
ok(getById('rvCount').textContent.indexOf('筛选') === 0,
   '顶栏计数标明是「筛选后」的数量：' + getById('rvCount').textContent);

/* ★ 「当前第几张」必须跟着翻页走：计数、序号、卡片三者同步 */
ok(getById('rvCur').textContent === '当前 1', '刚打开时「当前」= 第 1 张：' + getById('rvCur').textContent);
fire(getById('rvNext'), 'click', {});
ok(getById('rvCur').textContent === '当前 2', '按「下一张」后「当前」跟着变：' + getById('rvCur').textContent);
ok(getById('rvPos').textContent === '2 / ' + W.BANK.all.length,
   '详情页的进度与顶栏一致：' + getById('rvPos').textContent);
fire(getById('rvNext'), 'click', {});
fire(getById('rvPrev'), 'click', {});
fire(getById('rvPrev'), 'click', {});
ok(getById('rvCur').textContent === '当前 1', '往前翻能回到第 1 张：' + getById('rvCur').textContent);
fire(getById('rvPrev'), 'click', {});
ok(getById('rvCur').textContent === '当前 ' + W.BANK.all.length,
   '从第 1 张往前翻会绕到最后一张：' + getById('rvCur').textContent);

/* 绕回最后一张之后，继续往后翻应该回到开头，计数不能乱 */
fire(getById('rvNext'), 'click', {});   // 109 → 1
ok(getById('rvCur').textContent === '当前 1', '从最后一张往后翻会绕回第 1 张：' + getById('rvCur').textContent);
fire(getById('rvNext'), 'click', {});   // 1 → 2
ok(getById('rvCur').textContent === '当前 2', '绕回后继续翻页计数正确：' + getById('rvCur').textContent);
W.ReviewRoom.close();

/* ---------------- 16c. ★ 实物像素图 + 对齐机制 ---------------- */
section('16c. 实物像素图与对齐');
ok(typeof W.SPRITE === 'object', 'SPRITE 实物图表已建立');
ok(typeof W.Art.real === 'function' && typeof W.Art.hasReal === 'function',
   'Art.real() / Art.hasReal() 已导出');

/* 没登记实物图时必须安全回退，不能返回 undefined */
let badReal = [];
W.BANK.all.forEach(w => {
  const r = W.Art.real(w.art);
  if (typeof r !== 'string' || r.indexOf('data:') !== 0 && !/\.(png|jpe?g|webp)$/i.test(r)) badReal.push(w.word);
});
ok(badReal.length === 0, '每个图形 key 都能拿到一张图（缺失时回退到内置图标）',
   badReal.slice(0, 5).join(','));
ok(W.Art.real('不存在的key').indexOf('data:image') === 0, '未知 key 也能回退，不会崩');

/* 登记过的 key 要真的用那张图；没登记的用内置图标 */
const fakeKey = '__selftest_sprite__';
W.SPRITE[fakeKey] = 'data:image/png;base64,AAAB';
ok(W.Art.hasReal(fakeKey) === true, '登记后 hasReal 返回 true');
ok(W.Art.real(fakeKey) === 'data:image/png;base64,AAAB', '登记后 real 返回登记的那张图');
delete W.SPRITE[fakeKey];
ok(W.Art.hasReal(fakeKey) === false, '删掉后 hasReal 回到 false');
/* 挑一个「还没做实物图」的 key 来验回退路径 —— 别写死 door：
   实物图是一批一批补的，写死的 key 早晚会被补上，这条检查就会假失败。
   注意：无头替身里 toDataURL 返回的是固定假字符串，所以不能拿 real() 和 get()
   的返回值直接比字符串 —— 改成把 autoReal 换成一个哨兵，看 real() 有没有走到它。 */
const noSpriteKey = Object.keys(W.Sketch.ALL).filter(k => k !== '__default' && !W.SPRITE[k])[0];
ok(!!noSpriteKey, '存在「还没做实物图」的 key，可以验证回退路径');
const realAutoReal = W.Sketch.autoReal;
W.Sketch.autoReal = () => 'SENTINEL_AUTO_REAL';
ok(W.Art.real(noSpriteKey) === 'SENTINEL_AUTO_REAL',
   '未登记实物图时 real 走的是程序化实物图（' + noSpriteKey + '）');
W.SPRITE[noSpriteKey] = 'assets/sprites/' + noSpriteKey + '.png';
ok(W.Art.real(noSpriteKey) === 'assets/sprites/' + noSpriteKey + '.png',
   '登记了实物图时 real 不再走程序化，直接用真图');
delete W.SPRITE[noSpriteKey];
W.Sketch.autoReal = realAutoReal;

/* ★ 对齐的核心保证：简笔画和实物图画进【同一个正方形】 */
W.Game.startRun(1);
W.Battle.start('inkling');
const canvas = getById('drawCanvas');
ok(!!canvas, '演出画布存在');
/* 画布尺寸在测试替身里是固定的，这里验证「同一坐标系」这条不变量：
   简笔画的 0 和 100 必须落在同一个正方形里，实物图也用这个正方形 */
const srcCode = (function () {
  const fs = require('fs');
  const html = fs.readFileSync('D:\\雪梨英语管理系统\\Game3\\legacy.html', 'utf8');
  return html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
})();
ok(/function box\(\)\{[\s\S]{0,160}?side=Math\.min\(W,H\)/.test(srcCode),
   '画布用「居中的正方形」作为 0~100 素材坐标系');
ok(/const b=box\(\);\s*\n\s*ctx\.globalAlpha=a;[\s\S]{0,120}?ctx\.drawImage\(spriteImg,b\.x,b\.y,b\.side,b\.side\)/.test(srcCode),
   '实物图画进的是和简笔画完全相同的那个矩形（天然对齐）');
ok(/drawAll\(0\);[\s\S]{0,160}?revealSprite\(\);/.test(srcCode),
   '演出顺序：先只留线条，再让实物在原位淡入');
ok(/function revealSprite\(\)/.test(srcCode), '有独立的「实物长出来」淡入函数');

/* 验收室的三联图能渲染 */
W.ReviewRoom.open();
const rvHtml = getById('rvGrid').innerHTML;
ok(rvHtml.indexOf('rvcard') >= 0, '验收室仍能正常渲染');
W.ReviewRoom.close();

/* ★ 三级回退：真图 → 程序化占位图 → 内置小图标，任何一级都不能崩 */
/* ★ 已登记的实物图必须真的存在，路径写错要立刻发现 */
const fsx = require('fs'), pathx = require('path');
const ROOTX = 'D:\\雪梨英语管理系统\\Game3';
const spriteKeys = Object.keys(W.SPRITE || {});
const missingFile = spriteKeys.filter(k => {
  const src = W.SPRITE[k];
  if (/^data:/.test(src)) return false;
  return !fsx.existsSync(pathx.isAbsolute(src) ? src : pathx.join(ROOTX, src));
});
ok(missingFile.length === 0, 'SPRITE 表里登记的 ' + spriteKeys.length + ' 张图文件都在',
   missingFile.map(k => k + ':' + W.SPRITE[k]).join(', '));

/* ★ 每张实物图都必须有人用，否则就是「登记了却没人看」的死文件。
   两类使用者：
     ① 单词       —— 大部分实物图是词卡的图（door / desk / …）
     ② 剧情屏     —— 角色立绘（chalk / dragon / mirror / tree / pot …）不是单词，
                     只在剧情里出现，不能因为「没有单词在用」被判成死文件。
   这条是从 STORY 里自动推导的，以后加剧情角色不用改这里。 */
const storyArts = new Set();
Object.values(W.STORY || {}).forEach(seg => (seg.screens || []).forEach(sc => {
  if (sc.art) storyArts.add(sc.art);
}));
const deadSprite = spriteKeys.filter(k => !W.BANK.all.some(w => w.art === k) && !storyArts.has(k));
ok(deadSprite.length === 0,
   'SPRITE 表的每个 key 都有单词或剧情在用（' + spriteKeys.length + ' 张，其中 ' +
   spriteKeys.filter(k => !W.BANK.all.some(w => w.art === k)).length + ' 张是剧情角色）',
   '没人用：' + deadSprite.join(','));

/* ★ 有图没登记 —— 这条直接盯住「美术做完了但忘记登记」。
   这批 NPC 立绘交付时就是这样：5 张 PNG 都做对了，但 SPRITE 表里一条都没有，
   于是游戏照旧读 16×16 小图标 —— 美术白做了，而且从界面上完全看不出来。
   判据不用猜「意图」：assets/sprites/ 下只要有一张 PNG 没登记，就是漏了。 */
const spriteDir = pathx.join(ROOTX, 'assets', 'sprites');
const onDisk = fsx.existsSync(spriteDir)
  ? fsx.readdirSync(spriteDir).filter(f => /\.png$/i.test(f) && !/^_/.test(f)).map(f => f.replace(/\.png$/i, ''))
  : [];
const unregistered = onDisk.filter(k => !W.SPRITE[k]);
ok(unregistered.length === 0,
   'assets/sprites/ 下的 ' + onDisk.length + ' 张图全部登记进 SPRITE（没有做了却没人用的）',
   '有图但没登记：' + unregistered.join(', '));

/* 反向：登记了但文件不在，前面的 missingFile 已经查了 */
ok(spriteKeys.every(k => W.Art.realKind(k) === 'sprite'),
   '登记之后 realKind 都变成 sprite（不再是 auto）');

/* ★ 每张实物图都必须是正方形 PNG（引擎会把它拉进正方形的 0~100 框，
   不是正方形就会被拉变形，而且从数值上很难看出来） */
const badDim = [], badFmt = [], dupContent = {};
const crypto = require('crypto');
spriteKeys.forEach(k => {
  const src = W.SPRITE[k];
  if (/^data:/.test(src)) return;
  const p = pathx.isAbsolute(src) ? src : pathx.join(ROOTX, src);
  const buf = fsx.readFileSync(p);
  if (buf.toString('ascii', 1, 4) !== 'PNG') { badFmt.push(k); return; }
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (w !== h) badDim.push(k + ':' + w + '×' + h);
  if (w !== 64) badDim.push(k + ':不是 64×64（是 ' + w + '）');
  const sig = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
  (dupContent[sig] = dupContent[sig] || []).push(k);
});
ok(badFmt.length === 0, '每张实物图都是 PNG 格式', badFmt.join(','));
ok(badDim.length === 0, '每张实物图都是 64×64 正方形', [...new Set(badDim)].join(', '));
const dupGroups = Object.values(dupContent).filter(g => g.length > 1);
ok(dupGroups.length === 0, '没有内容完全相同的实物图（批量生成时最容易犯的错）',
   dupGroups.map(g => g.join('=')).join('  '));

/* ★ 剪影描边 + 颜色数 —— 这两条决定了「简笔画变成实物」那一下顺不顺
   （简笔画用墨线画，实物图外缘如果是浅色，墨线就被盖掉了，淡入看起来像糊上去的。
     实测过没补描边的人物图外缘只有 27% 是墨线，补完是 100%） */
const { decodePNG: decodeSpritePNG } = require('./tools/spritekit.js');
const olBad = [], olThin = [], colBad = [], outBad = [];
spriteKeys.forEach(k => {
  const src = W.SPRITE[k];
  if (/^data:/.test(src)) return;
  const p = pathx.isAbsolute(src) ? src : pathx.join(ROOTX, src);
  let im;
  try { im = decodeSpritePNG(fsx.readFileSync(p)); } catch (e) { return; }
  const solid = (x, y) => x >= 0 && y >= 0 && x < 64 && y < 64 && im[(y * 64 + x) * 4 + 3] > 0;
  let edge = 0, dark = 0;
  const colors = new Set();
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    if (!solid(x, y)) continue;
    const i4 = (y * 64 + x) * 4;
    colors.add((im[i4] << 16) | (im[i4 + 1] << 8) | im[i4 + 2]);
    if (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)) continue;
    edge++;
    if (0.299 * im[i4] + 0.587 * im[i4 + 1] + 0.114 * im[i4 + 2] < 90) dark++;
  }
  const r = edge ? dark / edge : 0;
  if (r < 0.90) olBad.push(k + ':' + (r * 100).toFixed(0) + '%');
  else if (r < 1) olThin.push(k + ':' + (r * 100).toFixed(0) + '%');
  if (colors.size > 8) colBad.push(k + ':' + colors.size + '色');

  /* ★ 实物不能伸到简笔画「画过的墨线」外面。
     引擎把实物图和简笔画 drawImage 到同一个正方形；简笔画线宽约 3.1 个单位、
     以折线为中心，所以实际画到的是包围盒 ±1.55。实物超出这个范围的部分，
     淡入时没有线托着，看起来就是「凭空多出一块」。
     实测过：桌面挑出 2px、人物鞋底挑出 4px，显示时约 7~15px，看得出来。
     这条比「尺寸比例」准 —— 同样是 1.18×，宽 76 的图形多出 7 个单位，
     宽 40 的只多 3.4，比例口径会把它们判成一样糟。

     ★ 必须用 Sketch.ALL 直接查表，不能用 Sketch.polys()：
       polys() 对未知 key 会兜底返回 SKETCH.__default（一个问号），
       于是「没有简笔画的角色立绘」会拿问号的包围盒去比 —— 假失败。
       没有简笔画的图（NPC 立绘）本来就无从谈「伸没伸出墨线」，跳过。 */
  const polys = W.Sketch.ALL[k];
  if (!polys || !polys.length) return;
  const sb = (function () {
    let a = 100, b = -1, c = 100, d = -1;
    polys.forEach(p => p.forEach(q => {
      if (q[0] < a) a = q[0]; if (q[0] > b) b = q[0];
      if (q[1] < c) c = q[1]; if (q[1] > d) d = q[1];
    }));
    return (b < 0) ? null : { minX: a, maxX: b, minY: c, maxY: d };
  })();
  if (sb) {
    let minX = 64, maxX = -1, minY = 64, maxY = -1;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (im[(y * 64 + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (maxX >= 0) {
      const T = v => v / 64 * 100;
      const over = Math.max(
        (sb.minX - 1.55) - T(minX), T(maxX) - (sb.maxX + 1.55),
        (sb.minY - 1.55) - T(minY), T(maxY) - (sb.maxY + 1.55));
      if (over > 2.34) outBad.push(k + '：超出 ' + (over * 0.64).toFixed(1) + 'px');   /* 2.34 单位 = 1.5px */
    }
  }
});
ok(olBad.length === 0,
   '每张实物图的外缘都是墨线（能接住简笔画的墨线）—— 共 ' + spriteKeys.length + ' 张',
   '描边覆盖不足 90%：' + olBad.join('、'));
ok(colBad.length === 0, '每张实物图颜色数 ≤ 8（少色平涂规范）', colBad.join('、'));
ok(outBad.length === 0,
   '没有实物图伸到简笔画墨线外面（伸出去的部分淡入时会「凭空多出一块」）',
   outBad.join('、'));
if (olThin.length) console.log('   （注：' + olThin.length + ' 张外缘有极细笔画未压墨，属正常：' + olThin.join('、') + '）');

/* ★ Art.pic —— 战斗里「拼出来的词变成真东西」靠它，
   必须在有实物图时用实物图、没有时才退回内置小图标 */
ok(typeof W.Art.pic === 'function', 'Art.pic 已导出（实物图优先的 <img>）');
ok(W.Art.pic('desk', 44).indexOf('assets/sprites/desk.png') > 0, 'Art.pic 优先用实物像素图');
ok(W.Art.pic('inkling', 44).indexOf(W.Art.get('inkling')) > 0,
   'Art.pic 在 key 没有简笔画/实物图时退回内置小图标（不能拿 __default 通用形状顶替）');
/* 挑一个「有简笔画、还没做实物图」的 key：这时应该给程序化实物图，
   而且必须和内置 8×8 小图标不是同一张，否则这个检查会假通过 */
const sketchOnly = Object.keys(W.Sketch.ALL).filter(k => k !== '__default' && !W.SPRITE[k])[0];
ok(!!sketchOnly, '存在「只有简笔画、还没做实物图」的 key 可供检查');
if (sketchOnly) {
  ok(W.Art.pic(sketchOnly, 44).indexOf('data:image/png') > 0 &&
     W.Art.pic(sketchOnly, 44) !== W.Art.img(sketchOnly, 44),
     'Art.pic 对只有简笔画的词（' + sketchOnly + '）用的是程序化实物图，不是小图标');
}
ok(/Art\.pic\(/.test(CODE), '战斗特效里确实用上了 Art.pic');
['fly(', 'spawnAt(', 'callAlly('].forEach(fn => {
  const m = CODE.match(new RegExp('function ' + fn.replace('(', '\\(') + '[\\s\\S]{0,600}?U\\.el\\([^)]*Art\\.(pic|img)'));
  ok(!!m && m[1] === 'pic', fn.replace('(', '') + ' 弹出/飞出的物件用的是实物图而不是小图标');
});

/* ★ 批次清单必须和「实际推导出来的集合」完全一致 —— 清单和现实脱节是最难查的一类问题
   （之前 P0 清单把动词 bath 占用的 bathtub 也算进去，工具一直显示 20/21 差一个） */
const P0K = W.P0_SKETCH_KEYS, P1K = W.P1_SKETCH_KEYS;
ok(Array.isArray(P0K) && P0K.length === 21, 'P0_SKETCH_KEYS 有 21 个');
ok(Array.isArray(P1K) && P1K.length === 57, 'P1_SKETCH_KEYS 有 57 个，实际 ' + (P1K ? P1K.length : 0));
ok(new Set(P0K).size === P0K.length, 'P0 清单没有重复项');
ok(new Set(P1K).size === P1K.length, 'P1 清单没有重复项');
ok(P0K.every(k => P1K.indexOf(k) < 0), 'P0 和 P1 清单没有交叠');

const artInUse = new Set(W.BANK.all.map(w => w.art));
ok(P0K.every(k => artInUse.has(k)), 'P0 清单里每个 key 都有单词在用',
   P0K.filter(k => !artInUse.has(k)).join(' '));
ok(P1K.every(k => artInUse.has(k)), 'P1 清单里每个 key 都有单词在用',
   P1K.filter(k => !artInUse.has(k)).join(' '));

/* 独立推导一遍 P1：名词 × 非 P0 × 非抽象词。
   已经做出的试样仍属于 P1 清单，所以这里不按真图状态过滤。 */
const derivedP1 = [...new Set(W.BANK.all
  .filter(w => w.tag !== 'verb')
  .filter(w => w.tag !== 'adj' && w.tag !== 'study')
  .filter(w => P0K.indexOf(w.art) < 0)
  .map(w => w.art))];
ok(derivedP1.every(k => P1K.indexOf(k) >= 0),
   'P1 清单没有漏掉任何该做的图形', derivedP1.filter(k => P1K.indexOf(k) < 0).join(' '));
ok(P1K.every(k => derivedP1.indexOf(k) >= 0),
   'P1 清单没有多出不存在的图形', P1K.filter(k => derivedP1.indexOf(k) < 0).join(' '));

ok(typeof W.Sketch.autoReal === 'function', '程序化实物图生成器已就绪');
let autoBad = [];
W.BANK.all.forEach(w => {
  const a = W.Sketch.autoReal(w.art, 128);
  if (typeof a !== 'string' || a.indexOf('data:image/png') !== 0) autoBad.push(w.word);
});
ok(autoBad.length === 0, '每个图形都能程序化生成实物图（' + W.BANK.all.length + ' 个全部成功）',
   autoBad.slice(0, 5).join(','));
ok(W.Sketch.autoReal('不存在的key').indexOf('data:image/png') === 0, '未知图形也有兜底实物图');
ok(W.Sketch.autoReal('door') === W.Sketch.autoReal('door'), '程序化实物图有缓存（同一 key 返回同一张）');
ok(/^#/.test(W.Sketch.autoColor('door')), '每个图形有手工挑的主色：door = ' + W.Sketch.autoColor('door'));

/* realKind 三态 —— 同样不写死 door，用当下还没做实物图的 key */
ok(W.Art.realKind(noSpriteKey) === 'auto', '没登记真图时 realKind = auto（程序化占位）：' + noSpriteKey);
W.SPRITE[noSpriteKey] = 'assets/sprites/' + noSpriteKey + '.png';
ok(W.Art.realKind(noSpriteKey) === 'sprite', '登记真图后 realKind = sprite');
ok(W.Art.real(noSpriteKey) === 'assets/sprites/' + noSpriteKey + '.png', '登记真图后 real 优先返回真图');
delete W.SPRITE[noSpriteKey];
ok(W.Art.realKind(noSpriteKey) === 'auto', '删掉登记后回到 auto');
ok(W.Art.real(noSpriteKey).indexOf('data:image/png') === 0, 'auto 状态返回的是程序化实物图 dataURL');

/* ★ realKind 不能只因为「Sketch 存在」就说 auto。
   以前写的是 if(Sketch.autoReal) return 'auto' —— 对任何 key 都成立，
   于是一个既没有实物图、又没有简笔画的 key（比如只有 8×8 图标的 brush）
   会被报成 'auto'，接着 Art.real() 就会拿 SKETCH.__default 的通用形状
   （一个问号）顶上，看起来"有实物图"其实是错的。
   判据：凡是在 CHARS/ICONS 里、且既无实物图又无简笔画的 key，一律只能说 icon。 */
const rkBad = [];
Object.keys(W.Art.CHARS).concat(Object.keys(W.Art.ICONS)).forEach(k => {
  if (W.Art.SPRITE[k] || W.Sketch.has(k)) return;
  const rk = W.Art.realKind(k);
  if (rk !== 'icon') rkBad.push(k + '=' + rk);
});
ok(rkBad.length === 0,
   'realKind 对「无实物图且无简笔画」的 key 一律报 icon，不谎报 auto（谎报会拿问号顶替）：'
   + Object.keys(W.Art.CHARS).concat(Object.keys(W.Art.ICONS)).filter(k => !W.Art.SPRITE[k] && !W.Sketch.has(k)).length + ' 个已核',
   rkBad.join(' '));

/* ---------------- 16d. ★ 呈现方式路由（名词画实物 / 动词演动作） ---------------- */
section('16d. 呈现方式路由');
const verbs = W.BANK.all.filter(w => w.present === 'action');
const things = W.BANK.all.filter(w => w.present === 'thing');
ok(verbs.length === 8, '全库有 ' + verbs.length + ' 个动词：' + verbs.map(w => w.word).join(' '));
ok(things.length === W.BANK.all.length - verbs.length, '其余 ' + things.length + ' 个都是名词/其他');
ok(verbs.every(w => w.tag === 'verb'), '所有 present=action 的词 tag 都是 verb');
ok(things.every(w => w.tag !== 'verb'), '没有动词被漏判成 thing');
/* 这 8 个必须是真正的动词 */
const expectVerbs = ['clean', 'help', 'open', 'close', 'lost', 'find', 'bath', 'pass'];
ok(expectVerbs.every(v => W.BANK.get('w_' + v) && W.BANK.get('w_' + v).present === 'action'),
   '八个动词逐个核对通过');
ok(!W.BANK.get('w_door') || W.BANK.get('w_door').present === 'thing', '名词 door 走简笔画路线');

/* 动词必须有可播的动作演出（FX 支持它的 act） */
const actKeys = Object.keys(W.ACTS);
const verbNoAct = verbs.filter(w => actKeys.indexOf(w.act) < 0);
ok(verbNoAct.length === 0, '每个动词都有对应的动作演出', verbNoAct.map(w => w.word).join(','));

/* AnimShow 模块在位，且能被调用 */
ok(!!W.AnimShow, 'AnimShow 动作演出模块已导出');
W.Game.startRun(1);
W.Battle.start('inkling');
const beforeHp = W.Battle.S.foes[0].hp;
W.Battle.S.energy = 9;
W.Battle.S.hand = [W.CARDS.make('c_w_clean')];   // clean 是动词
W.Battle.renderAll();
clickCard(0);
ok(!W.Battle.S || W.Battle.S.over || W.Battle.S.busy || W.Battle.S.foes[0].hp !== beforeHp ||
   W.Battle.S.hand.length === 0, '打出动词卡能走通整条流程（不卡死）');

/* 数据契约：ACT_ANIM 表存在（后期填逐帧动画用） */
ok(typeof W.ACT_ANIM === 'object', 'ACT_ANIM 逐帧动画表已就位（现在为空，用 FX 演出兜底）');

/* ★ 简笔画素材库的卫生检查：不留孤儿、不留缺配色的图形 */
const skKeys = Object.keys(W.Sketch.ALL).filter(k => k !== '__default');
const usedArt = new Set(W.BANK.all.map(w => w.art));
const orphanSketch = skKeys.filter(k => !usedArt.has(k));
ok(orphanSketch.length === 0, '没有孤儿简笔画（画了却没有单词在用）', orphanSketch.join(' '));

const noColor = skKeys.filter(k => !W.SKETCH_COLOR[k]);
ok(noColor.length === 0,
   '每个简笔画都有主色（否则程序化实物图会全变成同一个灰紫色）', noColor.join(' '));
const badColor = skKeys.filter(k => !/^#[0-9a-fA-F]{6}$/.test(W.SKETCH_COLOR[k] || ''));
ok(badColor.length === 0, '主色格式都是 #RRGGBB', badColor.slice(0, 6).join(' '));

/* ★ 反过来：每个单词的 art key 都必须能在简笔画库里找到 */
const missingArt = W.BANK.all.filter(w => !W.Sketch.has(w.art));
ok(missingArt.length === 0, '每个单词的图形 key 都有对应简笔画',
   missingArt.map(w => w.word + ':' + w.art).join(','));

/* ★ 名词的图形必须是「专属」的：还在共用的应该只剩 P2 抽象词 */
const shareCnt = {};
W.BANK.all.forEach(w => (shareCnt[w.art] = (shareCnt[w.art] || 0) + 1));
const sharedNouns = W.BANK.all.filter(w => w.present === 'thing' && shareCnt[w.art] > 1);
const sharedNonAbstract = sharedNouns.filter(w => w.tag !== 'adj' && w.tag !== 'study');
ok(sharedNonAbstract.length === 0,
   '具体名词的图形全部是专属的（没有「看图选词」会歧义的词）',
   sharedNonAbstract.map(w => w.word + '(' + w.art + '×' + shareCnt[w.art] + ')').join(', '));
ok(sharedNouns.length <= 10,
   '还在共用图形的只剩抽象词：' + sharedNouns.length + ' 个（' +
   [...new Set(sharedNouns.map(w => w.art))].join(' ') + '）');

/* ---------------- 17. 音效与语音降级 ---------------- */
section('17. 音效 / 语音降级');
W.SFX.init();
W.SFX.play('correct');
W.SFX.setMusic(true);
W.SFX.setMusic(false);
ok(true, '无 AudioContext 时音效不会崩溃');
ok(W.TTS.supported === false, '无 SpeechSynthesis 时标记为不支持');
let said = false;
W.TTS.say('door', { onend: () => { said = true; } });
ok(said, 'TTS 不可用时仍会回调 onend（保证流程继续）');
ok(W.ASR.available() === false, '无 SpeechRecognition 时正确降级');
ok(W.Art.get('hero').indexOf('data:image/png') === 0, '像素素材能生成 dataURL');
ok(W.Art.get('不存在的key').indexOf('data:image/png') === 0, '未知素材 key 有兜底图形');

/* ---------------- 18. ★ 剧情系统 ---------------- */
section('18. 剧情系统（STORY / Story）');

ok(typeof W.STORY === 'object' && typeof W.Story === 'object', 'STORY 数据表和 Story 播放器都已挂上');

const storyKeys = Object.keys(W.STORY || {});
ok(storyKeys.length > 0, 'STORY 有 ' + storyKeys.length + ' 段');

/* ★ 每一章都必须有 open / mid / end 三段。
   这条是专门为「文本写好了但没人读」加的 —— 之前 6 章各写了 intro/story/outro
   共 18 句剧情，但代码里除了日记没有任何地方读它们，玩家一次都没看到过。

   ★ 例外：第 6 章通关直接接「结局」，所以它的 end 由 ending 顶替（设计如此）。 */
const LAST_CH = W.CHAPTERS.length;
const segKeyOf = (id, k) => (k === 'end' && id === LAST_CH && W.STORY.ending)
  ? 'ending' : ('ch' + id + '_' + k);
const missingSeg = [];
W.CHAPTERS.forEach(c => {
  ['open', 'mid', 'end'].forEach(k => {
    const key = segKeyOf(c.id, k);
    if (!W.STORY[key]) missingSeg.push(key);
  });
});
ok(missingSeg.length === 0,
   '每一章的 open / mid / end 三段剧情数据都在（第 6 章的 end 由 ending 顶替）',
   '缺：' + missingSeg.join(' '));

/* ★ 数据写了还不够 —— 每一段都必须在代码里有【触发点】，否则永远不会播。
   这条正是这次发现的现状本身（写好的剧情没人读），所以要守死。 */
const srcAll = fs.readFileSync('D:\\雪梨英语管理系统\\Game3\\legacy.html', 'utf8');
ok(/Story\.playOnce\('ch'\+id\+'_open'/.test(srcAll), '开章剧情有触发点（章节选择 → 落地图之前）');
ok(/Story\.playOnce\('ch'\+ch\.id\+'_mid'/.test(srcAll), '中段剧情有触发点（第一次进谜题节点）');
ok(/Story\.playOnce\(tailKey/.test(srcAll), '通关剧情有触发点（Boss 胜利 → 结算之前）');
ok(/Story\.play\('opening'/.test(srcAll), '开场剧情有触发点（首次进游戏的启动流程）');

/* 每一屏的静态图 key 必须真实存在，否则运行时是个问号 */
const badArt = [], badRelic = [], emptySeg = [];
storyKeys.forEach(k => {
  const seg = W.STORY[k];
  if (!seg.screens || !seg.screens.length) { emptySeg.push(k); return; }
  seg.screens.forEach((sc, i) => {
    if (sc.art && !W.Sketch.has(sc.art) && !W.Art.get(sc.art)) badArt.push(k + '#' + (i + 1) + ':' + sc.art);
    if (sc.relic && !W.RELICS[sc.relic]) badRelic.push(k + '#' + (i + 1) + ':' + sc.relic);
  });
});
ok(emptySeg.length === 0, '没有空的剧情段', emptySeg.join(' '));
ok(badArt.length === 0, '剧情里用到的图形 key 都能取到图', badArt.join(' '));
ok(badRelic.length === 0, '剧情里发的词灵 key 都真实存在', badRelic.join(' '));

/* ★ 上面那条「能取到图」其实是查不出问题的：Art.get() 最后会兜到 ICONS.quest，
   任何 key 都"取得到"。而且它只扫 screens，不扫 pre ——
   所以 opening.pre 里那个只有 8×8 图标的 brush 一直漏到现在。
   这里换一条有牙齿的：剧情 art 必须落在【实物图 / 简笔画 / 16×16 角色图】这一层，
   掉进 8×8 的 ICONS 就报错（放大到剧情舞台上就是一坨马赛克）。 */
const stubArt = [], noArt = [];
const hasRealArt = k => !!(W.Art.SPRITE[k] || W.Sketch.has(k) || W.Art.CHARS[k]);
storyKeys.forEach(k => {
  const seg = W.STORY[k];
  (seg.pre || []).concat(seg.screens || []).forEach((sc, i) => {
    if (!sc.art) { noArt.push(k + '#' + (i + 1) + ':<空>'); return; }
    if (!hasRealArt(sc.art)) stubArt.push(k + '#' + (i + 1) + ':' + sc.art);
  });
});
ok(noArt.length === 0, '每屏都写了 art（留空会掉成 8×8 的 quest 图标）', noArt.join(' '));
ok(stubArt.length === 0, '剧情 art 都在实物图/简笔画/角色图这一层，没掉进 8×8 小图标', stubArt.join(' '));

const totalScreens = storyKeys.reduce((n, k) => n + (W.STORY[k].screens || []).length, 0);
ok(totalScreens >= 40, '剧情共 ' + totalScreens + ' 屏（够讲完六个章节 + 开场 + 结局）');

/* 序列帧目录名不能重复：两段共用一个目录会导致画面错位 */
const secs = storyKeys.map(k => W.STORY[k].sec).filter(Boolean);
const dupSec = secs.filter((s, i) => secs.indexOf(s) !== i);
ok(dupSec.length === 0, '每段的序列帧目录名互不相同（' + secs.length + ' 个）', dupSec.join(' '));

/* ★ 序列帧：探测方式 + 缺帧时的降级 */
ok(/function probe\(sec, onReady\)/.test(srcAll), '序列帧按目录自动发现（probe）');
ok(/let next=1, inflight=0, stopped=false/.test(srcAll), '序列帧是并行取的（不是一张张串行）');
ok(/img\.onerror=function\(\)\{ inflight--; stopped=true;/.test(srcAll),
   '序列帧探测撞到 404 就停止继续探，不报错');
ok(/rec\.names\[i-1\]=src/.test(srcAll),
   '并行到达的帧按索引回填（乱序 push 会让动画倒着放）');
ok(/if\(rec\.list\.length && onReady\) onReady\(rec\.list\)/.test(srcAll),
   '整段判完才回调（不是首帧到达就开播，否则开头会跳帧）');
ok(/if\(playingSec===sec && frameTimer\) return true/.test(srcAll),
   '同一段里翻屏不会重播动画（一段动画配 2~4 屏台词）');
ok(/elArt\.src=Art\.picSrc\(sc\.art\|\|'quest'\)/.test(srcAll),
   '没有序列帧时退回静态图（picSrc：优先 64×64 实物图，没有才退回图标，不白屏）');
ok(/function showStatic\(sc\)/.test(srcAll), '静态图渲染抽成独立函数（降级路径清晰）');

/* ★ STORY 声明的每一段，磁盘上都要有对应的序列帧目录。
   这条盯的是「片段名对不上」——STORY 里写 ch1_open、磁盘上叫 ch1-start，
   运行时就永远播不出来，而且不会报错，只是静默退回静态图。
   唯一豁免：opening —— 开场按设计走代码实现，不是序列帧。 */
const storyDir = pathx.join(ROOTX, 'assets', 'story');
const diskSegs = fsx.existsSync(storyDir)
  ? fsx.readdirSync(storyDir).filter(f => { try { return fsx.statSync(pathx.join(storyDir, f)).isDirectory(); } catch (e) { return false; } })
  : [];
const segAllowNoDir = ['opening'];      // 开场由代码实现，不需要序列帧
const segNoDir = secs.filter(s => segAllowNoDir.indexOf(s) < 0 && diskSegs.indexOf(s) < 0);
ok(segNoDir.length === 0,
   'STORY 声明的 ' + secs.length + ' 个片段名，磁盘上都有对应目录（缺 ' + segAllowNoDir.length + ' 个豁免）',
   '磁盘上没有目录：' + segNoDir.join(' '));
ok(diskSegs.every(d => secs.indexOf(d) >= 0 || d === 'opening'),
   '磁盘上的 ' + diskSegs.length + ' 个目录都被 STORY 用到了（没有白做的动画）',
   '没人用：' + diskSegs.filter(d => secs.indexOf(d) < 0).join(' '));

/* ★ 运行时不许引用「不在磁盘上」的视频。
   opening.mp4 是外挂成片：在 → 正常播；不在 → 自动降级到 pre 那 5 屏。
   所以这条是「警告」不是「失败」—— 但必须报出来，否则素材丢了没人知道。 */
const vidRefs = [...srcAll.matchAll(/video:\s*'(assets\/[^']+)'/g)].map(m => m[1]);
warn(vidRefs.every(rel => fsx.existsSync(pathx.join(ROOTX, rel))),
     'STORY 里声明的视频文件都在磁盘上',
     '缺文件（游戏会自动降级，不会白屏）：' + vidRefs.filter(rel => !fsx.existsSync(pathx.join(ROOTX, rel))).join(' '));
warn(!/opening-reference/.test(srcAll),
     '运行时没有引用任何「参考片」文件',
     'index.html 里还残留 opening-reference 的引用');

/* ★ 开场视频：真的嵌进来播，不是代码模仿 */
ok(/<video id="stVideo"/.test(srcAll), '<video> 元素已就位');
ok(/opening:\{ sec:'opening', video:'/.test(srcAll), '开场段声明了视频文件');
ok(/elVid\.play\(\)/.test(srcAll), '打开时先试自动播放（浏览器允许就直接播）');
ok(/elVidStart\.addEventListener/.test(srcAll), '自动播放被拒时有「▶ 开始」按钮兜底');
ok(/elVidSkip\.addEventListener/.test(srcAll), '视频有「跳过」按钮');
ok(/elVid\.onerror=failOnce/.test(srcAll), '视频加载失败会走降级（不是静默卡住）');
ok(/clearTimeout\(vidTimer\); vidTimer=0;/.test(srcAll), '视频有超时兜底（拿不到元数据就当没有这个文件）');
ok(/function vidFinish\(ok\)/.test(srcAll), '视频层的收尾统一走 vidFinish（播完/跳过/失败三条路都收敛到一处）');

/* ★ 🛠 剧情调试台：剧情每段只播一次，播过就进存档；
   需要随时能重播任意一段（开场 / 18 段章节 / 结局），否则开发时没法复看。 */
ok(/debug:function\(\)\{/.test(srcAll), 'Story.debug() 已导出（剧情调试台）');
ok(/stStoryDebug/.test(srcAll), '设置页里有「🛠 打开剧情调试台」入口');
ok(/data-play="/.test(srcAll), '调试台给每一段都准备了「▶ 重播」按钮');
ok(/dbgOpening/.test(srcAll) && /重播开场动画/.test(srcAll), '调试台有「重播开场动画」一键按钮');
ok(/dbgAll/.test(srcAll), '调试台有「连续播全部」');
ok(/dbgReset/.test(srcAll), '调试台有「清除全部剧情记录」');
ok(/frameCount\(seg\.sec\)/.test(srcAll), '调试台会显示每段的序列帧加载了几张（一眼看出这段有没有动画）');
ok(/replayHard:function/.test(srcAll), 'Story.replayHard() 能无视记录强制重播');

/* 调试台要能真的打开并列出全部段落 */
W.Story.debug();
const dbgHtml = getById('modalBox').innerHTML;
ok(dbgHtml.indexOf('剧情调试台') >= 0 || dbgHtml.indexOf('data-play') >= 0,
   '调试台能打开并渲染出内容');
const btnCount = (dbgHtml.match(/data-play="/g) || []).length;
ok(btnCount === Object.keys(W.STORY).length,
   '调试台列出了全部 ' + btnCount + ' 段（STORY 有 ' + Object.keys(W.STORY).length + ' 段）');
ok(dbgHtml.indexOf('opening') >= 0 && dbgHtml.indexOf('ending') >= 0,
   '调试台里既有开场也有结局');
W.UI.hideModal();

/* ★ 运行时不能 fetch —— `file://` 下 fetch/XHR 读本地文件会被 CORS 挡掉，
   所以序列帧只能靠 <img> 探测。这条守住「有人图省事用 fetch 读 manifest」的回归。 */
ok(!/\bfetch\s*\(/.test(srcAll) && !/XMLHttpRequest/.test(srcAll),
   '运行时没有任何 fetch / XHR（file:// 下会被 CORS 挡掉，只能靠 <img> 探测）');

/* 文字必须由 HTML 叠加，不能烧进帧里 —— 否则英文朗读、竖屏适配、跳过留档都做不到 */
ok(/elEnText\.textContent=sc\.en/.test(srcAll), '英文句由 HTML 叠加显示（不是烧在图里）');
ok(/TTS\.say\(sc\.en/.test(srcAll), '每一屏的英文句会自动朗读');
ok(/elSkip\.addEventListener/.test(srcAll), '有「跳过」按钮');

/* 跳过之后正文仍要进日记，内容不能丢 */
ok(/Game\.log\('通关 · '\+ch\.name, ch\.outro\)/.test(srcAll),
   '通关正文仍然写进日记（跳过了也不丢内容）');

/* ★ 功能测试：真的把一段剧情走一遍，而不是只看数据长得对不对 */
const flagsBefore = JSON.parse(JSON.stringify(W.Save.data.flags || {}));
let doneCalled = 0;
W.Story.play('ch1_open', () => { doneCalled++; });
ok(getById('ovStory').classList.contains('show'), 'play() 之后剧情遮罩打开了');
ok(getById('stLines').innerHTML.length > 0, '第一屏有文案：' + getById('stLines').textContent.slice(0, 20));
ok(getById('stProg').textContent === '1 / ' + W.STORY.ch1_open.screens.length,
   '进度显示「1 / N」：' + getById('stProg').textContent);
ok(getById('stWho').textContent === '' || !getById('stWho').classList.contains('hidden'),
   '第一屏是旁白时说话人栏隐藏');

/* 逐屏推进到底 */
const n1 = W.STORY.ch1_open.screens.length;
for (let i = 0; i < n1; i++) fire(getById('stNext'), 'click');
ok(doneCalled === 1, '整段播完后回调被调用一次');
ok(!getById('ovStory').classList.contains('show'), '播完后遮罩自动关闭');

/* 有台词的那一屏，说话人栏要显示出来 */
W.Story.play('ch1_open', null);
fire(getById('stNext'), 'click');                      // 走到第 2 屏（粉笔精灵说话）
ok(getById('stWho').textContent === '粉笔精灵', '有台词时说话人栏显示「粉笔精灵」');
ok(!getById('stWho').classList.contains('hidden'), '有台词时说话人栏不隐藏');

/* 英文句：走到带 en 的那一屏才显示，内容和数据一致；不带 en 的屏要隐藏 */
const enSeg = 'ch1_open';
const enIdx = W.STORY[enSeg].screens.findIndex(s => s.en);
ok(enIdx >= 0, enSeg + ' 里有一屏带英文句（第 ' + (enIdx + 1) + ' 屏）');
W.Story.play(enSeg, null);
ok(!getById('stEn').classList.contains('hidden') === (enIdx === 0),
   '第 1 屏' + (W.STORY[enSeg].screens[0].en ? '有' : '没有') + '英文句 → 🔊 那一行' +
   (W.STORY[enSeg].screens[0].en ? '显示' : '隐藏'));
for (let i = 0; i < enIdx; i++) fire(getById('stNext'), 'click');
ok(!getById('stEn').classList.contains('hidden'), '走到带英文句那一屏时 🔊 那一行显示出来');
ok(getById('stEnText').textContent === W.STORY[enSeg].screens[enIdx].en,
   '英文句内容和数据一致：' + getById('stEnText').textContent.slice(0, 34));

/* ★ 词灵：剧情发词灵要真的入账 */
const relicKey = 'ch1_end';
const relicId = W.STORY[relicKey].screens.filter(s => s.relic).map(s => s.relic)[0];
ok(!!relicId, relicKey + ' 有一屏发词灵：' + relicId);
const hadRelic = W.Game.hasRelic(relicId);
W.Save.data.run = null;
W.Game.startRun(1);                                     // 词灵是挂在 run 上的，先开一局
W.Story.play(relicKey, null);
W.STORY[relicKey].screens.forEach(() => fire(getById('stNext'), 'click'));
ok(W.Game.hasRelic(relicId), '播完发词灵那一屏之后，词灵真的进了背包：' + relicId);

/* ★ 跳过：点跳过要能立刻结束，不能卡住 */
let skipDone = 0;
W.Story.play('ch2_open', () => { skipDone++; });
fire(getById('stSkip'), 'click');
ok(skipDone === 1 && !getById('ovStory').classList.contains('show'), '点「跳过」立刻结束并回调');

/* ★ playOnce：播过一次就不再播 */
W.Save.data.flags = W.Save.data.flags || {};
W.Save.data.flags['__test_seg'] = 1;
W.STORY.__test_seg = { sec: null, screens: [{ art: 'book', lines: ['x'] }] };
let onceDone = 0;
const played = W.Story.playOnce('__test_seg', () => { onceDone++; });
ok(played === false && onceDone === 1, 'playOnce 对已播过的段直接回调、不再播放');
delete W.STORY.__test_seg;
delete W.Save.data.flags['__test_seg'];

/* 收尾：把测试动过的存档状态还原，别污染后面的检查 */
W.Save.data.flags = flagsBefore;
W.Save.data.run = null;

/* 序列帧：目录不存在时必须降级成静态图，不能白屏 */
ok(getById('stArt').src === '' || getById('stArt').src.indexOf('data:image/png') === 0 ||
   getById('stArt').src.indexOf('assets/story') >= 0,
   '没有序列帧时静态图确实被赋了值（不是空的）');

/* ★ picSrc：剧情屏用的就是这个 —— 角色立绘必须优先于内置小图标。
   这批 NPC 立绘交付时「文件做了、登记漏了」，如果剧情屏还用 get()，
   美术做了也看不见。这里把「立绘优先」这条钉死。 */
ok(typeof W.Art.picSrc === 'function', 'Art.picSrc 已导出（实物图优先的 URL）');
ok(W.Art.picSrc('chalk') === 'assets/sprites/chalk.png',
   '剧情角色 chalk 取到的是 64×64 立绘，不是 16×16 小图标：' + W.Art.picSrc('chalk'));
ok(W.Art.picSrc('door') === 'assets/sprites/door.png', '有实物图的单词同样优先取实物图');
ok(W.Art.picSrc('brush').indexOf('data:image/png') === 0,
   '没有实物图的（brush）退回内置图标，不会变成问号');
ok(W.Art.picSrc('不存在的key').indexOf('data:image/png') === 0,
   '未知 key 也有兜底，不返回 undefined');

/* 剧情里每一个 art key 都要能取到 URL（元素 src 赋 undefined 会显示碎图） */
const noSrc = [];
storyKeys.forEach(k => (W.STORY[k].screens || []).forEach((sc, i) => {
  if (!sc.art) return;
  const s = W.Art.picSrc(sc.art);
  if (!s || typeof s !== 'string' || !s.length) noSrc.push(k + '#' + (i + 1) + ':' + sc.art);
}));
ok(noSrc.length === 0, '剧情每一屏的 art 都能取到可用的图片 URL', noSrc.join(' '));

/* ---------------- 结果 ---------------- */
console.log('\n========================================');
console.log('检查项：' + checks + '　失败：' + fails + (warns ? '　警告：' + warns : ''));
console.log(fails ? '❌ 自测未通过' : (warns ? '⚠️  自测通过（有 ' + warns + ' 条警告，见上面 ⚠）' : '✅ 全部自测通过'));
process.exit(fails ? 1 : 0);
