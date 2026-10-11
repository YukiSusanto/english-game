#!/usr/bin/env node
/* =========================================================================
   artkit.js —— 实物像素图「画笔层」
   -------------------------------------------------------------------------
   spritekit.js 管的是坐标系、PNG、验收；这一层管的是「用 0~100 坐标画画」
   这件手边事：把 u()/P()/L()/R()/poly()/outlined() 这些都包好，
   再给一套统一色板，这样每张图的生成脚本能短到只剩构图本身。

   用法：
     const A = require('./artkit.js');
     const im = A.canvas();
     A.outlined(im, [[22,8],[78,8],[78,92],[22,92]], A.WOOD);
     A.circle(im, 66, 50, 3, A.BRASS);
     A.save('door', im);          // save = spritekit.save（自动压描边 + 出生即验收）
   ========================================================================= */
'use strict';
const SK = require('./spritekit.js');

/* ---------------- 通用色板 ----------------
   少色平涂规范：每张图 4~8 色。这里的颜色按「材质」分组，
   同一件东西在不同图里用同一个色，整包素材看起来才是一套。 */
const C = {
  INK:      '#21182b',   /* 描边墨色，和简笔画一致 */
  /* 木头 */
  WOOD_D:   '#7d4626', WOOD:     '#a9743c', WOOD_L:  '#d99a5c', WOOD_HI: '#eebd85',
  /* 金属 / 灰 */
  METAL_D:  '#5b6670', METAL:    '#8d9aa5', METAL_L: '#c3ced6', METAL_HI:'#e8eff3',
  /* 纸 / 白 */
  PAPER_D:  '#c9cfd6', PAPER:    '#eef2f5', PAPER_HI:'#ffffff',
  /* 玻璃 / 水 */
  GLASS_D:  '#5fa8c9', GLASS:    '#9fd6e6', GLASS_L: '#d4f0fa',
  /* 植物 */
  GREEN_D:  '#4a7c50', GREEN:    '#7fb37f', GREEN_L: '#a8d4a0',
  /* 布 / 塑料，暖色系 */
  RED_D:    '#a8323f', RED:      '#d9534f', RED_L:   '#f08a80',
  BLUE_D:   '#3f6f9e', BLUE:     '#5a95cc', BLUE_L:  '#9dc4e8',
  TEAL_D:   '#2f7d82', TEAL:     '#4b9fa5', TEAL_L:  '#9fd6d9',
  YELLOW_D: '#c49a3f', YELLOW:   '#e6bd62', YELLOW_L:'#f7dfa4',
  PINK_D:   '#b9506b', PINK:     '#e85b83', PINK_L:  '#ff9ab0',
  PURPLE_D: '#5d4a7e', PURPLE:   '#8875ab', PURPLE_L:'#bcabd6',
  /* 吃的 */
  BREAD_D:  '#a86b32', BREAD:    '#d99a52', BREAD_L: '#f2c98a',
  CREAM:    '#ffe7aa', CREAM_HI: '#fff6dd',
  MEAT_D:   '#8c3b32', MEAT:     '#c25a45', MEAT_L:  '#e88a6a',
  /* 皮肤（只用于皮肤，不要拿去当衣服暗面） */
  SKIN_SH:  '#d9a87a', SKIN:     '#f0c9a0', SKIN_HI: '#ffe0c0',
  HAIR_D:   '#3d251e', HAIR:     '#6b422e', HAIR_L:  '#96613f',
  /* 暗色块（黑板、屏幕边框、鞋底） */
  DARK_D:   '#2a2436', DARK:     '#3f3a4d', DARK_L:  '#5c5670'
};
/* 顺手把每个色名也做成 rgba 数组，方便 spritekit 原语直接用 */
const RGBA = {};
for (const k in C) RGBA[k] = SK.rgba(C[k]);

/* ---------------- 坐标换算：0~100 → 64px ---------------- */
const u = v => SK.u(v);
const uv = p => [u(p[0]), u(p[1])];
const pts = poly => poly.map(uv);
const P = pts;

/* hex 字符串比 rgba 数组好写太多，这里缓存一下，免得每画一个点都解析一遍 */
const cache = {};
const col = c => cache[c] || (cache[c] = SK.rgba(c));

/* ---------------- 画笔：全部收 0~100 坐标 ----------------
   注意 line/stroke 的最后一个参数是**笔画宽度（像素）**，不是 0~100 单位 ——
   和简笔画的线宽口径一致，写 3 就是 3px。 */
