#!/usr/bin/env node
/* =========================================================================
   sprite-view.js —— 把画好的实物图打成字符画看一眼
   -------------------------------------------------------------------------
   没有图形界面的时候（或者想快速核对构图时）用这个：
   每个颜色一个字符，画完立刻能看出「这是不是门」「脸有没有被盖住」。
   一条命令就能查出「腿从衣服中间穿出来」这类肉眼才看得见的问题。

   用法：
     node tools/sprite-view.js door                看一个
     node tools/sprite-view.js door board win      看多个
     node tools/sprite-view.js --p0                看全部 P0
     node tools/sprite-view.js --a11y door         只用 ▓▒░ 明暗，适合看不清字母时
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const SK = require('./spritekit.js');
const { ROOT, loadConsts } = require('./_extract.js');
const { SPRITE, P0_SKETCH_KEYS, P1_SKETCH_KEYS } = loadConsts(['SPRITE', 'P0_SKETCH_KEYS', 'P1_SKETCH_KEYS']);

const a = process.argv.slice(2);
const MARKS = '123456789abcdefghijklmnopqrstuvwxyz';
const LUM = ' .:-=+*#%@';

function render(name, opts) {
  opts = opts || {};
  const file = path.join(ROOT, 'assets', 'sprites', name + '.png');
  if (!fs.existsSync(file)) { console.log('\n=== ' + name + ' ===  没有这个文件'); return; }
  let im;
  try { im = SK.decodePNG(fs.readFileSync(file)); }
  catch (e) { console.log('\n=== ' + name + ' ===  ' + e.message); return; }

  const tally = {};
  for (let i = 0; i < 64 * 64; i++) {
    const k = i * 4;
    if (!im[k + 3]) continue;
    const hex = '#' + [im[k], im[k + 1], im[k + 2]].map(v => ('0' + v.toString(16)).slice(-2)).join('');
    tally[hex] = (tally[hex] || 0) + 1;
  }
  const top = Object.entries(tally).sort((x, y) => y[1] - x[1]);
  const ch = {};
  top.forEach(([c], i) => ch[c] = MARKS[i] || '?');

  console.log('\n=== ' + name + ' ===  ' + top.length + ' 色');
  if (!opts.a11y) console.log('   ' + top.map(([c, n], i) => (MARKS[i] || '?') + '=' + c + '(' + n + ')').join('  '));
  for (let y = 0; y < 64; y++) {
    let s = '';
    for (let x = 0; x < 64; x++) {
      const k = (y * 64 + x) * 4;
      if (!im[k + 3]) { s += '.'; continue; }
      if (opts.a11y) {
        const l = (0.299 * im[k] + 0.587 * im[k + 1] + 0.114 * im[k + 2]) / 255;
        s += LUM[Math.min(9, Math.round((1 - l) * 9))];
      } else {
        const hex = '#' + [im[k], im[k + 1], im[k + 2]].map(v => ('0' + v.toString(16)).slice(-2)).join('');
        s += ch[hex] || '?';
      }
    }
    console.log('   ' + s);
  }
}

let keys = a.filter(x => !x.startsWith('--'));
if (a.includes('--p0')) keys = P0_SKETCH_KEYS.slice();
else if (a.includes('--p1')) keys = P1_SKETCH_KEYS.filter(k => SPRITE[k]);
else if (a.includes('--all')) keys = Object.keys(SPRITE);
if (!keys.length) keys = Object.keys(SPRITE).slice(0, 4);
const opts = { a11y: a.includes('--a11y') };
keys.forEach(k => render(k, opts));
