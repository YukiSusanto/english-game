#!/usr/bin/env node
/* =========================================================================
   spritekit.js —— 实物像素图绘制工具箱
   -------------------------------------------------------------------------
   配合 tools/make-direction-sprites.js 那套思路做的：
   你已经有 px / rect / line / poly / circle 这套原语了，这个工具箱补上
   三件你每次都要手算、而且算错看不出来的事：

     ① 坐标换算   简笔画是 0~100，实物图是 64×64。SK.u(36) → 23.04，
                  不用再心算「y≈36 大概在 23 像素」。
     ② 自动底稿   把简笔画的封闭区域洪泛填色，得到一个已经对齐的底，
                  在上面改比从白纸开始快得多。
     ③ 出生即验收 每张图 save() 的时候自动做一次对齐自检，
                  不达标就当场报警 —— 不用等攒了 40 张才发现偏了。

   用法（写在自己的生成脚本里）：
     const SK = require('./spritekit.js');
     const im = SK.canvas();
     SK.fillSketch(im, 'door', SK.rgba('#b5763c'));   // 按简笔画填色，天然对齐
     SK.outlineSketch(im, 'door', SK.INK, 3);          // 沿简笔画描墨线
     SK.rect(im, 40, 26, 44, 30, SK.rgba('#e0c060'));  // 再手加细节
     SK.save('door', im);                              // 保存 + 自动验收

   命令行：
     node tools/spritekit.js --bounds door     看某个简笔画的包围盒
     node tools/spritekit.js --base door       生成一张自动底稿到 assets/sprites/_base_door.png
     node tools/spritekit.js --list            列出所有图形 key 和包围盒
     node tools/spritekit.js --check           对齐自检（等价 sprite-align.js）
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ROOT, loadConsts } = require('./_extract.js');

const SKETCH = (loadConsts(['SKETCH'])).SKETCH;

const W = 64, H = 64;
const OUT = path.resolve(ROOT, 'assets', 'sprites');
/* 自动底稿写到单独的目录，别和真素材混在一起 */
const PREVIEW = path.resolve(ROOT, 'assets', '_preview');

/* ---------------- 颜色 ---------------- */
const rgba = hex => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};
const INK = rgba('#21182b');

/* ---------------- 位图 ---------------- */
const canvas = () => new Uint8Array(W * H * 4);

function px(im, x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  im[i] = color[0]; im[i + 1] = color[1]; im[i + 2] = color[2]; im[i + 3] = color[3];
}
function getPx(im, x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return [0, 0, 0, 0];
  const i = (y * W + x) * 4;
  return [im[i], im[i + 1], im[i + 2], im[i + 3]];
}
function rect(im, x0, y0, x1, y1, color) {
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(im, x, y, color);
}
function line(im, x0, y0, x1, y1, color, width) {
  width = width || 1;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    const a = -Math.floor(width / 2), b = Math.ceil(width / 2) - 1;
    for (let oy = a; oy <= b; oy++) for (let ox = a; ox <= b; ox++) px(im, x0 + ox, y0 + oy, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function poly(im, points, color) {
  if (points.length < 3) return;
  const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...points.map(p => p[1]))));
  for (let y = minY; y <= maxY; y++) {
    const hits = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > y) !== (yj > y)) hits.push(xi + (y - yi) * (xj - xi) / (yj - yi));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2)
      for (let x = Math.ceil(hits[i]); x <= Math.floor(hits[i + 1]); x++) px(im, x, y, color);
  }
}
/** 先按轮廓铺墨线再往里收一点填色 —— 出一致的深色描边（和你原脚本同一招） */
function outlinedPoly(im, points, fill, ink) {
  poly(im, points, ink);
  const inner = points.map(([x, y]) => [x + (32 - x) * 0.045, y + (32 - y) * 0.045]);
  poly(im, inner, fill);
}
function circle(im, cx, cy, r, color) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(im, x, y, color);
}
function outlinedCircle(im, cx, cy, r, fill, ink) {
  circle(im, cx, cy, r, ink); circle(im, cx, cy, r - 2, fill);
}

