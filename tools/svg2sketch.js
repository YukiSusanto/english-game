#!/usr/bin/env node
/* =========================================================================
   svg2sketch.js —— 把 SVG 线条图标转成《单词画笔》的简笔画格式
   -------------------------------------------------------------------------
   为什么需要它：Feather / Lucide / Tabler / Iconoir 这些免费图标库都是
   24×24 的描边 SVG，风格天生就是「简笔画」。这个脚本把它们变成游戏里
   能直接粘贴的 [[x,y],...] 笔画数组。

   用法：
     node tools/svg2sketch.js icons/ruler.svg
     node tools/svg2sketch.js icons/*.svg --out sketch.txt
     node tools/svg2sketch.js icons/book.svg --key book --res 8 --size 100
     node tools/svg2sketch.js --json icons/*.svg        # 直接输出可粘贴片段

   参数：
     --key NAME    指定图形 key（默认取文件名，去掉 .svg）
     --res N       曲线采样精度，越小越平滑但点越多（默认 6，单位：SVG 用户单位）
     --size N      输出坐标空间，默认 100（游戏约定就是 0~100）
     --pad N       四周留白百分比，默认 6
     --rms N       简化阈值，越大点越少（默认 0.6）
     --json        只输出 `key : [[...]],` 片段，方便直接贴
     --dump        额外打印每笔的点数

   支持的命令：M m L l H h V v C c S s Q q T t Z z（A 弧线按直线近似）
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

/* ---------------- 1. 极简 SVG path 解析 ---------------- */
function tokenize(d) {
  const out = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  let m;
  while ((m = re.exec(d)) !== null) out.push(m[1] || parseFloat(m[2]));
  return out;
}

/** 把 path 的 d 属性展开成 [{x,y}] 折线 */
function pathToPoints(d, res) {
  const tk = tokenize(d);
  const polys = [];
  let cur = null, x = 0, y = 0, sx = 0, sy = 0;
  let i = 0, cmd = null;
  // 上一个控制点（用于 S / T 的隐含反射）
  let lastC = null, lastQ = null, prevCmd = '';

  const push = (px, py) => { if (cur) cur.push([px, py]); };
  const startNew = (px, py) => { cur = [[px, py]]; polys.push(cur); };
  const num = () => tk[i++];

  while (i < tk.length) {
    if (typeof tk[i] === 'string') { cmd = tk[i++]; }
    else if (cmd === 'M') { cmd = 'L'; }
    else if (cmd === 'm') { cmd = 'l'; }
    // 否则沿用上一个命令（隐式重复）
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const bx = rel ? x : 0, by = rel ? y : 0;

    if (C === 'M') {
      x = num() + bx; y = num() + by; sx = x; sy = y;
      startNew(x, y); lastC = lastQ = null;
    } else if (C === 'L') {
      x = num() + bx; y = num() + by; push(x, y); lastC = lastQ = null;
    } else if (C === 'H') {
      x = num() + bx; push(x, y); lastC = lastQ = null;
    } else if (C === 'V') {
      y = num() + by; push(x, y); lastC = lastQ = null;
    } else if (C === 'C' || C === 'S') {
      let x1, y1, x2, y2;
      if (C === 'C') { x1 = num() + bx; y1 = num() + by; }
      else {
        const px = (lastC && /[CS]/.test(prevCmd)) ? 2 * x - lastC[0] : x;
        const py = (lastC && /[CS]/.test(prevCmd)) ? 2 * y - lastC[1] : y;
        x1 = px; y1 = py;
      }
      x2 = num() + bx; y2 = num() + by;
      const nx = num() + bx, ny = num() + by;
      sampleCubic(x, y, x1, y1, x2, y2, nx, ny, res, push);
      lastC = [x2, y2]; x = nx; y = ny; lastQ = null;
    } else if (C === 'Q' || C === 'T') {
      let x1, y1;
      if (C === 'Q') { x1 = num() + bx; y1 = num() + by; }
      else {
        const px = (lastQ && /[QT]/.test(prevCmd)) ? 2 * x - lastQ[0] : x;
        const py = (lastQ && /[QT]/.test(prevCmd)) ? 2 * y - lastQ[1] : y;
        x1 = px; y1 = py;
      }
      const nx = num() + bx, ny = num() + by;
      sampleQuad(x, y, x1, y1, nx, ny, res, push);
      lastQ = [x1, y1]; x = nx; y = ny; lastC = null;
    } else if (C === 'A') {
      const rx = num(), ry = num(), phi = num(), fA = num(), fS = num();
      const nx = num() + bx, ny = num() + by;
      sampleArc(x, y, rx, ry, phi, fA, fS, nx, ny, res, push);
      x = nx; y = ny; lastC = lastQ = null;
    } else if (C === 'Z') {
      push(sx, sy); x = sx; y = sy; cur = null; lastC = lastQ = null;
    } else {
      i++;  // 不认识的命令，跳过
    }
    prevCmd = C;
  }
  return polys.filter(p => p.length >= 2);
}

