#!/usr/bin/env node
/* =========================================================================
   sprite-sheet.js —— 生成「简笔画 / 实物图 / 叠加对齐」对照页（HTML）
   -------------------------------------------------------------------------
   这是验收实物像素图的主力工具：不用一个个在游戏里点，一页看完所有图形。
   每行三格：
     [简笔画]  [实物图]  [叠加：红线=简笔画压在实物图上]
   第三格里红线正好贴着实物的轮廓 = 对齐了。

   用法：
     node tools/sprite-sheet.js                  输出 实物图对照表.html
     node tools/sprite-sheet.js --only-missing   只看还没做实物图的
     node tools/sprite-sheet.js --only-done      只看已经做了的
     node tools/sprite-sheet.js --p0             只看 P0 那 21 个
     node tools/sprite-sheet.js --p1             只看 P1 那 57 个
     node tools/sprite-sheet.js --out my.html

   生成的 HTML 是自包含的（图片转成 base64 内嵌），可以直接发给别人看。
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const { ROOT, loadConsts } = require('./_extract.js');
const { RAW, SKETCH, SPRITE, SKETCH_COLOR, P0_SKETCH_KEYS, P1_SKETCH_KEYS } = loadConsts(['RAW','SKETCH','SPRITE','SKETCH_COLOR','P0_SKETCH_KEYS','P1_SKETCH_KEYS']);

/* 和游戏里 Sketch 模块一致的颜色工具 */
function hex2rgb(h){
  h=String(h).replace('#','');
  if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}
function shade(col,f){
  const c=hex2rgb(col);
  const g=v=>Math.max(0,Math.min(255,Math.round(f>0 ? v+(255-v)*f : v*(1+f))));
  return '#'+[g(c[0]),g(c[1]),g(c[2])].map(v=>('0'+v.toString(16)).slice(-2)).join('');
}
const colorOf = k => (SKETCH_COLOR && (SKETCH_COLOR[k] || SKETCH_COLOR.__default)) || '#b0a8c0';

const P0 = P0_SKETCH_KEYS;
const P1 = P1_SKETCH_KEYS;

const argv = process.argv.slice(2);
const onlyMissing = argv.includes('--only-missing');
const onlyDone = argv.includes('--only-done');
const onlyP0 = argv.includes('--p0');
const onlyP1 = argv.includes('--p1');

/* ★ 输出文件名跟着筛选走 —— 以前 --p1 会把它写进「实物图对照表.html」，
   把原本装着全部 97 张的那份悄悄覆盖掉。现在各筛各的，互不影响。 */
function defaultOut(){
  if (onlyP1) return 'P1实物图对照表.html';
  if (onlyP0) return 'P0实物图对照表.html';
  if (onlyMissing) return '实物图对照表_未完成.html';
  if (onlyDone) return '实物图对照表_已完成.html';
  return '实物图对照表.html';
}
const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1]
                                   : path.join(ROOT, defaultOut());

const users = {};
for (const u in RAW) for (const r of RAW[u]) (users[r[5]] = users[r[5]] || []).push(r[0]);

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function imgSrc(src) {
  if (!src) return null;
  if (/^data:/.test(src)) return src;
  const p = path.isAbsolute(src) ? src : path.join(ROOT, src);
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  const mime = buf.toString('ascii', 1, 4) === 'PNG' ? 'image/png' : 'image/jpeg';
  return 'data:' + mime + ';base64,' + buf.toString('base64');
}
function pngSize(buf) {
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  return null;
}

let keys = Object.keys(SKETCH).filter(k => k !== '__default');
/* --p0 只列「真正被名词用到的」P0 图形（bathtub 被动词 bath 占用，走动作演出，不需要实物图） */
if (onlyP0) keys = keys.filter(k => P0.indexOf(k) >= 0 &&
  (users[k] || []).some(w => !/^(clean|help|open|close|lost|find|bath|pass)$/.test(w)));
if (onlyP1) keys = keys.filter(k => P1.indexOf(k) >= 0);
keys = keys.filter(k => {
  const has = !!imgSrc(SPRITE[k]);
  if (onlyMissing) return !has;
  if (onlyDone) return has;
  return true;
});
keys.sort((a, b) => (P0.indexOf(b) >= 0) - (P0.indexOf(a) >= 0) ||
  (P1.indexOf(b) >= 0) - (P1.indexOf(a) >= 0) || a.localeCompare(b));

