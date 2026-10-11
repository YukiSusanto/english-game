#!/usr/bin/env node
/* =========================================================================
   sprite-outline.js —— 给已有的实物像素图统一补剪影描边
   -------------------------------------------------------------------------
   背景：简笔画是用墨线画的。实物图如果外缘是浅色（皮肤、白大褂、浅蓝
   连体衣），淡入的时候那圈墨线就被盖掉了，看起来像「糊」上一层而不是
   「线长成了实物」。实测人物图外缘只有 27~32% 是墨线，物件是 37~100%。

   这个脚本把 assets/sprites 里已经存在的图读回来，沿外轮廓压一圈墨线再
   写回去。做法和 SK.save() 里的自动描边完全一样（spritekit.outlineSilhouette）：
     · 只压外圈，不向外扩张 → 包围盒和缩放比一个像素都不变
     · 外圈已经是墨色的像素不动 → 重复跑不会越描越粗

   用法：
     node tools/sprite-outline.js              全部过一遍（已经 100% 的会跳过）
     node tools/sprite-outline.js --dry        只看结果，不写文件
     node tools/sprite-outline.js --key desk   只处理一个
     node tools/sprite-outline.js --all        连已经 100% 的也重跑一遍
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const SK = require('./spritekit.js');
const { ROOT, loadConsts } = require('./_extract.js');

const SPRITE = loadConsts(['SPRITE']).SPRITE;
const a = process.argv.slice(2);
const dry = a.includes('--dry');
const force = a.includes('--all');
const only = a.includes('--key') ? a[a.indexOf('--key') + 1] : null;

/** 剪影边缘里有多少比例是深色墨线（和外缘判定同一套口径） */
function coverage(im) {
  const solid = (x, y) => x >= 0 && y >= 0 && x < SK.W && y < SK.H && im[(y * SK.W + x) * 4 + 3] > 0;
  let edge = 0, dark = 0;
  for (let y = 0; y < SK.H; y++) for (let x = 0; x < SK.W; x++) {
    if (!solid(x, y)) continue;
    if (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)) continue;
    edge++;
    const i = (y * SK.W + x) * 4;
    if (0.299 * im[i] + 0.587 * im[i + 1] + 0.114 * im[i + 2] < 90) dark++;
  }
  return { edge, dark, ratio: edge ? dark / edge : 0 };
}

const keys = Object.keys(SPRITE).filter(k => !only || k === only).sort();
if (!keys.length) { console.log('没有匹配的实物图：' + (only || '(全部)')); process.exit(1); }

const rows = [];
for (const k of keys) {
  const file = path.join(ROOT, 'assets', 'sprites', k + '.png');
  if (!fs.existsSync(file)) { rows.push({ k, miss: true }); continue; }
  let im;
  try { im = SK.decodePNG(fs.readFileSync(file)); }
  catch (e) { rows.push({ k, err: e.message }); continue; }

  const before = coverage(im);
  if (before.ratio >= 0.995 && !force) { rows.push({ k, before, after: before, skipped: true }); continue; }
  const r = SK.outlineSilhouette(im);
  const after = coverage(im);
  if (!dry) fs.writeFileSync(file, SK.png(im));
  rows.push({ k, before, after, painted: r.painted });
}

console.log(`剪影描边${dry ? '（试运行，未写文件）' : ''}　共 ${rows.length} 个`);
console.log('-'.repeat(66));
let changed = 0, skipped = 0;
rows.forEach(r => {
  if (r.miss) { console.log(`${r.k.padEnd(14)} ⚠ 没有这个文件`); return; }
  if (r.err) { console.log(`${r.k.padEnd(14)} ⚠ ${r.err}`); return; }
  if (r.skipped) { skipped++; console.log(`${r.k.padEnd(14)} 已经是 ${(r.before.ratio * 100).toFixed(0)}%　跳过`); return; }
  changed++;
  const b = (r.before.ratio * 100).toFixed(0), f = (r.after.ratio * 100).toFixed(0);
  const tag = r.after.ratio >= 0.98 ? '✅' : (r.after.ratio >= 0.9 ? '○' : '⚠');
  console.log(`${r.k.padEnd(14)} 描边 ${b.padStart(3)}% → ${f.padStart(3)}%　压墨 ${String(r.painted).padStart(3)}px　${tag}` +
    (r.after.ratio < 0.9 ? '  （外缘还有非墨色的细笔画，属正常）' : ''));
});
console.log('-'.repeat(66));
const bad = rows.filter(r => r.after && r.after.ratio < 0.9 && !r.skipped);
console.log(`${dry ? '将要处理' : '已处理'} ${changed} 个，跳过 ${skipped} 个` +
  (bad.length ? `，${bad.length} 个仍有细笔画外露：${bad.map(r => r.k).join('、')}` : ''));
if (!dry) console.log('下一步：node tools/sprite-align.js --png　确认对齐没被破坏');