/* =========================================================================
   坐标换算：简笔画 0~100 ↔ 实物图 0~64
   引擎把整张 64×64 画进和简笔画完全相同的正方形，
   所以  像素 = 简笔画坐标 × 0.64
   ========================================================================= */
const u = v => v * W / 100;
const uv = p => [u(p[0]), u(p[1])];
const pts = poly => poly.map(uv);

/** 取某个图形的简笔画（已换算成像素坐标） */
function sketchPx(key) {
  const p = SKETCH[key];
  if (!p) return null;
  return p.map(pts);
}
/** 简笔画的包围盒（0~100 坐标） */
function bounds(key) {
  const p = SKETCH[key];
  if (!p) return null;
  let a = 100, b = -1, c = 100, d = -1;
  p.forEach(poly => poly.forEach(q => {
    if (q[0] < a) a = q[0]; if (q[0] > b) b = q[0];
    if (q[1] < c) c = q[1]; if (q[1] > d) d = q[1];
  }));
  return { minX: a, minY: c, maxX: b, maxY: d, w: b - a, h: d - c };
}

/* ---------------- 描边遮罩 + 内部洪泛 ---------------- */
function maskOf(key, width) {
  width = width || 3;
  const m = new Uint8Array(W * H);
  const polys = sketchPx(key) || sketchPx('__default') || [];
  polys.forEach(p => {
    for (let i = 1; i < p.length; i++) {
      /* 用临时 32 位图不行，直接借 line 的写法往 mask 上打点 */
      let [x0, y0] = p[i - 1].map(Math.round), [x1, y1] = p[i].map(Math.round);
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        const a = -Math.floor(width / 2), b = Math.ceil(width / 2) - 1;
        for (let oy = a; oy <= b; oy++) for (let ox = a; ox <= b; ox++) {
          const X = x0 + ox, Y = y0 + oy;
          if (X >= 0 && Y >= 0 && X < W && Y < H) m[Y * W + X] = 1;
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
  });
  return m;
}
/** mask 里所有「被笔画围住」的像素 */
function insideOf(mask) {
  const outside = new Uint8Array(W * H), st = [];
  const seed = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (outside[i] || mask[i]) return;
    outside[i] = 1; st.push(i);
  };
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
  for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
  while (st.length) {
    const i = st.pop(), x = i % W, y = (i / W) | 0;
    seed(x + 1, y); seed(x - 1, y); seed(x, y + 1); seed(x, y - 1);
  }
  const inside = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) inside[i] = (!mask[i] && !outside[i]) ? 1 : 0;
  return inside;
}

