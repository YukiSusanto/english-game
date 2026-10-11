#!/usr/bin/env node
/* =========================================================================
   pipeline-status.js —— 素材流水线看板：现在该做什么？
   -------------------------------------------------------------------------
   两条流水线有先后依赖：
     ① 简笔画（SKETCH）—— 实物图必须挂在【定稿】的简笔画上
     ② 实物图（SPRITE）—— 给共用图形做实物图，等简笔画一拆就作废
   这个工具把「素材优先级 P0/P1/P2」和「简笔画状态」交叉起来，
   直接告诉你哪一批现在就能动手、哪一批必须先画简笔画。

   用法：
     node tools/pipeline-status.js            看板 + 现在能做的清单
     node tools/pipeline-status.js --ready    只看「现在立刻能做实物图」的
     node tools/pipeline-status.js --sketch   只看「必须先画简笔画」的
     node tools/pipeline-status.js --md       输出 Markdown 表格
     node tools/pipeline-status.js --next 5   列出接下来该做的 5 个
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, loadConsts } = require('./_extract.js');
const { RAW, SKETCH, SPRITE, P0_SKETCH_KEYS, P1_SKETCH_KEYS } = loadConsts(['RAW','SKETCH','SPRITE','P0_SKETCH_KEYS','P1_SKETCH_KEYS']);

/* P0 清单：唯一来源是 index.html 里的 P0_SKETCH_KEYS */
const P0KEYS = P0_SKETCH_KEYS;
const P1KEYS = P1_SKETCH_KEYS;

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const arg = f => argv[argv.indexOf(f) + 1];

/* ---------------- 汇总 ---------------- */
const words = [], seen = new Set();
for (const u in RAW) for (const r of RAW[u]) {
  if (seen.has(r[0])) continue;
  seen.add(r[0]);
  words.push({ word: r[0], cn: r[1], unit: +u, art: r[5], tag: r[4] });
}
const share = {};
words.forEach(w => (share[w.art] = (share[w.art] || 0) + 1));
function spriteReal(k) {
  const s = SPRITE[k];
  if (!s) return false;
  if (/^data:/.test(s)) return true;
  return fs.existsSync(path.isAbsolute(s) ? s : path.join(ROOT, s));
}
words.forEach(w => {
  w.present = w.tag === 'verb' ? 'action' : 'thing';
  w.sketch = !SKETCH[w.art] ? 'missing' : (share[w.art] > 1 ? 'shared' : 'final');
  w.share = share[w.art];
  w.sprite = spriteReal(w.art) ? 'real' : 'auto';
  if (w.present === 'action') w.pri = '—';
  else if (P0KEYS.indexOf(w.art) >= 0) w.pri = 'P0';
  else if (P1KEYS.indexOf(w.art) >= 0) w.pri = 'P1';
  else if (w.tag === 'adj' || w.tag === 'study') w.pri = 'P2';
  else w.pri = 'P1';
});

const nouns = words.filter(w => w.present === 'thing');
const verbs = words.filter(w => w.present === 'action');
const readyToSprite = nouns.filter(w => w.sketch === 'final' && w.sprite !== 'real');
const needSketch = nouns.filter(w => w.sketch !== 'final');
const doneBoth = nouns.filter(w => w.sketch === 'final' && w.sprite === 'real');

/* ---------------- Markdown ---------------- */
if (has('--md')) {
  console.log('| 单词 | 中文 | U | 图形 key | 优先级 | 简笔画 | 实物图 | 下一步 |');
  console.log('|---|---|---|---|---|---|---|---|');
  nouns.forEach(w => {
    const sk = { final: '✅ 定稿', shared: `⚠ 与 ${w.share - 1} 词共用`, missing: '❌ 缺' }[w.sketch];
    const sp = w.sprite === 'real' ? '★ 真图' : '◆ 占位';
    const nx = w.sketch !== 'final' ? '先画简笔画' : (w.sprite === 'auto' ? '可以配实物图' : '完成');
    console.log(`| \`${w.word}\` | ${w.cn} | U${w.unit} | \`${w.art}\` | ${w.pri} | ${sk} | ${sp} | ${nx} |`);
  });
  process.exit(0);
}

/* ---------------- 单列表模式 ---------------- */
function list(title, arr) {
  console.log(`\n【${title}】${arr.length} 个\n`);
  const byPri = {};
  arr.forEach(w => (byPri[w.pri] = byPri[w.pri] || []).push(w));
  ['P0', 'P1', 'P2'].forEach(p => {
    if (!byPri[p]) return;
    console.log(`  ${p}（${byPri[p].length} 个）`);
    byPri[p].forEach(w => console.log(`    ${w.art.padEnd(12)} ${w.cn.padEnd(8)} U${w.unit}  ${w.word}` +
      (w.sketch === 'shared' ? `　（与 ${w.share - 1} 个词共用「${w.art}」）` : '')));
    console.log('');
  });
}

