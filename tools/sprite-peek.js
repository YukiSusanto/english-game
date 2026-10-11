#!/usr/bin/env node
/* =========================================================================
   sprite-peek.js —— 画实物图前先「看一眼」简笔画长什么样
   -------------------------------------------------------------------------
   不用开浏览器、不用读坐标表：把简笔画的形状、包围盒、笔顺一次性打出来，
   画实物图的时候照着它对位。带 --list 就列出还没做实物图的。

   用法：
     node tools/sprite-peek.js door                  看一个
     node tools/sprite-peek.js door chair book       看多个
     node tools/sprite-peek.js --next 8              看「待办清单」里的前 8 个
     node tools/sprite-peek.js --next 8 --p1         只在 P1 清单里取
     node tools/sprite-peek.js --list                只列待办清单
   ========================================================================= */
'use strict';
const SK = require('./spritekit.js');
const { loadConsts } = require('./_extract.js');
const { SPRITE, P0_SKETCH_KEYS, P1_SKETCH_KEYS, RAW } =
  loadConsts(['SPRITE', 'P0_SKETCH_KEYS', 'P1_SKETCH_KEYS', 'RAW']);

/* RAW 的行是 [单词, 中文, ?, ?, 词性, 简笔画 key]；BANK 是运行时拼出来的，抽不出来 */
const WORDS = [];
for (const u in RAW) for (const r of RAW[u]) WORDS.push({ word: r[0], cn: r[1], tag: r[4], art: r[5], unit: +u });

const a = process.argv.slice(2);
/* --small 用一半的格子，一次看六七个图也刷不满屏（细节靠 --dump 再确认） */
const SMALL = a.includes('--small');
const CW = SMALL ? 40 : 52, CH = SMALL ? 20 : 26;   /* 字符高宽比约 2:1，视觉上才是正方形 */
const MARKS = '·123456789abcdefghijklmnopqrstuvwxyz';

/** 待办 = 有简笔画、有单词在用、但还没登记实物图 */
function todo() {
  const used = new Set(WORDS.map(w => w.art));
  const pool = a.includes('--p1') ? P1_SKETCH_KEYS
             : a.includes('--p0') ? P0_SKETCH_KEYS
             : Object.keys(SK.SKETCH).filter(k => k !== '__default');
  return pool.filter(k => used.has(k) && SK.SKETCH[k] && !SPRITE[k]);
}

/** 把简笔画画成字符画，每一笔用不同字符标出来，方便对着写生成脚本 */
function art(key) {
  const polys = SK.SKETCH[key];
  if (!polys) return null;
  const g = [];
  for (let y = 0; y < CH; y++) g.push(new Array(CW).fill(' '));
  const seg = (x0, y0, x1, y1, ch) => {
    x0 = Math.round(x0); y0 = Math.round(y0);
    const X1 = Math.round(x1), Y1 = Math.round(y1);
    const dx = Math.abs(X1 - x0), sx = x0 < X1 ? 1 : -1;
    const dy = -Math.abs(Y1 - y0), sy = y0 < Y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x0 >= 0 && y0 >= 0 && x0 < CW && y0 < CH) g[y0][x0] = ch;
      if (x0 === X1 && y0 === Y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  const T = (x, y) => [x / 100 * (CW - 1), y / 100 * (CH - 1)];
  polys.forEach((p, i) => {
    const mark = MARKS[i + 1] || '#';
    for (let j = 1; j < p.length; j++) {
      const A = T(p[j - 1][0], p[j - 1][1]), B = T(p[j][0], p[j][1]);
      seg(A[0], A[1], B[0], B[1], mark);
    }
  });
  return g.map(r => r.join(''));
}

function show(key) {
  const b = SK.bounds(key);
  const polys = SK.SKETCH[key];
  const word = WORDS.filter(w => w.art === key)[0];
  console.log('\n【' + key + '】' + (word ? '  ' + word.word + ' / ' + word.cn + '  U' + word.unit : '') +
              (SPRITE[key] ? '   ★已有实物图' : ''));
  if (!polys) { console.log('  没有这个简笔画'); return; }
  console.log('  包围盒 0~100：左' + b.minX + ' 上' + b.minY + ' 右' + b.maxX + ' 下' + b.maxY +
              '　宽' + b.w + ' 高' + b.h + '　' + polys.length + ' 笔');
  console.log('  64px 像素：' + SK.u(b.minX).toFixed(1) + ',' + SK.u(b.minY).toFixed(1) +
              ' → ' + SK.u(b.maxX).toFixed(1) + ',' + SK.u(b.maxY).toFixed(1));
  console.log('   +' + '-'.repeat(CW) + '+');
  art(key).forEach(r => console.log('   |' + r + '|'));
  console.log('   +' + '-'.repeat(CW) + '+');
  polys.forEach((p, i) => {
    console.log('   ' + (MARKS[i + 1] || '#') + ' ' + p.map(q => '(' + q[0] + ',' + q[1] + ')').join('→'));
  });
}

if (a.includes('--list')) {
  const t = todo();
  console.log('待办 ' + t.length + ' 个：');
  t.forEach(k => {
    const w = WORDS.filter(x => x.art === k)[0];
    console.log('  ' + k.padEnd(14) + (w ? w.word + ' / ' + w.cn + '  U' + w.unit : ''));
  });
  process.exit(0);
}

let keys = a.filter(x => !x.startsWith('--') && SK.SKETCH[x]);
if (a.includes('--next')) {
  const n = parseInt(a[a.indexOf('--next') + 1], 10) || 8;
  keys = todo().slice(0, n);
}
if (!keys.length) keys = todo().slice(0, 8);
keys.forEach(show);