/** ① 自动底稿：按简笔画把封闭区域填上颜色（已经对齐好了，直接在上面改） */
function fillSketch(im, key, color, width) {
  const mask = maskOf(key, width || 3);
  const inside = insideOf(mask);
  for (let i = 0; i < W * H; i++) if (inside[i]) {
    im[i * 4] = color[0]; im[i * 4 + 1] = color[1]; im[i * 4 + 2] = color[2]; im[i * 4 + 3] = color[3];
  }
  return { mask, inside };
}
/** ② 沿简笔画描一圈墨线（保证和线条画完的位置完全贴合） */
function outlineSketch(im, key, color, width) {
  width = width || 3;
  const polys = sketchPx(key) || [];
  polys.forEach(p => {
    for (let i = 1; i < p.length; i++)
      line(im, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], color, width);
  });
}
/** ③ 立体感：内侧靠左上提亮、靠右下压暗 */
function shadeSketch(im, key, hi, lo, width) {
  const mask = maskOf(key, width || 3);
  const inside = insideOf(mask);
  const R = 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!inside[i]) continue;
    let up = false, dn = false, lf = false, rt = false;
    for (let d = 1; d <= R; d++) {
      if (y - d >= 0 && mask[(y - d) * W + x]) up = true;
      if (y + d < H && mask[(y + d) * W + x]) dn = true;
      if (x - d >= 0 && mask[y * W + x - d]) lf = true;
      if (x + d < W && mask[y * W + x + d]) rt = true;
    }
    const tl = (up || lf) && !(dn || rt);
    const br = (dn || rt) && !(up || lf);
    if (tl) { im[i * 4] = hi[0]; im[i * 4 + 1] = hi[1]; im[i * 4 + 2] = hi[2]; }
    else if (br) { im[i * 4] = lo[0]; im[i * 4 + 1] = lo[1]; im[i * 4 + 2] = lo[2]; }
  }
}
/** ④ 剪影描边：沿整张图的外轮廓压一圈墨线
 *
 *  为什么需要它：简笔画是墨线画的，画完变成实物图时如果实物图的外缘是浅色
 *  （皮肤、白大褂、浅蓝连体衣），那圈墨线就被盖掉了，200ms 淡入看起来像
 *  「糊」上一层，而不是「线长成了实物」。实测人物图的外缘只有 27~32% 是墨线，
 *  物件是 37~100%，差别肉眼可见。
 *
 *  做法是「只压外圈，不向外扩张」：沿不透明区域最外一圈像素涂墨，所以
 *  ① 包围盒一个像素都不变 → 对齐自检和缩放比完全不受影响
 *  ② 外缘 100% 是墨线 → 和简笔画的墨线严丝合缝地接上
 *
 *  细的地方（默认 <3px 跨度）跳过，免得一根 1px 的线整根变成黑的。
 *  外圈已经是墨色的像素不动 —— 这样重复调用不会把描边越压越粗，
 *  已经 100% 的图跑一遍等于没跑。
 */
function outlineSilhouette(im, color, opts) {
  color = color || INK;
  opts = opts || {};
  const minThick = opts.minThick == null ? 3 : opts.minThick;
  const src = Uint8Array.from(im);           /* 快照：边读边写会串味 */
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 0;
  const isInk = (x, y) => {
    const i = (y * W + x) * 4;
    return Math.abs(src[i] - color[0]) + Math.abs(src[i + 1] - color[1]) + Math.abs(src[i + 2] - color[2]) < 60;
  };
  /* 在某条轴线上量一下这个特征有多粗 —— 用来判断值不值得压墨 */
  const span = (x, y, dx, dy) => {
    let n = 1;
    for (let s = 1; s < 12 && solid(x + dx * s, y + dy * s); s++) n++;
    for (let s = 1; s < 12 && solid(x - dx * s, y - dy * s); s++) n++;
    return n;
  };
  let painted = 0, edge = 0, already = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!solid(x, y)) continue;
    if (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)) continue;  /* 内部像素 */
    edge++;
    if (isInk(x, y)) { already++; continue; }
    if (Math.max(span(x, y, 1, 0), span(x, y, 0, 1), span(x, y, 1, 1), span(x, y, 1, -1)) < minThick) continue;
    px(im, x, y, color); painted++;
  }
  const covered = already + painted;
  return { edge, painted, already, ratio: edge ? covered / edge : 0 };
}

/** 换色（把某个颜色整体替换，方便批量调色） */
function replace(im, from, to) {
  for (let i = 0; i < W * H; i++) {
    const k = i * 4;
    if (im[k] === from[0] && im[k + 1] === from[1] && im[k + 2] === from[2] && im[k + 3] === from[3]) {
      im[k] = to[0]; im[k + 1] = to[1]; im[k + 2] = to[2]; im[k + 3] = to[3];
    }
  }
}