const canvas = SK.canvas;
const px     = (im, x, y, color) => SK.px(im, u(x), u(y), col(color));
const rect   = (im, x0, y0, x1, y1, color) => SK.rect(im, u(x0), u(y0), u(x1), u(y1), col(color));
const line   = (im, x0, y0, x1, y1, color, w) => SK.line(im, u(x0), u(y0), u(x1), u(y1), col(color), w || 1);
const poly   = (im, points, color) => SK.poly(im, pts(points), col(color));
const circle = (im, cx, cy, r, color) => SK.circle(im, u(cx), u(cy), u(r), col(color));
const oCircle= (im, cx, cy, r, fill, ink) => SK.outlinedCircle(im, u(cx), u(cy), u(r), col(fill), col(ink || C.INK));
const outlined = (im, points, fill, ink) => SK.outlinedPoly(im, pts(points), col(fill), col(ink || C.INK));
/** 一条折线（多段），用同一支笔画完 */
const stroke = (im, points, color, w) => {
  for (let i = 1; i < points.length; i++) line(im, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], color, w);
};

/* ---------------- 常用形状：省掉每次手写顶点 ---------------- */
/** 圆角矩形（用折线切角，少色平涂里够用） */
function roundRect(im, x0, y0, x1, y1, color, cut = 2) {
  const k = cut;
  poly(im, [[x0 + k, y0], [x1 - k, y0], [x1, y0 + k], [x1, y1 - k], [x1 - k, y1], [x0 + k, y1], [x0, y1 - k], [x0, y0 + k]], color);
}
function oRoundRect(im, x0, y0, x1, y1, fill, cut = 2, ink) {
  const k = cut;
  outlined(im, [[x0 + k, y0], [x1 - k, y0], [x1, y0 + k], [x1, y1 - k], [x1 - k, y1], [x0 + k, y1], [x0, y1 - k], [x0, y0 + k]], fill, ink);
}
/** 椭圆（用多边形逼近，比 circle 能拉长） */
function ellipse(im, cx, cy, rx, ry, color, seg = 20) {
  const p = [];
  for (let i = 0; i < seg; i++) {
    const t = i / seg * Math.PI * 2;
    p.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  poly(im, p, color);
}
function oEllipse(im, cx, cy, rx, ry, fill, ink, seg = 20) {
  const p = [];
  for (let i = 0; i < seg; i++) {
    const t = i / seg * Math.PI * 2;
    p.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  outlined(im, p, fill, ink);
}
/** 水平/垂直渐变条：用 3~4 段平涂模拟，不要真渐变 */
function band(im, x0, y0, x1, y1, colors) {
  const n = colors.length, h = (y1 - y0) / n;
  colors.forEach((c, i) => rect(im, x0, y0 + h * i, x1, y0 + h * (i + 1), c));
}

const saveAll = SK.save;
const check = SK.check;

/* 颜色审计：少色平涂规范是 4~8 色。透明不算，
   这里也顺手把「哪几个色超了」列出来，好判断该合并哪几个。 */
function audit(im) {
  const t = {};
  for (let i = 0; i < 64 * 64; i++) {
    const k = i * 4;
    if (!im[k + 3]) continue;
    const hex = '#' + [im[k], im[k + 1], im[k + 2]].map(v => ('0' + v.toString(16)).slice(-2)).join('');
    t[hex] = (t[hex] || 0) + 1;
  }
  return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ hex: c, n }));
}

/** 保存 = spritekit.save（自动压剪影描边 + 出生即验收）+ 颜色数审计。
 *  审计放在**描边之后** —— 描边会往剪影外圈刷墨色，那是实打实多出来的一色，
 *  自测也是按最终 PNG 数颜色的，这里必须和它对上，否则会「看着 8 色、存下来 9 色」。
 *  颜色超了不阻止保存，但会打出来 —— 攒到最后再返工最贵。 */
function save(name, im, opts) {
  const r = saveAll(name, im, opts);
  const cols = audit(im);
  if (!opts || !opts.quiet) {
    const bad = cols.length > 8 ? '  ❌ 颜色超了，砍到 8 色以内：' +
      cols.slice(8).map(c => c.hex + '(' + c.n + ')').join(' ') : '';
    const few = cols.length < 4 ? '  ⚠ 只有 ' + cols.length + ' 色，偏单调' : '';
    console.log('     颜色 ' + cols.length + '　' + cols.slice(0, 9).map(c => c.hex).join(' ') + bad + few);
  }
  r.colors = cols.length;
  return r;
}

module.exports = {
  SK, C, RGBA, u, uv, pts, P,
  canvas, px, rect, line, poly, circle, oCircle, outlined, stroke,
  roundRect, oRoundRect, ellipse, oEllipse, band, save, check, audit
};
