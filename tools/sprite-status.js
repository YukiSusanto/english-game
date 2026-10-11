#!/usr/bin/env node
/* =========================================================================
   sprite-status.js —— 实物像素图进度表
   -------------------------------------------------------------------------
   用法：
     node tools/sprite-status.js            看进度 + 还缺哪些
     node tools/sprite-status.js --todo     只列还没做的
     node tools/sprite-status.js --p0       只看 P0 那 21 个
     node tools/sprite-status.js --p1       只看 P1 那 57 个
     node tools/sprite-status.js --md       输出 Markdown 表格
     node tools/sprite-status.js --strict   没做完就非 0 退出（可挂 CI）
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const { ROOT, loadConsts } = require('./_extract.js');
const { RAW, SKETCH, SPRITE, P0_SKETCH_KEYS, P1_SKETCH_KEYS } = loadConsts(['RAW','SKETCH','SPRITE','P0_SKETCH_KEYS','P1_SKETCH_KEYS']);

/* P0 清单：唯一来源是 index.html 里的 P0_SKETCH_KEYS */
const P0 = P0_SKETCH_KEYS;
const P1 = P1_SKETCH_KEYS;

/* 每个图形 key → 用到的词 */
const users = {};
for (const u in RAW) for (const r of RAW[u]) (users[r[5]] = users[r[5]] || []).push(r[0]);
const keys = Object.keys(SKETCH).filter(k => k !== '__default').sort();

const args = process.argv.slice(2);
const onlyTodo = args.includes('--todo');
const onlyP0 = args.includes('--p0');
const onlyP1 = args.includes('--p1');
const md = args.includes('--md');

/* 检查登记的图是否真的存在，并读出尺寸 */
function probe(src) {
  if (!src) return { ok: false, why: '未登记真图（用程序化占位图）' };
  if (/^data:image\//.test(src)) {
    // 内嵌 PNG：从 IHDR 里读宽高
    const b64 = src.split(',')[1] || '';
    try {
      const buf = Buffer.from(b64, 'base64');
      if (buf.length > 24 && buf.toString('ascii', 12, 16) === 'IHDR') {
        return { ok: true, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), data: true };
      }
    } catch (e) {}
    return { ok: true, data: true };
  }
  const p = path.isAbsolute(src) ? src : path.join(ROOT, src);
  if (!fs.existsSync(p)) return { ok: false, why: '文件不存在：' + src };
  const buf = fs.readFileSync(p);
  if (buf.toString('ascii', 1, 4) === 'PNG') {
    return { ok: true, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), size: buf.length };
  }
  return { ok: true, w: 0, h: 0, size: buf.length, fmt: '非 PNG（建议用 PNG-32 透明背景）' };
}

let rows = keys.map(k => {
  const src = SPRITE[k] || '';
  const info = probe(src);
  return { key: k, words: users[k] || [], src: src, info: info,
           p0: P0.indexOf(k) >= 0, p1: P1.indexOf(k) >= 0, done: info.ok };
});

if (onlyP0) rows = rows.filter(r => r.p0);
if (onlyP1) rows = rows.filter(r => P1.indexOf(r.key) >= 0);
const total = rows.length;
const done = rows.filter(r => r.done).length;

if (md) {
  console.log('| 图形 key | 对应单词 | 实物图 | 尺寸 | 状态 |');
  console.log('|---|---|---|---|---|');
  rows.filter(r => !onlyTodo || !r.done).forEach(r =>
    console.log(`| \`${r.key}\` | ${r.words.join(' / ')} | ${r.src ? '`' + r.src + '`' : '—'} | ${r.info.w ? r.info.w + '×' + r.info.h : '—'} | ${r.done ? '✅' : '❌ ' + (r.info.why || '未登记')} |`));
  process.exit(0);
}

console.log('实物像素图进度（真图 / 程序化占位图）');
console.log('==========================================');
console.log(`图形总数 ${total}　★真图 ${done}　◆程序化占位 ${total - done}`);
/* P0 只看「真正被名词用到的」那些 —— bathtub 被动词 bath 引用，走动作演出，不需要实物图 */
const p0Needed = P0.filter(k => (users[k] || []).some(w => !/^(clean|help|open|close|lost|find|bath|pass)$/.test(w)));
const p0done = p0Needed.filter(k => SPRITE[k] && probe(SPRITE[k]).ok).length;
const batchKeys = onlyP1 ? P1 : p0Needed;
const batchDone = batchKeys.filter(k => SPRITE[k] && probe(SPRITE[k]).ok).length;
console.log(onlyP1
  ? `  其中 P1（P1_SKETCH_KEYS 清单 ${batchKeys.length} 个）  ★${batchDone}/${batchKeys.length}`
  : `  其中 P0（第一批补的 ${p0Needed.length} 个，动词占用的不算）  ★${p0done}/${p0Needed.length}`);
console.log('==========================================\n');

const show = rows.filter(r => !onlyTodo || !r.done);
if (!show.length) { console.log('🎉 全部都用上真图了！'); process.exit(0); }
show.forEach(r => {
  const batch = r.p0 ? '★P0 ' : (r.p1 ? '★P1 ' : '    ');
  console.log(`${r.done ? '✅' : '❌'} ${batch}${r.key.padEnd(12)} ${r.words.join('/')}`);
  if (r.done) {
    const d = r.info.w ? `${r.info.w}×${r.info.h}` : (r.info.data ? 'dataURL' : '未知尺寸');
    const warn = (r.info.w && (r.info.w !== r.info.h)) ? '  ⚠ 不是正方形' : ((r.info.w && r.info.w !== 64 && r.info.w !== 128) ? '  （建议 64×64）' : '');
    console.log(`      → ${r.src}　${d}${warn}${r.info.fmt ? '  ⚠ ' + r.info.fmt : ''}`);
  } else {
    console.log(`      → 用的还是程序化占位图（已对齐、能看，可升级成真图）`);
  }
});

if (args.includes('--strict')) {
  const left = total - done;
  if (left) { console.error(`\n❌ 还有 ${left} 张用的是程序化占位图`); process.exit(1); }
}