/* ---------------- PNG 编码（8 位 RGBA，非隔行） ---------------- */
function chunk(type, data) {
  const name = Buffer.from(type);
  const b = Buffer.concat([name, data]);
  let c = 0xffffffff;
  for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  const cc = c ^ 0xffffffff;
  const crc = Buffer.from([(cc >>> 24) & 255, (cc >>> 16) & 255, (cc >>> 8) & 255, cc & 255]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  return Buffer.concat([len, b, crc]);
}
function png(im) {
  const stride = W * 4;
  const raw = Buffer.alloc((stride + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(im.buffer, im.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------------- PNG 解码（8 位、非隔行、RGBA/RGB/灰度） ---------------- */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG 文件');
  let off = 8, ihdr = null; const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    } else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error('缺少 IHDR');
  if (ihdr.interlace) throw new Error('不支持隔行扫描 PNG');
  if (ihdr.depth !== 8) throw new Error('只支持 8 位色深（实际 ' + ihdr.depth + ' 位）');
  const CH = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const ch = CH[ihdr.color];
  if (!ch) throw new Error('不支持的颜色类型 ' + ihdr.color + '（调色板 PNG 请先导出 RGBA）');
  if (ihdr.w !== W || ihdr.h !== H) throw new Error(`尺寸必须是 ${W}×${H}（实际 ${ihdr.w}×${ihdr.h}）`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * ch;
  const dec = Buffer.alloc(ihdr.h * stride);
  let p = 0;
  for (let y = 0; y < ihdr.h; y++) {
    const ft = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = dec.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? dec.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += ((a + b) >> 1);
      else if (ft === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  /* 统一摊成 RGBA 画布 */
  const im = canvas();
  for (let i = 0; i < W * H; i++) {
    const s = i * ch, d = i * 4;
    if (ch === 4) { im[d] = dec[s]; im[d + 1] = dec[s + 1]; im[d + 2] = dec[s + 2]; im[d + 3] = dec[s + 3]; }
    else if (ch === 3) { im[d] = dec[s]; im[d + 1] = dec[s + 1]; im[d + 2] = dec[s + 2]; im[d + 3] = 255; }
    else if (ch === 2) { im[d] = im[d + 1] = im[d + 2] = dec[s]; im[d + 3] = dec[s + 1]; }
    else { im[d] = im[d + 1] = im[d + 2] = dec[s]; im[d + 3] = 255; }
  }
  return im;
}
/** 读回已经存在的实物图（用来批量补描边、调色） */
function load(name) {
  return decodePNG(fs.readFileSync(path.join(OUT, name + '.png')));
}

/* ---------------- 自检：出生即验收 ---------------- */
function analyseBox(im) {
  let minX = W, maxX = -1, minY = H, maxY = -1, opaque = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (im[(y * W + x) * 4 + 3] === 0) continue;
    opaque++;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY, opaque };
}
/** 返回对齐诊断（不改文件）。无论成功失败都返回完整字段，方便调用方直接打印 */
function check(key, im) {
  const blank = { ok: false, why: '', off: 0, rw: 1, rh: 1, coverage: 0 };
  const a = analyseBox(im);
  const sb = bounds(key);
  if (a.maxX < 0) return Object.assign({}, blank, { why: '整张图是全透明的（是不是没画上？）' });
  if (!sb) return Object.assign({}, blank, { why: '找不到对应的简笔画：' + key });
  const T = v => v / W * 100;
  const ib = { minX: T(a.minX), maxX: T(a.maxX), minY: T(a.minY), maxY: T(a.maxY) };
  const offX = ((ib.minX + ib.maxX) - (sb.minX + sb.maxX)) / 2;
  const offY = ((ib.minY + ib.maxY) - (sb.minY + sb.maxY)) / 2;
  const off = Math.hypot(offX, offY);
  const rw = (ib.maxX - ib.minX) / Math.max(1, sb.w);
  const rh = (ib.maxY - ib.minY) / Math.max(1, sb.h);
  const prob = [];
  if (off > 4) prob.push(`中心偏移 ${off.toFixed(1)} 个单位（${(off * W / 100).toFixed(1)}px）`);
  if (rw < 0.85 || rw > 1.25) prob.push(`横向缩放 ${rw.toFixed(2)}×`);
  if (rh < 0.85 || rh > 1.25) prob.push(`纵向缩放 ${rh.toFixed(2)}×`);
  if (a.opaque === 0) prob.push('没有不透明像素');
  return { ok: !prob.length, why: prob.join('；'), off, rw, rh, coverage: a.opaque / (W * H) };
}
/** 保存 + 自动验收。opts.key 指定用哪个图形做对齐基准（默认用文件名）
 *  opts.outline === false 可以关掉自动剪影描边（默认开） */
function save(name, im, opts) {
  opts = opts || {};
  fs.mkdirSync(OUT, { recursive: true });
  const ol = opts.outline === false ? null : outlineSilhouette(im, opts.ink || INK);
  const r = check(opts.key || name, im);
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, png(im));
  if (!opts.quiet) {
    const tag = r.ok ? '✅' : '❌';
    console.log(`${tag} ${name.padEnd(14)} 内容占比 ${(r.coverage * 100).toFixed(0)}%　` +
                `偏移 ${r.off.toFixed(1)}　尺寸 ${r.rw.toFixed(2)}×${r.rh.toFixed(2)}×` +
                (ol ? `　描边 ${(ol.ratio * 100).toFixed(0)}%` : '') +
                (r.ok ? '' : `\n     ${r.why}`));
  }
  return r;
}

/* ---------------- 命令行 ---------------- */
/** 把简笔画在终端里画出来 —— 不开浏览器也能看形状。
    字符高宽比约 2:1，所以横向取 56 格、纵向 28 格，视觉上才是正方形。 */
function ascii(key){
  const polys = SKETCH[key];
  if (!polys) return null;
  const CW = 56, CH = 28;
  const g = [];
  for (let y = 0; y < CH; y++) g.push(new Array(CW).fill(' '));
  const dot = (x, y) => { if (x >= 0 && y >= 0 && x < CW && y < CH) g[y][x] = '#'; };
  polys.forEach(p => {
    for (let i = 1; i < p.length; i++) {
      let x0 = Math.round(p[i - 1][0] / 100 * (CW - 1));
      let y0 = Math.round(p[i - 1][1] / 100 * (CH - 1));
      const x1 = Math.round(p[i][0] / 100 * (CW - 1));
      const y1 = Math.round(p[i][1] / 100 * (CH - 1));
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        dot(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
  });
  return g.map(r => r.join(''));
}

function main() {
  const a = process.argv.slice(2);
  if (a.includes('--ascii')) {
    const k = a[a.indexOf('--ascii') + 1];
    const art = ascii(k);
    if (!art) { console.log('没有这个图形：' + k); process.exit(1); }
    const b = bounds(k);
    console.log(`\n${k}　包围盒 0~100：左${b.minX} 上${b.minY} 右${b.maxX} 下${b.maxY}　宽${b.w} 高${b.h}`);
    console.log('   +' + '-'.repeat(56) + '+');
    art.forEach(r => console.log('   |' + r + '|'));
    console.log('   +' + '-'.repeat(56) + '+');
    return;
  }
  if (a.includes('--dump')) {
    const k = a[a.indexOf('--dump') + 1];
    const polys = SKETCH[k];
    if (!polys) { console.log('没有这个图形：' + k); process.exit(1); }
    const b = bounds(k);
    console.log(`\n// ${k}　包围盒 0~100：左${b.minX} 上${b.minY} 右${b.maxX} 下${b.maxY}`);
    console.log(`// → 64px 像素坐标：(${u(b.minX).toFixed(1)}, ${u(b.minY).toFixed(1)}) 到 (${u(b.maxX).toFixed(1)}, ${u(b.maxY).toFixed(1)})`);
    console.log(`// 共 ${polys.length} 笔，下面直接抄进生成脚本`);
    polys.forEach((p, i) => {
      console.log(`  {{ ${p.map(q => `[${u(q[0]).toFixed(1)},${u(q[1]).toFixed(1)}]`).join(', ')} }},`);
    });
    /* 顺手出一张自动底稿当参考 */
    const im = canvas();
    fillSketch(im, k, rgba('#c98d5a'));
    shadeSketch(im, k, rgba('#ffffff'), rgba('#000000'));
    outlineSketch(im, k, INK, 3);
    fs.mkdirSync(PREVIEW, { recursive: true });
    fs.writeFileSync(path.join(PREVIEW, k + '.png'), png(im));
    console.log(`\n（同时生成了自动底稿 assets/_preview/${k}.png）`);
    return;
  }
  if (a.includes('--list')) {
    const keys = Object.keys(SKETCH).filter(k => k !== '__default').sort();
    console.log('图形 key     包围盒（0~100）              像素（×0.64）');
    console.log('-'.repeat(62));
    keys.forEach(k => {
      const b = bounds(k);
      console.log(`${k.padEnd(12)} 左${String(b.minX).padStart(3)} 上${String(b.minY).padStart(3)} ` +
        `右${String(b.maxX).padStart(3)} 下${String(b.maxY).padStart(3)}   ` +
        `${u(b.minX).toFixed(1)},${u(b.minY).toFixed(1)} → ${u(b.maxX).toFixed(1)},${u(b.maxY).toFixed(1)}`);
    });
    return;
  }
  if (a.includes('--bounds')) {
    const k = a[a.indexOf('--bounds') + 1];
    const b = bounds(k);
    if (!b) { console.log('没有这个图形：' + k); process.exit(1); }
    console.log(`${k} 的包围盒`);
    console.log(`  0~100 坐标   左 ${b.minX}  上 ${b.minY}  右 ${b.maxX}  下 ${b.maxY}  宽 ${b.w} 高 ${b.h}`);
    console.log(`  64×64 像素   左 ${u(b.minX).toFixed(1)}  上 ${u(b.minY).toFixed(1)}  右 ${u(b.maxX).toFixed(1)}  下 ${u(b.maxY).toFixed(1)}`);
    console.log(`  画的时候用   SK.u(${b.minX}) = ${u(b.minX).toFixed(2)} …… 不用心算`);
    return;
  }
  if (a.includes('--base')) {
    const k = a[a.indexOf('--base') + 1];
    if (!SKETCH[k]) { console.log('没有这个图形：' + k); process.exit(1); }
    const im = canvas();
    const col = rgba(a.includes('--color') ? a[a.indexOf('--color') + 1] : '#c98d5a');
    fillSketch(im, k, col);
    shadeSketch(im, k, rgba('#ffffff'), rgba('#000000'));
    outlineSketch(im, k, INK, 3);
    fs.mkdirSync(PREVIEW,{recursive:true});
    const r = (function(){ const q = check(k, im); fs.writeFileSync(path.join(PREVIEW, k + '.png'), png(im)); return q; })();
    console.log(`\n已生成 assets/_preview/${k}.png —— 这是自动底稿，在它上面改比从白纸开始快`);
    console.log(`对齐自检：${r.ok ? '✅ 通过' : '❌ ' + r.why}`);
    return;
  }
  console.log(fs.readFileSync(__filename, 'utf8').split('=====')[1].split('=====')[0]);
}
if (require.main === module) main();

module.exports = {
  W, H, OUT, INK, rgba,
  canvas, px, getPx, rect, line, poly, outlinedPoly, circle, outlinedCircle,
  u, uv, pts, sketchPx, bounds,
  maskOf, insideOf, fillSketch, outlineSketch, shadeSketch, outlineSilhouette, replace,
  png, decodePNG, load, save, check, analyseBox,
  SKETCH
};