function sampleCubic(x0, y0, x1, y1, x2, y2, x3, y3, res, push) {
  const len = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
  const n = Math.max(2, Math.min(64, Math.ceil(len / res)));
  for (let k = 1; k <= n; k++) {
    const t = k / n, u = 1 - t;
    push(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
         u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
  }
}
function sampleQuad(x0, y0, x1, y1, x2, y2, res, push) {
  const len = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(2, Math.min(64, Math.ceil(len / res)));
  for (let k = 1; k <= n; k++) {
    const t = k / n, u = 1 - t;
    push(u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2);
  }
}

/* SVG 椭圆弧 → 采样点（端点参数化，W3C 实现说明里的标准算法） */
function sampleArc(x1, y1, rx, ry, phiDeg, fA, fS, x2, y2, res, push) {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) { push(x2, y2); return; }
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (phiDeg % 360) * Math.PI / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;
  let lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den));
  if (fA === fS) co = -co;
  const cxp = co * (rx * y1p / ry);
  const cyp = co * (-ry * x1p / rx);
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const d = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1e-9;
    let a = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / d)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const ux = (x1p - cxp) / rx, uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx, vy = (-y1p - cyp) / ry;
  const th1 = ang(1, 0, ux, uy);
  let dth = ang(ux, uy, vx, vy);
  if (!fS && dth > 0) dth -= 2 * Math.PI;
  if (fS && dth < 0) dth += 2 * Math.PI;
  const arcLen = Math.abs(dth) * Math.max(rx, ry);
  const n = Math.max(3, Math.min(96, Math.ceil(arcLen / res)));
  for (let k = 1; k <= n; k++) {
    const t = th1 + dth * (k / n);
    push(cx + cosP * rx * Math.cos(t) - sinP * ry * Math.sin(t),
         cy + sinP * rx * Math.cos(t) + cosP * ry * Math.sin(t));
  }
}

/* ---------------- 2. 简化（Douglas–Peucker） ---------------- */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = -1, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const L = Math.hypot(dx, dy) || 1e-9;
    for (let k = a + 1; k < b; k++) {
      const [px, py] = pts[k];
      const d = Math.abs((px - ax) * dy - (py - ay) * dx) / L;
      if (d > maxD) { maxD = d; idx = k; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = true; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, k) => keep[k]);
}

