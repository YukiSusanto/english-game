#!/usr/bin/env node
/* =========================================================================
   sketch-sheet.js —— 把所有简笔画导出成一张 SVG 总览图
   -------------------------------------------------------------------------
   用法：
     node tools/sketch-sheet.js                  输出 简笔画总览.svg
     node tools/sketch-sheet.js --out my.svg
     node tools/sketch-sheet.js --only-new       只导出本次新增的 P0 图形
     node tools/sketch-sheet.js --cols 8

   打开方式：用浏览器直接打开生成的 .svg（或者拖进 Chrome），
   一眼就能扫完全部图形，比在游戏里一个个点快得多。也可以直接打印。
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const { ROOT, loadConsts } = require('./_extract.js');
const { RAW, SKETCH } = loadConsts(['RAW','SKETCH']);

/* 本次新增的 P0 图形 */
const UPDATED = ['light','crayon','ruler','candy','teddy','key','eraser','hair','glasses',
                 'shoe','hat','table','sofa','bathtub','knife','fork','chopsticks','spoon',
                 'egg','football','basketball'];

const argv = process.argv.slice(2);
const onlyNew = argv.includes('--only-new');
const cols = argv.includes('--cols') ? parseInt(argv[argv.indexOf('--cols') + 1], 10) : 7;
const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : path.join(ROOT, '简笔画总览.svg');

/* 每个图形 → 用它的词 */
const wordsOf = {};
for (const u in RAW) for (const r of RAW[u]) {
  (wordsOf[r[5]] = wordsOf[r[5]] || []).push({ w: r[0], cn: r[1], u: u });
}
let keys = Object.keys(SKETCH).filter(k => k !== '__default');
if (onlyNew) keys = UPDATED.filter(k => SKETCH[k]);
keys.sort((a, b) => {
  const ua = Math.min(...(wordsOf[a] || [{ u: 9 }]).map(x => +x.u));
  const ub = Math.min(...(wordsOf[b] || [{ u: 9 }]).map(x => +x.u));
  return ua - ub || a.localeCompare(b);
});

/* 版面 */
const CELL = 150, PAD = 14, LABEL = 40, HEADER = 78;
const rows = Math.ceil(keys.length / cols);
const W = cols * CELL + PAD * 2;
const H = HEADER + rows * (CELL + LABEL) + PAD * 2;

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Courier New',monospace">
<rect width="${W}" height="${H}" fill="#241a2e"/>
<text x="${PAD}" y="34" fill="#ffd447" font-size="22" font-weight="bold">单词画笔 · 简笔画总览</text>
<text x="${PAD}" y="58" fill="#f7e7c6" font-size="13">共 ${keys.length} 个图形${onlyNew ? '（只看本次新增）' : ''}　·　坐标 0~100　·　★ = 本次新增　·　⚠ = 被多个词共用</text>
`;

keys.forEach((k, i) => {
  const cx = PAD + (i % cols) * CELL;
  const cy = HEADER + Math.floor(i / cols) * (CELL + LABEL);
  const box = CELL - 18;
  const inset = box * 0.08;
  const s = box - inset * 2;
  const polys = SKETCH[k] || [];
  const users = wordsOf[k] || [];
  const isNew = UPDATED.indexOf(k) >= 0;
  const shared = users.length > 1;

  svg += `<rect x="${cx}" y="${cy}" width="${box}" height="${box}" rx="10" fill="#fdf6e5" stroke="${isNew ? '#7bd389' : (shared ? '#ffd447' : '#3a2a1e')}" stroke-width="3"/>`;
  svg += `<g transform="translate(${cx + inset},${cy + inset}) scale(${s / 100})" fill="none" stroke="#2b2033" stroke-width="${(100 / s * 3).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round">`;
  polys.forEach(p => {
    svg += `<path d="M ${p.map(q => q.join(' ')).join(' L ')}"/>`;
  });
  svg += `</g>`;
  /* 右上角角标 */
  if (isNew) svg += `<text x="${cx + box - 8}" y="${cy + 22}" fill="#2f7d3c" font-size="16" font-weight="bold" text-anchor="end">★</text>`;
  if (shared) svg += `<text x="${cx + box - 8}" y="${cy + box - 10}" fill="#a06a00" font-size="12" text-anchor="end">×${users.length}</text>`;

  /* 标签 */
  const label = users.slice(0, 2).map(u => u.w).join(' / ') + (users.length > 2 ? ` +${users.length - 2}` : '');
  svg += `<text x="${cx + box / 2}" y="${cy + box + 17}" fill="#ffd447" font-size="13" font-weight="bold" text-anchor="middle">${esc(k)}</text>`;
  svg += `<text x="${cx + box / 2}" y="${cy + box + 32}" fill="#f7e7c6" font-size="11" text-anchor="middle">${esc(label)}</text>`;
});

svg += `</svg>\n`;
fs.writeFileSync(out, svg, 'utf8');
console.log(`已生成 ${out}`);
console.log(`  ${keys.length} 个图形，${cols} 列 × ${rows} 行，画布 ${W}×${H}`);
console.log('  用浏览器打开就能看（也可以直接打印）');
