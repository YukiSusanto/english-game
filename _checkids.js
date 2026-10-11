/* 静态检查脚本：核对 JS 里引用的 DOM id 是否都存在于 index.html（含 JS 动态生成的 id） */
const fs = require('fs');
const path = 'D:\\雪梨英语管理系统\\Game3\\legacy.html';
const html = fs.readFileSync(path, 'utf8');

const ids = new Set();
for (const m of html.matchAll(/id="([A-Za-z0-9_-]+)"/g)) ids.add(m[1]);
for (const m of html.matchAll(/id='([A-Za-z0-9_-]+)'/g)) ids.add(m[1]);

const used = new Set();
for (const m of html.matchAll(/U\.\$\$?\('#([A-Za-z0-9_-]+)/g)) used.add(m[1]);
for (const m of html.matchAll(/\$\('#([A-Za-z0-9_-]+)/g)) used.add(m[1]);

/* 这些按钮已从界面移除（低龄化精简），代码里保留了带空值保护的绑定，
   方便随时把它们加回来。 */
const ALLOW_MISSING = new Set(['spClear', 'spKbd']);

const missing = [...used].filter(u => !ids.has(u) && !ALLOW_MISSING.has(u));
console.log('已定义 id 数:', ids.size);
console.log('被引用 id 数:', used.size);
if (missing.length) {
  console.log('!!! 缺失的 id:');
  missing.sort().forEach(x => console.log('   ', x));
  process.exitCode = 1;
} else {
  console.log('OK: 所有被引用的 id 都存在');
}

/* 附带检查：静态 HTML 中 id 唯一性 */
const dup = {};
for (const m of html.matchAll(/id="([A-Za-z0-9_-]+)"/g)) dup[m[1]] = (dup[m[1]] || 0) + 1;
const dupes = Object.keys(dup).filter(k => dup[k] > 1);
console.log(dupes.length ? '重复 id: ' + dupes.join(', ') : 'OK: id 无重复');

/* 检查 CSS 中使用的 class 是否在 JS/HTML 里出现（只提示图像相关的明显笔误） */
const warn = [];
['.multbox', '.slot', '.tile', '.kbd', '.card', '.node', '.bar', '.pip', '.item', '.chip', '.panel', '.btn']
  .forEach(c => { if (!html.includes(c)) warn.push(c); });
console.log(warn.length ? 'CSS 类名缺失: ' + warn.join(', ') : 'OK: 关键 CSS 类名齐全');