/* ---------------- 3. SVG → 归一化笔画 ---------------- */
function svgToPolys(svg, opt) {
  const res = opt.res || 6, pad = opt.pad == null ? 6 : opt.pad, size = opt.size || 100;
  const ds = [];
  // <path d="...">
  for (const m of svg.matchAll(/<path[^>]*\bd\s*=\s*"([^"]+)"/g)) ds.push(m[1]);
  // <line x1 y1 x2 y2>
  for (const m of svg.matchAll(/<line[^>]*\/?>/g)) {
    const t = m[0];
    const g = k => { const r = t.match(new RegExp(k + '\\s*=\\s*"([-\\d.]+)"')); return r ? parseFloat(r[1]) : 0; };
    ds.push(`M${g('x1')} ${g('y1')}L${g('x2')} ${g('y2')}`);
  }
  // <polyline points="x,y x,y">
  for (const m of svg.matchAll(/<polyline[^>]*\bpoints\s*=\s*"([^"]+)"/g)) {
    const pts = m[1].trim().split(/[\s,]+/).map(Number);
    let d = '';
    for (let k = 0; k + 1 < pts.length; k += 2) d += (k ? 'L' : 'M') + pts[k] + ' ' + pts[k + 1];
    if (d) ds.push(d + 'Z');
  }
  // <polygon> / <rect> 也顺手支持
  for (const m of svg.matchAll(/<polygon[^>]*\bpoints\s*=\s*"([^"]+)"/g)) {
    const pts = m[1].trim().split(/[\s,]+/).map(Number);
    let d = '';
    for (let k = 0; k + 1 < pts.length; k += 2) d += (k ? 'L' : 'M') + pts[k] + ' ' + pts[k + 1];
    if (d) ds.push(d + 'Z');
  }
  for (const m of svg.matchAll(/<rect[^>]*\/?>/g)) {
    const t = m[0];
    const g = k => { const r = t.match(new RegExp(k + '\\s*=\\s*"([-\\d.]+)"')); return r ? parseFloat(r[1]) : 0; };
    const x = g('x'), y = g('y'), w = g('width'), h = g('height');
    if (w && h) ds.push(`M${x} ${y}L${x + w} ${y}L${x + w} ${y + h}L${x} ${y + h}Z`);
  }
  for (const m of svg.matchAll(/<circle[^>]*\/?>/g)) {
    const t = m[0];
    const g = k => { const r = t.match(new RegExp(k + '\\s*=\\s*"([-\\d.]+)"')); return r ? parseFloat(r[1]) : 0; };
    const cx = g('cx'), cy = g('cy'), r = g('r');
    if (r) ds.push(`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`);
  }

  let polys = [];
  ds.forEach(d => { polys = polys.concat(pathToPoints(d, res)); });
  if (!polys.length) return [];

  /* 去重 + 简化 */
  polys = polys.map(p => simplify(p, opt.rms == null ? 0.6 : opt.rms)).filter(p => p.length >= 2);

  /* 等比缩放到 0~size，居中 */
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  polys.forEach(p => p.forEach(([x, y]) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }));
  const w = maxX - minX || 1, h = maxY - minY || 1;
  const inner = size * (1 - pad * 2 / 100);
  const k = Math.min(inner / w, inner / h);
  const ox = (size - w * k) / 2 - minX * k, oy = (size - h * k) / 2 - minY * k;
  return polys.map(p => p.map(([x, y]) => [
    Math.round((x * k + ox) * 10) / 10,
    Math.round((y * k + oy) * 10) / 10
  ]));
}

/* ---------------- 4. 输出 ---------------- */
function fmt(key, polys, dump) {
  const lines = polys.map(p => '          ' + JSON.stringify(p));
  if (dump) {
    console.error(`  ${key}: ${polys.length} 笔，点数为 [${polys.map(p => p.length).join(', ')}]`);
  }
  return `  ${key} : [\n${lines.join(',\n')}\n  ],`;
}

function main() {
  const argv = process.argv.slice(2);
  const opt = { size: 100, res: 6, pad: 6, rms: 0.6 };
  const files = [];
  let jsonOnly = false, dump = false, keyOverride = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--key') keyOverride = argv[++i];
    else if (a === '--res') opt.res = parseFloat(argv[++i]);
    else if (a === '--size') opt.size = parseFloat(argv[++i]);
    else if (a === '--pad') opt.pad = parseFloat(argv[++i]);
    else if (a === '--rms') opt.rms = parseFloat(argv[++i]);
    else if (a === '--json') jsonOnly = true;
    else if (a === '--dump') dump = true;
    else if (a === '--out') opt.out = argv[++i];
    else files.push(a);
  }
  if (!files.length) {
    console.log(fs.readFileSync(__filename, 'utf8').split('=====')[1].replace(/^[^\n]*\n/, ''));
    process.exit(0);
  }
  const chunks = [];
  files.forEach(f => {
    let svg;
    try { svg = fs.readFileSync(f, 'utf8'); }
    catch (e) { console.error('读不到文件：' + f); return; }
    const key = keyOverride || path.basename(f).replace(/\.svg$/i, '').replace(/[^A-Za-z0-9_]/g, '_');
    const polys = svgToPolys(svg, opt);
    if (!polys.length) { console.error('⚠ ' + f + ' 里没解析出线条（可能是填充色块图标，不是描边图标）'); return; }
    chunks.push(fmt(key, polys, dump || true));
  });
  const text = chunks.join('\n');
  if (opt.out) { fs.writeFileSync(opt.out, text, 'utf8'); console.log('已写入 ' + opt.out + '（' + chunks.length + ' 个图形）'); }
  else console.log(text);
}
main();