if (has('--ready')) {
  const c = {};
  readyToSprite.forEach(w => (c[w.pri] = (c[w.pri] || 0) + 1));
  list('现在立刻能做实物图（简笔画已定稿）', readyToSprite);
  console.log(`  小计：P0 ${c.P0 || 0}　P1 ${c.P1 || 0}　P2 ${c.P2 || 0}`);
  console.log("\n  画法：const SK=require('./tools/spritekit.js') → fillSketch / outlineSketch / save");
  console.log('  验收：node tools/sprite-align.js');
  process.exit(0);
}
if (has('--sketch')) {
  list('必须先画简笔画（否则实物图会白做）', needSketch);
  console.log('  画法：设置 → 🖌 简笔画工坊（或 node tools/sketch-status.js 看工单）');
  process.exit(0);
}
if (has('--next')) {
  const n = parseInt(arg('--next'), 10) || 5;
  console.log(`接下来该做的 ${Math.min(n, needSketch.length)} 个简笔画：\n`);
  needSketch.slice(0, n).forEach((w, i) =>
    console.log(`  ${i + 1}. ${w.word.padEnd(12)} ${w.cn.padEnd(8)} → key \`${w.art}\`` +
      (w.sketch === 'shared' ? `   ⚠ 现在和 ${w.share - 1} 个词共用` : '')));
  console.log('\n  画法：设置 → 🖌 简笔画工坊');
  process.exit(0);
}

/* ---------------- 默认：看板 ---------------- */
console.log('素材流水线看板');
console.log('='.repeat(72));
console.log(`单词总数 ${words.length}　（名词 ${nouns.length}　动词 ${verbs.length}）`);
console.log(`动词走【动作演出】，不需要简笔画/实物图：${verbs.map(w => w.word).join(' ')}`);
console.log('='.repeat(72));

console.log('\n优先级 × 简笔画状态　交叉表\n');
console.log('优先级    名词数   简笔画待画   可直接做实物图   已完成');
['P0', 'P1', 'P2'].forEach(p => {
  const g = nouns.filter(w => w.pri === p);
  const fin = g.filter(w => w.sketch === 'final');
  console.log(`${p.padEnd(9)}${String(g.length).padStart(6)}${String(g.length - fin.length).padStart(13)}` +
              `${String(fin.filter(w => w.sprite !== 'real').length).padStart(16)}` +
              `${String(fin.filter(w => w.sprite === 'real').length).padStart(9)}`);
});
console.log('='.repeat(72));

console.log(`\n现在立刻能做实物图：${readyToSprite.length} 个（简笔画已定稿）`);
console.log(`必须先画简笔画：　　${needSketch.length} 个（共用图形或缺失）`);
console.log(`两条都完成：　　　　${doneBoth.length} 个`);

console.log('\n' + '-'.repeat(72));
console.log('推荐顺序（动态生成，跟着实际进度走）：\n');

const p0Ready = readyToSprite.filter(w => w.pri === 'P0').length;
const p1Ready = readyToSprite.filter(w => w.pri === 'P1').length;
const p1Sketch = needSketch.filter(w => w.pri === 'P1').length;
let step = 1;
if (p0Ready) {
  console.log(`  第 ${step++} 步   P0 的 ${p0Ready} 个实物图        现在就能做 —— 这批本来是画错的，最该先看效果`);
} else {
  console.log(`  ✓  P0 实物图已全部完成`);
}
if (p1Sketch) {
  console.log(`  第 ${step++} 步   P1 的 ${p1Sketch} 个简笔画        现在就能做 —— 不先做，后面那批实物图会白做`);
} else {
  console.log(`  ✓  P1 简笔画已全部完成（${nouns.filter(w => w.pri === 'P1').length} 个名词都是专属图形）`);
}
if (p1Ready) {
  const tail = p1Sketch ? '等上一步的简笔画画完，一次过一遍' : '现在就能做 —— 简笔画全部定稿了，可以一次过一遍';
  console.log(`  第 ${step++} 步   P1 的 ${p1Ready} 个实物图        ${tail}`);
}
const p2Ready = readyToSprite.filter(w => w.pri === 'P2').length;
const p2Sketch = needSketch.filter(w => w.pri === 'P2').length;
if (p2Sketch || p2Ready) {
  console.log(`  第 ${step++} 步   P2（抽象词，还剩 ${p2Sketch} 个简笔画 / ${p2Ready} 个实物图）`);
  console.log('            建议跳过 —— 抽象词不参与「看图选词」，程序化占位图够用');
} else {
  console.log(`  ✓  P2 也全部完成`);
}
console.log('\n  → 能做实物图的清单：node tools/pipeline-status.js --ready');
console.log('  → 要画简笔画的清单：node tools/pipeline-status.js --sketch');
console.log('  → 简笔画工单与设计：node tools/sketch-status.js');
console.log('-'.repeat(72));