let cards = '';
let nDone = 0, nMiss = 0;
keys.forEach(k => {
  const polys = SKETCH[k] || [];
  const src = SPRITE[k] || '';
  const dataUrl = imgSrc(src);
  const meta = (() => {
    if (!src) return { txt: '◆ 程序化占位图（未登记真图）', ok: false };
    if (/^data:/.test(src)) return { txt: '★ 真图 · dataURL 内嵌', ok: true };
    const p = path.isAbsolute(src) ? src : path.join(ROOT, src);
    if (!fs.existsSync(p)) return { txt: '⚠ 登记了但文件不存在：' + src, ok: false };
    const buf = fs.readFileSync(p);
    const sz = pngSize(buf);
    return { txt: '★ 真图 · ' + src + (sz ? `　${sz.w}×${sz.h}` : '') + (sz && sz.w !== sz.h ? '　⚠ 不是正方形' : ''), ok: true };
  })();
  if (meta.ok) nDone++; else nMiss++;

  /* 简笔画的 SVG（0~100 视口，直接嵌） */
  const pathD = polys.map(p => 'M ' + p.map(q => q.join(' ')).join(' L ')).join(' ');
  const col = colorOf(k);
  const sketchSvg = `<svg viewBox="-4 -4 108 108" class="cv">
    <rect x="0" y="0" width="100" height="100" fill="#fdf6e5"/>
    <rect x="0" y="0" width="100" height="100" fill="none" stroke="#c8a86a" stroke-width="0.6" stroke-dasharray="4 4"/>
    <path d="${pathD}" fill="none" stroke="#2b2033" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  /* 程序化占位实物图：用 SVG 的 fill-rule 直接把封闭区域填色，
     和游戏里 Sketch.autoReal() 的洪泛填色效果一致（这俩是同一套几何） */
  const autoSvg = `<svg viewBox="0 0 100 100" class="cv">
    <rect x="0" y="0" width="100" height="100" fill="#fdf6e5"/>
    <path d="${pathD}" fill="${col}" fill-rule="evenodd"
      stroke="${shade(col,-0.62)}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${pathD}" fill="none" stroke="${shade(col,-0.62)}" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round" opacity="0.55"/>
  </svg>`;

  const spriteInner = dataUrl
    ? `<img src="${dataUrl}" class="lay pixel" alt="">`
    : autoSvg;
  const spriteCap = dataUrl ? '实物图 ★真图' : '实物图 ◆占位';

  /* 叠加：实物图 + 红线简笔画压在上面 */
  const overInner = dataUrl
    ? `<img src="${dataUrl}" class="lay pixel" alt="">`
    : autoSvg;
  const overSvg = `<div class="cv over">
      ${overInner}
      <svg viewBox="0 0 100 100" class="oline" style="position:absolute;inset:0;width:100%;height:100%">
        <path d="${pathD}" fill="none" stroke="#ff3b30" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>
      </svg>
    </div>`;

  cards += `
  <div class="row ${meta.ok ? 'ok' : 'miss'}">
    <div class="hd">
      <b>${esc(k)}</b>
      <span>${esc((users[k] || []).join(' / '))}</span>
      ${P0.indexOf(k) >= 0 ? '<em>★P0</em>' : ''}
      <small>${esc(meta.txt)}</small>
    </div>
    <div class="pane"><div class="cap">简笔画</div>${sketchSvg}</div>
    <div class="pane"><div class="cap">${spriteCap}</div><div class="cv">${spriteInner}</div></div>
    <div class="pane"><div class="cap">叠加对齐</div>${overSvg}</div>
  </div>`;
});

const page = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>实物像素图 · 对齐对照表</title>
<style>
:root{--ink:#241a2e;--paper:#f7e7c6;--cream:#fff8e8;--gold:#ffd447;}
*{box-sizing:border-box}
body{margin:0;padding:20px;background:var(--ink);color:var(--paper);
  font:14px/1.5 'Courier New',monospace}
h1{color:var(--gold);font-size:22px;margin:0 0 6px}
.sum{opacity:.85;margin-bottom:18px}
.sum b{color:#7bd389}.sum i{color:#ff8f8c;font-style:normal}
.row{display:grid;grid-template-columns:220px 1fr 1fr 1fr;gap:14px;align-items:center;
  padding:12px;margin-bottom:10px;border-radius:10px;background:#2e2340;
  border-left:6px solid #c98a1a}
.row.ok{border-left-color:#2f7d3c}
.hd{display:flex;flex-direction:column;gap:2px}
.hd b{color:var(--gold);font-size:16px}
.hd span{opacity:.8;font-size:12px;word-break:break-all}
.hd em{color:#7bd389;font-style:normal;font-size:12px}
.hd small{opacity:.6;font-size:11px;word-break:break-all}
.pane{display:flex;flex-direction:column;align-items:center;gap:4px}
.cap{font-size:11px;opacity:.65}
.cv{position:relative;width:150px;height:150px;background:#fdf6e5;border-radius:8px;overflow:hidden;
  border:2px solid var(--ink)}
.cv svg{width:100%;height:100%;display:block}
.lay{position:absolute;inset:0;width:100%;height:100%}
.lay.pixel{image-rendering:pixelated}
.nope{display:flex;align-items:center;justify-content:center;color:#a03030;font-size:12px}
.oline{position:absolute;inset:0}
footer{margin-top:24px;opacity:.6;font-size:12px}
@media(max-width:900px){.row{grid-template-columns:1fr 1fr}.hd{grid-column:1/-1}}
</style></head><body>
<h1>实物像素图 · 对齐对照表</h1>
<div class="sum">共 ${keys.length} 个图形　·　<b>★ 真图 ${nDone}</b>　·　<i>◆ 程序化占位 ${nMiss}</i>
　·　<b>第三格的红线是简笔画</b>，贴着实物轮廓 = 对齐了<br>第三格用 SVG 的 fill-rule 直接填色，和游戏里洪泛填色的几何是同一套，所以看到的就是游戏里的效果。</div>
${cards}
<footer>生成命令：<code>node tools/sprite-sheet.js</code>　·　规范见《实物像素图规范.md》</footer>
</body></html>`;

fs.writeFileSync(out, page, 'utf8');
console.log('已生成 ' + out);
console.log(`  ${keys.length} 个图形：★真图 ${nDone}，◆程序化占位 ${nMiss}`);
console.log('  用浏览器打开就能看');
