/* =========================================================================
   _extract.js —— 从 index.html 里安全地抽出顶层常量
   -------------------------------------------------------------------------
   为什么不用正则：index.html 的注释里也会出现 `const SPRITE = {` 这种示例，
   正则会被注释骗到，把整个 Art 模块都吞进去。
   这里改成按行扫描：从「行首正好是 const NAME = 」开始，读到「单独一行的 };」为止。
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/** 读出 index.html 里的内联脚本 */
function readCode(){
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
}

/** 抽出顶层常量声明（支持 `const X = {};` / `const X = [];` 单行，以及多行）
    注意两件事，以前都踩过坑：
      ① 等号两边有没有空格都要认（`const SKETCH_COLOR={` 这种也常见）
      ② 结尾既可能是 `};`（对象）也可能是 `];`（数组），只认 `};` 会一路扫到下一个对象结尾，
         把中间一大段别的常量也吞进来 → 重复声明报错
*/
function extractConst(code, name){
  const lines = code.split('\n');
  const head = new RegExp('^const\\s+' + name + '\\s*=\\s*');
  let start = -1;
  for (let i = 0; i < lines.length; i++){
    if (head.test(lines[i])) { start = i; break; }
  }
  if (start < 0) return '';
  const line = lines[start];
  // 单行形式：const SPRITE = {};   /   const X = [];
  if (/[}\]]\s*;\s*$/.test(line)) return line;
  const isArray = /\[\s*$/.test(line);
  const closer = isArray ? '];' : '};';
  for (let i = start + 1; i < lines.length; i++){
    if (lines[i].trim() === closer) return lines.slice(start, i + 1).join('\n');
  }
  return '';
}

/** 一次性取出多个常量，返回 { NAME: 值 } */
function loadConsts(names){
  const code = readCode();
  const parts = names.map(n => extractConst(code, n)).filter(Boolean);
  const sb = { console };
  vm.runInNewContext(parts.join('\n') + '\n' +
    'this.__out = {' + names.map(n => n + ':typeof ' + n + '!=="undefined"?' + n + ':undefined').join(',') + '};', sb);
  return sb.__out;
}

module.exports = { ROOT, readCode, extractConst, loadConsts };
